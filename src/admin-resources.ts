import type { CwaComponentKind } from './runtime/types'

export const GENERIC_ICON = 'lucide:component'

export const COMPONENT_KIND_ICONS: Record<CwaComponentKind, string> = {
  'heading': 'heading',
  'rich-text': 'letter-text',
  'image': 'image',
  'gallery': 'images',
  'carousel': 'gallery-horizontal-end',
  'video': 'square-play',
  'hero': 'panel-top',
  'banner': 'megaphone',
  'card': 'layout-panel-top',
  'card-grid': 'layout-grid',
  'section': 'layout-template',
  'media-text': 'columns-2',
  'columns': 'columns-3',
  'container': 'square-dashed',
  'link': 'link',
  'button': 'mouse-pointer-click',
  'link-group': 'list',
  'tabs': 'panels-top-left',
  'accordion': 'list-collapse',
  'quote': 'quote',
  'testimonial': 'message-square-quote',
  'form': 'form',
  'newsletter': 'mail',
  'sign-up': 'user-plus',
  'collection': 'layout-list',
  'articles': 'newspaper',
  'table': 'table',
  'steps': 'list-ordered',
  'file': 'file-down',
  'chart': 'chart-column',
  'heatmap': 'grid-3x3',
  'map': 'map-pin',
  'contact': 'contact',
  'social': 'share-2',
  'person': 'user',
  'people': 'users',
  'notice': 'sticky-note',
}

const FRAME = '#292524'
const STROKE = '#44403c'
const BAR = '#57534e'
const IMG = '#78716c'
const ACCENT = '#3b82f6'

function rect(x: number, y: number, width: number, height: number, fill: string, rx = 1) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}"/>`
}

const SKELETONS: Partial<Record<CwaComponentKind, string>> = {
  'hero': rect(1, 1, 46, 16, IMG, 0) + rect(6, 20, 24, 3, BAR) + rect(6, 25.5, 10, 3.5, ACCENT, 1.75),
  'card': rect(14, 4, 20, 12, IMG) + rect(14, 19, 20, 3, BAR) + rect(14, 24.5, 13, 2.5, BAR),
  'card-grid': rect(5, 5, 11, 10, IMG) + rect(18.5, 5, 11, 10, IMG) + rect(32, 5, 11, 10, IMG)
    + rect(5, 18, 11, 9, BAR) + rect(18.5, 18, 11, 9, BAR) + rect(32, 18, 11, 9, ACCENT),
  'media-text': rect(5, 5, 18, 22, IMG) + rect(27, 8, 16, 3, BAR) + rect(27, 14, 13, 2.5, BAR) + rect(27, 21, 9, 3.5, ACCENT, 1.75),
  'section': rect(12, 7, 24, 3, BAR) + rect(9, 13, 30, 2.5, BAR) + rect(14, 18, 20, 2.5, BAR) + rect(19, 23, 10, 3.5, ACCENT, 1.75),
  'columns': rect(5, 7, 10, 3, BAR) + rect(5, 13, 10, 2, BAR) + rect(5, 17, 8, 2, BAR)
    + rect(19, 7, 10, 3, BAR) + rect(19, 13, 10, 2, BAR) + rect(19, 17, 8, 2, BAR)
    + rect(33, 7, 10, 3, BAR) + rect(33, 13, 10, 2, BAR) + rect(33, 17, 8, 2, BAR),
  'carousel': rect(6, 4, 36, 18, IMG) + rect(18, 25.5, 3, 3, ACCENT, 1.5) + rect(22.5, 25.5, 3, 3, BAR, 1.5) + rect(27, 25.5, 3, 3, BAR, 1.5),
  'collection': rect(5, 5, 7, 5, IMG) + rect(15, 6.5, 26, 2, BAR) + rect(5, 13.5, 7, 5, IMG) + rect(15, 15, 20, 2, BAR)
    + rect(5, 22, 7, 5, IMG) + rect(15, 23.5, 23, 2, BAR) + rect(38, 23, 5, 3, ACCENT, 1.5),
}

export interface LucideIconSet {
  icons: Record<string, { body: string }>
  aliases?: Record<string, { parent: string }>
}

export interface AdminResourceConfig {
  icon?: string
  group?: string
  image?: string
}

