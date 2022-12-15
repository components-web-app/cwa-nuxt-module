import { describe, expect, test } from 'vitest'
import { FetchError } from 'ohmyfetch'
import { createCwaResourceError } from './cwa-resource-error'

describe('Test creating cwa resource errors', () => {
  test('We can create a cwa resource error with any arbitrary error', () => {
    const cwaResourceError = createCwaResourceError(new Error('My Error'))
    expect(cwaResourceError.name).toBe('CwaResourceError')
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
    { message: 'Some fetch error message', expectedMessage: 'Some fetch error message', statusCode: 502, statusMessage: 'My status message', statusText: 'My status text', primaryMessage: 'My status text' },
    { message: 'Some fetch error message', expectedMessage: 'Some fetch error message', statusCode: 500, statusMessage: 'My status message', statusText: undefined, primaryMessage: 'My status message' },
    { message: 'Some fetch error message', expectedMessage: 'Some fetch error message', statusCode: 404, statusMessage: undefined, statusText: 'My status text', primaryMessage: 'My status text' },
    { message: 'Some fetch error message', expectedMessage: 'Some fetch error message', statusCode: 401, statusMessage: undefined, statusText: undefined, primaryMessage: 'Some fetch error message' },
    { message: '', expectedMessage: 'An unknown error occurred', statusCode: 403, statusMessage: undefined, statusText: undefined, primaryMessage: 'An unknown error occurred' },
    { message: undefined, expectedMessage: 'An unknown error occurred', statusCode: 102, statusMessage: undefined, statusText: undefined, primaryMessage: 'An unknown error occurred' },
    { message: undefined, expectedMessage: 'An unknown error occurred', statusCode: 100, statusMessage: 'My status message', statusText: undefined, primaryMessage: 'My status message' }
  ])('We can create a cwa resource error with a FetchError', ({ message, expectedMessage, statusCode, statusMessage, statusText, primaryMessage }) => {
    const fetchError = new FetchError(message)
    fetchError.statusCode = statusCode
    fetchError.statusMessage = statusMessage
    fetchError.statusText = statusText

    const cwaResourceError = createCwaResourceError(fetchError)
    expect(cwaResourceError.name).toBe('CwaResourceError')
    expect(cwaResourceError.message).toBe(expectedMessage)
    expect(cwaResourceError.statusCode).toBe(statusCode)
    expect(cwaResourceError.statusMessage).toBe(statusMessage)
    expect(cwaResourceError.statusText).toBe(statusText)
    expect(cwaResourceError.primaryMessage).toBe(primaryMessage)
    expect(cwaResourceError.asObject).toStrictEqual({
      message: expectedMessage,
      statusCode,
      statusMessage,
      statusText,
      primaryMessage
    })
  })
})
