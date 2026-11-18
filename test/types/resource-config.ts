import type Cwa from '../../src/runtime/cwa'
import type { CwaModuleOptions } from '../../src/runtime/types'

export const configured: CwaModuleOptions['resources'] = {
  Hero: { name: 'Hero', icon: 'hero', group: 'Layout', image: '~/assets/hero.webp' },
  Link: { icon: 'lucide:link' },
}

export function runtimeKeys(cwa: Cwa) {
  const hero = cwa.resourcesConfig.Hero
  // @ts-expect-error
  const icon = hero?.icon
  // @ts-expect-error
  const group = hero?.group
  // @ts-expect-error
  const image = hero?.image
  return [hero?.name, hero?.description, hero?.instantAdd, hero?.defaultData, hero?.ui, hero?.managerTabs, icon, group, image]
}
