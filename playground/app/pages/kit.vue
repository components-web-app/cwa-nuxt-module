<script setup lang="ts">
import { computed, ref } from 'vue'
import { definePageMeta, useCwaToast, useHead } from '#imports'
import {
  CwaUiAlert,
  CwaUiDialog,
  CwaUiFormSection,
  CwaUiTextarea,
  CwaUiBadge,
  CwaUiButton,
  CwaUiDatePicker,
  CwaUiFileUpload,
  CwaUiMultiSelect,
  CwaUiResourceSearch,
  CwaUiSegmented,
  CwaUiSelect,
  CwaUiIconBinIcon,
  CwaUiIconPlusIcon,
  CwaUiIconTickIcon,
  CwaUiIconXMarkIcon,
  CwaUiInput,
  CwaUiManagerRowDivider,
  CwaUiManagerTab,
  CwaUiNumber,
  CwaUiSpinner,
  CwaUiToggle,
  CwaUiTree,
} from '#components'
import { fakeFieldModel } from '../kit/fake-field-model'
import { fakeDialogForm } from '../kit/fake-dialog-form'
import { useCwaConfirm } from '../../../src/runtime/composables/cwa-confirm'
import type { FakeStatus } from '../kit/fake-field-model'
import type { CwaResource } from '../../../src/runtime/resources/resource-utils'
import type { MenuEntry } from '../../../src/runtime/templates/components/core/ui/menu-entries'
import Toast from '../../../src/runtime/templates/components/core/ui/Toast.vue'
import FormGroup from '../../../src/runtime/templates/components/core/ui/FormGroup.vue'
import ResourceStack from '../../../src/runtime/templates/components/core/ui/ResourceStack.vue'
import type { CwaToastOptions } from '../../../src/runtime/composables/cwa-toast'
import { badgeTintPercent } from '../../../src/runtime/templates/components/ui/kit-looks'
import { kitColourLabel, kitColourTokens, kitContrastPairs, kitThemeStyle, kitTokenCss, measureKitPair } from '../../../src/tailwind/kit-tokens'

definePageMeta({
  cwa: {
    disabled: true,
  },
})

const light = ref(false)
const theme = computed(() => light.value ? 'light' : 'dark')
const themeStyle = computed(() => kitThemeStyle(theme.value))

useHead({
  title: 'CWA admin UI kit',
  htmlAttrs: { style: themeStyle },
})

const ratios = computed(() => kitContrastPairs.map(pair => measureKitPair(pair, theme.value)))

const variants = ['solid', 'soft', 'ghost'] as const
const tones = ['accent', 'danger'] as const
const toast = useCwaToast()
const noop = () => {}
const toastSamples = {
  success: { tone: 'success', title: 'Published', description: 'Hero section on Kitchens.' },
  info: { tone: 'info', title: 'Updated from your other window', description: 'Title and Intro on Hero section.' },
  warning: { tone: 'warning', title: 'Mercure reconnected', description: '3 components on this page changed while you were away.' },
  error: {
    id: 'kit-unmounted',
    tone: 'error',
    title: 'Title wasn’t saved',
    description: 'You switched tabs before it could save.',
    actions: [{ label: 'Show me', primary: true, onClick: noop }, { label: 'Retry', onClick: noop }, { label: 'Reset', onClick: noop }],
  },
  errors: {
    id: 'kit-unmounted-many',
    tone: 'error',
    title: '2 changes weren’t saved',
    description: 'Title and Subtitle, on Hero section. Reset puts back their last saved values.',
    actions: [{ label: 'Show me', primary: true, onClick: noop }, { label: 'Retry all', onClick: noop }, { label: 'Reset all', onClick: noop }],
  },
} satisfies Record<string, CwaToastOptions>
const toastButtons = [
  { key: 'success', label: 'Success' },
  { key: 'info', label: 'Info' },
  { key: 'warning', label: 'Warning' },
  { key: 'error', label: 'Error with actions' },
  { key: 'errors', label: 'Several errors' },
] as const
const staticToasts = [toastSamples.success, toastSamples.warning, toastSamples.errors]

