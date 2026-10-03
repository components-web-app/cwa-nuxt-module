// @vitest-environment node
import { dirname, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { scanComponentGroupDeclarations } from './component-group-declarations'

const APP = '/site/app'
const GROUP_FILE = '/module/runtime/templates/components/main/ComponentGroup.vue'

type Entry = { pascalName: string, filePath: string }

function scan(files: Record<string, string>, templates: Entry[], components: Entry[] = []) {
  return scanComponentGroupDeclarations({
    templates,
    components: [...templates, ...components, { pascalName: 'CwaComponentGroup', filePath: GROUP_FILE }],
    componentGroupFile: GROUP_FILE,
    readFile: file => files[file],
    resolveImport: (source, importer) => {
      if (source.startsWith('~/')) {
        return `${APP}/${source.slice(2)}`
      }
      if (source.startsWith('.')) {
        return resolve(dirname(importer), source)
      }
      return undefined
    },
  })
}

const template = (pascalName: string, filePath: string): Entry => ({ pascalName, filePath: `${APP}/${filePath}` })

const iriScript = `<script setup lang="ts">
import type { IriProp } from '#cwa/composables/cwa-resource'
const props = defineProps<IriProp>()
</script>`

describe('scanComponentGroupDeclarations', () => {
  describe('location kinds', () => {
    test('a page template locating its group at props.iri or iri declares it on itself', () => {
      const result = scan({
        [`${APP}/cwa/pages/PrimaryPageTemplate.vue`]: `<template>
  <div>
    <CwaComponentGroup reference="primary" :location="props.iri" />
    <CwaComponentGroup reference="main" :location="iri" />
  </div>
</template>
${iriScript}`,
      }, [template('CwaPagePrimaryPageTemplate', 'cwa/pages/PrimaryPageTemplate.vue')])

      expect(result).toEqual({
        CwaPagePrimaryPageTemplate: [
          { reference: 'primary', location: 'self' },
          { reference: 'main', location: 'self' },
        ],
      })
    })

    test('a component locating its group at publishedIri, or at a local publishedIri.value, declares it on itself', () => {
      const result = scan({
        [`${APP}/cwa/components/Accordion/Accordion.vue`]: `<template>
  <div>
    <CwaComponentGroup
      reference="accordion"
      :location="publishedIri"
      :allowed-components="[CwaComponentNames.AccordionTab]"
    />
  </div>
</template>
<script setup lang="ts">
const props = defineProps<IriProp>()
const { exposeMeta, publishedIri } = useCwaComponent(props)
</script>`,
        [`${APP}/cwa/components/CaseStudyImage/ui/CaseStudyImageColumn.vue`]: `<template>
  <div class="w-1/2">
    <CwaComponentGroup
      reference="caseStudyBody"
      :allowed-components="['/_api/component/case_study_texts']"
      :location="publishedIri.value"
    />
  </div>
</template>
<script setup lang="ts">
const publishedIri = computed(() => $cwa.resources.findPublishedComponentIri(iri.value))
</script>`,
      }, [
        template('CwaComponentAccordion', 'cwa/components/Accordion/Accordion.vue'),
        template('CwaComponentCaseStudyImageUiCaseStudyImageColumn', 'cwa/components/CaseStudyImage/ui/CaseStudyImageColumn.vue'),
      ])

      expect(result).toEqual({
        CwaComponentAccordion: [{ reference: 'accordion', location: 'self' }],
        CwaComponentCaseStudyImageUiCaseStudyImageColumn: [{ reference: 'caseStudyBody', location: 'self' }],
      })
    })

    test('a layout locating its groups at the layout IRI declares layout groups, under a v-if too', () => {
      const result = scan({
        [`${APP}/cwa/layouts/primary.vue`]: `<template>
  <div>
    <CwaComponentGroup
      v-if="$cwa.resources.layoutIri.value"
      reference="top"
      :location="$cwa.resources.layoutIri.value"
      :allowed-components="[CwaComponentNames.NavigationLink]"
    />
    <slot />
    <CwaComponentGroup reference="bottom" :location="layoutIri" />
  </div>
</template>`,
      }, [template('CwaLayoutPrimary', 'cwa/layouts/primary.vue')])

      expect(result).toEqual({
        CwaLayoutPrimary: [
          { reference: 'top', location: 'layout' },
          { reference: 'bottom', location: 'layout' },
        ],
      })
    })

    test('a literal location-reference fixes the full reference, whatever the location', () => {
      const result = scan({
        [`${APP}/cwa/components/HeroSection/HeroSection.vue`]: `<template>
  <section>
    <CwaComponentGroup
      reference="links"
      :location="$cwa.resources.layoutIri.value"
      location-reference="hero-links"
      :allowed-components="[CwaComponentNames.NavigationLink]"
    />
    <CwaComponentGroup reference="quoted" :location="iri" :location-reference="'quoted-ref'" />
  </section>
</template>`,
      }, [template('CwaComponentHeroSection', 'cwa/components/HeroSection/HeroSection.vue')])

      expect(result).toEqual({
        CwaComponentHeroSection: [
          { reference: 'links', location: 'fixed', locationReference: 'hero-links' },
          { reference: 'quoted', location: 'fixed', locationReference: 'quoted-ref' },
        ],
      })
    })

    test('any other location, or a bound location-reference, is unknown', () => {
      const result = scan({
        [`${APP}/cwa/pages/Odd.vue`]: `<template>
  <div>
    <CwaComponentGroup reference="parent" :location="parentIri" />
    <CwaComponentGroup reference="bound-ref" :location="iri" :location-reference="someRef" />
    <CwaComponentGroup reference="literal" location="/_/pages/abc" />
  </div>
</template>`,
      }, [template('CwaPageOdd', 'cwa/pages/Odd.vue')])

      expect(result).toEqual({
        CwaPageOdd: [
          { reference: 'parent', location: 'unknown' },
          { reference: 'bound-ref', location: 'unknown' },
          { reference: 'literal', location: 'unknown' },
        ],
      })
    })

    test('a bound reference is recorded as dynamic, and a v-bind object as dynamic with an unknown location', () => {
      const result = scan({
        [`${APP}/cwa/pages/Dynamic.vue`]: `<template>
  <div>
    <CwaComponentGroup :reference="name" :location="props.iri" />
    <CwaComponentGroup :reference="'quoted'" :location="props.iri" />
    <CwaComponentGroup v-bind="groupProps" />
  </div>
</template>`,
      }, [template('CwaPageDynamic', 'cwa/pages/Dynamic.vue')])

      expect(result).toEqual({
        CwaPageDynamic: [
          { reference: null, location: 'self' },
          { reference: 'quoted', location: 'self' },
          { reference: null, location: 'unknown' },
        ],
      })
    })
  })

  describe('following rendered components', () => {
    test('follows an auto-imported component by its tag, in either case, and with a Lazy prefix', () => {
      const result = scan({
        [`${APP}/cwa/layouts/primary.vue`]: `<template>
  <header>
    <HeaderMenuLinks />
    <header-external-links />
    <LazyFooterLinks />
  </header>
</template>`,
        [`${APP}/components/HeaderMenuLinks.vue`]: `<template>
  <nav>
    <CwaComponentGroup
      v-if="$cwa.resources.layoutIri.value"
      reference="header-menu"
      :location="$cwa.resources.layoutIri.value"
      location-reference="header-menu"
    />
  </nav>
</template>`,
        [`${APP}/components/HeaderExternalLinks.vue`]: `<template>
  <div>
    <CwaComponentGroup reference="header-right-menu" :location="$cwa.resources.layoutIri.value" />
  </div>
</template>`,
        [`${APP}/components/FooterLinks.vue`]: `<template>
  <CwaComponentGroup reference="footer" :location="$cwa.resources.layoutIri.value" />
</template>`,
      }, [template('CwaLayoutPrimary', 'cwa/layouts/primary.vue')], [
        template('HeaderMenuLinks', 'components/HeaderMenuLinks.vue'),
        template('HeaderExternalLinks', 'components/HeaderExternalLinks.vue'),
        template('FooterLinks', 'components/FooterLinks.vue'),
      ])

      expect(result).toEqual({
        CwaLayoutPrimary: [
          { reference: 'header-menu', location: 'fixed', locationReference: 'header-menu' },
          { reference: 'header-right-menu', location: 'layout' },
          { reference: 'footer', location: 'layout' },
        ],
      })
    })

    test('follows a Nuxt layout imported by a CWA layout into the components it renders, counting both v-if and v-else branches', () => {
      const result = scan({
        [`${APP}/cwa/layouts/primary.vue`]: `<template>
  <div>
    <CwaComponentGroup
      v-if="$cwa.resources.layoutIri.value"
      reference="top"
      :location="$cwa.resources.layoutIri.value"
    />
    <Static>
      <slot />
    </Static>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import Static from "~/layouts/static.vue";
</script>`,
        [`${APP}/layouts/static.vue`]: `<script lang="ts" setup>
const $cwa = useCwa()
</script>
<template>
  <div>
    <StaticMenu />
    <slot />
  </div>
</template>`,
        [`${APP}/components/static/Menu.vue`]: `<template>
  <div>
    <ol v-if="open">
      <CwaComponentGroup
        v-if="$cwa.resources.layoutIri.value"
        reference="topHamburgerNav"
        :location="$cwa.resources.layoutIri.value"
      />
      <CwaComponentGroup
        v-else
        reference="fallbackNav"
        :location="$cwa.resources.layoutIri.value"
      />
    </ol>
  </div>
</template>`,
      }, [template('CwaLayoutPrimary', 'cwa/layouts/primary.vue')], [
        template('StaticMenu', 'components/static/Menu.vue'),
      ])

      expect(result).toEqual({
        CwaLayoutPrimary: [
          { reference: 'top', location: 'layout' },
          { reference: 'topHamburgerNav', location: 'layout' },
          { reference: 'fallbackNav', location: 'layout' },
        ],
      })
    })

    test('follows a component loaded with defineAsyncComponent and one imported from #components', () => {
      const result = scan({
        [`${APP}/cwa/components/Html/Html.vue`]: `<template>
  <div>
    <Editor />
    <Icon />
  </div>
</template>
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { SvgIcon as Icon } from '#components'
const Editor = defineAsyncComponent(() => import('../../../components/Editor.vue'))
</script>`,
        [`${APP}/components/Editor.vue`]: `<template><CwaComponentGroup reference="editor" :location="$cwa.resources.layoutIri.value" /></template>`,
        [`${APP}/components/SvgIcon.vue`]: `<template><CwaComponentGroup reference="icon" :location="$cwa.resources.layoutIri.value" /></template>`,
      }, [template('CwaComponentHtml', 'cwa/components/Html/Html.vue')], [
        template('SvgIcon', 'components/SvgIcon.vue'),
      ])

      expect(result).toEqual({
        CwaComponentHtml: [
          { reference: 'editor', location: 'layout' },
          { reference: 'icon', location: 'layout' },
        ],
      })
    })

    test('a group in the slot of another component belongs to the template that writes it', () => {
      const result = scan({
        [`${APP}/cwa/components/PortfolioMedia/PortfolioMedia.vue`]: `<template>
  <StaticPortfolioGallery>
    <CwaComponentGroup
      reference="pageGalleryList"
      :allowed-components="['/_api/component/portfolio_images_mixeds']"
      :location="iri"
    />
  </StaticPortfolioGallery>
</template>
${iriScript}`,
        [`${APP}/components/static/PortfolioGallery.vue`]: `<template><div class="gallery"><slot /></div></template>`,
      }, [template('CwaComponentPortfolioMedia', 'cwa/components/PortfolioMedia/PortfolioMedia.vue')], [
        template('StaticPortfolioGallery', 'components/static/PortfolioGallery.vue'),
      ])

      expect(result).toEqual({
        CwaComponentPortfolioMedia: [{ reference: 'pageGalleryList', location: 'self' }],
      })
    })

    test('a wrapper locating its group at its own location prop is unknown, and its literal location-reference is still fixed', () => {
      const result = scan({
        [`${APP}/cwa/components/HeroSection/HeroSection.vue`]: `<template>
  <div>
    <CwaComponentGroup reference="hero" :location="iri" />
    <TabGroup :location="iri" />
    <AppFooter :location="iri" />
  </div>
</template>`,
        [`${APP}/components/TabGroup.vue`]: `<template>
  <ul>
    <CwaComponentGroup
      ref="tabComponentGroup"
      reference="hero-tabgroup"
      :location="location"
      :allowed-components="['/_api/component/navigation_links']"
    />
  </ul>
</template>
<script lang="ts" setup>
defineProps<{ location?: string }>()
</script>`,
        [`${APP}/components/AppFooter.vue`]: `<template>
  <div>
    <CwaComponentGroup
      v-if="location"
      reference="sponsors"
      :location="location"
      location-reference="footer_sponsors"
    />
  </div>
</template>`,
      }, [template('CwaComponentHeroSection', 'cwa/components/HeroSection/HeroSection.vue')], [
        template('TabGroup', 'components/TabGroup.vue'),
        template('AppFooter', 'components/AppFooter.vue'),
      ])

      expect(result).toEqual({
        CwaComponentHeroSection: [
          { reference: 'hero', location: 'self' },
          { reference: 'hero-tabgroup', location: 'unknown' },
          { reference: 'sponsors', location: 'fixed', locationReference: 'footer_sponsors' },
        ],
      })
    })

    test('an ordinary component locating a group at its own iri is unknown, since that iri is not the template\'s resource', () => {
      const result = scan({
        [`${APP}/cwa/pages/Primary.vue`]: `<template><Wrapper :iri="props.iri" /></template>`,
        [`${APP}/components/Wrapper.vue`]: `<template><CwaComponentGroup reference="wrapped" :location="props.iri" /></template>`,
      }, [template('CwaPagePrimary', 'cwa/pages/Primary.vue')], [
        template('Wrapper', 'components/Wrapper.vue'),
      ])

      expect(result).toEqual({
        CwaPagePrimary: [{ reference: 'wrapped', location: 'unknown' }],
      })
    })

    test('does not follow into another CWA template, by tag or by import', () => {
      const result = scan({
        [`${APP}/cwa/pages/Primary.vue`]: `<template>
  <div>
    <CwaComponentGroup reference="primary" :location="props.iri" />
    <CwaComponentHero />
    <Other />
    <CwaPage />
  </div>
</template>
<script setup lang="ts">
import Other from '../layouts/other.vue'
</script>`,
        [`${APP}/cwa/components/Hero/Hero.vue`]: `<template><CwaComponentGroup reference="hero" :location="iri" /></template>`,
        [`${APP}/cwa/layouts/other.vue`]: `<template><CwaComponentGroup reference="other" :location="$cwa.resources.layoutIri.value" /></template>`,
      }, [
        template('CwaPagePrimary', 'cwa/pages/Primary.vue'),
        template('CwaComponentHero', 'cwa/components/Hero/Hero.vue'),
        template('CwaLayoutOther', 'cwa/layouts/other.vue'),
      ])

      expect(result).toEqual({
        CwaPagePrimary: [{ reference: 'primary', location: 'self' }],
        CwaComponentHero: [{ reference: 'hero', location: 'self' }],
        CwaLayoutOther: [{ reference: 'other', location: 'layout' }],
      })
    })

    test('survives components that render each other, and lists a declaration reached twice once', () => {
      const result = scan({
        [`${APP}/cwa/pages/Loop.vue`]: `<template><First /><Second /></template>`,
        [`${APP}/components/First.vue`]: `<template><div><Second /><CwaComponentGroup reference="first" :location="$cwa.resources.layoutIri.value" /></div></template>`,
        [`${APP}/components/Second.vue`]: `<template><div><First /><CwaComponentGroup reference="second" :location="$cwa.resources.layoutIri.value" /></div></template>`,
      }, [template('CwaPageLoop', 'cwa/pages/Loop.vue')], [
        template('First', 'components/First.vue'),
        template('Second', 'components/Second.vue'),
      ])

      expect(result).toEqual({
        CwaPageLoop: [
          { reference: 'first', location: 'layout' },
          { reference: 'second', location: 'layout' },
        ],
      })
    })

    test('a group imported explicitly from the module is still a declaration', () => {
      const result = scan({
        [`${APP}/cwa/pages/Imported.vue`]: `<template><Group reference="primary" :location="props.iri" /></template>
<script setup lang="ts">
import Group from '#cwa/templates/components/main/ComponentGroup.vue'
</script>`,
      }, [template('CwaPageImported', 'cwa/pages/Imported.vue')])
      const withAlias = scanComponentGroupDeclarations({
        templates: [template('CwaPageImported', 'cwa/pages/Imported.vue')],
        components: [],
        componentGroupFile: GROUP_FILE,
        readFile: file => file === `${APP}/cwa/pages/Imported.vue`
          ? `<template><Group reference="primary" :location="props.iri" /></template>
<script setup lang="ts">
import Group from '#cwa/templates/components/main/ComponentGroup.vue'
</script>`
          : undefined,
        resolveImport: source => source.replace('#cwa', '/module/runtime'),
      })

      expect(result).toEqual({ CwaPageImported: [] })
      expect(withAlias).toEqual({ CwaPageImported: [{ reference: 'primary', location: 'self' }] })
    })
  })

  describe('what cannot be read', () => {
    test('a template that declares no group has an empty entry', () => {
      const result = scan({
        [`${APP}/cwa/components/Text/Text.vue`]: `<template><p>{{ text }}</p></template>`,
      }, [template('CwaComponentText', 'cwa/components/Text/Text.vue')])

      expect(result).toEqual({ CwaComponentText: [] })
    })

    test.each([
      ['cannot be read', undefined],
      ['has a template it cannot parse', '<template lang="pug">div</template>'],
      ['has a script it cannot parse', '<template><div /></template><script setup lang="ts">import {</script>'],
    ])('a followed component that %s makes the template accept any reference', (_, source) => {
      const files: Record<string, string> = {
        [`${APP}/cwa/pages/Primary.vue`]: `<template>
  <div>
    <CwaComponentGroup reference="primary" :location="props.iri" />
    <Child />
  </div>
</template>`,
      }
      if (source !== undefined) {
        files[`${APP}/components/Child.vue`] = source
      }
      const result = scan(files, [template('CwaPagePrimary', 'cwa/pages/Primary.vue')], [
        template('Child', 'components/Child.vue'),
      ])

      expect(result).toEqual({
        CwaPagePrimary: [
          { reference: 'primary', location: 'self' },
          { reference: null, location: 'unknown' },
        ],
      })
    })

    test('ignores components that are not single-file components', () => {
      const result = scan({
        [`${APP}/cwa/pages/Primary.vue`]: `<template><NuxtLink to="/" /></template>`,
      }, [template('CwaPagePrimary', 'cwa/pages/Primary.vue')], [
        { pascalName: 'NuxtLink', filePath: '/nuxt/app/components/nuxt-link.js' },
      ])

      expect(result).toEqual({ CwaPagePrimary: [] })
    })
  })
})
