import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { google, Auth } from 'googleapis';
import * as nodemailer from 'nodemailer';
import { User } from '../auth/domain/entities/user.entity';
import { AuthService } from '../auth/application/services/auth.service';

@Injectable()
export class GoogleService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly authService: AuthService,
  ) {}

  private getOAuth2Client(): any {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException('Google OAuth configurations are missing in environment variables');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri) as any;
  }

  getAuthUrl(state: string): string {
    const oauth2Client = this.getOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/gmail.send',
      ],
      state,
    });
  }

  /**
   * Auth URL for the sign-in flow. `platform` is encoded into `state` so the
   * callback knows whether to redirect to the web app or deep-link into the
   * mobile app — same `|mobile` convention the connect flow uses.
   */
  getLoginAuthUrl(platform?: string): string {
    return this.getAuthUrl(platform === 'mobile' ? 'login|mobile' : 'login');
  }

  async handleLoginCallback(code: string): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    const oauth2Client = this.getOAuth2Client();
    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client as any });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email;
      if (!email) {
        throw new BadRequestException('Failed to retrieve email from Google');
      }

      const firstName = userInfo.data.given_name || 'Google';
      const lastName = userInfo.data.family_name || 'User';

      return await this.authService.loginOAuth(email, firstName, lastName, {
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || undefined,
        expiryDate: tokens.expiry_date || undefined,
      });
    } catch (error) {
      throw new BadRequestException(`Failed to login via Google: ${error.message}`);
    }
  }

  async handleCallback(code: string, userId: string): Promise<User> {
    const oauth2Client = this.getOAuth2Client();
    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client as any });
      const userInfo = await oauth2.userinfo.get();
      const googleEmail = userInfo.data.email || null;

      const updateData: Partial<User> = {
        googleAccessToken: tokens.access_token || null,
        googleTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleEmail,
      };

      if (tokens.refresh_token) {
        updateData.googleRefreshToken = tokens.refresh_token;
      }

      await this.userRepository.update(userId, updateData);

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('User not found after OAuth callback');
      }
      return user;
    } catch (error) {
      throw new BadRequestException(`Failed to connect Google account: ${error.message}`);
    }
  }

  async disconnect(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiresAt: null,
      googleEmail: null,
    });
  }

  async getConnectionStatus(userId: string): Promise<{ connected: boolean; email?: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['googleAccessToken', 'googleEmail'],
    });

    if (user && user.googleAccessToken) {
      return { connected: true, email: user.googleEmail || undefined };
    }
    return { connected: false };
  }

  async getAuthenticatedOAuth2Client(userId: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.googleAccessToken) {
      throw new BadRequestException('Google account is not connected');
    }

    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken || undefined,
      expiry_date: user.googleTokenExpiresAt ? user.googleTokenExpiresAt.getTime() : undefined,
    });

    const isExpired = user.googleTokenExpiresAt && user.googleTokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000;
    if (isExpired && user.googleRefreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        const updateData: Partial<User> = {
          googleAccessToken: credentials.access_token || null,
          googleTokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
        };
        if (credentials.refresh_token) {
          updateData.googleRefreshToken = credentials.refresh_token;
        }
        await this.userRepository.update(userId, updateData);
        oauth2Client.setCredentials(credentials);
      } catch (error) {
        throw new BadRequestException(`Failed to refresh Google access token: ${error.message}`);
      }
    }

    return oauth2Client;
  }

  async exportNoteToDrive(userId: string, noteTitle: string, noteContentHtml: string): Promise<string> {
    const auth = await this.getAuthenticatedOAuth2Client(userId);
    const drive = google.drive({ version: 'v3', auth: auth as any });

    const fileMetadata = {
      name: noteTitle || 'Untitled Note',
      mimeType: 'application/vnd.google-apps.document',
    };

    const media = {
      mimeType: 'text/html',
      body: noteContentHtml,
    };

    try {
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id,webViewLink',
      });

      return response.data.webViewLink || '';
    } catch (error) {
      throw new BadRequestException(`Failed to export note to Google Drive: ${error.message}`);
    }
  }

  async createCalendarEvent(
    userId: string,
    eventDetails: { title: string; description: string; start: Date; end: Date },
  ): Promise<string> {
    const auth = await this.getAuthenticatedOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: auth as any });

    const event = {
      summary: eventDetails.title,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.start.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: eventDetails.end.toISOString(),
        timeZone: 'UTC',
      },
    };

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      return response.data.htmlLink || '';
    } catch (error) {
      throw new BadRequestException(`Failed to sync calendar event: ${error.message}`);
    }
  }

  async sendEmail(userId: string, to: string, subject: string, bodyHtml: string): Promise<void> {
    const auth = await this.getAuthenticatedOAuth2Client(userId);
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.googleEmail) {
      throw new BadRequestException('Google account not connected');
    }

    const gmail = google.gmail({ version: 'v1', auth: auth as any });

    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts = [
      `From: <${user.googleEmail}>`,
      `To: <${to}>`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${utf8Subject}`,
      '',
      bodyHtml,
    ];
    const message = messageParts.join('\n');
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
    } catch (error) {
      throw new BadRequestException(`Failed to send email via Gmail: ${error.message}`);
    }
  }

  async listCalendarEvents(userId: string, timeMin?: string, timeMax?: string): Promise<any[]> {
    const auth = await this.getAuthenticatedOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: auth as any });

    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        timeMax: timeMax || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error) {
      throw new BadRequestException(`Failed to list calendar events: ${error.message}`);
    }
  }
}
