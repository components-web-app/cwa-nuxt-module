import { defineEventHandler, setResponseHeaders } from 'h3'

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'cache-control': 'no-cache',
    'x-robots-tag': 'noindex, nofollow',
  })
  return {
    status: 'OK',
  }
})
