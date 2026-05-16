import {
  Injectable, UnauthorizedException, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { User } from '../../../auth/domain/entities/user.entity';
import { Session } from '../../../auth/domain/entities/session.entity';
import { TotpRecoveryCode } from '../../../auth/domain/entities/totp-recovery-code.entity';
import { TotpService } from '../../../../shared/services/totp.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { TotpVerifyDto } from '../dto/totp-verify.dto';

const PASSWORD_EXPIRY_DAYS = 60;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
    @InjectRepository(TotpRecoveryCode) private readonly recoveryCodeRepo: Repository<TotpRecoveryCode>,
    private readonly totpService: TotpService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      totpEnabled: user.totpEnabled,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.userRepo.update(userId, { firstName: dto.firstName, lastName: dto.lastName });
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) throw new BadRequestException('Current password is incorrect');
    const passwordHash = await argon2.hash(dto.newPassword);
    const passwordExpiresAt = new Date();
    passwordExpiresAt.setDate(passwordExpiresAt.getDate() + PASSWORD_EXPIRY_DAYS);
    await this.userRepo.update(userId, { passwordHash, passwordExpiresAt });
  }

  async listSessions(userId: string) {
    const now = new Date();
    const sessions = await this.sessionRepo.find({
      where: { userId, revokedAt: null },
      order: { createdAt: 'DESC' },
    });
    return sessions
      .filter(s => s.expiresAt > now)
      .map(s => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId, revokedAt: null },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.sessionRepo.update(sessionId, { revokedAt: new Date() });
  }

  async setupTotp(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const secret = this.totpService.generateSecret();
    const uri = this.totpService.buildUri(secret, user.email);
    const qrDataUrl = await this.totpService.generateQrDataUrl(uri);
    await this.userRepo.update(userId, { totpSecret: secret });
    return { secret, qrDataUrl };
  }

  async enableTotp(userId: string, dto: TotpVerifyDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.totpSecret) throw new BadRequestException('Run 2FA setup first');
    if (!this.totpService.verify(user.totpSecret, dto.code)) {
      throw new BadRequestException('Invalid 2FA code');
    }
    await this.userRepo.update(userId, { totpEnabled: true });

    await this.recoveryCodeRepo.delete({ userId });
    const codes = Array.from({ length: 8 }, () => this.generateRecoveryCode());
    await this.recoveryCodeRepo.save(
      codes.map(c => ({ userId, codeHash: c.hash, usedAt: null })),
    );

    return { message: '2FA enabled', recoveryCodes: codes.map(c => c.display) };
  }

  async disableTotp(userId: string, dto: TotpVerifyDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.totpEnabled || !user.totpSecret) throw new BadRequestException('2FA is not enabled');
    if (!this.totpService.verify(user.totpSecret, dto.code)) {
      throw new BadRequestException('Invalid 2FA code');
    }
    await this.userRepo.update(userId, { totpEnabled: false, totpSecret: null });
    await this.recoveryCodeRepo.delete({ userId });
    return { message: '2FA disabled' };
  }

  private generateRecoveryCode(): { display: string; hash: string } {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    const display = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { display, hash };
  }
}
