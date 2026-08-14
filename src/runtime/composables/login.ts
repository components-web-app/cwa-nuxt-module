import { reactive, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { FetchError } from 'ofetch'
import { navigateTo, useRoute } from '#imports'
import { useCwa } from '#cwa/composables/cwa'

export interface UseLoginOps {
  /**
   * Where to send the user once they are signed in.
   *
   * Resolved when `signIn` succeeds (so a ref/getter may change in between). When omitted, the
   * `redirect` query parameter of the current route is used — which is what the `cwa-auth` route
   * middleware sets, so the round trip works with no app code at all. Falls back to '/'.
   *
   * Only internal, absolute paths are honoured; anything else falls back to '/' (see
   * `resolveRedirectTarget`).
   */
  redirect?: MaybeRefOrGetter<string | undefined>
}

export const DEFAULT_LOGIN_REDIRECT = '/'

/**
 * Reduce an untrusted redirect target to something safe to navigate to.
 *
 * The target usually arrives in a query parameter, so it is attacker-controllable: a user can be
 * handed `/login?redirect=https://evil.example.com` and, post sign-in, be bounced off-site with the
 * credibility of having just authenticated. Only a plain internal path is accepted — a single
 * leading slash, no protocol-relative `//host`, no `/\host` (which several browsers normalise to
 * `//host`).
 */
function resolveRedirectTarget(target: unknown): string {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return DEFAULT_LOGIN_REDIRECT
  }
  return target
}

export const useLogin = (ops: UseLoginOps = {}) => {
  const $cwa = useCwa()
  // Captured here rather than inside `signIn`: `signIn` is called from an event handler, outside
  // of any component setup context.
  const route = useRoute()

  const credentials = reactive({
    username: '',
    password: '',
  })

  const error = ref()
  const submitting = ref(false)

  function getRedirectTarget() {
    const explicit = toValue(ops.redirect)
    return resolveRedirectTarget(explicit === undefined ? route.query?.redirect : explicit)
  }

  async function signIn() {
    submitting.value = true
    error.value = undefined
    const user = await $cwa.auth.signIn(credentials)
    if (user instanceof FetchError) {
      error.value = user.data?.message || user.statusMessage || 'Unknown/Network Error'
    }
    else {
      navigateTo(getRedirectTarget())
    }
    submitting.value = false
  }

  return {
    credentials,
    error,
    submitting,
    signIn,
  }
}
