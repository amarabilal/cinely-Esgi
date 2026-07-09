import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  Req,
  Param,
  Body,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoogleService } from './google.service';
import { JwtAuthGuard } from '../../shared/guards/jwt.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Note } from '../notes/domain/entities/note.entity';

@ApiTags('google')
@Controller('google')
export class GoogleController {
  constructor(
    private readonly googleService: GoogleService,
    private readonly jwtService: JwtService,
    @InjectRepository(Note)
    private readonly noteRepository: Repository<Note>,
  ) {}

  @ApiOperation({ summary: 'Redirects to Google OAuth page for login' })
  @Get('login')
  async loginRedirect(@Res() res: Response) {
    const url = this.googleService.getLoginAuthUrl();
    return res.redirect(url);
  }

  @ApiOperation({ summary: 'Redirects to Google OAuth page' })
  @Get('auth')
  async auth(
    @Query('token') token: string,
    @Query('platform') platform: string,
    @Res() res: Response,
  ) {
    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      const userId = payload.sub;
      // Encode the originating platform in `state` so the callback knows whether
      // to redirect to the web app or deep-link back into the mobile app.
      const state = platform === 'mobile' ? `${userId}|mobile` : userId;
      const url = this.googleService.getAuthUrl(state);
      return res.redirect(url);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  @ApiOperation({ summary: 'Get Google connection status' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getStatus(@CurrentUser() user: { sub: string }) {
    return this.googleService.getConnectionStatus(user.sub);
  }

  @ApiOperation({ summary: 'Disconnect Google account' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('disconnect')
  async disconnect(@CurrentUser() user: { sub: string }) {
    await this.googleService.disconnect(user.sub);
    return { success: true };
  }

  @ApiOperation({ summary: 'Export note to Google Drive' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('export-drive/:noteId')
  async exportToDrive(
    @CurrentUser() user: { sub: string },
    @Param('noteId') noteId: string,
  ) {
    const note = await this.noteRepository.findOne({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (note.userId !== user.sub) {
      throw new ForbiddenException('You do not own this note');
    }

    const webViewLink = await this.googleService.exportNoteToDrive(
      user.sub,
      note.title,
      note.content,
    );

    return { webViewLink };
  }

  @ApiOperation({ summary: 'Sync note to Google Calendar' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('sync-calendar/:noteId')
  async syncToCalendar(
    @CurrentUser() user: { sub: string },
    @Param('noteId') noteId: string,
    @Body() body: { start: string; end: string },
  ) {
    const note = await this.noteRepository.findOne({ where: { id: noteId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (note.userId !== user.sub) {
      throw new ForbiddenException('You do not own this note');
    }

    if (!body.start || !body.end) {
      throw new BadRequestException('Start and end date/times are required');
    }

    const htmlLink = await this.googleService.createCalendarEvent(user.sub, {
      title: note.title || 'Untitled Note Event',
      description: `Synced from Cinely Notes app. \n\nContent:\n${note.content.replace(/<[^>]*>/g, '')}`, // Strip HTML for description
      start: new Date(body.start),
      end: new Date(body.end),
    });

    return { htmlLink };
  }

  @ApiOperation({ summary: 'Send email via Gmail' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('send-email')
  async sendEmail(
    @CurrentUser() user: { sub: string },
    @Body() body: { to: string; subject: string; html: string },
  ) {
    if (!body.to || !body.subject || !body.html) {
      throw new BadRequestException('Recipient (to), subject, and html body are required');
    }
    await this.googleService.sendEmail(user.sub, body.to, body.subject, body.html);
    return { success: true };
  }

  @ApiOperation({ summary: 'List Google Calendar events' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('calendar-events')
  async listEvents(
    @CurrentUser() user: { sub: string },
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
  ) {
    return this.googleService.listCalendarEvents(user.sub, timeMin, timeMax);
  }
}

// Controller mapped under /api/google/callback (uses standard /api prefix)
@Controller('google')
export class GoogleCallbackController {
  constructor(private readonly googleService: GoogleService) {}

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new UnauthorizedException('Invalid Google OAuth callback parameters');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (state === 'login') {
      try {
        const tokens = await this.googleService.handleLoginCallback(code);

        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax' as const,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/',
        };

        res.cookie('refreshToken', tokens.refreshToken, cookieOptions);
        return res.redirect(`${frontendUrl}/login?google_login=success&token=${tokens.accessToken}`);
      } catch (error) {
        return res.redirect(`${frontendUrl}/login?google_login=error&message=${encodeURIComponent(error.message)}`);
      }
    } else {
      // Account-connect flow. `state` is the userId, optionally suffixed with
      // `|mobile` when the request originated from the React Native app — in
      // which case we deep-link back into the app instead of the web frontend.
      const [userId, platform] = state.split('|');
      const isMobile = platform === 'mobile';
      try {
        await this.googleService.handleCallback(code, userId);
        return res.redirect(
          isMobile
            ? 'cinely://google?google_connected=success'
            : `${frontendUrl}/settings?google_connected=success`,
        );
      } catch (error) {
        const message = encodeURIComponent(error.message);
        return res.redirect(
          isMobile
            ? `cinely://google?google_connected=error&message=${message}`
            : `${frontendUrl}/settings?google_connected=error&message=${message}`,
        );
      }
    }
  }
}
