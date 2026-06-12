import {
  Injectable, Inject, ConflictException, UnauthorizedException,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { IUserRepository, USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/entities/user.entity';
import { Session } from '../../domain/entities/session.entity';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity';
import { TotpRecoveryCode } from '../../domain/entities/totp-recovery-code.entity';
import { TotpService } from '../../../../shared/services/totp.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { MailService } from './mail.service';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const PASSWORD_EXPIRY_DAYS = 60;
const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @InjectRepository(Session) private readonly sessionRepository: Repository<Session>,
    @InjectRepository(PasswordResetToken) private readonly resetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(TotpRecoveryCode) private readonly recoveryCodeRepository: Repository<TotpRecoveryCode>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly totpService: TotpService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password);
    const passwordExpiresAt = new Date();
    passwordExpiresAt.setDate(passwordExpiresAt.getDate() + PASSWORD_EXPIRY_DAYS);

    const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const emailVerificationToken = this.hashToken(verificationToken);
    const emailVerificationExpiresAt = new Date();
    emailVerificationExpiresAt.setHours(emailVerificationExpiresAt.getHours() + 24);

    const user = await this.userRepository.save({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordExpiresAt,
      emailVerificationToken,
      emailVerificationExpiresAt,
    });

    this.mailService.sendEmailVerification(user.email, verificationToken).catch(() => {});

    return this.createTokenPair(user.id, user.email);
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const user = await this.userRepository.findByEmailVerificationToken(tokenHash);
    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    await this.userRepository.update(user.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    });
  }

  async login(dto: LoginDto, ipAddress: string) {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new ForbiddenException(`Account locked. Try again in ${minutesLeft} minutes`);
    }

    const isValid = await argon2.verify(user.passwordHash, dto.password);

    if (!isValid) {
      const attempts = user.loginAttempts + 1;
      const update: any = { loginAttempts: attempts };
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date();
        lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCK_DURATION_MINUTES);
        update.lockedUntil = lockedUntil;
      }
      await this.userRepository.update(user.id, update);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userRepository.update(user.id, { loginAttempts: 0, lockedUntil: null });

    if (user.passwordExpiresAt < new Date()) {
      throw new ForbiddenException('PASSWORD_EXPIRED');
    }

    if (user.totpEnabled) {
      const tempToken = this.jwtService.sign(
        { sub: user.id, scope: '2fa' },
        { expiresIn: '5m', secret: process.env.JWT_ACCESS_SECRET },
      );
      return { twoFactorRequired: true as const, tempToken };
    }

    return this.createTokenPair(user.id, user.email);
  }

  async verify2fa(tempToken: string, code: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(tempToken, { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (payload.scope !== '2fa') throw new UnauthorizedException('Invalid token scope');

    const user = await this.userRepository.findById(payload.sub);
    if (!user || !user.totpEnabled || !user.totpSecret) throw new UnauthorizedException();

    if (this.totpService.verify(user.totpSecret, code)) {
      return this.createTokenPair(user.id, user.email);
    }

    const normalizedCode = code.toUpperCase().replace(/[-\s]/g, '');
    const codeHash = this.hashToken(normalizedCode);
    const recovery = await this.recoveryCodeRepository.findOne({
      where: { userId: user.id, codeHash, usedAt: null },
    });
    if (!recovery) throw new UnauthorizedException('Invalid 2FA code');
    await this.recoveryCodeRepository.update(recovery.id, { usedAt: new Date() });

    return this.createTokenPair(user.id, user.email);
  }

  async logout(sessionToken: string) {
    if (!sessionToken) return;
    const tokenHash = this.hashToken(sessionToken);
    const session = await this.sessionRepository.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });
    if (session) {
      await this.sessionRepository.update(session.id, { revokedAt: new Date() });
    }
  }

  async refresh(sessionToken: string) {
    if (!sessionToken) throw new UnauthorizedException();
    const tokenHash = this.hashToken(sessionToken);
    const session = await this.sessionRepository.findOne({
      where: { tokenHash, revokedAt: IsNull() },
      relations: ['user'],
    });
    if (!session || session.expiresAt < new Date()) throw new UnauthorizedException('Session expired');
    await this.sessionRepository.update(session.id, { revokedAt: new Date() });
    return this.createTokenPair(session.userId, session.user.email);
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) return;

    // Invalidate all previous unused tokens before creating a new one
    await this.resetTokenRepository.update(
      { userId: user.id, usedAt: null },
      { usedAt: new Date() },
    );

    const token = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.resetTokenRepository.save({ userId: user.id, tokenHash, expiresAt, usedAt: null });
    await this.mailService.sendPasswordReset(user.email, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    const resetToken = await this.resetTokenRepository.findOne({
      where: { tokenHash, usedAt: null },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    const passwordHash = await argon2.hash(newPassword);
    const passwordExpiresAt = new Date();
    passwordExpiresAt.setDate(passwordExpiresAt.getDate() + PASSWORD_EXPIRY_DAYS);

    await this.userRepository.update(resetToken.userId, { passwordHash, passwordExpiresAt });
    await this.resetTokenRepository.update(resetToken.id, { usedAt: new Date() });
  }

  async loginOAuth(
    email: string,
    firstName: string,
    lastName: string,
    googleTokens: {
      accessToken: string;
      refreshToken?: string;
      expiryDate?: number;
    },
  ) {
    let user = await this.userRepository.findByEmail(email);

    if (!user) {
      const placeholderPassword = crypto.randomUUID();
      const passwordHash = await argon2.hash(placeholderPassword);
      const passwordExpiresAt = new Date();
      passwordExpiresAt.setDate(passwordExpiresAt.getDate() + PASSWORD_EXPIRY_DAYS);

      user = await this.userRepository.save({
        email,
        passwordHash,
        firstName: firstName || 'Google',
        lastName: lastName || 'User',
        passwordExpiresAt,
        isEmailVerified: true,
      });
    }

    const updateData: Partial<User> = {
      googleAccessToken: googleTokens.accessToken,
      googleEmail: email,
      isEmailVerified: true,
      loginAttempts: 0,
      lockedUntil: null,
    };

    if (googleTokens.refreshToken) {
      updateData.googleRefreshToken = googleTokens.refreshToken;
    }
    if (googleTokens.expiryDate) {
      updateData.googleTokenExpiresAt = new Date(googleTokens.expiryDate);
    }

    await this.userRepository.update(user.id, updateData);

    return this.createTokenPair(user.id, user.email);
  }

  private async createTokenPair(userId: string, email: string) {
    const accessToken = this.jwtService.sign(
      { sub: userId, email },
      { expiresIn: '15m', secret: process.env.JWT_ACCESS_SECRET },
    );
    const refreshToken = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
    await this.sessionRepository.save({ userId, tokenHash, expiresAt, revokedAt: null });
    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
