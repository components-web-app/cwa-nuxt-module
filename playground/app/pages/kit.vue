<script setup lang="ts">
import { nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { definePageMeta, useHead } from '#imports'
import {
  CwaUiBadge,
  CwaUiButton,
  CwaUiIconBinIcon,
  CwaUiIconPlusIcon,
  CwaUiIconTickIcon,
  CwaUiIconXMarkIcon,
  CwaUiSpinner,
} from '#components'
import { kitColourLabel, kitColourTokens, kitContrastPairs, measureKitPair } from '../../../src/tailwind/kit-tokens'
import type { KitColourToken } from '../../../src/tailwind/kit-tokens'

definePageMeta({
  cwa: {
    disabled: true,
  },
})

useHead({ title: 'CWA admin UI kit' })

const light = ref(false)
const reducedMotion = ref(false)
const root = useTemplateRef<HTMLElement>('root')
const values = ref<Partial<Record<KitColourToken, string>>>({})
const ratios = ref<(number | undefined)[]>([])

function measure() {
  if (!root.value) {
    return
  }
  const style = getComputedStyle(root.value)
  const read = (token: KitColourToken) => style.getPropertyValue(`--cwa-color-${token}`).trim()
  values.value = Object.fromEntries(kitColourTokens.map(({ name }) => [name, read(name)]))
  ratios.value = kitContrastPairs.map(pair => measureKitPair(pair, read))
}

onMounted(measure)
watch(light, () => nextTick(measure))

const variants = ['solid', 'soft', 'ghost'] as const
const tones = ['accent', 'danger'] as const
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
    ref="root"
    class="kit"
    :class="{ 'cwa:theme-light': light, 'cwa:reduce-motion': reducedMotion }"
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
        <label class="kit-switch">
          <input
            v-model="reducedMotion"
            type="checkbox"
            role="switch"
            data-testid="kit-reduced-motion"
          >
          <span>Reduced motion</span>
        </label>
      </div>
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
                <td><code>{{ values[token.name] ?? '' }}</code></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Measured contrast</h3>
        <p class="kit-note">
          Measured in this theme from the values above. Text needs 4.5:1, glyphs and lines 3:1, against the fill they sit on; a badge's tint is its tone at 18% over the surface.
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
                  {{ ratios[index] === undefined ? '' : `${ratios[index]!.toFixed(2)}:1` }}
                </td>
                <td class="kit-num">
                  {{ pair.min }}:1
                </td>
                <td :data-result="ratios[index] === undefined ? undefined : ratios[index]! >= pair.min ? 'pass' : 'fail'">
                  {{ ratios[index] === undefined ? '' : ratios[index]! >= pair.min ? 'Passes' : 'Fails' }}
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

.kit-accent {
  color: var(--cwa-color-accent-fg);
}
</style>
