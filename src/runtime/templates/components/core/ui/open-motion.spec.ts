// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { infoPanel, menuPanel } from './field-looks'
import { dialogOpen, overlayOpen, popoverOpen } from './open-motion'

const css = readFileSync(fileURLToPath(new URL('../../../assets/cwa.css', import.meta.url)), 'utf8')
const compiled = css.replace(/\s+/g, ' ')
const runtime = fileURLToPath(new URL('../../../../', import.meta.url))

function vueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? vueFiles(join(directory, entry.name))
    : entry.name.endsWith('.vue') ? [join(directory, entry.name)] : [])
}

const floatingTags = /<(PopoverContent|DropdownMenuContent|SelectContent|ComboboxContent)\b[^>]*>/g
const ownMotion = ['templates/components/core/ui/ResourceStack.vue']

const floatingSurfaces = vueFiles(runtime).flatMap((file) => {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(floatingTags)].map(([tag, name]) => ({ file: relative(runtime, file), name: name!, tag }))
}).filter(surface => !ownMotion.includes(surface.file))

const reduced = '@media (prefers-reduced-motion: reduce) { &[data-state=\'open\'] { animation: none; } }'
const dialogBody = `{ --cwa-rise-from: -50% calc(-50% + 0.5rem); &[data-state='open'] { animation: cwa-rise var(--cwa-duration-slow) var(--cwa-ease-out); } ${reduced} }`

describe('opening motion in the compiled cwa.css (#461)', () => {
  test('one keyframe fades in, moves from a start offset and scales from 0.98, with no transform, so reka\'s placement on the popper wrapper is never replaced', () => {
    const keyframes = /@keyframes cwa-rise \{ from \{ ([^}]*) \} \}/.exec(compiled)

    expect(keyframes?.[1]).toBe('opacity: 0; translate: var(--cwa-rise-from); scale: 0.98;')
  })

  test('a popover or menu starts 0.25rem towards its trigger on the side reka placed it, animates only while open so closing stays instant, and stops under reduced motion by a later rule', () => {
    expect(compiled).toContain(`.cwa\\:pop-in { --cwa-rise-from: 0 -0.25rem; &[data-side='top'] { --cwa-rise-from: 0 0.25rem; } &[data-side='left'] { --cwa-rise-from: 0.25rem 0; } &[data-side='right'] { --cwa-rise-from: -0.25rem 0; } &[data-state='open'] { animation: cwa-rise var(--cwa-duration-fast) var(--cwa-ease-out); } ${reduced} }`)
  })

  test('a centred dialog rises 0.5rem into its centred place, -50% -50%, over 300ms, from sm up in CwaUiDialog, and stops under reduced motion by a later rule', () => {
    expect(compiled).toContain(`.cwa\\:dialog-in ${dialogBody}`)
    expect(compiled).toContain('.cwa\\:sm\\:dialog-in { --cwa-rise-from: -50% calc(-50% + 0.5rem); } .cwa\\:sm\\:dialog-in[data-state=\'open\'] { animation: cwa-rise var(--cwa-duration-slow) var(--cwa-ease-out); } @media (prefers-reduced-motion: reduce) { .cwa\\:sm\\:dialog-in[data-state=\'open\'] { animation: none; } }')
  })

  test('an overlay fades in over 200ms while open, and stops under reduced motion by a later rule', () => {
    expect(compiled).toContain('.cwa\\:overlay-in[data-state=\'open\'] { animation: cwa-line-in var(--cwa-duration-base) ease-out; } @media (prefers-reduced-motion: reduce) { .cwa\\:overlay-in[data-state=\'open\'] { animation: none; } }')
  })
})

describe('surfaces that open with the motion (#461)', () => {
  test('the shared looks are the three utilities, and menus and information popovers take the popover one', () => {
    expect([popoverOpen, dialogOpen, overlayOpen]).toEqual(['cwa:pop-in', 'cwa:dialog-in', 'cwa:overlay-in'])
    expect(menuPanel.split(' ')).toContain(popoverOpen)
    expect(infoPanel.split(' ')).toContain(popoverOpen)
  })

  test('no menu keeps the old fade alone', () => {
    expect(menuPanel).not.toContain('cwa-line-in')
    expect(readFileSync(join(runtime, 'templates/components/ui/Menu.vue'), 'utf8')).not.toContain('cwa-line-in')
  })

  test('every popover, menu and select in the admin binds the shared popover motion', () => {
    const bare = floatingSurfaces.filter(surface => !/\b(popoverOpen|menuPanel|infoPanel)\b/.test(surface.tag)).map(surface => `${surface.file} ${surface.name}`)

    expect(floatingSurfaces.length).toBe(17)
    expect(bare).toEqual([])
  })
})
