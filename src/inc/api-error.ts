export default class ApiError extends Error {
  endpoint?: string;
  statusCode: number;

  constructor (message, statusCode: number, endpoint?: string) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.endpoint = endpoint
  }
}