const fieldStatuses: FakeStatus[] = ['idle', 'pending', 'saving', 'saved', 'error', 'conflict']
const inputModels = fieldStatuses.map(status => ({ status, model: fakeFieldModel('Kitchens', status, 'Kitchens & bathrooms') }))
const toggleModels = fieldStatuses.map(status => ({ status, model: fakeFieldModel(true, status, false) }))
const numberModels = fieldStatuses.map(status => ({ status, model: fakeFieldModel(3, status, 4) }))
const selectOptions: MenuEntry[] = [
  { label: 'Default', value: 'default' },
  { label: 'Split image', value: 'split', description: 'Image on one side, text on the other' },
  { group: 'Wide layouts only', items: [{ label: 'Full bleed', value: 'bleed', disabled: true, disabledReason: 'Needs a wide layout' }] },
]
const styleOptions = [
  { label: 'Dark background', value: 'dark' },
  { label: 'Extra padding', value: 'padding' },
  { label: 'Wide', value: 'wide' },
  { label: 'Rounded corners', value: 'rounded' },
]
const selectModels = fieldStatuses.map(status => ({ status, model: fakeFieldModel<string>('split', status, 'default') }))
const multiModels = fieldStatuses.map(status => ({ status, model: fakeFieldModel<string[]>(['padding', 'dark'], status, ['wide']) }))
const segmentModels = fieldStatuses.map(status => ({ status, model: fakeFieldModel<string>('left', status, 'right') }))
const dateModels = fieldStatuses.map(status => ({ status, model: fakeFieldModel<string>('2026-12-01T09:00:00.000Z', status, '2026-12-02T09:00:00.000Z') }))
const plainSelect = ref<string | null>(null)
const plainStyles = ref<string[]>([])
const plainSegment = ref('page')
const plainDate = ref<string | null>(null)
const kitPages: CwaResource[] = Array.from({ length: 42 }, (_, index) => ({ '@id': `/_/routes/${index + 1}`, '@type': 'Route', 'path': index ? `/showrooms/branch-${index}` : '/', '_metadata': { persisted: true } } as CwaResource))
const kitPageLabel = (resource: CwaResource) => resource.path ?? ''
const searchRoute = ref<string | null>(null)
function kitSearch(term: string, pageNumber: number) {
  const found = kitPages.filter(page => (page.path as string).includes(term))
  return new Promise<{ items: CwaResource[], total: number }>(resolve => setTimeout(() => resolve({ items: found.slice((pageNumber - 1) * 20, pageNumber * 20), total: found.length }), 400))
}
const kitSearchForever = () => new Promise<never>(() => {})
const kitPeers = [{ user: { id: '/_/users/mia', name: 'Mia' }, name: 'Mia', colour: '#d946ef', isSelf: false, clientIds: ['kit-mia'] }]
function withPeer<T>(model: ReturnType<typeof fakeFieldModel<T>>) {
  return { ...model, focusedBy: computed(() => kitPeers), focusListeners: { onFocusin: () => {}, onFocusout: () => {}, onPointerdown: () => {} } }
}
const presenceModels = {
  input: withPeer(fakeFieldModel('Kitchens')),
  number: withPeer(fakeFieldModel(3)),
  toggle: withPeer(fakeFieldModel(true)),
  select: withPeer(fakeFieldModel<string>('split')),
  segmented: withPeer(fakeFieldModel<string>('left')),
}
const kitSearchFails = () => Promise.reject(new Error('500'))
const kitSearchNone = async () => ({ items: [], total: 0 })
const kitResolve = async (iri: string) => kitPages.find(page => page['@id'] === iri)
function fakeUpload(file: { name: string, size: string, url?: string, mimeType?: string } | undefined, status: FakeStatus) {
  const model = fakeFieldModel<string | undefined>(file?.name, status)
  return {
    file: computed(() => file),
    state: computed(() => model.state!.value),
    updating: ref(false),
    handleInputChangeFile: async () => {},
    handleInputDeleteFile: async () => {},
    retry: async () => model.retry?.(),
    reset: async () => model.reset?.(),
  }
}
const kitImage = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 3%22%3E%3Crect width=%224%22 height=%223%22 fill=%22%23a3866a%22/%3E%3C/svg%3E'
const uploadSamples = [
  { status: 'idle' as const, upload: fakeUpload({ name: 'workshop-bench.jpg', size: '240 KB', url: kitImage, mimeType: 'image/jpeg' }, 'idle') },
  { status: 'empty' as const, upload: fakeUpload(undefined, 'idle') },
  { status: 'saving' as const, upload: fakeUpload({ name: 'workshop-bench.jpg', size: '240 KB', url: kitImage, mimeType: 'image/jpeg' }, 'saving') },
  { status: 'saved' as const, upload: fakeUpload({ name: 'brochure.pdf', size: '1.2 MB', mimeType: 'application/pdf' }, 'saved') },
  { status: 'error' as const, upload: fakeUpload({ name: 'workshop-bench.jpg', size: '240 KB', url: kitImage, mimeType: 'image/jpeg' }, 'error') },
]
const plainText = ref('')
const nullableText = ref<string | null>('Can be emptied')
const plainToggle = ref(false)
const position = ref(2)
const barScheduling = ref(false)
const barPosition = ref(1)
const barReordering = ref(true)
const lastChoice = ref('')
const treeChoice = ref('')
const treeNodes = [
  { key: '/kitchens', label: '/kitchens', children: [
    { key: '/kitchens/shaker', label: '/kitchens/shaker', children: [{ key: '/kitchens/shaker/painted', label: '/kitchens/shaker/painted' }] },
    { key: '/kitchens/range', label: '/kitchens/range' },
  ] },
  { key: '/old-kitchens', label: '/old-kitchens' },
]
const treeActions = (node: { key: string, label: string }) => [
  { label: `Delete ${node.label}`, danger: true, delete: true, run: () => { treeChoice.value = `Delete ${node.label}` } },
  { label: `More actions for ${node.label}`, menu: [
    { label: 'Edit settings', onSelect: () => { treeChoice.value = `Edit ${node.label}` } },
    { label: 'Go to page', onSelect: () => { treeChoice.value = `Go to ${node.label}` } },
  ] },
]
const menuOptions: MenuEntry[] = [
  { label: 'Cancel schedule', value: 'cancel-schedule' },
  { group: null, items: [{ label: 'Add before', value: 'add-before' }, { label: 'Add after', value: 'add-after' }] },
  { group: null, items: [{ label: 'Add to start or end', value: 'add-full', disabled: true, disabledReason: 'Main content is full: 6 of 6 components.' }] },
  { group: null, items: [{ label: 'Clone', value: 'clone' }, { label: 'Move', value: 'move' }, { label: 'Discard', value: 'discard', tone: 'danger' }] },
]

