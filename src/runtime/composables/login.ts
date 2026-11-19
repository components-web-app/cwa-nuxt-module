import { reactive, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { FetchError } from 'ofetch'
import { navigateTo, useRoute } from '#imports'
import { useCwa } from '#cwa/composables/cwa'

export interface UseLoginOps {
  redirect?: MaybeRefOrGetter<string | undefined>
}

export const DEFAULT_LOGIN_REDIRECT = '/'

function resolveRedirectTarget(target: unknown): string {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return DEFAULT_LOGIN_REDIRECT
  }
  return target
}

const INVALID_CREDENTIALS = 'Invalid credentials.'
const COOKIE_NOT_KEPT = 'We couldn\'t keep you signed in. Your browser didn\'t store the sign-in cookie; check the site\'s cookie settings or try again.'
const SIGN_IN_FAILED = 'We couldn\'t sign you in. Please try again.'

function requestPath(request: FetchError['request']) {
  const url = typeof request === 'string' ? request : request instanceof Request ? request.url : undefined
  if (!url) {
    return undefined
  }
  try {
    return new URL(url, 'http://localhost').pathname.replace(/\/+$/, '')
  }
  catch {
    return undefined
  }
}

function signInFailure(error: FetchError) {
  if (error.status !== 401) {
    return SIGN_IN_FAILED
  }
  return requestPath(error.request)?.endsWith('/login') ? INVALID_CREDENTIALS : COOKIE_NOT_KEPT
}

export const useLogin = (ops: UseLoginOps = {}) => {
  const $cwa = useCwa()
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
      error.value = signInFailure(user)
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
