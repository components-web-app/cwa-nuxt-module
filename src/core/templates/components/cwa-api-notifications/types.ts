export const NotificationLevels = {
  ERROR: 1,
  WARNING: 2,
  INFO: 3
}

export interface Notification {
  title: string
  message: string
  level: number
  code: string
  endpoint?: string
  field?: string
  category?: string
}

export interface TimestampedNotification extends Notification {
  id: number
  timestamp: Date
}

export interface RemoveNotificationEvent {
  code: string
  category?: string
  field?: string
}
