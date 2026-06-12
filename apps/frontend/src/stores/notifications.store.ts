import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { notificationsApi, type NotificationItem } from '@/api/notifications.api';

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<NotificationItem[]>([]);
  const loading = ref(false);

  const unreadCount = computed(() => notifications.value.filter(n => !n.read).length);

  async function fetchNotifications() {
    loading.value = true;
    try {
      const { data } = await notificationsApi.findAll();
      notifications.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function markAsRead(id: string) {
    const { data } = await notificationsApi.markAsRead(id);
    const idx = notifications.value.findIndex(n => n.id === id);
    if (idx !== -1) {
      notifications.value[idx] = data;
    }
  }

  async function markAllAsRead() {
    await notificationsApi.markAllAsRead();
    notifications.value = notifications.value.map(n => ({ ...n, read: true }));
  }

  async function deleteNotification(id: string) {
    await notificationsApi.remove(id);
    notifications.value = notifications.value.filter(n => n.id !== id);
  }

  function addNotification(notification: NotificationItem) {
    if (notifications.value.some(n => n.id === notification.id)) return;
    notifications.value.unshift(notification);
  }

  return {
    notifications,
    loading,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
  };
});
