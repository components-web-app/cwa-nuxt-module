<script setup lang="ts">
import { computed, provide, ref, useTemplateRef, watch } from 'vue'
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import CwaUiButton from './Button.vue'
import CwaUiInput from './Input.vue'
import CwaUiResourceSearch from './ResourceSearch.vue'
import type { ResourceSearchPage } from './ResourceSearch.vue'
import CwaUiToggle from './Toggle.vue'
import { formSurfaceKey } from '../core/ui/field-keys'
import { useCwa } from '#cwa/composables/cwa'
import { isLinkUrl } from '#cwa/resources/link-url'
import type { CwaResource } from '#cwa/resources/resource-utils'

const PER_PAGE = 20

const { at, href = null, newTab = false } = defineProps<{
  at: HTMLElement | { x: number, y: number }
  href?: string | null
  newTab?: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  apply: [link: { href: string, newTab: boolean }]
  remove: []
}>()

provide(formSurfaceKey, { unsaved: () => false, register: () => () => {} })

const $cwa = useCwa()
const url = ref<string | null>(href)
const opensInNewTab = ref(newTab)
const route = ref<string | null>(null)
const touched = ref(false)
const content = useTemplateRef<{ $el: HTMLElement }>('content')
const paths = new Map<string, string>()

const valid = computed(() => isLinkUrl(url.value))
const invalid = computed(() => touched.value && !!url.value && !valid.value ? 'Use /path or https://…' : undefined)

const reference = computed(() => {
  if (at instanceof HTMLElement) {
    return at
  }
  const { x, y } = at
  return { getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 }) }
})

watch(open, (isOpen) => {
  if (!isOpen) {
    return
  }
  url.value = href
  opensInNewTab.value = newTab
  route.value = null
  touched.value = false
}, { immediate: true })

function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  content.value?.$el?.querySelector?.<HTMLInputElement>('input[type="url"]')?.focus()
}

async function loadRoutes(term: string, page: number): Promise<ResourceSearchPage> {
  const params = new URLSearchParams({ perPage: String(PER_PAGE), page: String(page) })
  term && ['search', 'path'].forEach(param => params.append(param, term))
  const response = await $cwa.fetch({ path: `/_/routes?${params.toString()}` }).response
  const items: CwaResource[] = response._data?.member ?? response._data?.['hydra:member'] ?? []
  items.forEach(item => item.path && paths.set(item['@id'], item.path))
  return { items, total: response._data?.totalItems ?? response._data?.['hydra:totalItems'] ?? items.length }
}

function routeLabel(resource: CwaResource) {
  return resource.path ?? resource['@id']
}

const resolving = new Map<string, Promise<CwaResource | undefined>>()

function resolveRoute(iri: string): Promise<CwaResource | undefined> {
  const known = paths.get(iri)
  if (known) {
    return Promise.resolve({ '@id': iri, 'path': known } as unknown as CwaResource)
  }
  let pending = resolving.get(iri)
  if (!pending) {
    pending = $cwa.fetchResource({ path: iri, shallowFetch: true })
    resolving.set(iri, pending)
  }
  return pending
}

watch(route, async (iri) => {
  if (!iri) {
    return
  }
  const path = (await resolveRoute(iri))?.path
  if (path && route.value === iri) {
    url.value = path
  }
})

function apply() {
  touched.value = true
  if (!valid.value || !url.value) {
    return
  }
  emit('apply', { href: url.value, newTab: opensInNewTab.value })
  open.value = false
}

function remove() {
  emit('remove')
  open.value = false
}

function onUrlKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault()
    apply()
  }
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverAnchor :reference="reference" />
    <PopoverPortal>
      <PopoverContent
        ref="content"
        side="bottom"
        align="start"
        :side-offset="6"
        :collision-padding="8"
        role="dialog"
        aria-label="Link"
        data-testid="link-popover"
        class="cwa:z-context cwa:flex cwa:w-[min(22rem,calc(100vw-1rem))] cwa:flex-col cwa:gap-3 cwa:bg-surface-menu cwa:p-3 cwa:text-fg cwa:shadow-popover cwa:outline-1 cwa:outline-transparent"
        @open-auto-focus="onOpenAutoFocus"
        @focus-outside.prevent
      >
        <div data-testid="link-popover-page">
          <CwaUiResourceSearch
            v-model="route"
            label="Page"
            endpoint="/_/routes"
            :load="loadRoutes"
            :resolve="resolveRoute"
            :label-of="routeLabel"
            placeholder="Search pages"
            width="full"
          />
        </div>
        <CwaUiInput
          v-model="url"
          label="URL"
          type="url"
          nullable
          width="full"
          placeholder="/path or https://…"
          :invalid="invalid"
          @keydown="onUrlKeydown"
          @focusout="touched = true"
        />
        <CwaUiToggle
          v-model="opensInNewTab"
          label="Open in a new tab"
        />
        <div class="cwa:flex cwa:items-center cwa:justify-end cwa:gap-2">
          <CwaUiButton
            v-if="href"
            label="Remove link"
            tone="danger"
            variant="ghost"
            @click="remove"
          />
          <CwaUiButton
            label="Apply"
            variant="solid"
            :disabled="!valid"
            @click="apply"
          />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
