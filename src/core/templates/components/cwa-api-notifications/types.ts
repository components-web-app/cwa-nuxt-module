export const NotificationEvents = {
  add: 'cwa-notification.add',
  remove: 'cwa-notification.remove',
  clear: 'cwa-notification.clear'
}

export const NotificationLevels = {
  ERROR: 1,
  WARNING: 2,
  INFO: 3
}

export interface Notification {
  message: string,
  level: number,
  endpoint?: string,
  field?: string,
  category?: string
}

export interface TimestampedNotification extends Notification {
  id: number,
  timestamp: Date
}
