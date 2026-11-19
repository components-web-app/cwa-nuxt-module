import type { CwaComponentConfig, CwaResourcesMeta } from '../../src/runtime/types'

export const configured: CwaComponentConfig[] = [
  { name: 'Hero', icon: 'hero', group: 'Layout', image: '~/assets/hero.webp' },
  { icon: 'lucide:link' },
]

export function runtimeKeys(resourcesConfig: CwaResourcesMeta) {
  const hero = resourcesConfig.Hero
  // @ts-expect-error
  const icon = hero?.icon
  // @ts-expect-error
  const group = hero?.group
  // @ts-expect-error
  const image = hero?.image
  return [hero?.name, hero?.description, hero?.instantAdd, hero?.defaultData, hero?.ui, hero?.managerTabs, icon, group, image]
}