const stackNames = ['Rich text', 'Component position', 'Left column group', 'Two columns', 'Component position', 'Tab panel group', 'Tabs', 'Component position', 'Main content group']
const stackLevels = stackNames.map((label, index) => ({ key: String(index), label }))
const stackAt = ref<HTMLElement | { x: number, y: number }>()
const stackChoice = ref('')
const stackKey = ref(0)
const stackByKeyboard = ref(false)

function openStackOver(event: MouseEvent) {
  stackKey.value++
  stackByKeyboard.value = event.detail === 0
  stackAt.value = event.currentTarget as HTMLElement
}

function openStackAtPointer(event: MouseEvent) {
  event.preventDefault()
  stackKey.value++
  stackByKeyboard.value = false
  stackAt.value = { x: event.clientX, y: event.clientY }
}

function chooseStackLevel(key: string) {
  stackChoice.value = stackLevels[Number(key)]!.label
}

const dialogOpen = ref(false)
const dialogForm = fakeDialogForm({ reference: 'Shaker kitchens', title: 'Shaker kitchens | Hand-built', metaDescription: 'Hand-built shaker kitchens, made to measure.', isReachableWithoutRoute: false }, { title: kitPeers })
const dialogTabs = [{ label: 'Details', key: 'details' }, { label: 'Info', key: 'info' }]
const pageForm = fakeDialogForm({ siteName: 'Shaker kitchens', canonicalUrl: 'https://shaker.example', maintenanceModeEnabled: false })
const confirm = useCwaConfirm()
const confirmResult = ref('')

async function confirmSimple() {
  const go = await confirm({ title: 'Remove this component?', description: 'It is only used here.', keep: 'Keep it', go: 'Remove', tone: 'danger' })
  confirmResult.value = go ? 'Removed' : 'Kept'
}

async function confirmTyped() {
  const go = await confirm({
    title: 'Delete “Shaker kitchens”?',
    lines: [
      { text: '14 pages built from this template are deleted too. Visitors to their 14 addresses get “Page not found”.', emphasis: 'strong' },
      { text: 'The route /kitchens/shaker is kept, and visitors to it get “Page not found”.', emphasis: 'muted' },
      { text: 'This can\'t be undone.' },
    ],
    keep: 'Don\'t delete',
    go: 'Delete page',
    typed: { noun: 'page name', value: 'Shaker kitchens' },
  })
  confirmResult.value = go ? 'Deleted' : 'Not deleted'
}

const badgeTones = [
  { tone: 'success', label: 'Live' },
  { tone: 'neutral', label: 'Draft' },
  { tone: 'accent', label: 'Scheduled' },
  { tone: 'warning', label: 'Both are set' },
  { tone: 'danger', label: 'Not saved' },
] as const
</script>

