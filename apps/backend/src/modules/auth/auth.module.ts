import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './domain/entities/user.entity';
import { Session } from './domain/entities/session.entity';
import { PasswordResetToken } from './domain/entities/password-reset-token.entity';
import { TotpRecoveryCode } from './domain/entities/totp-recovery-code.entity';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { UserTypeOrmRepository } from './infrastructure/repositories/user.typeorm.repository';
import { AuthService } from './application/services/auth.service';
import { MailService } from './application/services/mail.service';
import { AuthController } from './infrastructure/controllers/auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Session, PasswordResetToken, TotpRecoveryCode]),
    JwtModule.register({}),
  ],
  providers: [
    AuthService,
    MailService,
    { provide: USER_REPOSITORY, useClass: UserTypeOrmRepository },
  ],
  controllers: [AuthController],
})
export class AuthModule {}
