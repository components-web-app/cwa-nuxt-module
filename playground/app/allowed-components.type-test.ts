import type { CwaAllowedComponent } from '#cwa/types'
import { CwaComponentStyles, CwaComponentUis, definePageMeta } from '#imports'

export const byConstant: CwaAllowedComponent[] = [
  { component: 'HtmlContent', ui: [CwaComponentUis.HtmlContent.default, CwaComponentUis.HtmlContent.AltHtmlContent] },
]

export const byShortName: CwaAllowedComponent[] = [
  { component: 'HtmlContent', ui: ['default', 'AltHtmlContent'] },
  { component: 'UiComponent', ui: [CwaComponentUis.UiComponent.JournalPageLayout] },
]

export const byStyle: CwaAllowedComponent[] = [
  { component: 'HtmlContent', styles: Object.values(CwaComponentStyles.HtmlContent) },
]

export const misspelt: CwaAllowedComponent[] = [
  {
    component: 'HtmlContent',
    ui: [
      // @ts-expect-error a UI the component does not have
      'AltHtmlContnet',
    ],
  },
]

export const anotherComponentsUi: CwaAllowedComponent[] = [
  {
    component: 'UiComponent',
    ui: [
      // @ts-expect-error another component's UI
      'AltHtmlContent',
    ],
  },
]

definePageMeta({
  cwa: {
    disabled: true,
    // @ts-expect-error staticLayout is removed, the layout is named by its reference with layout
    staticLayout: 'CwaLayoutPrimary',
  },
})
