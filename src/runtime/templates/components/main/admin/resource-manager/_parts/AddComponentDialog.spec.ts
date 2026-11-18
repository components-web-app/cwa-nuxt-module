// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fieldExplanation } from '../../../../../../../../test/utils/field-info'
import { reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { consola } from 'consola'
import { axe } from '../../../../../../../../test/utils/axe'
import { drawsFocusRing } from '../../../../../../../../test/utils/focus-ring'

const { dynamicOptions, resolvedMeta, cwaState } = vi.hoisted(() => ({
  dynamicOptions: {
    getTypeOptions: vi.fn(),
    getPropertyOptions: vi.fn(),
  },
  resolvedMeta: {} as Record<string, unknown>,
  cwaState: { cwa: null as any },
}))

vi.mock('#cwa/templates/components/main/admin/_common/useDynamicPositionSelectOptions', () => ({
  useDynamicPositionSelectOptions: () => dynamicOptions,
}))

vi.mock('#build/cwa-admin-resources', () => ({
  adminResourceIcons: {
    'lucide:component': '<svg data-cwa-admin-icon data-icon="component"></svg>',
    'lucide:letter-text': '<svg data-cwa-admin-icon data-icon="letter-text"></svg>',
    'lucide:image': '<svg data-cwa-admin-icon data-icon="image"></svg>',
    'lucide:panel-top': '<svg data-cwa-admin-icon data-icon="panel-top"></svg>',
    'skeleton:hero': '<svg data-cwa-admin-icon data-icon="skeleton-hero"></svg>',
  },
  adminResources: {
    HtmlContent: { icon: 'lucide:letter-text', group: 'Text' },
    Image: { icon: 'lucide:image', group: 'Media' },
    Hero: { icon: 'lucide:panel-top', skeleton: 'skeleton:hero', group: 'Layout', image: '/hero.webp' },
    Map: { group: 'Media' },
  },
}))

vi.mock('#cwa/templates/components/core/useDataResolver', () => ({
  useDataResolver: (meta: Ref<unknown[]>, ops: { components: Ref<string[]> }) => {
    meta.value = ops.components.value.map(name => resolvedMeta[name] ?? null)
    return { startDataResolver: vi.fn(), stopDataResolver: vi.fn() }
  },
}))

const { useCwa } = vi.hoisted(() => ({
  useCwa: vi.fn(() => cwaState.cwa),
}))

mockNuxtImport('useCwa', () => useCwa)

enableAutoUnmount(afterEach)

const GROUP = '/_/component_groups/main'

const componentMetadata = {
  HtmlContent: { resourceName: 'HtmlContent', endpoint: '/component/html_contents', isPublishable: true, explicitAllowOnly: false },
  Image: { resourceName: 'Image', endpoint: '/component/images', isPublishable: false, explicitAllowOnly: false },
  Hero: { resourceName: 'Hero', endpoint: '/component/heroes', isPublishable: true, explicitAllowOnly: false },
  Map: { resourceName: 'Map', endpoint: '/component/maps', isPublishable: false, explicitAllowOnly: true },
  Spacer: { resourceName: 'Spacer', endpoint: '/component/spacers', isPublishable: false, explicitAllowOnly: false },
  NoFrontEnd: { resourceName: 'NoFrontEnd', endpoint: '/component/no_front_ends', isPublishable: false, explicitAllowOnly: false },
  ComponentPosition: { resourceName: 'ComponentPosition', endpoint: '/_/component_positions', isPublishable: false, explicitAllowOnly: false },
}

const resourcesConfig = {
  HtmlContent: { name: 'Rich text', description: '<p>Paragraphs &amp; links</p>', ui: ['CwaComponentHtmlContentUiAltHtmlContent'] },
  Image: { name: 'Image', description: 'One image with alt text', instantAdd: true },
  Hero: { name: 'Hero section', description: 'Title, subtitle and image', defaultData: { title: 'New hero' } },
  Map: { name: 'Map location' },
  Spacer: { name: 'Spacer' },
  ComponentPosition: { name: 'Position', instantAdd: true },
}

function makeCwa() {
  const store = reactive<Record<string, any>>({
    [GROUP]: { data: { '@id': GROUP, 'reference': 'Main content_/_/pages/home', 'componentPositions': ['/_/component_positions/1', '/_/component_positions/2', '/_/component_positions/3'] } },
    '/_/component_positions/1': { data: { component: '/component/images/1' } },
    '/_/component_positions/2': { data: { component: '/component/images/2' } },
    '/_/component_positions/3': { data: { component: '/component/html_contents/3' } },
  })
  const addResourceEvent = ref<any>(undefined)
  const newResource = ref<any>(undefined)
  const intro = document.createElement('p')
  intro.textContent = 'Intro text'
  return {
    store,
    getComponentMetadata: vi.fn(async () => componentMetadata),
    resourcesConfig,
    resourcesManager: {
      addResourceEvent,
      clearAddResource: vi.fn(() => {
        addResourceEvent.value = undefined
      }),
      setAddResourceEventResource: vi.fn(),
      addResourceAction: vi.fn(async () => ({ '@id': '/component/images/new' })),
      clearAddResourceEventResource: vi.fn(),
    },
    resources: {
      newResource,
      isDynamicPage: ref(false),
      pageData: ref({ data: { '@type': 'BlogArticleData' } }),
      getResource: vi.fn((iri: string) => ({ get value() { return store[iri] } })),
    },
    admin: {
      eventBus: { emit: vi.fn() },
      resourceStackManager: {
        isEditingLayout: ref(false),
        resourceStack: ref([
          { iri: '/component/html_contents/3', displayName: 'Rich text', domElements: ref([intro]) },
          { iri: '/_/component_positions/3', displayName: 'Position', domElements: ref([]) },
          { iri: GROUP, displayName: 'Group', domElements: ref([]) },
        ]),
      },
    },
  }
}

async function mountDialog() {
  const { default: AddComponentDialog } = await import('./AddComponentDialog.vue')
  return mount(AddComponentDialog, {
    attachTo: document.body,
    global: { components: { CwaComponentHtmlContent: { template: '<div />' }, CwaComponentHtmlContentUiAltHtmlContent: { template: '<div />' } } },
  })
}

async function openDialog(event: Record<string, unknown> = {}) {
  cwaState.cwa.resourcesManager.addResourceEvent.value = { targetIri: '/component/html_contents/3', addAfter: true, closest: { group: GROUP, position: '/_/component_positions/3' }, ...event }
  await flushPromises()
}

const dialog = () => document.querySelector<HTMLElement>('[data-testid="dialog"]')
const q = <T extends HTMLElement = HTMLElement>(selector: string) => dialog()?.querySelector<T>(selector) ?? null
const qa = (selector: string) => [...(dialog()?.querySelectorAll<HTMLElement>(selector) ?? [])]
const search = () => q<HTMLInputElement>('[data-testid="combobox-input"]')!
const optionValues = () => qa('[role="option"]').map(option => option.dataset.value)
const sectionLabels = () => qa('[data-testid="combobox-section"]').map(section => document.getElementById(section.getAttribute('aria-labelledby')!)!.textContent!.trim())
const chipValues = () => qa('[data-testid="add-component-chip"]').map(chip => chip.dataset.value)
const add = () => q<HTMLButtonElement>('[data-testid="add-component-add"]')!
const announcer = () => q('[data-testid="dialog-announcer"]')!.textContent

function shown(element: HTMLElement | null) {
  const copy = element!.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.cwa\\:sr-only').forEach(hidden => hidden.remove())
  return copy.textContent?.replace(/\s+/g, ' ').trim()
}

async function type(value: string) {
  search().value = value
  search().dispatchEvent(new Event('input'))
  await flushPromises()
}

async function key(target: HTMLElement, name: string, init: KeyboardEventInit = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }))
  await flushPromises()
}

