<script setup lang="ts">
import { computed } from 'vue'
import { CwaUiButton, CwaUiManagerRowDivider, CwaUiManagerTab, CwaUiMenu, CwaUiSegmented, CwaUiToggle } from '#components'
import type { MenuEntry } from '../../../src/runtime/templates/components/core/ui/menu-entries'
import type { KitThemeChoice, KitWidth } from './workbench-settings'
import { useKitWorkbench } from './workbench-state'
import { kitTabs, useKitTab } from './kit-tab'

const { sections, frameWidth } = defineProps<{
  sections: { id: string, label: string }[]
  frameWidth?: number
}>()

const emit = defineEmits<{ jump: [id: string] }>()

const { settings } = useKitWorkbench()
const tab = useKitTab()
const tabModel = computed({
  get: () => tab.value,
  set: (value) => {
    tab.value = value === 'practice' ? 'practice' : 'kit'
  },
})

const themeOptions = [{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]
const widthOptions = [{ value: 'full', label: 'Full' }, { value: '1280', label: '1280' }, { value: '768', label: '768' }, { value: '390', label: '390' }]

const theme = computed({
  get: () => settings.theme,
  set: (value) => {
    settings.theme = (value ?? 'auto') as KitThemeChoice
  },
})
const width = computed({
  get: () => settings.width,
  set: (value) => {
    settings.width = (value ?? 'full') as KitWidth
  },
})
const touch = computed({
  get: () => settings.touch,
  set: (value) => {
    settings.touch = !!value
  },
})
const reducedMotion = computed({
  get: () => settings.reducedMotion,
  set: (value) => {
    settings.reducedMotion = !!value
  },
})

const sectionItems = computed<MenuEntry[]>(() => sections.map(section => ({ label: section.label, value: section.id })))
</script>

<template>
  <div
    class="kit-toolbar"
    data-testid="kit-toolbar"
    @click.stop
  >
    <CwaUiManagerTab>
      <CwaUiSegmented
        v-model="tabModel"
        label="View"
        label-hidden
        :options="kitTabs"
        data-testid="kit-toolbar-tab"
      />
      <CwaUiMenu
        :items="sectionItems"
        label="Sections"
        side="bottom"
        align="start"
        @select="emit('jump', String($event.value))"
      >
        <CwaUiButton
          label="Sections"
          size="sm"
          data-testid="kit-toolbar-sections"
        />
      </CwaUiMenu>
      <CwaUiManagerRowDivider />
      <CwaUiSegmented
        v-model="theme"
        label="Theme"
        :options="themeOptions"
        data-testid="kit-toolbar-theme"
      />
      <CwaUiSegmented
        v-model="width"
        label="Width"
        :options="widthOptions"
        info="Full renders the demos in this page. A fixed width renders them in a frame of that width, so phone layouts, container widths and dialogs change as they would on that screen. Drag the frame's right edge to try other widths."
        data-testid="kit-toolbar-width"
      />
      <span
        v-if="frameWidth"
        class="kit-toolbar-note"
        data-testid="kit-toolbar-frame-width"
      >{{ frameWidth }} px</span>
      <CwaUiManagerRowDivider />
      <CwaUiToggle
        v-model="touch"
        label="Touch"
        info="Turns on the kit's coarse-pointer sizes and turns off its hover-only styles, as on a phone or tablet."
        data-testid="kit-toolbar-touch"
      />
      <CwaUiToggle
        v-model="reducedMotion"
        label="Reduced motion"
        info="Applies the kit's reduced-motion styles, and components that ask the browser get the same answer. The demos remount when it changes."
        data-testid="kit-toolbar-motion"
      />
    </CwaUiManagerTab>
  </div>
</template>

<style scoped>
.kit-toolbar {
  position: sticky;
  top: 0;
  z-index: 740;
  background: var(--cwa-color-surface);
  box-shadow: inset 0 -1px 0 var(--cwa-color-line);
}

.kit-toolbar-note {
  flex: none;
  color: var(--cwa-color-fg-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
</style>
