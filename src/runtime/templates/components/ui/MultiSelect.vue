<script setup lang="ts">
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxPortal,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxViewport,
} from 'reka-ui'
import Field from '../core/ui/Field.vue'
import type { FieldWidth } from '../core/ui/Field.vue'
import ChevronGlyph from '../core/ui/ChevronGlyph.vue'
import CheckGlyph from '../core/ui/CheckGlyph.vue'
import XMarkIcon from './icon/XMarkIcon.vue'
import SheetSearch from '../core/ui/SheetSearch.vue'
import { opensAsSheet } from '../core/ui/sheet-media'
import { useAnnounce, useFieldModel } from '../core/ui/field-context'
import { fieldBox, fieldDisabled, fieldFill, menuPanel, optionLook, placeholderLook, sheetOptionLook } from '../core/ui/field-looks'
import type { MenuItem } from '../core/ui/menu-entries'
import type { ResourceModelField } from '#cwa/resources/model-editors'

const props = withDefaults(defineProps<{
  label: string
  labelHidden?: boolean
  info?: string
  description?: string
  placeholder?: string
  searchPlaceholder?: string
  width?: FieldWidth
  disabled?: boolean
  disabledReason?: string
  options: MenuItem[]
  field?: string
  model?: ResourceModelField<string[]>
  modelValue?: string[] | null
}>(), {
  labelHidden: false,
  info: undefined,
  description: undefined,
  placeholder: 'None',
  searchPlaceholder: 'Search',
  width: 'md',
  disabled: false,
  disabledReason: undefined,
  field: undefined,
  model: undefined,
  modelValue: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: string[] | null | undefined] }>()

const { model, value, state, unbound } = useFieldModel<string[]>(props, emit)
const announce = useAnnounce()
const id = useId()
const open = ref(false)
const search = ref('')
const armed = ref(false)
const sheetOpen = ref(false)
const sheetId = `${id}-sheet`
const returnTo = ref<HTMLElement | null>()
const anchor = useTemplateRef<{ $el: HTMLElement }>('anchor')
const toggle = useTemplateRef<{ $el: HTMLElement }>('toggle')

function setOpen(next: boolean) {
  if (next && opensAsSheet()) {
    const focused = document.activeElement
    returnTo.value = focused instanceof HTMLElement && anchor.value?.$el.contains(focused) ? focused : toggle.value?.$el
    sheetOpen.value = true
    return
  }
  open.value = next
}

function onAnchorMousedown(event: MouseEvent) {
  opensAsSheet() && event.preventDefault()
}

const chosen = computed(() => value.value ?? [])
const labelOf = (val: string) => props.options.find(option => option.value === val)?.label ?? val
const firstChosen = computed(() => chosen.value[0] === undefined ? undefined : labelOf(chosen.value[0]))
const more = computed(() => Math.max(0, chosen.value.length - 1))

const order = ref<string[]>([])
watch(() => open.value || sheetOpen.value, (isOpen) => {
  if (isOpen) {
    order.value = [...chosen.value]
    return
  }
  search.value = ''
  armed.value = false
})

const listed = computed(() => {
  const query = search.value.trim().toLowerCase()
  const matching = props.options.filter(option => !query || option.label.toLowerCase().includes(query))
  const rank = (option: MenuItem) => {
    const at = order.value.indexOf(option.value ?? '')
    return at === -1 ? Number.POSITIVE_INFINITY : at
  }
  return [...matching].sort((a, b) => rank(a) - rank(b))
})

function write(next: string[]) {
  value.value = next
}

const countText = (count: number) => count ? `${count} selected` : 'None selected'

function choose(next: unknown) {
  armed.value = false
  const picked = Array.isArray(next) ? next.filter((item): item is string => typeof item === 'string') : []
  write(picked)
  announce(countText(picked.length))
}

