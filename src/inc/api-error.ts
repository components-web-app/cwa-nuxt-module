import { Violation } from '../utils/AxiosErrorParser'

export default class ApiError extends Error {
  endpoint?: string
  statusCode: number
  violations: Violation[]
  isCancel: boolean

  constructor(
    message,
    statusCode: number,
    endpoint?: string,
    violations?: Violation[],
    isCancel?: boolean
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.endpoint = endpoint
    this.violations = violations
    this.isCancel = !!isCancel
  }
}
