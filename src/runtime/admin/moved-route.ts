import type { Router } from 'vue-router'
import type Cwa from '#cwa/cwa'

export async function followMovedRoute($cwa: Pick<Cwa, 'fetch' | 'navigationDisabled'>, router: Pick<Router, 'currentRoute' | 'replace'>) {
  const current = router.currentRoute.value
  if (current.meta.key !== 'cwa-page') {
    return
  }
  const route = await $cwa.fetch({ path: `/_/routes/${current.path}` }).response.catch(() => undefined)
  const redirectPath = route?._data?.redirectPath
  if (typeof redirectPath !== 'string') {
    return
  }
  await router.replace({
    path: redirectPath,
    query: $cwa.navigationDisabled ? { ...current.query, cwa_force: 'true' } : current.query,
    hash: current.hash,
  })
}
