import {
  Controller, Get, Patch, Delete,
  Param, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../shared/guards/jwt.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { NotificationsService } from '../../application/services/notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Retrieve all notifications for the user' })
  findAll(@CurrentUser() user: { sub: string }) {
    return this.notificationsService.findAll(user.sub);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.sub, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @HttpCode(200)
  async markAllAsRead(@CurrentUser() user: { sub: string }) {
    await this.notificationsService.markAllAsRead(user.sub);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a notification' })
  async remove(@CurrentUser() user: { sub: string }, @Param('id') id: string) {
    await this.notificationsService.remove(user.sub, id);
  }
}