export interface AdminResourcesTemplateInput {
  resources: Record<string, AdminResourceConfig | undefined>
  previews: Record<string, string>
  lucide: LucideIconSet
  warn: (message: string) => void
}

function lucideBody(lucide: LucideIconSet, name: string): string | undefined {
  const parent = lucide.aliases?.[name]?.parent
  return lucide.icons[parent ?? name]?.body
}

function lucideSvg(body: string) {
  return `<svg data-cwa-admin-icon xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`
}

function skeletonSvg(body: string) {
  return `<svg data-cwa-admin-icon xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" aria-hidden="true" focusable="false"><rect x=".5" y=".5" width="47" height="31" rx="2" fill="${FRAME}" stroke="${STROKE}"/>${body}</svg>`
}

interface ResolvedIcon {
  icon: { key: string, svg: string }
  skeleton?: { key: string, svg: string }
}

function resolveIcon(icon: string, lucide: LucideIconSet): ResolvedIcon | undefined {
  if (icon.startsWith('lucide:')) {
    const body = lucideBody(lucide, icon.slice('lucide:'.length))
    return body ? { icon: { key: icon, svg: lucideSvg(body) } } : undefined
  }
  const kind = icon as CwaComponentKind
  const lucideName = COMPONENT_KIND_ICONS[kind]
  const body = lucideName ? lucideBody(lucide, lucideName) : undefined
  if (!body) {
    return undefined
  }
  const skeleton = SKELETONS[kind]
  return {
    icon: { key: `lucide:${lucideName}`, svg: lucideSvg(body) },
    skeleton: skeleton ? { key: `skeleton:${kind}`, svg: skeletonSvg(skeleton) } : undefined,
  }
}

export function adminResourcesTemplate({ resources, previews, lucide, warn }: AdminResourcesTemplateInput): string {
  const icons: Record<string, string> = { [GENERIC_ICON]: lucideSvg(lucideBody(lucide, 'component') ?? '') }
  const entries: Record<string, { icon?: string, skeleton?: string, group?: string, image?: string }> = {}
  const imports: string[] = []
  const imageRefs: Record<string, string> = {}

  for (const name of Object.keys(resources).sort()) {
    const config = resources[name] ?? {}
    const entry: { icon?: string, skeleton?: string, group?: string, image?: string } = {}
    if (config.icon) {
      const resolved = resolveIcon(config.icon, lucide)
      if (resolved) {
        icons[resolved.icon.key] = resolved.icon.svg
        entry.icon = resolved.icon.key
        if (resolved.skeleton) {
          icons[resolved.skeleton.key] = resolved.skeleton.svg
          entry.skeleton = resolved.skeleton.key
        }
      }
      else {
        warn(`cwa.resources.${name}.icon "${config.icon}" is not a component kind or a Lucide icon, so the generic component icon is shown.`)
      }
    }
    if (config.group) {
      entry.group = config.group
    }
    if (config.image) {
      entry.image = config.image
    }
    else if (previews[name]) {
      const ref = `preview${imports.length}`
      imports.push(`import ${ref} from ${JSON.stringify(previews[name])}`)
      imageRefs[name] = ref
    }
    if (Object.keys(entry).length || imageRefs[name]) {
      entries[name] = entry
    }
  }

  const body = Object.entries(entries).map(([name, entry]) => {
    const fields = Object.entries(entry).map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    imageRefs[name] && fields.push(`image: ${imageRefs[name]}`)
    return `  ${JSON.stringify(name)}: { ${fields.join(', ')} },`
  })

  return `${imports.map(line => `${line}\n`).join('')}export const adminResourceIcons: Record<string, string> = ${JSON.stringify(icons, undefined, 2)}
export const adminResources: Record<string, { icon?: string, skeleton?: string, group?: string, image?: string }> = {
${body.join('\n')}
}
`
}

export function lucideNamesTypeTemplate(lucide: LucideIconSet): string {
  const names = [...Object.keys(lucide.icons), ...Object.keys(lucide.aliases ?? {})].sort()
  return `declare global {
  interface CwaLucideIconNames {
${names.map(name => `    ${JSON.stringify(name)}: true`).join('\n')}
  }
}
export {}
`
}
