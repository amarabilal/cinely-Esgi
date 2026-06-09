import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './domain/entities/device-token.entity';
import { NotificationsService } from './application/services/notifications.service';
import { DevicesController } from './infrastructure/controllers/devices.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken])],
  providers: [NotificationsService],
  controllers: [DevicesController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
