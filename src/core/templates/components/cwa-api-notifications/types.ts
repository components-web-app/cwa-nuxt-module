export const NotificationLevels = {
  ERROR: 1,
  WARNING: 2,
  INFO: 3
}

export interface NotificationEvent {
  title: string
  message: string
  level: number
  code: string
  endpoint?: string
  field?: string
  category?: string
}

export interface TimestampedNotification extends NotificationEvent {
  id: number
  timestamp: Date
}

export interface RemoveNotificationEvent {
  code: string
  category?: string
  field?: string
  endpoint?: string
}