function remove(val: string) {
  write(chosen.value.filter(item => item !== val))
  announce(`Removed ${labelOf(val)}`)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Backspace' || search.value || !chosen.value.length) {
    armed.value = false
    return
  }
  if (!armed.value) {
    armed.value = true
    announce(`${labelOf(chosen.value.at(-1)!)} marked. Press Backspace again to remove it.`)
    return
  }
  armed.value = false
  remove(chosen.value.at(-1)!)
}

const inactive = computed(() => props.disabled || unbound)
</script>

<template>
  <Field
    :disabled-reason="disabled ? disabledReason : undefined"
    :label="label"
    :label-hidden="labelHidden"
    :info="info"
    :description="description"
    :width="width"
    :state="state"
    :model="model"
    :control-id="id"
    :inactive="inactive"
    :name="field"
    :format="value => Array.isArray(value) ? value.map(labelOf).join(', ') : String(value)"
  >
    <template #default="{ describedBy, tone, busy }">
      <ComboboxRoot
        :open="open"
        :model-value="chosen"
        multiple
        ignore-filter
        open-on-click
        :reset-search-term-on-blur="false"
        :reset-search-term-on-select="false"
        :disabled="inactive"
        @update:open="setOpen"
        @update:model-value="choose"
      >
        <ComboboxAnchor
          ref="anchor"
          :class="[fieldBox, fieldFill(tone, inactive), 'cwa:gap-1.5 cwa:pr-3', { [fieldDisabled]: inactive }]"
          @mousedown="onAnchorMousedown"
        >
          <span
            v-if="!open && firstChosen"
            class="cwa:ml-1 cwa:flex cwa:min-w-0 cwa:shrink cwa:items-center cwa:bg-chip cwa:pl-2 cwa:text-control"
            :class="{ 'cwa:outline-2 cwa:outline-accent-fg': armed }"
            data-testid="multi-chip"
          >
            <span class="cwa:truncate">{{ firstChosen }}</span>
            <button
              type="button"
              :aria-label="`Remove ${firstChosen}`"
              :disabled="inactive"
              class="cwa:grid cwa:h-7 cwa:w-6 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:hover:bg-field-hover cwa:pointer-coarse:size-hit"
              @click.stop="remove(chosen[0]!)"
              @pointerdown.stop
            >
              <XMarkIcon class="cwa:size-3" />
            </button>
          </span>
          <span
            v-if="!open && more"
            class="cwa:shrink-0"
            :class="inactive ? undefined : 'cwa:text-fg-secondary'"
            data-testid="multi-more"
          >+{{ more }}</span>
          <span
            v-if="chosen.length"
            :id="`${id}-count`"
            aria-hidden="true"
            data-testid="multi-count"
            class="cwa:shrink-0 cwa:pl-3 cwa:text-control cwa:whitespace-nowrap cwa:text-fg-secondary"
            :class="{ 'cwa:sr-only': !open }"
          >{{ countText(chosen.length) }}</span>
          <ComboboxInput
            :id="id"
            v-model="search"
            :placeholder="open ? searchPlaceholder : (firstChosen ? '' : placeholder)"
            :aria-describedby="[chosen.length ? `${id}-count` : '', describedBy ?? ''].filter(Boolean).join(' ') || undefined"
            :aria-invalid="tone === 'danger' ? 'true' : undefined"
            :aria-busy="busy ? 'true' : undefined"
            data-testid="multi-input"
            v-bind="sheetOpen ? { 'aria-expanded': 'true', 'aria-controls': sheetId } : {}"
            class="cwa:h-full cwa:w-0 cwa:min-w-0 cwa:flex-1 cwa:appearance-none cwa:border-0 cwa:bg-transparent cwa:px-2 cwa:text-control cwa:text-inherit cwa:outline-none cwa:focus:ring-0 cwa:disabled:cursor-not-allowed cwa:pointer-coarse:text-base"
            :class="[placeholderLook(inactive), { 'cwa:pl-3': !open && !firstChosen }]"
            @keydown="onKeydown"
          />
          <ComboboxTrigger
            ref="toggle"
            :aria-label="`Show ${label} options`"
            data-testid="multi-toggle"
            tabindex="-1"
            class="cwa:grid cwa:h-full cwa:cursor-pointer cwa:place-items-center cwa:disabled:cursor-not-allowed"
          >
            <ChevronGlyph />
          </ComboboxTrigger>
        </ComboboxAnchor>
        <ComboboxPortal>
          <ComboboxContent
            position="popper"
            side="bottom"
            align="start"
            :side-offset="4"
            :collision-padding="8"
            :class="[menuPanel, 'cwa:min-w-(--reka-combobox-trigger-width)']"
            data-testid="multi-menu"
          >
            <ComboboxViewport class="cwa:max-h-72 cwa:overflow-y-auto cwa:py-1">
              <ComboboxEmpty class="cwa:px-3 cwa:py-2 cwa:text-fg-muted">
                Nothing matches “{{ search }}”.
              </ComboboxEmpty>
              <ComboboxItem
                v-for="option in listed"
                :key="option.value"
                :value="option.value ?? option.label"
                :disabled="option.disabled"
                :text-value="option.label"
                :class="optionLook"
              >
                <span class="cwa:flex cwa:min-w-0 cwa:flex-1 cwa:flex-col">
                  <span :class="{ 'cwa:opacity-50': option.disabled }">{{ option.label }}</span>
                  <span
                    v-if="option.disabled && option.disabledReason"
                    class="cwa:text-helper cwa:text-fg-muted"
                  >{{ option.disabledReason }}</span>
                </span>
                <ComboboxItemIndicator><CheckGlyph /></ComboboxItemIndicator>
              </ComboboxItem>
            </ComboboxViewport>
          </ComboboxContent>
        </ComboboxPortal>
      </ComboboxRoot>
      <SheetSearch
        v-if="sheetOpen"
        v-model:open="sheetOpen"
        v-model:query="search"
        multiple
        :model-value="chosen"
        :label="label"
        :placeholder="searchPlaceholder"
        :panel-id="sheetId"
        :return-to="returnTo"
        test-id="multi-sheet"
        @update:model-value="choose"
        @keydown="onKeydown"
      >
        <template #chips>
          <div
            v-if="chosen.length"
            data-testid="multi-sheet-chips"
            class="cwa:flex cwa:shrink-0 cwa:gap-1.5 cwa:overflow-x-auto cwa:px-4 cwa:pb-3 cwa:[scrollbar-width:none]"
          >
            <span
              v-for="(item, index) in chosen"
              :key="item"
              data-testid="multi-sheet-chip"
              class="cwa:flex cwa:shrink-0 cwa:items-center cwa:bg-chip cwa:pl-2 cwa:text-control"
              :class="{ 'cwa:outline-2 cwa:outline-accent-fg': armed && index === chosen.length - 1 }"
            >
              <span class="cwa:whitespace-nowrap">{{ labelOf(item) }}</span>
              <button
                type="button"
                :aria-label="`Remove ${labelOf(item)}`"
                class="cwa:grid cwa:size-hit cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:hover:bg-field-hover"
                @click="remove(item)"
              >
                <XMarkIcon class="cwa:size-3" />
              </button>
            </span>
          </div>
        </template>
        <ComboboxEmpty class="cwa:px-4 cwa:py-2 cwa:text-fg-muted">
          Nothing matches “{{ search }}”.
        </ComboboxEmpty>
        <ComboboxItem
          v-for="option in listed"
          :key="option.value"
          :value="option.value ?? option.label"
          :disabled="option.disabled"
          :text-value="option.label"
          :class="sheetOptionLook"
        >
          <span class="cwa:flex cwa:min-w-0 cwa:flex-1 cwa:flex-col">
            <span :class="{ 'cwa:opacity-50': option.disabled }">{{ option.label }}</span>
            <span
              v-if="option.disabled && option.disabledReason"
              class="cwa:text-helper cwa:text-fg-muted"
            >{{ option.disabledReason }}</span>
          </span>
          <ComboboxItemIndicator><CheckGlyph /></ComboboxItemIndicator>
        </ComboboxItem>
      </SheetSearch>
    </template>
  </Field>
</template>
