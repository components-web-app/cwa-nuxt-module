export interface CwaResourceErrorObject {
  message?: string
  statusCode?: number
  statusMessage?: string
  statusText?: string
  primaryMessage: string
}

export class CwaResourceError extends Error {
  name = 'CwaResourceError' as const
  statusCode?: number
  statusMessage?: string
  statusText?: string
  asObject?: CwaResourceErrorObject
  primaryMessage?: string
}

export function createCwaResourceError (error: any) {
  let message = error?.message
  if (!message || message === '') {
    message = 'An unknown error occurred'
  }
  const cwaResourceError = new CwaResourceError(message)
  Object.defineProperty(cwaResourceError, 'statusCode', {
    get (): number|undefined {
      return error?.statusCode
    }
  })
  Object.defineProperty(cwaResourceError, 'statusMessage', {
    get (): string|undefined {
      return error?.statusMessage
    }
  })
  Object.defineProperty(cwaResourceError, 'statusText', {
    get (): string|undefined {
      return error?.statusText
    }
  })
  Object.defineProperty(cwaResourceError, 'primaryMessage', {
    get (): string {
      return error?.statusText || error?.statusMessage || message
    }
  })
  Object.defineProperty(cwaResourceError, 'asObject', {
    get (): CwaResourceErrorObject {
      return {
        message: this.message,
        statusCode: this.statusCode,
        statusMessage: this.statusMessage,
        statusText: this.statusText,
        primaryMessage: this.primaryMessage
      }
    }
  })
  return cwaResourceError
}
