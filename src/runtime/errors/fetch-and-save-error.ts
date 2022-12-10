export default class FetchAndSaveError extends Error {
  public readonly originalError: any

  constructor (message: string, originalError: any) {
    super(message)
    this.name = 'FetchAndSaveError'
    this.originalError = originalError
  }
}
