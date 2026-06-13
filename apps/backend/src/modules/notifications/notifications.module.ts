import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './domain/entities/notification.entity';
import { DeviceToken } from './domain/entities/device-token.entity';
import { NotificationsService } from './application/services/notifications.service';
import { NotificationsController } from './infrastructure/controllers/notifications.controller';
import { DevicesController } from './infrastructure/controllers/devices.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Notification, DeviceToken])],
  controllers: [NotificationsController, DevicesController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
