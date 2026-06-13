import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../../domain/entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async findAll(userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    userId: string,
    type: NotificationType,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId,
      type,
      message,
      read: false,
      metadata,
    });
    return this.notificationRepository.save(notification);
  }

  async markAsRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    notification.read = true;
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update({ userId, read: false }, { read: true });
  }

  async remove(userId: string, id: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    await this.notificationRepository.remove(notification);
  }
}
