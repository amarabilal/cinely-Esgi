import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt.guard';
import { TotpService } from './services/totp.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtAuthGuard, TotpService],
  exports: [JwtAuthGuard, JwtModule, TotpService],
})
export class SharedModule {}
