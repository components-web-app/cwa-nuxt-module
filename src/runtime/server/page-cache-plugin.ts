import type { H3Event } from 'h3'
import { removeResponseHeader, setResponseHeader } from 'h3'
import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event: H3Event) => {
    const decision = event.context.cwaPageCache
    if (!decision) {
      return
    }

    if (event.node.res.statusCode !== 200) {
      removeResponseHeader(event, 'Surrogate-Key')
      setResponseHeader(event, 'Cache-Control', 'no-store')
      return
    }

    if (decision.unstorable) {
      setResponseHeader(event, 'Cache-Control', 'private, no-store')
      return
    }

    if (!decision.surrogateKey || !decision.cacheControl) {
      return
    }

    setResponseHeader(event, 'Surrogate-Key', decision.surrogateKey)
    setResponseHeader(event, 'Cache-Control', decision.cacheControl)
  })
})
