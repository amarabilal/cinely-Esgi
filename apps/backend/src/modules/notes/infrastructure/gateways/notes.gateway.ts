import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect,
  MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../auth/domain/entities/user.entity';
import { NotesService } from '../../application/services/notes.service';

interface UserPresence {
  userId: string;
  userName: string;
  color: string;

  permissions: Record<string, 'OWNER' | 'READ' | 'WRITE'>;

  ready?: Promise<void>;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899'];

function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

@WebSocketGateway({
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://localhost',
      'capacitor://localhost',
      'http://localhost',
    ],
    credentials: true,
  },
})
export class NotesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => NotesService)) private readonly notesService: NotesService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) { client.disconnect(); return; }

    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      client.disconnect();
      return;
    }

    const presence: UserPresence = {
      userId: payload.sub,
      userName: 'User',
      color: colorFor(payload.sub),
      permissions: {},
    };
    client.data = presence;
    client.join(`user:${payload.sub}`);

    presence.ready = (async () => {
      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user) { client.disconnect(); return; }
      presence.userName = `${user.firstName} ${user.lastName}`;
    })();
  }

  async handleDisconnect(client: Socket) {
    const ud = client.data as UserPresence | undefined;
    if (!ud) return;
    for (const room of client.rooms) {
      if (room === client.id) continue;
      this.server.to(room).emit('user_left', { userId: ud.userId });
    }
  }

  @SubscribeMessage('join_note')
  async joinNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    const ud = client.data as UserPresence;
    await ud.ready?.catch(() => {});
    let permission: 'OWNER' | 'READ' | 'WRITE';
    try {
      permission = await this.notesService.getPermission(ud.userId, data.noteId);
    } catch {
      return { error: 'Access denied' };
    }

    ud.permissions[data.noteId] = permission;

    await client.join(`note:${data.noteId}`);
    client.to(`note:${data.noteId}`).emit('user_joined', {
      userId: ud.userId,
      userName: ud.userName,
      color: ud.color,
    });

    const sockets = await this.server.in(`note:${data.noteId}`).fetchSockets();
    const others = sockets
      .filter(s => s.id !== client.id)
      .map(s => {
        const d = s.data as UserPresence;
        return { userId: d.userId, userName: d.userName, color: d.color };
      });

    return { users: others };
  }

  @SubscribeMessage('leave_note')
  leaveNote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string },
  ) {
    const ud = client.data as UserPresence;
    delete ud.permissions[data.noteId];
    client.leave(`note:${data.noteId}`);
    client.to(`note:${data.noteId}`).emit('user_left', { userId: ud.userId });
  }

  @SubscribeMessage('note_update')
  handleNoteUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string; title: string; content: string; json?: object; from?: number; to?: number },
  ) {
    const ud = client.data as UserPresence;
    const permission = ud.permissions[data.noteId];
    if (!permission || permission === 'READ') return;

    client.to(`note:${data.noteId}`).emit('note_updated', {
      noteId: data.noteId,
      title: data.title,
      content: data.content,
      json: data.json,
      from: data.from,
      to: data.to,
      userId: ud.userId,
      userName: ud.userName,
      color: ud.color,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('cursor_update')
  handleCursorUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { noteId: string; from: number; to: number },
  ) {
    const ud = client.data as UserPresence;

    if (!ud.permissions[data.noteId] || ud.permissions[data.noteId] === 'READ') return;

    client.to(`note:${data.noteId}`).emit('cursor_updated', {
      noteId: data.noteId,
      userId: ud.userId,
      userName: ud.userName,
      color: ud.color,
      from: data.from,
      to: data.to,
    });
  }

  emitTagsUpdated(noteId: string, tags: Array<{ id: string; name: string; color: string }>) {
    this.server.to(`note:${noteId}`).emit('note_tags_updated', { noteId, tags });
  }

  emitNoteDeleted(noteId: string) {
    this.server.to(`note:${noteId}`).emit('note_deleted', { noteId });
  }

  emitNoteArchived(noteId: string) {
    this.server.to(`note:${noteId}`).emit('note_archived', { noteId });
  }

  async emitPermissionChanged(noteId: string, targetUserId: string, permission: 'READ' | 'WRITE') {

    const sockets = await this.server.in(`note:${noteId}`).fetchSockets();
    for (const s of sockets) {
      const ud = s.data as UserPresence;
      if (ud?.userId === targetUserId) {
        ud.permissions[noteId] = permission;
      }
    }
    this.server.to(`note:${noteId}`).emit('permission_changed', { noteId, userId: targetUserId, permission });
  }

  async emitShareRevoked(noteId: string, targetUserId: string) {

    const sockets = await this.server.in(`note:${noteId}`).fetchSockets();
    for (const s of sockets) {
      const ud = s.data as UserPresence;
      if (ud?.userId === targetUserId) {
        delete ud.permissions[noteId];
      }
    }
    this.server.to(`note:${noteId}`).emit('share_revoked', { noteId, userId: targetUserId });
  }

  sendNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }
}