<template>
  <div
    class="kit"
    :style="themeStyle"
  >
    <header class="kit-head">
      <h1>CWA admin UI kit</h1>
      <div class="kit-switches">
        <label class="kit-switch">
          <input
            v-model="light"
            type="checkbox"
            role="switch"
            data-testid="kit-light"
          >
          <span>Light theme</span>
        </label>
      </div>
      <p class="kit-note">
        To see reduced motion, use DevTools' "Emulate CSS prefers-reduced-motion".
      </p>
    </header>

    <main>
      <section aria-labelledby="kit-tokens">
        <h2 id="kit-tokens">
          Colour tokens
        </h2>
        <div class="kit-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">
                  Token
                </th>
                <th scope="col">
                  Use
                </th>
                <th scope="col">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="token in kitColourTokens"
                :key="token.name"
              >
                <td>
                  <span class="kit-token">
                    <span
                      class="kit-swatch"
                      :style="{ background: `var(--cwa-color-${token.name})` }"
                    />
                    <code>{{ token.name }}</code>
                  </span>
                </td>
                <td>{{ token.use }}</td>
                <td><code>{{ kitTokenCss(token[theme]) }}</code></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Measured contrast</h3>
        <p class="kit-note">
          Measured in this theme from the values above, which come from <code>kit-tokens.ts</code>; the specs check that <code>cwa.css</code> matches them. Text needs 4.5:1, glyphs and lines 3:1, against the fill they sit on; a badge's tint is its tone at {{ badgeTintPercent }}% over the surface.
        </p>
        <div class="kit-scroll">
          <table data-testid="kit-contrast">
            <thead>
              <tr>
                <th scope="col">
                  Pair
                </th>
                <th scope="col">
                  Use
                </th>
                <th
                  scope="col"
                  class="kit-num"
                >
                  Ratio
                </th>
                <th
                  scope="col"
                  class="kit-num"
                >
                  Needs
                </th>
                <th scope="col">
                  Result
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(pair, index) in kitContrastPairs"
                :key="index"
              >
                <td><code>{{ kitColourLabel(pair.fg) }}</code> on <code>{{ kitColourLabel(pair.bg) }}</code></td>
                <td>{{ pair.use }}</td>
                <td class="kit-num">
                  {{ ratios[index]!.toFixed(2) }}:1
                </td>
                <td class="kit-num">
                  {{ pair.min }}:1
                </td>
                <td :data-result="ratios[index]! >= pair.min ? 'pass' : 'fail'">
                  {{ ratios[index]! >= pair.min ? 'Passes' : 'Fails' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="kit-button">
        <h2 id="kit-button">
          Button
        </h2>
        <p class="kit-note">
          A disabled button with a reason shows it on hover and gives it to screen readers as the button's description.
        </p>
        <template
          v-for="variant in variants"
          :key="variant"
        >
          <template
            v-for="tone in tones"
            :key="tone"
          >
            <h3>{{ variant }}, {{ tone }}</h3>
            <div class="kit-row">
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                :label="tone === 'danger' ? 'Delete' : 'Publish now'"
              />
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                :icon="tone === 'danger' ? CwaUiIconBinIcon : CwaUiIconPlusIcon"
                :label="tone === 'danger' ? 'Delete' : 'Page'"
              />
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                label="Disabled"
                disabled
                disabled-reason="Nothing has changed since the last save"
              />
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                :label="tone === 'danger' ? 'Deleting' : 'Saving'"
                loading
              />
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                size="sm"
                label="Small"
              />
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                size="sm"
                label="Small, loading"
                loading
              />
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                :icon="tone === 'danger' ? CwaUiIconBinIcon : CwaUiIconXMarkIcon"
                :label="tone === 'danger' ? 'Delete' : 'Close'"
                icon-only
              />
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                :icon="tone === 'danger' ? CwaUiIconBinIcon : CwaUiIconXMarkIcon"
                :label="tone === 'danger' ? 'Delete' : 'Close'"
                icon-only
                size="sm"
              />
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                :icon="CwaUiIconXMarkIcon"
                label="Removing"
                icon-only
                loading
              />
              <CwaUiButton
                :variant="variant"
                :tone="tone"
                :icon="CwaUiIconXMarkIcon"
                label="Disabled"
                icon-only
                disabled
              />
            </div>
          </template>
        </template>
      </section>

      <section aria-labelledby="kit-spinner">
        <h2 id="kit-spinner">
          Spinner
        </h2>
        <div class="kit-row">
          <span class="kit-sample"><CwaUiSpinner size="sm" />Small</span>
          <span class="kit-sample"><CwaUiSpinner />Medium</span>
          <span class="kit-sample kit-accent"><CwaUiSpinner />In accent text</span>
        </div>
      </section>

      <section aria-labelledby="kit-badge">
        <h2 id="kit-badge">
          Badge
        </h2>
        <h3>With a dot</h3>
        <div class="kit-row">
          <CwaUiBadge
            v-for="badge in badgeTones"
            :key="badge.tone"
            :tone="badge.tone"
            dot
          >
            {{ badge.label }}
          </CwaUiBadge>
        </div>
        <h3>Without a mark</h3>
        <div class="kit-row">
          <CwaUiBadge
            v-for="badge in badgeTones"
            :key="badge.tone"
            :tone="badge.tone"
          >
            {{ badge.label }}
          </CwaUiBadge>
          <CwaUiBadge tone="accent">
            Shared · 3 places
          </CwaUiBadge>
        </div>
        <h3>With an icon</h3>
        <div class="kit-row">
          <CwaUiBadge
            tone="success"
            :icon="CwaUiIconTickIcon"
          >
            Saved
          </CwaUiBadge>
          <CwaUiBadge
            tone="danger"
            :icon="CwaUiIconXMarkIcon"
          >
            Not saved
          </CwaUiBadge>
        </div>
      </section>

      <section aria-labelledby="kit-fields">
        <h2 id="kit-fields">
          Fields and their save state
        </h2>
        <p class="kit-note">
          Each field binds one of <code>field="…"</code> (inside a manager tab), <code>:model</code> or <code>v-model</code>. The 2px line on the field's bottom edge is its save state: a moving band while saving, a line that grows and fades when saved, solid red when it wasn't saved and amber for a conflict. Focus or hover a red or amber field for Retry and Reset, or the two values. These samples use <code>fakeFieldModel(value, state)</code>; Retry saves and Reset puts the value back.
        </p>
        <h3>Input</h3>
        <div class="kit-stack">
          <div class="kit-row">
            <CwaUiInput
              v-for="sample in inputModels"
              :key="sample.status"
              :label="sample.status"
              :model="sample.model"
              :data-testid="`kit-input-${sample.status}`"
            />
          </div>
          <div class="kit-row">
            <CwaUiInput
              v-model="plainText"
              label="With v-model"
              placeholder="Type here"
              info="Info is behind the ⓘ and also describes the field to screen readers."
            />
            <CwaUiInput
              v-model="nullableText"
              label="Nullable"
              nullable
              width="lg"
            />
            <CwaUiInput
              model-value="Read only"
              label="Read only"
              readonly
            />
            <CwaUiInput
              model-value="Disabled"
              label="Disabled"
              disabled
            />
          </div>
        </div>
        <h3>Toggle</h3>
        <div class="kit-row">
          <CwaUiToggle
            v-for="sample in toggleModels"
            :key="sample.status"
            :label="sample.status"
            :model="sample.model"
          />
          <CwaUiToggle
            v-model="plainToggle"
            label="With v-model and info"
            info="A toggle's ⓘ sits after the switch."
          />
          <CwaUiToggle
            :model-value="true"
            label="Disabled"
            disabled
          />
        </div>
        <h3>Number</h3>
        <p class="kit-note">
          Typing past the range is allowed and marked; on blur or Enter it snaps to the nearest end and says so. The − and + stay focusable at the ends and say why they do nothing. Arrow keys step by one, Page Up and Page Down by five, Home and End go to the ends.
        </p>
        <div class="kit-stack">
          <div class="kit-row">
            <CwaUiNumber
              v-for="sample in numberModels"
              :key="sample.status"
              :label="sample.status"
              :model="sample.model"
              :min="1"
              :max="6"
            />
          </div>
          <div class="kit-row">
            <CwaUiNumber
              v-model="position"
              label="Columns, 1 to 6"
              :min="1"
              :max="6"
              noun="column"
              min-reason="One column is the fewest"
              max-reason="Six columns is the most"
              data-testid="kit-number"
            />
            <CwaUiNumber
              :model-value="3"
              label="Disabled"
              disabled
            />
          </div>
        </div>
        <h3>Someone else in the field</h3>
        <p class="kit-note">
          Another editor's focus rings the field inside its box in their colour and names them on a flag on its top edge that fades after 3 s and comes back on hover. Focus the field yourself and your focus ring replaces theirs, while the flag stays up saying they are editing it too. Every kit field shows it; a disabled one shows it but never reports your own focus. In a manager row or a dialog the flag sits in a layer above the fields, so the row never clips it.
        </p>
        <div
          class="kit-bar"
          data-testid="kit-presence"
        >
          <CwaUiManagerTab>
            <CwaUiInput
              label="Input"
              :model="presenceModels.input"
            />
            <CwaUiNumber
              label="Number"
              :model="presenceModels.number"
              :min="1"
              :max="6"
            />
            <CwaUiToggle
              label="Toggle"
              :model="presenceModels.toggle"
            />
            <CwaUiSelect
              label="Select"
              :model="presenceModels.select"
              :options="selectOptions"
            />
            <CwaUiSegmented
              label="Segmented"
              :model="presenceModels.segmented"
              :options="[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]"
            />
          </CwaUiManagerTab>
        </div>
      </section>

      <section aria-labelledby="kit-choices">
        <h2 id="kit-choices">
          Choices, search, files and dates
        </h2>
        <p class="kit-note">
          The same edge line, popover and binding as the fields above. A Select or MultiSelect choice saves at once; the Style control in the Ui tab maps its style names to class strings through the model's typed mapping.
        </p>
        <h3>Select</h3>
        <div class="kit-stack">
          <div class="kit-row">
            <CwaUiSelect
              v-for="sample in selectModels"
              :key="sample.status"
              :label="sample.status"
              :model="sample.model"
              :options="selectOptions"
            />
          </div>
          <div class="kit-row">
            <CwaUiSelect
              v-model="plainSelect"
              label="Nullable"
              nullable
              none-label="Default"
              :options="selectOptions"
              info="None is the first option and stores null."
            />
            <CwaUiSelect
              model-value="split"
              label="Disabled"
              disabled
              :options="selectOptions"
            />
          </div>
        </div>
        <h3>MultiSelect</h3>
        <p class="kit-note">
          In the bar it shows the first choice as a chip and +N. Type to filter; Backspace in an empty search marks the last chip and a second Backspace removes it.
        </p>
        <div class="kit-stack">
          <div class="kit-row">
            <CwaUiMultiSelect
              v-for="sample in multiModels"
              :key="sample.status"
              :label="sample.status"
              :model="sample.model"
              :options="styleOptions"
            />
          </div>
          <div class="kit-row">
            <CwaUiMultiSelect
              v-model="plainStyles"
              label="Empty, with v-model"
              :options="styleOptions"
            />
          </div>
        </div>
        <h3>Segmented</h3>
        <div class="kit-row">
          <CwaUiSegmented
            v-for="sample in segmentModels"
            :key="sample.status"
            :label="sample.status"
            :model="sample.model"
            :options="[{ value: 'left', label: 'Left' }, { value: 'centre', label: 'Centre' }, { value: 'right', label: 'Right' }]"
          />
          <CwaUiSegmented
            v-model="plainSegment"
            label="Link"
            :options="[{ value: 'page', label: 'Page' }, { value: 'url', label: 'URL' }]"
          />
        </div>
        <h3>ResourceSearch</h3>
        <p class="kit-note">
          Open each to see its state. Results come 20 at a time with the total; slow answers say so after 3 s (5 s for the first load); a stale answer is ignored. The Link field in a manager tab is a Segmented Page / URL over a ResourceSearch and a URL input: a page saves at once, a URL 250 ms after typing stops while it is valid, and the first save after switching clears the other with Undo on its line.
        </p>
        <div class="kit-row">
          <CwaUiResourceSearch
            v-model="searchRoute"
            label="Results"
            endpoint="/_/routes"
            :label-of="kitPageLabel"
            :load="kitSearch"
            :resolve="kitResolve"
            placeholder="Search pages"
          />
          <CwaUiResourceSearch
            :model-value="null"
            label="Loading"
            endpoint="/_/routes"
            :label-of="kitPageLabel"
            :load="kitSearchForever"
          />
          <CwaUiResourceSearch
            :model-value="null"
            label="Server failure"
            endpoint="/_/routes"
            :label-of="kitPageLabel"
            :load="kitSearchFails"
          />
          <CwaUiResourceSearch
            :model-value="null"
            label="Nothing"
            endpoint="/_/routes"
            :label-of="kitPageLabel"
            :load="kitSearchNone"
          />
          <CwaUiResourceSearch
            model-value="/_/routes/7"
            label="Chosen, label loading"
            endpoint="/_/routes"
            :label-of="kitPageLabel"
            :load="kitSearch"
            :resolve="kitSearchForever"
          />
        </div>
        <h3>FileUpload</h3>
        <p class="kit-note">
          Remove asks first and has no Undo: the server deletes the file.
        </p>
        <div class="kit-row">
          <CwaUiFileUpload
            v-for="sample in uploadSamples"
            :key="sample.status"
            :label="sample.status"
            :upload="sample.upload"
            accept="image/*"
          />
        </div>
        <h3>DatePicker</h3>
        <div class="kit-row">
          <CwaUiDatePicker
            v-for="sample in dateModels"
            :key="sample.status"
            :label="sample.status"
            :model="sample.model"
          />
          <CwaUiDatePicker
            v-model="plainDate"
            label="Empty, with v-model"
          />
        </div>
      </section>

      <section aria-labelledby="kit-menu">
        <h2 id="kit-menu">
          Split button and menu
        </h2>
        <p class="kit-note">
          The ⋮ opens a menu anchored to the whole button. A disabled option says why on its second line. Last chosen: <output data-testid="kit-menu-choice">{{ lastChoice || 'nothing yet' }}</output>
        </p>
        <div class="kit-row">
          <CwaUiButton
            label="Publish now"
            variant="solid"
            size="sm"
            :options="menuOptions"
            data-testid="kit-split"
            @select="lastChoice = $event.label"
          />
          <CwaUiButton
            label="Schedule"
            variant="solid"
            size="sm"
            disabled
            disabled-reason="Choose a date first"
            :options="menuOptions"
            @select="lastChoice = $event.label"
          />
          <CwaUiButton
            label="Saving"
            variant="solid"
            size="sm"
            loading
            :options="menuOptions"
          />
          <CwaUiButton
            size="sm"
            :options="menuOptions"
            options-label="Component actions"
            @select="lastChoice = $event.label"
          />
        </div>
      </section>

      <section aria-labelledby="kit-tree">
        <h2 id="kit-tree">
          Tree
        </h2>
        <p class="kit-note">
          A treegrid: arrow keys move between rows, Right and Left open, close and reach a row's actions, Delete runs its delete action. Last action: <output data-testid="kit-tree-choice">{{ treeChoice || 'nothing yet' }}</output>
        </p>
        <div class="kit-stack">
          <CwaUiTree
            label="Example routes"
            :nodes="treeNodes"
            :actions="treeActions"
            data-testid="kit-tree"
          />
          <CwaUiTree
            label="Empty routes"
            :nodes="[]"
            empty="Nothing is nested here."
          />
        </div>
      </section>

      <section aria-labelledby="kit-resource-stack">
        <h2 id="kit-resource-stack">
          Resource stack
        </h2>
        <p class="kit-note">
          Right-click the area, or open it over the button as the header's path selector does. The innermost box's corner sits on the pointer. Last chosen: <output data-testid="kit-stack-choice">{{ stackChoice || 'nothing yet' }}</output>
        </p>
        <div class="kit-stack">
          <div class="kit-row">
            <div
              class="kit-stack-area"
              data-testid="kit-stack-area"
              @contextmenu="openStackAtPointer"
            >
              Right-click here
            </div>
            <CwaUiButton
              label="Rich text"
              size="sm"
              @click="openStackOver"
            />
          </div>
          <ResourceStack
            v-if="stackAt"
            :key="stackKey"
            :levels="stackLevels"
            selected="0"
            :at="stackAt"
            :keyboard="stackByKeyboard"
            :select="chooseStackLevel"
            @close="stackAt = undefined"
          />
        </div>
      </section>

      <section aria-labelledby="kit-bar">
        <h2 id="kit-bar">
          Manager row
        </h2>
        <p class="kit-note">
          A manager tab is one row that never grows the bar: controls sit side by side, and a row too wide for the screen scrolls sideways with a fade at the cut edge, becoming one tab stop.
        </p>
        <div
          class="kit-bar"
          data-testid="kit-bar"
        >
          <CwaUiManagerTab>
            <CwaUiToggle
              v-model="barReordering"
              label="Enable reordering"
              info="Lets you drag components on the page."
            />
            <CwaUiNumber
              v-model="barPosition"
              label="Position"
              :min="1"
              :max="6"
              noun="position"
              decrement-label="Move up"
              increment-label="Move down"
              min-reason="Already first in this group"
              max-reason="Already last in this group"
              :disabled="!barReordering"
            />
            <CwaUiManagerRowDivider />
            <CwaUiToggle
              v-model="barScheduling"
              label="Schedule"
            />
            <CwaUiInput
              :model="inputModels[4]!.model"
              label="Title"
            />
            <CwaUiInput
              :model="inputModels[5]!.model"
              label="Subtitle"
            />
          </CwaUiManagerTab>
        </div>
      </section>

      <section aria-labelledby="kit-dialog">
        <h2 id="kit-dialog">
          Dialog and Save
        </h2>
        <p class="kit-note">
          <code>CwaUiDialog</code> holds a form: fields bound with <code>field="…"</code> edit a local copy, marked ● Unsaved, and nothing is sent until Save. Save says how many changes it sends; closing with changes asks first. A failed Save shows an alert listing each field, which opens its tab. This sample uses <code>fakeDialogForm()</code>.
        </p>
        <div class="kit-stack">
          <div class="kit-row">
            <CwaUiButton
              label="Open page settings"
              data-testid="kit-dialog-open"
              @click="dialogOpen = true"
            />
            <CwaUiButton
              label="Fail the next Save"
              size="sm"
              data-testid="kit-dialog-fail"
              @click="dialogForm.failNext({ reference: 'This reference is already used by another page.' })"
            />
            <CwaUiButton
              label="Conflict on the next Save"
              size="sm"
              data-testid="kit-dialog-conflict"
              @click="dialogForm.conflictNext({ title: 'Shaker kitchens | Made to measure' })"
            />
          </div>
          <CwaUiDialog
            v-if="dialogOpen"
            title="Shaker kitchens"
            :tabs="dialogTabs"
            :form="dialogForm"
            data-testid="kit-dialog"
            @close="dialogOpen = false"
            @save="dialogForm.save()"
          >
            <template #details>
              <CwaUiFormSection>
                <CwaUiInput
                  field="reference"
                  label="Reference"
                  description="Only admins see this. It names the page in lists."
                />
              </CwaUiFormSection>
              <CwaUiFormSection
                title="Search engines"
                description="What people see in search results."
              >
                <CwaUiInput
                  field="title"
                  label="SEO page title"
                  optional
                />
                <CwaUiTextarea
                  field="metaDescription"
                  label="SEO meta description"
                  optional
                  counter
                  :maxlength="160"
                />
              </CwaUiFormSection>
              <CwaUiFormSection title="Nesting">
                <CwaUiToggle
                  field="isReachableWithoutRoute"
                  label="Public without a route"
                />
              </CwaUiFormSection>
            </template>
            <template #info>
              <CwaUiFormSection
                title="Delete this page"
                description="Its route is kept, and visitors to it get “Page not found”."
              >
                <div>
                  <CwaUiButton
                    tone="danger"
                    label="Delete page"
                    @click="confirmTyped"
                  />
                </div>
              </CwaUiFormSection>
            </template>
          </CwaUiDialog>
        </div>
      </section>

      <section aria-labelledby="kit-confirm">
        <h2 id="kit-confirm">
          Confirm
        </h2>
        <p class="kit-note">
          <code>await useCwaConfirm()(options)</code> resolves true for the go action. A typed confirm asks for the name (ignoring case and spaces) before the go action turns on. Last answer: <output data-testid="kit-confirm-result">{{ confirmResult || 'nothing yet' }}</output>
        </p>
        <div class="kit-row">
          <CwaUiButton
            label="Simple confirm"
            data-testid="kit-confirm-simple"
            @click="confirmSimple"
          />
          <CwaUiButton
            label="Typed confirm"
            tone="danger"
            data-testid="kit-confirm-typed"
            @click="confirmTyped"
          />
        </div>
      </section>

      <section aria-labelledby="kit-form-group">
        <h2 id="kit-form-group">
          Admin pages: FormGroup
        </h2>
        <p class="kit-note">
          An admin page with a form (site settings) uses the dialog's Save model on the page: a local copy, nothing sent as you type, and one count, on Save. Cancel and leaving the page ask first while anything is unsaved, and closing the tab gets the browser's prompt. Its sections' headings are <code>h2</code>. This sample uses <code>fakeDialogForm()</code>.
        </p>
        <div class="kit-stack">
          <div class="kit-row">
            <CwaUiButton
              label="Fail the next Save"
              size="sm"
              data-testid="kit-form-group-fail"
              @click="pageForm.failNext({ canonicalUrl: 'Enter a full address, like https://example.com.' })"
            />
          </div>
          <FormGroup
            :form="pageForm"
            data-testid="kit-form-group"
            @save="pageForm.save()"
          >
            <CwaUiFormSection title="General">
              <CwaUiInput
                field="siteName"
                label="Site name"
                width="full"
              />
              <CwaUiInput
                field="canonicalUrl"
                label="Canonical URL"
                type="url"
                width="full"
              />
            </CwaUiFormSection>
            <CwaUiFormSection title="Maintenance">
              <CwaUiToggle
                field="maintenanceModeEnabled"
                label="Enable maintenance mode"
              />
            </CwaUiFormSection>
          </FormGroup>
        </div>
      </section>

      <section aria-labelledby="kit-form-parts">
        <h2 id="kit-form-parts">
          Alerts and sections
        </h2>
        <div class="kit-stack">
          <div class="kit-toasts">
            <CwaUiAlert
              tone="danger"
              title="This page wasn't saved."
            >
              Reference: this reference is already used by another page.
            </CwaUiAlert>
            <CwaUiAlert
              tone="warning"
              title="Mia changed 1 field while you were editing."
            >
              Choose which version to keep, then Save.
            </CwaUiAlert>
            <CwaUiAlert title="Note">
              An info alert has no edge.
            </CwaUiAlert>
          </div>
          <div
            class="kit-toasts"
            data-testid="kit-form-section"
          >
            <CwaUiFormSection
              title="Search engines"
              description="Section titles are fg-secondary."
            >
              <p>A section groups fields in a dialog. The textarea is in the dialog sample above.</p>
            </CwaUiFormSection>
            <CwaUiFormSection title="A second section">
              <p>It has a rule and the section space above it.</p>
            </CwaUiFormSection>
          </div>
        </div>
      </section>

      <section aria-labelledby="kit-toasts">
        <h2 id="kit-toasts">
          Toasts
        </h2>
        <p class="kit-note">
          Raised with <code>useCwaToast()</code>. Success and info go after 4 seconds, warnings after 6; errors and toasts with actions stay until dismissed. At most 3 show, the newest on top; the rest wait and show when room frees up. Raising the same toast again changes nothing; the stack turns see-through while it entirely hides the focused element.
        </p>
        <div
          class="kit-row"
          data-testid="kit-toast-raise"
        >
          <CwaUiButton
            v-for="button in toastButtons"
            :key="button.key"
            :label="button.label"
            size="sm"
            @click="toast.show(toastSamples[button.key])"
          />
        </div>
        <h3>Samples</h3>
        <div
          class="kit-toasts"
          data-testid="kit-toast-samples"
        >
          <Toast
            v-for="sample in staticToasts"
            :key="sample.title"
            :tone="sample.tone"
            :title="sample.title"
            :description="sample.description"
            :actions="'actions' in sample ? sample.actions : undefined"
          />
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.kit {
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  max-width: 100vw;
  min-height: 100vh;
  padding: 1.5rem 1rem 3rem;
  background: var(--cwa-color-surface);
  color: var(--cwa-color-fg);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 0.875rem;
  line-height: 1.45;
}

@media (min-width: 640px) {
  .kit {
    padding: 2rem 2.5rem 4rem;
  }
}

.kit-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--cwa-color-line);
}

