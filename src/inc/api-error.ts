import { Violation } from '../utils/AxiosErrorParser'

export default class ApiError extends Error {
  endpoint?: string
  statusCode: number
  violations: Violation[]

  constructor(
    message,
    statusCode: number,
    endpoint?: string,
    violations?: Violation[]
  ) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.endpoint = endpoint
    this.violations = violations
  }
}
