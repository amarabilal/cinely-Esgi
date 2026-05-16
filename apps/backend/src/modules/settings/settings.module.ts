import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/domain/entities/user.entity';
import { Session } from '../auth/domain/entities/session.entity';
import { TotpRecoveryCode } from '../auth/domain/entities/totp-recovery-code.entity';
import { SettingsService } from './application/services/settings.service';
import { SettingsController } from './infrastructure/controllers/settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session, TotpRecoveryCode])],
  providers: [SettingsService],
  controllers: [SettingsController],
})
export class SettingsModule {}
