export default class ApiError extends Error {
  constructor (message) {
    super(message)
    this.name = 'ApiError'
  }
}
