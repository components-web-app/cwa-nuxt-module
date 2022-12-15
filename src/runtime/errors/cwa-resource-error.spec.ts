import { describe, expect, test } from 'vitest'
import { FetchError } from 'ohmyfetch'
import { createCwaResourceError } from './cwa-resource-error'

describe('Test creating cwa resource errors', () => {
  test('We can create a cwa resource error with any arbitrary error', () => {
    const cwaResourceError = createCwaResourceError(new Error('My Error'))
    expect(cwaResourceError.message).toBe('My Error')
    expect(cwaResourceError.statusCode).toBeUndefined()
    expect(cwaResourceError.statusMessage).toBeUndefined()
    expect(cwaResourceError.statusText).toBeUndefined()
    expect(cwaResourceError.primaryMessage).toBe('My Error')
    expect(cwaResourceError.asObject).toStrictEqual({
      message: 'My Error',
      statusCode: undefined,
      statusMessage: undefined,
      statusText: undefined,
      primaryMessage: 'My Error'
    })
  })

  test.each([
    { message: 'Some fetch error message', statusCode: 101, statusMessage: 'My status message', statusText: 'My status text', primaryMessage: 'My status text' },
    { message: 'Some fetch error message', statusCode: 101, statusMessage: 'My status message', statusText: undefined, primaryMessage: 'My status message' },
    { message: 'Some fetch error message', statusCode: 101, statusMessage: undefined, statusText: 'My status text', primaryMessage: 'My status text' },
    { message: 'Some fetch error message', statusCode: 101, statusMessage: undefined, statusText: undefined, primaryMessage: 'Some fetch error message' }
  ])('We can create a cwa resource error with a FetchError', ({ message, statusCode, statusMessage, statusText, primaryMessage }) => {
    const fetchError = new FetchError(message)
    fetchError.statusCode = statusCode
    fetchError.statusMessage = statusMessage
    fetchError.statusText = statusText

    const cwaResourceError = createCwaResourceError(fetchError)
    expect(cwaResourceError.message).toBe(message)
    expect(cwaResourceError.statusCode).toBe(statusCode)
    expect(cwaResourceError.statusMessage).toBe(statusMessage)
    expect(cwaResourceError.statusText).toBe(statusText)
    expect(cwaResourceError.primaryMessage).toBe(primaryMessage)
    expect(cwaResourceError.asObject).toStrictEqual({
      message,
      statusCode,
      statusMessage,
      statusText,
      primaryMessage
    })
  })
})
