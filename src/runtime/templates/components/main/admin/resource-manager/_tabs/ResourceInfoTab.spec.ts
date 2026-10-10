// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, ref } from 'vue'
import { NEW_RESOURCE_IRI } from '#cwa/storage/stores/resources/state'
import ResourceInfoTab from './ResourceInfoTab.vue'

const iri = ref<string>('/component/abc')
const resourceData = ref<Record<string, any>>({})

const mockCwa = {
  resources: {
    isDataPage: computed(() => false),
  },
  admin: {
    resourceStackManager: {
      isEditingLayout: computed(() => false),
    },
  },
}

vi.mock('#cwa/composables/cwa-resource-manager-tab', () => ({
  useCwaResourceManagerTab: () => ({
    iri,
    resource: computed(() => ({ data: resourceData.value })),
    $cwa: mockCwa,
    exposeMeta: { disabled: ref(false) },
  }),
}))

const ButtonStub = {
  name: 'CwaUiFormButton',
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
}

function mountInfoTab() {
  return mount(ResourceInfoTab, { global: { stubs: { CwaUiFormButton: ButtonStub } } })
}

function publishable(published: boolean) {
  return { '@id': iri.value, '_metadata': { publishable: { published } } }
}

describe('Info tab — delete button names the version being deleted', () => {
  beforeEach(() => {
    iri.value = '/component/abc'
    resourceData.value = {}
  })

  test('a draft of a publishable component says Delete Draft', () => {
    resourceData.value = publishable(false)
    const wrapper = mountInfoTab()

    expect(wrapper.find('button').text()).toBe('Delete Draft')
  })

  test('the live version of a publishable component says Delete Live', () => {
    resourceData.value = publishable(true)
    const wrapper = mountInfoTab()

    expect(wrapper.find('button').text()).toBe('Delete Live')
  })

  test('a resource that is not publishable says Delete', () => {
    resourceData.value = { '@id': iri.value, '_metadata': {} }
    const wrapper = mountInfoTab()

    expect(wrapper.find('button').text()).toBe('Delete')
  })

  test('adding a new resource says Discard, even when it is publishable', () => {
    iri.value = NEW_RESOURCE_IRI
    resourceData.value = publishable(false)
    const wrapper = mountInfoTab()

    expect(wrapper.find('button').text()).toBe('Discard')
  })

  test('the label follows the selected version when the selection changes', async () => {
    resourceData.value = publishable(false)
    const wrapper = mountInfoTab()
    expect(wrapper.find('button').text()).toBe('Delete Draft')

    iri.value = '/component/abc_live'
    resourceData.value = publishable(true)
    await flushPromises()

    expect(wrapper.find('button').text()).toBe('Delete Live')
  })
})
