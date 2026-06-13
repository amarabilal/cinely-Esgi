import {
  Controller, Post, Delete, Body, Param, HttpCode, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { NotificationsService } from '../../application/services/notifications.service';
import { RegisterDeviceDto } from '../../application/dto/register-device.dto';

@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a push device token for the current user' })
  async register(
    @CurrentUser() user: { sub: string },
    @Body() dto: RegisterDeviceDto,
  ) {
    await this.notifications.registerToken(user.sub, dto.token, dto.platform);
    return { ok: true };
  }

  @Delete(':token')
  @HttpCode(204)
  @ApiOperation({ summary: 'Unregister a push device token' })
  async unregister(@Param('token') token: string) {
    await this.notifications.removeToken(token);
  }
}
