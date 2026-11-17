// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { scanCwaConfigDeclarations } from './cwa-config-declarations'

const APP = '/site/app'

type Entry = { pascalName: string, filePath: string }

const template = (pascalName: string, filePath: string): Entry => ({ pascalName, filePath: `${APP}/${filePath}` })

function scan(files: Record<string, string | undefined>, templates: Entry[], onUncheckable?: (filePath: string, reason: string) => void) {
  return scanCwaConfigDeclarations({
    templates,
    readFile: file => files[file],
    onUncheckable,
  })
}

const sfc = (setup: string) => `<template>
  <div />
</template>

<script setup lang="ts">
${setup}
</script>
`

describe('scanCwaConfigDeclarations', () => {
  test('a <Name>/<Name>.vue with a literal defineCwaConfig gives that config, keyed by resource type', () => {
    const result = scan({
      [`${APP}/cwa/components/Hero/Hero.vue`]: sfc(`import type { IriProp } from '#cwa/composables/cwa-resource'
defineCwaConfig({
  name: 'Hero',
  description: '<p>Full-width banner</p>',
  instantAdd: true,
  defaultData: { title: 'New hero', tags: ['a', 'b'], count: -1, empty: null },
  multipleStyles: true,
  styles: {
    'black-bg': { label: 'Black Background', classes: 'bg-black text-white' },
    wide: { label: \`Wide\`, classes: 'w-full' },
  },
} as const)
const props = defineProps<IriProp>()`),
    }, [template('CwaComponentHero', 'cwa/components/Hero/Hero.vue')])

    expect(result).toEqual({
      components: {
        Hero: {
          name: 'Hero',
          description: '<p>Full-width banner</p>',
          instantAdd: true,
          defaultData: { title: 'New hero', tags: ['a', 'b'], count: -1, empty: null },
          multipleStyles: true,
          styles: {
            'black-bg': { label: 'Black Background', classes: 'bg-black text-white' },
            'wide': { label: 'Wide', classes: 'w-full' },
          },
        },
      },
      ui: {},
      layouts: {},
      pages: {},
    })
  })

  test('a ui/<Variant>.vue gives its own styles keyed by its variant name, and layouts and pages are keyed by their names', () => {
    const result = scan({
      [`${APP}/cwa/components/Hero/ui/Wide.vue`]: sfc(`defineCwaConfig({
  styles: { tall: { label: 'Tall', classes: 'h-screen' } },
})`),
      [`${APP}/cwa/layouts/primary.vue`]: sfc(`defineCwaConfig({
  name: 'Primary Layout',
  styles: { blue: { label: 'Blue Background', classes: 'bg-blue-600' } },
})`),
      [`${APP}/cwa/pages/PrimaryPageTemplate.vue`]: sfc(`defineCwaConfig({
  name: 'Primary Page',
  styles: { big: { label: 'Big Text', classes: 'text-2xl' } },
})`),
    }, [
      template('CwaComponentHeroUiWide', 'cwa/components/Hero/ui/Wide.vue'),
      template('CwaLayoutPrimary', 'cwa/layouts/primary.vue'),
      template('CwaPagePrimaryPageTemplate', 'cwa/pages/PrimaryPageTemplate.vue'),
    ])

    expect(result).toEqual({
      components: {},
      ui: {
        CwaComponentHeroUiWide: { styles: { tall: { label: 'Tall', classes: 'h-screen' } } },
      },
      layouts: {
        Primary: { name: 'Primary Layout', styles: { blue: { label: 'Blue Background', classes: 'bg-blue-600' } } },
      },
      pages: {
        PrimaryPageTemplate: { name: 'Primary Page', styles: { big: { label: 'Big Text', classes: 'text-2xl' } } },
      },
    })
  })

  test('a file without the macro gives no entry, so the component keeps its automatic name', () => {
    const result = scan({
      [`${APP}/cwa/components/Plain/Plain.vue`]: sfc(`const props = defineProps<{ iri: string }>()`),
    }, [template('CwaComponentPlain', 'cwa/components/Plain/Plain.vue')])

    expect(result).toEqual({ components: {}, ui: {}, layouts: {}, pages: {} })
  })

  describe('an argument that is not a literal, or a second call', () => {
    const file = `${APP}/cwa/components/Hero/Hero.vue`

    function uncheckable(setup: string) {
      const reported: [string, string][] = []
      const result = scan({ [file]: sfc(setup) }, [template('CwaComponentHero', 'cwa/components/Hero/Hero.vue')], (filePath, reason) => reported.push([filePath, reason]))
      return { result, reported }
    }

    test.each([
      {
        case: 'an identifier',
        setup: `const config = { name: 'Hero' }
defineCwaConfig(config)`,
        reason: 'passes defineCwaConfig a variable, not a literal',
      },
      {
        case: 'an identifier inside the object',
        setup: `const label = 'Hero'
defineCwaConfig({ name: label })`,
        reason: 'passes defineCwaConfig a variable, not a literal',
      },
      {
        case: 'a spread',
        setup: `defineCwaConfig({ ...base, name: 'Hero' })`,
        reason: 'uses a spread in defineCwaConfig',
      },
      {
        case: 'a function call',
        setup: `defineCwaConfig({ name: makeName() })`,
        reason: 'calls a function in defineCwaConfig',
      },
      {
        case: 'a computed key',
        setup: `defineCwaConfig({ styles: { [key]: { label: 'Wide', classes: 'w-full' } } })`,
        reason: 'uses a computed key in defineCwaConfig',
      },
      {
        case: 'an interpolated template literal',
        setup: 'defineCwaConfig({ name: `Hero ${suffix}` })',
        reason: 'interpolates a template literal in defineCwaConfig',
      },
      {
        case: 'a second call',
        setup: `defineCwaConfig({ name: 'Hero' })
defineCwaConfig({ name: 'Again' })`,
        reason: 'calls defineCwaConfig more than once',
      },
    ])('$case is reported once, with the file and the reason, and gives no config', ({ setup, reason }) => {
      const { result, reported } = uncheckable(setup)

      expect(reported).toEqual([[file, reason]])
      expect(result.components).toEqual({})
    })

    test('a file that cannot be read or parsed is reported and gives no config', () => {
      const reported: [string, string][] = []
      const result = scan({
        [`${APP}/cwa/components/Broken/Broken.vue`]: sfc(`defineCwaConfig({ name: 'Broken' `),
      }, [
        template('CwaComponentMissing', 'cwa/components/Missing/Missing.vue'),
        template('CwaComponentBroken', 'cwa/components/Broken/Broken.vue'),
      ], (filePath, reason) => reported.push([filePath, reason]))

      expect(reported).toEqual([
        [`${APP}/cwa/components/Missing/Missing.vue`, 'could not be read'],
        [`${APP}/cwa/components/Broken/Broken.vue`, 'could not be parsed'],
      ])
      expect(result.components).toEqual({})
    })
  })
})
