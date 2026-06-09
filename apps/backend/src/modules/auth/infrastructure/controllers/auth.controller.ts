import {
  Controller, Post, Get, Body, Param, Req, Res, HttpCode, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../../application/services/auth.service';
import { RegisterDto } from '../../application/dto/register.dto';
import { LoginDto } from '../../application/dto/login.dto';
import { ForgotPasswordDto } from '../../application/dto/forgot-password.dto';
import { ResetPasswordDto } from '../../application/dto/reset-password.dto';
import { Verify2faDto } from '../../application/dto/verify-2fa.dto';
import { RefreshTokenDto } from '../../application/dto/refresh-token.dto';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Native clients (Capacitor) send this header and store the refresh token themselves. */
  private isNativeClient(req: Request): boolean {
    return req.headers['x-client-platform'] === 'capacitor';
  }

  /** Web gets only the access token (refresh lives in the cookie). Native also gets the refresh token. */
  private tokenResponse(req: Request, accessToken: string, refreshToken: string) {
    return this.isNativeClient(req) ? { accessToken, refreshToken } : { accessToken };
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.register(dto);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return this.tokenResponse(req, accessToken, refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip || req.socket.remoteAddress || '';
    const result = await this.authService.login(dto, ip);

    if ('twoFactorRequired' in result && result.twoFactorRequired) {
      return { twoFactorRequired: true, tempToken: result.tempToken };
    }

    const { accessToken, refreshToken } = result as { accessToken: string; refreshToken: string };
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return this.tokenResponse(req, accessToken, refreshToken);
  }

  @Post('2fa/verify')
  @HttpCode(200)
  async verify2fa(@Body() dto: Verify2faDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.verify2fa(dto.tempToken, dto.code);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return this.tokenResponse(req, accessToken, refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: RefreshTokenDto) {
    await this.authService.logout(req.cookies?.refreshToken ?? body?.refreshToken);
    res.clearCookie('refreshToken', { path: '/' });
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: RefreshTokenDto) {
    const presented = req.cookies?.refreshToken ?? body?.refreshToken;
    const { accessToken, refreshToken } = await this.authService.refresh(presented);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
    return this.tokenResponse(req, accessToken, refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: { sub: string }) {
    return this.authService.getProfile(user.sub);
  }

  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return { message: 'If this email exists, a reset link has been sent.' };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password updated successfully.' };
  }

  @Get('verify-email/:token')
  @HttpCode(200)
  async verifyEmail(@Param('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully.' };
  }
}
