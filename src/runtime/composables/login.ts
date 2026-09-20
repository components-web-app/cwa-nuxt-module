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
