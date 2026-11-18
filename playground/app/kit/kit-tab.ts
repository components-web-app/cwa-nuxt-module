import { computed } from 'vue'
import { useRoute, useRouter } from '#imports'

export type KitTab = 'kit' | 'practice'

export const kitTabs: { value: KitTab, label: string }[] = [{ value: 'kit', label: 'Kit' }, { value: 'practice', label: 'In practice' }]

export function kitTabOf(query: unknown): KitTab {
  return query === 'practice' ? 'practice' : 'kit'
}

export function useKitTab() {
  const route = useRoute()
  const router = useRouter()
  return computed<KitTab>({
    get: () => kitTabOf(route.query.tab),
    set: (tab) => {
      const { tab: _old, ...query } = route.query
      router.replace({ query: tab === 'kit' ? query : { ...query, tab } })
    },
  })
}
