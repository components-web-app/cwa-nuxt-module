export const NotificationLevels = {
  ERROR: 1,
  WARNING: 2,
  INFO: 3
}

export interface NotificationEvent {
  message: string,
  level: number,
  endpoint?: string
}

export interface Notification extends NotificationEvent {
  id: number,
  message: string,
  timestamp: Date,
  level: number
}
