<script setup lang="ts">
import { computed, ref } from 'vue'
import { definePageMeta, useCwaToast, useHead } from '#imports'
import {
  CwaUiBadge,
  CwaUiButton,
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
} from '#components'
import { fakeFieldModel } from '../kit/fake-field-model'
import type { FakeStatus } from '../kit/fake-field-model'
import type { MenuEntry } from '../../../src/runtime/templates/components/core/ui/menu-entries'
import Toast from '../../../src/runtime/templates/components/core/ui/Toast.vue'
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
const plainText = ref('')
const nullableText = ref<string | null>('Can be emptied')
const plainToggle = ref(false)
const position = ref(2)
const barScheduling = ref(false)
const barPosition = ref(1)
const barReordering = ref(true)
const lastChoice = ref('')
const menuOptions: MenuEntry[] = [
  { label: 'Cancel schedule', value: 'cancel-schedule' },
  { group: null, items: [{ label: 'Add before', value: 'add-before' }, { label: 'Add after', value: 'add-after' }] },
  { group: null, items: [{ label: 'Add to start or end', value: 'add-full', disabled: true, disabledReason: 'Main content is full: 6 of 6 components.' }] },
  { group: null, items: [{ label: 'Clone', value: 'clone' }, { label: 'Move', value: 'move' }, { label: 'Discard', value: 'discard', tone: 'danger' }] },
]

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