async function choose(value: string) {
  qa('[role="option"]').find(option => option.dataset.value === value)!.click()
  await flushPromises()
}

async function pick(testId: string, label: string) {
  const trigger = q(`[data-testid="${testId}"] [data-testid="select-trigger"]`)!
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await flushPromises()
  const option = [...document.querySelectorAll<HTMLElement>('[data-testid="select-menu"] [role="option"]')].find(item => item.textContent?.includes(label))!
  option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  option.click()
  await flushPromises()
}

describe('the add component dialog (#461)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cwaState.cwa = makeCwa()
    dynamicOptions.getTypeOptions.mockResolvedValue([{ label: 'Blog articles', value: 'App\\Entity\\BlogArticleData' }])
    dynamicOptions.getPropertyOptions.mockResolvedValue([{ label: 'Hero image', value: 'heroImage' }])
    for (const name of Object.keys(resolvedMeta)) {
      delete resolvedMeta[name]
    }
  })

  test('stays a centred dialog, as a picker, not a slide-over', async () => {
    await mountDialog()
    await openDialog()

    expect(dialog()!.dataset.placement).toBe('center')
  })

  describe('loading the available components', () => {
    test('shows an error instead of the list when the components cannot be loaded', async () => {
      cwaState.cwa.getComponentMetadata.mockRejectedValueOnce(new Error('Failed to fetch'))
      await mountDialog()

      await openDialog()

      expect(q('[data-testid="dialog-body"]')!.getAttribute('aria-busy')).toBeNull()
      expect(q('[data-testid="add-component-error"]')!.textContent).toContain('Could not load the available components')
    })

    test('loads the components when opened again after a failure', async () => {
      cwaState.cwa.getComponentMetadata.mockRejectedValueOnce(new Error('Failed to fetch'))
      await mountDialog()

      await openDialog()
      cwaState.cwa.resourcesManager.addResourceEvent.value = undefined
      await flushPromises()
      await openDialog()

      expect(q('[data-testid="add-component-error"]')).toBeNull()
      expect(optionValues()).toContain('Hero')
    })

    test('shows the spinner again while a reopened dialog loads', async () => {
      await mountDialog()
      await openDialog()
      cwaState.cwa.resourcesManager.addResourceEvent.value = undefined
      await flushPromises()
      cwaState.cwa.getComponentMetadata.mockReturnValueOnce(new Promise(() => {}))

      await openDialog()

      expect(q('[data-testid="dialog-body"]')!.getAttribute('aria-busy')).toBe('true')
    })
  })

  describe('the list', () => {
    test('is titled Add a component, says where it adds, and focuses the search', async () => {
      await mountDialog()
      await openDialog()

      expect(document.getElementById(dialog()!.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Add a component')
      expect(shown(q('[data-testid="add-component-target"]'))).toBe('To Main content, after “Intro text”')
      expect(document.activeElement).toBe(search())
    })

    test('a selected group says at the start or the end', async () => {
      await mountDialog()
      await openDialog({ targetIri: GROUP, addAfter: false })

      expect(shown(q('[data-testid="add-component-target"]'))).toBe('To Main content, at the start')
    })

    test('the components already in the group are chips, and the list never repeats them', async () => {
      await mountDialog()
      await openDialog()

      expect(chipValues()).toEqual(['Image', 'HtmlContent'])
      expect(qa('[data-testid="add-component-chip"]').every(chip => drawsFocusRing([...chip.classList]))).toBe(true)
      expect(document.getElementById(q('[data-testid="add-component-quick"]')!.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Already in this group')
      const image = qa('[data-testid="add-component-chip"]')[0]!
      expect(document.getElementById(image.getAttribute('aria-describedby')!)!.textContent).toBe('2 here')
      expect(optionValues()).not.toContain('Image')
      expect(optionValues()).not.toContain('HtmlContent')
    })

    test('the chips are left out when the group is empty', async () => {
      cwaState.cwa.store[GROUP].data.componentPositions = []
      await mountDialog()
      await openDialog({ targetIri: GROUP })

      expect(q('[data-testid="add-component-quick"]')).toBeNull()
      expect(optionValues()).toContain('Image')
    })

    test('sections are the configured groups A to Z, then Other, then Dynamic on a page data page', async () => {
      cwaState.cwa.resources.isDynamicPage.value = true
      await mountDialog()
      await openDialog()

      expect(sectionLabels()).toEqual(['Layout', 'Other', 'Dynamic'])
      expect(optionValues()).toEqual(['Hero', 'Spacer', 'ComponentPosition'])
      const dynamic = qa('[role="option"]').at(-1)!
      expect(document.getElementById(dynamic.getAttribute('aria-describedby')!)!.textContent).toBe('Changes per blog article: each blog article picks what shows here, Dynamic')
    })

    test('Dynamic is not offered when editing the layout', async () => {
      cwaState.cwa.resources.isDynamicPage.value = true
      cwaState.cwa.admin.resourceStackManager.isEditingLayout.value = true
      await mountDialog()
      await openDialog()

      expect(sectionLabels()).not.toContain('Dynamic')
      expect(cwaState.cwa.getComponentMetadata).toHaveBeenCalledWith(true, false)
    })

    test('components the group does not allow and components with no front end are never listed', async () => {
      await mountDialog()
      await openDialog()

      expect(optionValues()).not.toContain('Map')
      expect(optionValues()).not.toContain('NoFrontEnd')
    })

    test('a group listing allowed components offers only those', async () => {
      cwaState.cwa.store[GROUP].data.allowedComponents = ['/component/heroes', '/component/maps']
      await mountDialog()
      await openDialog()

      expect(chipValues()).toEqual([])
      expect(optionValues()).toEqual(['Hero', 'Map'])
    })

    test('every row starts with one fixed-size visual: an image, a skeleton, an icon or the generic icon', async () => {
      cwaState.cwa.store[GROUP].data.componentPositions = []
      await mountDialog()
      await openDialog({ targetIri: GROUP })

      const leads = Object.fromEntries(qa('[role="option"]').map(option => [option.dataset.value, option.querySelector<HTMLElement>('[data-lead]')!]))
      expect(leads.Hero!.dataset.lead).toBe('image')
      expect(leads.Image!.innerHTML).toContain('data-icon="image"')
      expect(leads.Spacer!.innerHTML).toContain('data-icon="component"')
      expect(new Set(qa('[role="option"]').map(option => option.querySelector('[data-lead]')!.parentElement!.className)).size).toBe(1)
    })

    test('a description is plain text, and HTML in it warns once in development', async () => {
      const warn = vi.spyOn(consola, 'warn').mockImplementation(() => {})
      await mountDialog()
      await openDialog()
      await type('rich')

      const rich = qa('[role="option"]').find(option => option.dataset.value === 'HtmlContent')!
      expect(shown(rich)).toContain('Paragraphs & links')
      expect(rich.innerHTML).not.toContain('<p>')
      cwaState.cwa.resourcesManager.addResourceEvent.value = undefined
      await flushPromises()
      await openDialog()
      expect(warn.mock.calls.filter(([message]) => String(message).includes('cwa.resources.HtmlContent.description'))).toHaveLength(1)
      warn.mockRestore()
    })
  })

  describe('searching', () => {
    test('hides the chips, lists in-group matches once with their count, and ranks names first', async () => {
      await mountDialog()
      await openDialog()

      await type('i')

      expect(q('[data-testid="add-component-quick"]')).toBeNull()
      expect(optionValues()).toEqual(['Image', 'Hero', 'HtmlContent'])
      const image = qa('[role="option"]')[0]!
      expect(shown(image)).toContain('2 here')
      expect(document.getElementById(image.getAttribute('aria-describedby')!)!.textContent).toBe('One image with alt text, 2 here, Media')
    })

    test('typing a name highlights it first', async () => {
      await mountDialog()
      await openDialog()

      await type('text')

      expect(search().getAttribute('aria-activedescendant')).toBe(qa('[role="option"]')[0]!.id)
      expect(optionValues()[0]).toBe('HtmlContent')
    })

    test('no match says so on one line with the trimmed term and no quotes', async () => {
      await mountDialog()
      await openDialog()

      await type('  gal   lery ')

      expect(shown(q('[data-testid="add-component-none"] span'))).toBe('No component called gal lery')
      expect(q('[data-testid="add-component-none"] b')!.textContent).toBe('gal lery')
      expect(q('[data-testid="add-component-clear"]')!.textContent!.trim()).toBe('Clear search')
    })

    test('a match only on a component the group does not allow says it is not allowed here', async () => {
      await mountDialog()
      await openDialog()

      await type('map')

      expect(shown(q('[data-testid="add-component-none"] span'))).toBe('Map location isn\'t allowed in Main content')
    })

    test('Clear search empties the search and puts focus back in it', async () => {
      await mountDialog()
      await openDialog()
      await type('zzz')

      q<HTMLButtonElement>('[data-testid="add-component-clear"]')!.click()
      await flushPromises()

      expect(search().value).toBe('')
      expect(chipValues()).toEqual(['Image', 'HtmlContent'])
      expect(document.activeElement).toBe(search())
    })

    test('Escape clears the search first, then a second Escape closes the dialog', async () => {
      await mountDialog()
      await openDialog()
      await type('hero')

      await key(search(), 'Escape')
      expect(search().value).toBe('')
      expect(cwaState.cwa.resourcesManager.clearAddResource).not.toHaveBeenCalled()

      await key(search(), 'Escape')
      expect(cwaState.cwa.resourcesManager.clearAddResource).toHaveBeenCalled()
    })
  })

  describe('the detail sub-view', () => {
    test('a click opens it with the name, image, description and where it adds, and Add has focus', async () => {
      await mountDialog()
      await openDialog()

      await choose('Hero')

      const view = q('[data-testid="sub-view"]')!
      expect(document.getElementById(view.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Hero section')
      expect(q('[data-testid="sub-view-back"]')!.getAttribute('aria-label')).toBe('Back to Components')
      expect(q<HTMLImageElement>('[data-testid="add-component-image"]')!.getAttribute('src')).toBe('/hero.webp')
      expect(q<HTMLImageElement>('[data-testid="add-component-image"]')!.alt).toBe('Preview of Hero section')
      expect(shown(q('[data-testid="add-component-description"]'))).toBe('Title, subtitle and image')
      expect(shown(q('[data-testid="add-component-adding-to"]'))).toBe('Adding to Main content, after “Intro text”')
      expect(document.activeElement).toBe(add())
      expect(q('[data-testid="sub-view-main"]')!.hidden).toBe(true)
      expect(announcer()).toBe('Hero section. Adding to Main content, after “Intro text”.')
    })

    test('a component with neither image nor description is just its name, where it adds and Add', async () => {
      await mountDialog()
      await openDialog()

      await choose('Spacer')

      expect(q('[data-testid="add-component-image"]')).toBeNull()
      expect(q('[data-testid="add-component-description"]')).toBeNull()
      expect(q('[data-testid="add-component-ui"]')).toBeNull()
      expect(q('[data-testid="add-component-style"]')).toBeNull()
      expect(shown(q('[data-testid="add-component-adding-to"]'))).toBe('Adding to Main content, after “Intro text”')
    })

    test('shows the icon the list row shows beside its name, hidden from assistive technology', async () => {
      cwaState.cwa.store[GROUP].data.componentPositions = []
      await mountDialog()
      await openDialog()
      const rowIcon = qa('[role="option"]').find(option => option.dataset.value === 'HtmlContent')!.querySelector('[data-lead]')!.innerHTML

      await choose('HtmlContent')

      const lead = q('[data-testid="sub-view-header"] [data-testid="add-component-detail-lead"]')!
      expect(lead.dataset.lead).toBe('icon')
      expect(lead.innerHTML).toBe(rowIcon)
      expect(lead.querySelector('[data-icon="letter-text"]')).not.toBeNull()
      expect(lead.getAttribute('aria-hidden')).toBe('true')
    })

    test('a component with a preview image shows that image, not a second icon in the header', async () => {
      await mountDialog()
      await openDialog()

      await choose('Hero')

      expect(q('[data-testid="add-component-image"]')!.getAttribute('src')).toBe('/hero.webp')
      expect(q('[data-testid="add-component-detail-lead"]')).toBeNull()
    })

    test('a component with no configured icon shows none in the header, nothing inferred', async () => {
      await mountDialog()
      await openDialog()

      expect(qa('[role="option"]').find(option => option.dataset.value === 'Spacer')!.querySelector('[data-lead="icon"]')).not.toBeNull()

      await choose('Spacer')

      expect(q('[data-testid="sub-view-header"] [data-lead]')).toBeNull()
    })

    test('Enter on the highlighted row opens it', async () => {
      await mountDialog()
      await openDialog()
      await type('spa')

      await key(search(), 'Enter')

      expect(document.getElementById(q('[data-testid="sub-view"]')!.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Spacer')
    })

    test('a chip opens it, and Back returns focus to that chip', async () => {
      await mountDialog()
      await openDialog()

      qa('[data-testid="add-component-chip"]')[1]!.click()
      await flushPromises()
      expect(document.getElementById(q('[data-testid="sub-view"]')!.getAttribute('aria-labelledby')!)!.textContent!.trim()).toBe('Rich text')

      q<HTMLButtonElement>('[data-testid="sub-view-back"]')!.click()
      await flushPromises()

      expect(document.activeElement).toBe(qa('[data-testid="add-component-chip"]')[1])
    })

    test('Escape goes back to the list as it was, with focus in the search, and never closes the dialog', async () => {
      await mountDialog()
      await openDialog()
      await type('spa')
      await key(search(), 'Enter')

      await key(add(), 'Escape')

      expect(q('[data-testid="sub-view"]')).toBeNull()
      expect(search().value).toBe('spa')
      expect(document.activeElement).toBe(search())
      expect(cwaState.cwa.resourcesManager.clearAddResource).not.toHaveBeenCalled()
    })

    test('Add creates the component in the group with its default data', async () => {
      await mountDialog()
      await openDialog()
      await choose('Hero')

      add().click()

      expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledWith('Hero', '/component/heroes', true, false, { title: 'New hero' })
    })

    test('an instant add component keeps the Add now label', async () => {
      await mountDialog()
      await openDialog()
      await type('image')
      await key(search(), 'Enter')

      expect(shown(add())).toBe('Add now')
      add().click()
      expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledWith('Image', '/component/images', false, true, {})
    })

    test('the UI and Style chosen go in the create request', async () => {
      resolvedMeta.CwaComponentHtmlContent = { cwaResource: { styles: { classes: { 'Black background': 'bg-black p-2' } } } }
      resolvedMeta.CwaComponentHtmlContentUiAltHtmlContent = { cwaResource: { name: 'Alternative', styles: { classes: { Boxed: ['border', 'p-4'] } } } }
      await mountDialog()
      await openDialog()
      await choose('Spacer')
      await key(add(), 'Escape')
      qa('[data-testid="add-component-chip"]')[1]!.click()
      await flushPromises()

      expect(q('[data-testid="add-component-ui"] [data-testid="select-trigger"]')!.textContent!.trim()).toBe('Default')
      await pick('add-component-style', 'Black background')
      await pick('add-component-ui', 'Alternative')
      expect(q('[data-testid="add-component-style"] [data-testid="select-trigger"]')!.textContent!.trim()).toBe('Default')
      await pick('add-component-style', 'Boxed')
      add().click()

      expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledWith('HtmlContent', '/component/html_contents', true, false, {
        uiComponent: 'CwaComponentHtmlContentUiAltHtmlContent',
        uiClassNames: ['border p-4'],
      })
    })

    test('with the UI and Style shown but left on Default, none is sent for both', async () => {
      resolvedMeta.CwaComponentHtmlContent = { cwaResource: { styles: { classes: { 'Black background': 'bg-black' } } } }
      await mountDialog()
      await openDialog()
      qa('[data-testid="add-component-chip"]')[1]!.click()
      await flushPromises()

      add().click()

      expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledWith('HtmlContent', '/component/html_contents', true, false, { uiComponent: null, uiClassNames: [] })
    })

    describe('the configured default data', () => {
      function configureDefaults(defaultData: Record<string, unknown>) {
        cwaState.cwa.resourcesConfig = { ...resourcesConfig, HtmlContent: { ...resourcesConfig.HtmlContent, defaultData } }
        resolvedMeta.CwaComponentHtmlContent = { cwaResource: { styles: { classes: { 'Black background': 'bg-black p-2' } } } }
        resolvedMeta.CwaComponentHtmlContentUiAltHtmlContent = { cwaResource: { name: 'Alternative', styles: { multiple: true, classes: { Boxed: ['border', 'p-4'], Shadow: 'shadow' } } } }
      }

      async function openHtmlContent() {
        await mountDialog()
        await openDialog()
        qa('[data-testid="add-component-chip"]')[1]!.click()
        await flushPromises()
      }

      const trigger = (testId: string) => q(`[data-testid="${testId}"] [data-testid="select-trigger"], [data-testid="${testId}"] [data-testid="multi-input"]`)!

      test('chooses the UI and the styles the default data sets, and sends them', async () => {
        configureDefaults({ title: 'Hello', uiComponent: 'CwaComponentHtmlContentUiAltHtmlContent', uiClassNames: ['shadow', 'border p-4'] })
        await openHtmlContent()

        expect(trigger('add-component-ui').textContent!.trim()).toBe('Alternative')
        expect(shown(q('[data-testid="add-component-style"]'))).toContain('Boxed')
        add().click()

        expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledWith('HtmlContent', '/component/html_contents', true, false, {
          title: 'Hello',
          uiComponent: 'CwaComponentHtmlContentUiAltHtmlContent',
          uiClassNames: ['border p-4', 'shadow'],
        })
      })

      test('the styles of the default UI are chosen from the default data', async () => {
        configureDefaults({ uiClassNames: ['bg-black p-2'] })
        await openHtmlContent()

        expect(trigger('add-component-ui').textContent!.trim()).toBe('Default')
        expect(trigger('add-component-style').textContent!.trim()).toBe('Black background')
        add().click()

        expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledWith('HtmlContent', '/component/html_contents', true, false, {
          uiComponent: null,
          uiClassNames: ['bg-black p-2'],
        })
      })

      test('choosing Default and no style overwrites the default data with none', async () => {
        configureDefaults({ uiComponent: 'CwaComponentHtmlContentUiAltHtmlContent', uiClassNames: ['shadow'] })
        await openHtmlContent()

        await pick('add-component-ui', 'Default')
        add().click()

        expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledWith('HtmlContent', '/component/html_contents', true, false, {
          uiComponent: null,
          uiClassNames: [],
        })
      })

      test('with no UI or Style to choose, the default data is sent as configured', async () => {
        cwaState.cwa.resourcesConfig = { ...resourcesConfig, Hero: { ...resourcesConfig.Hero, defaultData: { title: 'New hero', uiComponent: 'CwaComponentHeroUiWide', uiClassNames: ['dark'] } } }
        await mountDialog()
        await openDialog()
        await choose('Hero')

        expect(q('[data-testid="add-component-ui"]')).toBeNull()
        expect(q('[data-testid="add-component-style"]')).toBeNull()
        add().click()

        expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledWith('Hero', '/component/heroes', true, false, {
          title: 'New hero',
          uiComponent: 'CwaComponentHeroUiWide',
          uiClassNames: ['dark'],
        })
      })
    })

    describe('Add now while it adds', () => {
      function addingInstantly() {
        let finish!: (resource?: Record<string, unknown>) => void
        cwaState.cwa.resourcesManager.setAddResourceEventResource.mockImplementation(() => {
          cwaState.cwa.resources.newResource.value = { data: { _metadata: { adding: { instantAdd: true } } } }
        })
        cwaState.cwa.resourcesManager.addResourceAction.mockImplementation(() => new Promise((resolve) => {
          finish = resolve
        }))
        cwaState.cwa.resourcesManager.clearAddResourceEventResource.mockImplementation(() => {
          cwaState.cwa.resources.newResource.value = undefined
        })
        return { finish: (resource?: Record<string, unknown>) => finish(resource) }
      }

      async function openImage() {
        await mountDialog()
        await openDialog()
        await type('image')
        await key(search(), 'Enter')
      }

      test('a double click adds once, and Add says it is busy', async () => {
        addingInstantly()
        await openImage()

        add().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
        await flushPromises()
        add().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }))
        await flushPromises()

        expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledTimes(1)
        expect(cwaState.cwa.resourcesManager.addResourceAction).toHaveBeenCalledTimes(1)
        expect(add().getAttribute('aria-disabled')).toBe('true')
        expect(add().getAttribute('aria-busy')).toBe('true')
      })

      test('a second click before the add starts adds nothing more', async () => {
        addingInstantly()
        await openImage()

        add().click()
        add().click()
        await flushPromises()

        expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledTimes(1)
      })

      test('focus that was in the detail goes to Add when the spinner replaces it, and stays there when the add fails', async () => {
        const { finish } = addingInstantly()
        await openImage()
        const back = q('[data-testid="sub-view-back"]')!
        back.focus()

        add().click()
        await flushPromises()
        expect(q('[data-testid="add-component-detail"]')).toBeNull()
        expect(document.activeElement).toBe(add())

        finish(undefined)
        await flushPromises()

        expect(q('[data-testid="add-component-detail"]')).not.toBeNull()
        expect(document.activeElement).toBe(add())
        expect(add().hasAttribute('aria-disabled')).toBe(false)
      })
    })
  })

  describe('Add before a component is chosen', () => {
    test('is not in the footer on the list, shows on the detail and goes again after Back', async () => {
      await mountDialog()
      await openDialog()

      expect(q('[data-testid="add-component-add"]')).toBeNull()
      expect(qa('footer button').map(shown)).toEqual(['Cancel'])

      await choose('Spacer')

      expect(qa('footer button').map(shown)).toEqual(['Cancel', 'Add'])
      expect(document.activeElement).toBe(add())

      await key(add(), 'Escape')

      expect(q('[data-testid="sub-view"]')).toBeNull()
      expect(q('[data-testid="add-component-add"]')).toBeNull()
      expect(dialog()).not.toBeNull()
      expect(document.activeElement).toBe(search())

      await choose('Spacer')
      q<HTMLButtonElement>('[data-testid="sub-view-back"]')!.click()
      await flushPromises()

      expect(q('[data-testid="add-component-add"]')).toBeNull()
      expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).not.toHaveBeenCalled()
    })

    test('Cancel closes the dialog', async () => {
      await mountDialog()
      await openDialog()

      q<HTMLButtonElement>('[data-testid="add-component-cancel"]')!.click()
      await flushPromises()

      expect(cwaState.cwa.resourcesManager.clearAddResource).toHaveBeenCalled()
      expect(dialog()).toBeNull()
    })
  })

  describe('Dynamic', () => {
    async function openDynamic() {
      cwaState.cwa.resources.isDynamicPage.value = true
      await mountDialog()
      await openDialog()
      await choose('ComponentPosition')
    }

    test('Field is visibly disabled until a data type is chosen, with its reason behind its ⓘ and read with the field, and Data type has focus', async () => {
      await openDynamic()

      const field = q('[data-testid="add-component-field"] [data-testid="select-trigger"]')!
      expect(field.getAttribute('aria-disabled')).toBe('true')
      expect(field.hasAttribute('disabled')).toBe(false)
      expect(field.className).toContain('cwa:opacity-50')
      expect(q('[data-testid="add-component-field"] [data-testid="field-info"]')).not.toBeNull()
      expect(field.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent).join(' ')).toContain('Choose a data type first.')
      expect(document.activeElement).toBe(q('[data-testid="add-component-data-type"] [data-testid="select-trigger"]'))
      expect(add().getAttribute('aria-disabled')).toBe('true')
      expect(document.getElementById(add().getAttribute('aria-describedby')!)!.textContent).toBe('Choose a data type and a field first.')
    })

    test('while a data type\'s fields load, Field says Loading… and stays disabled, as the old dialog did', async () => {
      let resolveFields: (options: { label: string, value: string }[]) => void = () => undefined
      dynamicOptions.getPropertyOptions.mockReturnValueOnce(new Promise((resolve) => {
        resolveFields = resolve
      }))
      await openDynamic()

      await pick('add-component-data-type', 'Blog articles')
      const field = () => q('[data-testid="add-component-field"] [data-testid="select-trigger"]')!
      expect(shown(field())).toContain('Loading…')
      expect(field().getAttribute('aria-disabled')).toBe('true')

      resolveFields([{ label: 'Hero image', value: 'heroImage' }])
      await flushPromises()
      expect(shown(field())).toContain('Choose a field')
      expect(field().getAttribute('aria-disabled')).toBeNull()
    })

    test('choosing a data type enables Field with its options, and Add sends the position with both', async () => {
      await openDynamic()

      await pick('add-component-data-type', 'Blog articles')
      const field = q('[data-testid="add-component-field"] [data-testid="select-trigger"]')!
      expect(field.getAttribute('aria-disabled')).toBeNull()
      expect(fieldExplanation(q('[data-testid="add-component-field"]')!, 'The page data property that holds the component.')).toEqual({ info: true, line: false })
      expect(dynamicOptions.getPropertyOptions).toHaveBeenCalledWith('App\\Entity\\BlogArticleData', null)
      await pick('add-component-field', 'Hero image')

      expect(shown(add())).toBe('Add now')
      add().click()
      expect(cwaState.cwa.resourcesManager.setAddResourceEventResource).toHaveBeenCalledWith('ComponentPosition', '/_/component_positions', false, true, {
        pageDataClass: 'App\\Entity\\BlogArticleData',
        pageDataProperty: 'heroImage',
      })
    })
  })

  describe('keyboard between the chips and the list', () => {
    test('arrows move along the chips, and Down goes to the list with the first option highlighted', async () => {
      await mountDialog()
      await openDialog()
      const chips = qa('[data-testid="add-component-chip"]')
      expect(chips.map(chip => chip.tabIndex)).toEqual([0, -1])

      chips[0]!.focus()
      await key(chips[0]!, 'ArrowRight')
      expect(document.activeElement).toBe(chips[1])
      expect(chips.map(chip => chip.tabIndex)).toEqual([-1, 0])
      await key(chips[1]!, 'Home')
      expect(document.activeElement).toBe(chips[0])

      await key(chips[0]!, 'ArrowDown')
      expect(document.activeElement).toBe(search())
      expect(search().getAttribute('aria-activedescendant')).toBe(qa('[role="option"]')[0]!.id)

      await key(search(), 'ArrowUp')
      expect(document.activeElement).toBe(chips[0])
    })
  })

  test('an instant add, once saved, is added and selected, as before', async () => {
    await mountDialog()
    await openDialog()

    cwaState.cwa.resources.newResource.value = { data: { _metadata: { adding: { instantAdd: true } } } }
    await flushPromises()

    expect(cwaState.cwa.resourcesManager.addResourceAction).toHaveBeenCalled()
    expect(cwaState.cwa.admin.eventBus.emit).toHaveBeenCalledWith('selectResource', '/component/images/new')
    expect(cwaState.cwa.resourcesManager.clearAddResourceEventResource).toHaveBeenCalled()
  })

  test.each(['list', 'search', 'no match', 'not allowed', 'detail', 'detail without image', 'dynamic', 'dynamic typed'])('has no axe violations: %s', async (state) => {
    cwaState.cwa.resources.isDynamicPage.value = true
    await mountDialog()
    await openDialog()
    if (state === 'search') {
      await type('i')
    }
    if (state === 'no match') {
      await type('zzz')
    }
    if (state === 'not allowed') {
      await type('map')
    }
    if (state === 'detail') {
      await choose('Hero')
    }
    if (state === 'detail without image') {
      await choose('Spacer')
    }
    if (state.startsWith('dynamic')) {
      await choose('ComponentPosition')
    }
    if (state === 'dynamic typed') {
      await pick('add-component-data-type', 'Blog articles')
    }

    expect(await axe(document.body)).toHaveNoViolations()
  })
})
