export default class CustomError extends Error {
  constructor () {
    super('This is a custom error message that we can throw...')
    this.name = 'CustomError'
  }
}
