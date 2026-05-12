import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Note } from './note.entity';
import { User } from '../../../auth/domain/entities/user.entity';

export type SharePermission = 'READ' | 'WRITE';

@Entity('note_shares')
@Unique(['noteId', 'sharedWithId'])
export class NoteShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'note_id' })
  noteId: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: Note;

  @Column({ name: 'shared_with_id' })
  sharedWithId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'shared_with_id' })
  sharedWith: User;

  @Column({ type: 'enum', enum: ['READ', 'WRITE'], default: 'READ' })
  permission: SharePermission;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
