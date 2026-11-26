import { getCurrentInstance, onMounted, ref } from 'vue'
import { useCwa } from '#cwa/composables/cwa'
import type { CwaUser } from '#cwa/storage/stores/auth/state'

export const useCwaAccount = () => {
  const $cwa = useCwa()
  const account = ref<CwaUser>()
  const loading = ref(true)
  const loadFailed = ref(false)

  async function reload() {
    loading.value = true
    loadFailed.value = false
    try {
      account.value = await $cwa.cwaFetch.fetch<CwaUser>('/me')
    }
    catch {
      loadFailed.value = true
    }
    finally {
      loading.value = false
    }
  }

  if (getCurrentInstance()) {
    onMounted(reload)
  }
  else {
    reload()
  }

  return { account, loading, loadFailed, reload }
}
