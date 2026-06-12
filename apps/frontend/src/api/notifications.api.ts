import client from './client';

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'SHARE' | 'EDIT' | 'SYSTEM';
  message: string;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export const notificationsApi = {
  findAll: () => client.get<NotificationItem[]>('/notifications'),
  markAsRead: (id: string) => client.patch<NotificationItem>(`/notifications/${id}/read`),
  markAllAsRead: () => client.patch<{ success: boolean }>('/notifications/read-all'),
  remove: (id: string) => client.delete(`/notifications/${id}`),
};
