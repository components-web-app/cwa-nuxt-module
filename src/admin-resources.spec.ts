import { describe, expect, test, vi } from 'vitest'
import { adminResourcesTemplate, COMPONENT_KIND_ICONS, lucideNamesTypeTemplate } from './admin-resources'
import type { LucideIconSet } from './admin-resources'

const lucide: LucideIconSet = {
  icons: {
    'panel-top': { body: '<path d="panel-top"/>' },
    'layout-panel-top': { body: '<path d="layout-panel-top"/>' },
    'columns-2': { body: '<path d="columns-2"/>' },
    'layout-template': { body: '<path d="layout-template"/>' },
    'columns-3': { body: '<path d="columns-3"/>' },
    'gallery-horizontal-end': { body: '<path d="gallery-horizontal-end"/>' },
    'layout-list': { body: '<path d="layout-list"/>' },
    'component': { body: '<path d="component"/>' },
    'letter-text': { body: '<path d="letter-text"/>' },
    'map-pin': { body: '<path d="map-pin"/>' },
    'layout-grid': { body: '<path d="layout-grid"/>' },
    'unused-icon': { body: '<path d="unused"/>' },
  },
  aliases: {
    'text-paragraph': { parent: 'letter-text' },
  },
}

async function load(source: string) {
  const imports: string[] = []
  const code = source.replace(/^import (\w+) from (".*")$/gm, (_, name: string, from: string) => {
    imports.push(JSON.parse(from))
    return `const ${name} = ${JSON.stringify(`asset:${JSON.parse(from)}`)}`
  }).replace(/: Record<string, [^=]+> =/g, ' =').replace(/^export /gm, '')

  const values = new Function(`${code}; return { adminResourceIcons, adminResources }`)()
  return { ...values, imports }
}

function generate(resources: Record<string, any>, previews: Record<string, string> = {}) {
  const warn = vi.fn()
  const source = adminResourcesTemplate({ resources, previews, lucide, warn })
  return { source, warn }
}

