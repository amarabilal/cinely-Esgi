import {
  Controller, Get, Put, Post, Delete, Body, Param, Query, HttpCode, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { SettingsService } from '../../application/services/settings.service';
import { UpdateProfileDto } from '../../application/dto/update-profile.dto';
import { ChangePasswordDto } from '../../application/dto/change-password.dto';
import { TotpVerifyDto } from '../../application/dto/totp-verify.dto';
import { SubscriptionService } from '../../application/services/subscription.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Get('profile')
  getProfile(@CurrentUser() user: { sub: string }) {
    return this.settingsService.getProfile(user.sub);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: { sub: string }, @Body() dto: UpdateProfileDto) {
    return this.settingsService.updateProfile(user.sub, dto);
  }

  @Put('password')
  @HttpCode(204)
  changePassword(@CurrentUser() user: { sub: string }, @Body() dto: ChangePasswordDto) {
    return this.settingsService.changePassword(user.sub, dto);
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: { sub: string }) {
    return this.settingsService.listSessions(user.sub);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  revokeSession(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.settingsService.revokeSession(user.sub, id);
  }

  @Post('2fa/setup')
  setupTotp(@CurrentUser() user: { sub: string }) {
    return this.settingsService.setupTotp(user.sub);
  }

  @Post('2fa/enable')
  enableTotp(@CurrentUser() user: { sub: string }, @Body() dto: TotpVerifyDto) {
    return this.settingsService.enableTotp(user.sub, dto);
  }

  @Post('2fa/disable')
  disableTotp(@CurrentUser() user: { sub: string }, @Body() dto: TotpVerifyDto) {
    return this.settingsService.disableTotp(user.sub, dto);
  }

  @Get('subscription')
  getSubscription(
    @CurrentUser() user: { sub: string },
    @Query('sessionId') sessionId?: string,
  ) {
    return this.subscriptionService.getStatus(user.sub, sessionId);
  }

  @Post('subscription/checkout')
  createSubscriptionCheckout(@CurrentUser() user: { sub: string }) {
    return this.subscriptionService.createCheckoutSession(user.sub);
  }
}
