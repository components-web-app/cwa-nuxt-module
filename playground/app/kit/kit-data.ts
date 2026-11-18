import type { CwaResource } from '../../../src/runtime/resources/resource-utils'
import type { MenuEntry } from '../../../src/runtime/templates/components/core/ui/menu-entries'
import type { FakeLoader } from './fake-loader'

export const kitSelectOptions: MenuEntry[] = [
  { label: 'Default', value: 'default' },
  { label: 'Split image', value: 'split', description: 'Image on one side, text on the other' },
  { group: 'Wide layouts only', items: [{ label: 'Full bleed', value: 'bleed', disabled: true, disabledReason: 'Needs a wide layout' }] },
]

export const kitStyleOptions = [
  { label: 'Dark background', value: 'dark' },
  { label: 'Extra padding', value: 'padding' },
  { label: 'Wide', value: 'wide' },
  { label: 'Rounded corners', value: 'rounded' },
]

export const kitAlignOptions = [{ value: 'left', label: 'Left' }, { value: 'centre', label: 'Centre' }, { value: 'right', label: 'Right' }]

export type KitSearchOutcome = 'results' | 'empty' | 'error'

const componentNames = ['Gallery', 'Gallery grid', 'Gallery carousel', 'Map', 'Map with pins', 'Rich text', 'Text and image', 'Hero section', 'Spacer', 'Call to action', 'Contact form', 'Testimonial', 'Video', 'Tabs', 'Two columns', 'Accordion', 'Logo strip', 'Price table', 'Team grid', 'Blog list', 'Download list', 'Quote', 'Newsletter sign-up', 'Image', 'Embed']

export const kitSearchResources: CwaResource[] = [
  ...componentNames.map((name, index) => ({ '@id': `/component/kit/${index + 1}`, '@type': 'Component', name, '_metadata': { persisted: true } })),
  ...Array.from({ length: 30 }, (_, index) => ({ '@id': `/component/kit/gallery-${index + 1}`, '@type': 'Component', 'name': `Gallery ${index + 1}, showroom photos`, '_metadata': { persisted: true } })),
] as CwaResource[]

export const kitSearchLabel = (resource: CwaResource) => String(resource.name ?? resource['@id'])

export function kitSearchSource(loader: FakeLoader, outcome: () => KitSearchOutcome, resources: CwaResource[] = kitSearchResources) {
  return {
    load: async (term: string, page: number) => {
      await loader.wait()
      if (outcome() === 'error') {
        throw new Error('500')
      }
      const found = outcome() === 'empty' ? [] : resources.filter(resource => kitSearchLabel(resource).toLowerCase().includes(term.trim().toLowerCase()))
      return { items: found.slice((page - 1) * 20, page * 20), total: found.length }
    },
    resolve: async (iri: string) => resources.find(resource => resource['@id'] === iri),
  }
}
