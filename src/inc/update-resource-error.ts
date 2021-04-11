export default class UpdateResourceError extends Error {
  constructor(message) {
    super(message)
    this.name = 'UpdateResourceError'
  }
}
