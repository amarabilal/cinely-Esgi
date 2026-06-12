import client from './client';

export interface ActivityItem {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export const activityApi = {
  findAll: (limit = 50, offset = 0) =>
    client.get<ActivityItem[]>('/activity', { params: { limit, offset } }),
};
