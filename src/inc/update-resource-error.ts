import { NotificationEvent } from '../core/templates/components/cwa-api-notifications/types'
import ApiError from './api-error'

export default class UpdateResourceError extends Error {
  apiError: ApiError
  noticications: NotificationEvent[]

  constructor(message, apiError: ApiError, notifications: NotificationEvent[]) {
    super(message)
    this.name = 'UpdateResourceError'
    this.apiError = apiError
    this.noticications = notifications
  }
}
