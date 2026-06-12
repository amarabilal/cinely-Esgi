import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from '../../domain/entities/activity-log.entity';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityRepository: Repository<ActivityLog>,
  ) {}

  async log(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, any>,
  ): Promise<ActivityLog> {
    const entry = this.activityRepository.create({
      userId,
      action,
      entityType,
      entityId,
      metadata,
    });
    return this.activityRepository.save(entry);
  }

  async findAll(userId: string, limit = 50, offset = 0): Promise<ActivityLog[]> {
    return this.activityRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }
}
