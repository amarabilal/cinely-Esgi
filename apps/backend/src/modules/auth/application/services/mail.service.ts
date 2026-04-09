import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'localhost',
    port: Number(process.env.MAIL_PORT) || 1025,
    ignoreTLS: true,
  });

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const url = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await this.transporter.sendMail({
      from: '"Notes App" <noreply@notes.app>',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset.</p>
        <p><a href="${url}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
      `,
    });
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    const url = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    await this.transporter.sendMail({
      from: '"Notes App" <noreply@notes.app>',
      to: email,
      subject: 'Verify your email address',
      html: `
        <p>Welcome to Notes App! Please verify your email address.</p>
        <p><a href="${url}">Click here to verify your email</a></p>
        <p>This link expires in 24 hours. If you did not create an account, ignore this email.</p>
      `,
    });
  }
}