describe('the admin resources template', () => {
  test('a Lucide icon is written once, by its own name', async () => {
    const { source } = generate({ Map: { icon: 'lucide:map-pin' }, Location: { icon: 'lucide:map-pin' } })
    const { adminResourceIcons, adminResources } = await load(source)

    expect(adminResources.Map).toEqual({ icon: 'lucide:map-pin' })
    expect(adminResources.Location).toEqual({ icon: 'lucide:map-pin' })
    expect(adminResourceIcons['lucide:map-pin']).toContain('<path d="map-pin"/>')
    expect(source.match(/d=\\"map-pin\\"/g)).toHaveLength(1)
  })

  test('only the icons in use and the generic icon are written', async () => {
    const { source } = generate({ Body: { icon: 'rich-text' } })
    const { adminResourceIcons } = await load(source)

    expect(Object.keys(adminResourceIcons).sort()).toEqual(['lucide:component', 'lucide:letter-text'])
    expect(source).not.toContain('unused')
  })

  test('a kind uses its Lucide icon', async () => {
    const { adminResources, adminResourceIcons } = await load(generate({ Body: { icon: 'rich-text' } }).source)

    expect(COMPONENT_KIND_ICONS['rich-text']).toBe('letter-text')
    expect(adminResources.Body.icon).toBe('lucide:letter-text')
    expect(adminResourceIcons['lucide:letter-text']).toContain('viewBox="0 0 24 24"')
  })

  test('a layout kind has a 48 by 32 skeleton for rows as well as its icon for chips', async () => {
    const { adminResources, adminResourceIcons } = await load(generate({ Cards: { icon: 'card-grid' } }).source)

    expect(adminResources.Cards).toEqual({ icon: 'lucide:layout-grid', skeleton: 'skeleton:card-grid' })
    expect(adminResourceIcons['skeleton:card-grid']).toContain('viewBox="0 0 48 32"')
    expect(adminResourceIcons['lucide:layout-grid']).toContain('<path d="layout-grid"/>')
  })

  test('a kind without a skeleton has none', async () => {
    const { adminResources } = await load(generate({ Body: { icon: 'rich-text' } }).source)

    expect(adminResources.Body.skeleton).toBeUndefined()
  })

  test('every skeleton kind has a skeleton', async () => {
    const kinds = ['hero', 'card', 'card-grid', 'media-text', 'section', 'columns', 'carousel', 'collection']
    const { adminResources } = await load(generate(Object.fromEntries(kinds.map(kind => [kind, { icon: kind }]))).source)

    expect(kinds.map(kind => adminResources[kind].skeleton)).toEqual(kinds.map(kind => `skeleton:${kind}`))
  })

  test('a Lucide alias resolves to its parent icon', async () => {
    const { adminResourceIcons } = await load(generate({ Body: { icon: 'lucide:text-paragraph' } }).source)

    expect(adminResourceIcons['lucide:text-paragraph']).toContain('<path d="letter-text"/>')
  })

  test('an unknown icon warns and falls back to the generic icon', async () => {
    const { source, warn } = generate({ Odd: { icon: 'lucide:no-such-icon', group: 'Text' }, Odder: { icon: 'spaceship' } })
    const { adminResources } = await load(source)

    expect(adminResources.Odd).toEqual({ group: 'Text' })
    expect(adminResources.Odder).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cwa.resources.Odd.icon "lucide:no-such-icon"'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cwa.resources.Odder.icon "spaceship"'))
  })

  test('every icon carries the marker the entry bundle guard looks for', async () => {
    const { adminResourceIcons } = await load(generate({ Body: { icon: 'rich-text' }, Cards: { icon: 'hero' } }).source)

    expect(Object.values(adminResourceIcons).every(svg => (svg as string).startsWith('<svg data-cwa-admin-icon '))).toBe(true)
  })

  test('the group and image are kept as configured', async () => {
    const { adminResources } = await load(generate({ Hero: { group: 'Layout', image: '/previews/hero.webp' } }).source)

    expect(adminResources.Hero).toEqual({ group: 'Layout', image: '/previews/hero.webp' })
  })

  test.each(['/previews/hero.webp', '//cdn.example.com/hero.webp', 'https://cdn.example.com/hero.webp', 'http://cdn.example.com/hero.webp', 'HTTPS://cdn.example.com/hero.webp'])('an image URL %s is used as given', async (image) => {
    const { adminResources, imports } = await load(generate({ Hero: { image } }).source)

    expect(imports).toEqual([])
    expect(adminResources.Hero).toEqual({ image })
  })

  test.each(['~/assets/hero.webp', '@/assets/hero.webp', 'assets/hero.webp', './hero.webp'])('any other image, %s, is imported as an asset', async (image) => {
    const { adminResources, imports } = await load(generate(
      { Hero: { image } },
      { Hero: '/app/cwa/components/Hero/preview.webp' },
    ).source)

    expect(imports).toEqual([image])
    expect(adminResources.Hero).toEqual({ image: `asset:${image}` })
  })

  test('a preview.webp is imported as an asset when no image is configured', async () => {
    const { adminResources, imports } = await load(generate(
      { Hero: {}, Card: { image: '/card.webp' } },
      { Hero: '/app/cwa/components/Hero/preview.webp', Card: '/app/cwa/components/Card/preview.webp' },
    ).source)

    expect(imports).toEqual(['/app/cwa/components/Hero/preview.webp'])
    expect(adminResources.Hero).toEqual({ image: 'asset:/app/cwa/components/Hero/preview.webp' })
    expect(adminResources.Card).toEqual({ image: '/card.webp' })
  })

  test('a component with nothing configured is left out', async () => {
    const { adminResources } = await load(generate({ Plain: {}, Missing: undefined }).source)

    expect(adminResources).toEqual({})
  })
})

describe('the Lucide icon names type', () => {
  test('lists every icon and alias as a key of the global interface', () => {
    const source = lucideNamesTypeTemplate(lucide)

    expect(source).toContain('interface CwaLucideIconNames {')
    expect(source).toContain('"map-pin": true')
    expect(source).toContain('"text-paragraph": true')
    expect(source).not.toContain('<path')
  })
})