h1 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 650;
  line-height: 1.75rem;
}

h2 {
  margin: 2.5rem 0 1rem;
  font-size: 1.125rem;
  font-weight: 650;
  line-height: 1.5rem;
  color: var(--cwa-color-fg-secondary);
}

h3 {
  margin: 1.5rem 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--cwa-color-fg-muted);
}

h3::first-letter {
  text-transform: uppercase;
}

.kit-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.kit-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.5rem;
  cursor: pointer;
  font-weight: 500;
}

.kit-switch input {
  width: 1.125rem;
  height: 1.125rem;
  margin: 0;
  accent-color: var(--cwa-color-accent);
}

.kit-switch input:focus-visible {
  outline: 2px solid var(--cwa-color-accent-fg);
  outline-offset: 2px;
}

.kit-note {
  max-width: 48rem;
  margin: 0 0 0.75rem;
  color: var(--cwa-color-fg-muted);
}

.kit-scroll {
  max-width: 100%;
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  font-size: 0.8125rem;
}

th,
td {
  padding: 0.375rem 1rem 0.375rem 0;
  border-bottom: 1px solid var(--cwa-color-line);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  font-weight: 600;
  color: var(--cwa-color-fg-secondary);
}

.kit-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

[data-result='fail'] {
  color: var(--cwa-color-danger-fg);
  font-weight: 600;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
}

.kit-token {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.kit-swatch {
  width: 1.5rem;
  height: 1.5rem;
  flex: none;
  box-shadow: inset 0 0 0 1px var(--cwa-color-line);
}

.kit-stack-area {
  display: grid;
  place-items: center;
  width: 16rem;
  height: 8rem;
  border: 1px solid var(--cwa-color-line);
  color: var(--cwa-color-fg-muted);
}

.kit-stack {
  display: flex;
  flex-direction: column;
  gap: var(--cwa-spacing-stack);
}

.kit-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.kit-sample {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.kit-toasts {
  display: grid;
  gap: 0.75rem;
  max-width: 22rem;
}

.kit-bar {
  max-width: 100%;
  background: var(--cwa-color-surface);
  box-shadow: inset 0 0 0 1px var(--cwa-color-line);
}

.kit-accent {
  color: var(--cwa-color-accent-fg);
}
</style>
