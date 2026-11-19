<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import { ComboboxGroup, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxRoot, ListboxContent } from 'reka-ui'
import SearchIcon from './icon/SearchIcon.vue'
import { useAnnounce } from '../core/ui/field-context'
import { fieldBox, fieldFill } from '../core/ui/field-looks'

export interface ComboboxOption {
  value: string
  label: string
  description?: string
}

export interface ComboboxSection {
  key: string
  label: string
  options: ComboboxOption[]
}

const SETTLE = 400

const props = withDefaults(defineProps<{
  label: string
  placeholder?: string
  sections: ComboboxSection[]
  query: string
  noun?: [string, string]
  noneText?: string
  upLeaves?: boolean
}>(), {
  placeholder: undefined,
  noun: () => ['result', 'results'],
  noneText: 'No results',
  upLeaves: false,
})

const emit = defineEmits<{
  'update:query': [query: string]
  'choose': [value: string]
  'leaveTop': []
}>()

defineSlots<{
  header?: () => any
  before?: () => any
  empty?: () => any
  lead?: (props: { option: ComboboxOption }) => any
}>()

interface RekaCombobox {
  highlightItem: (value: string) => void
}

const id = useId()
const root = useTemplateRef<RekaCombobox>('root')
const input = useTemplateRef<{ $el: HTMLInputElement }>('input')
const wrapper = useTemplateRef<HTMLElement>('wrapper')
const announce = useAnnounce()
const highlighted = ref<string>()
const keyboard = ref(false)
let chosenByUser = false

const flat = computed(() => props.sections.flatMap(section => section.options.map(option => ({ option, section }))))
const term = computed(() => props.query.trim().replace(/\s+/g, ' '))
const activeId = computed(() => flat.value.some(entry => entry.option.value === highlighted.value) ? optionId(highlighted.value!) : undefined)

function optionId(value: string) {
  return `${id}-option-${value}`
}

function highlight(value: string | undefined, byKeyboard = false) {
  chosenByUser = true
  keyboard.value = byKeyboard
  if (value === undefined) {
    highlighted.value = undefined
    return
  }
  highlighted.value = value
  root.value?.highlightItem(value)
}

function highlightFirst(byKeyboard = false) {
  highlight(flat.value[0]?.option.value, byKeyboard)
}

const ownLeaves = new WeakSet<Event>()

function stopPointerLeave(event: Event) {
  !ownLeaves.has(event) && event.stopPropagation()
}

function clearHighlight() {
  chosenByUser = false
  keyboard.value = false
  highlighted.value = undefined
  const leave = new PointerEvent('pointerleave')
  ownLeaves.add(leave)
  wrapper.value?.querySelector('[dir]')?.dispatchEvent(leave)
}

watch(() => flat.value.map(entry => entry.option.value).join('\n'), () => {
  if (highlighted.value !== undefined && !flat.value.some(entry => entry.option.value === highlighted.value)) {
    nextTick(clearHighlight)
  }
})

let settle: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(settle))

watch(() => props.query, () => {
  nextTick(clearHighlight)
  clearTimeout(settle)
  settle = setTimeout(() => {
    const count = flat.value.length
    announce(count ? `${count} ${count === 1 ? props.noun[0] : props.noun[1]}` : props.noneText)
  }, SETTLE)
})

function onHighlight(payload: { value: unknown } | undefined) {
  if (!payload || typeof payload.value !== 'string') {
    return
  }
  if (!chosenByUser) {
    nextTick(clearHighlight)
    return
  }
  highlighted.value = payload.value
}

function keepHighlight() {
  nextTick(() => {
    const value = highlighted.value
    value && flat.value.some(entry => entry.option.value === value) && root.value?.highlightItem(value)
  })
}

function indexOfHighlight() {
  return flat.value.findIndex(entry => entry.option.value === highlighted.value)
}

function onKeydownCapture(event: KeyboardEvent) {
  if (event.target !== input.value?.$el) {
    return
  }
  if (props.upLeaves && event.key === 'ArrowUp' && indexOfHighlight() <= 0) {
    event.preventDefault()
    event.stopPropagation()
    keyboard.value = false
    emit('leaveTop')
    return
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.stopPropagation()
    if (event.ctrlKey && flat.value.length) {
      event.preventDefault()
      highlight(flat.value[event.key === 'Home' ? 0 : flat.value.length - 1]!.option.value, true)
    }
    return
  }
  if (event.key === 'Escape' && props.query) {
    event.preventDefault()
    event.stopPropagation()
    emit('update:query', '')
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'PageDown' || event.key === 'PageUp') {
    chosenByUser = true
    keyboard.value = true
  }
}

function onPointerMove(value: string) {
  chosenByUser = true
  if (highlighted.value !== value || keyboard.value) {
    highlighted.value = value
    keyboard.value = false
  }
}

function onSelect(event: Event, value: string) {
  event.preventDefault()
  emit('choose', value)
}

function parts(text: string) {
  const at = term.value ? text.toLowerCase().indexOf(term.value.toLowerCase()) : -1
  if (at < 0) {
    return { before: text }
  }
  return { before: text.slice(0, at), match: text.slice(at, at + term.value.length), after: text.slice(at + term.value.length) }
}

function described(option: ComboboxOption, section: ComboboxSection) {
  return [option.description, section.label].filter(Boolean).join(', ')
}

function focus(byKeyboard = false) {
  input.value?.$el.focus({ preventScroll: true })
  if (byKeyboard) {
    highlightFirst(true)
  }
}

defineExpose({ focus, highlighted })
</script>

<template>
  <div
    ref="wrapper"
    data-testid="combobox"
    @keydown.capture="onKeydownCapture"
    @pointerleave.capture="stopPointerLeave"
  >
    <ComboboxRoot
      ref="root"
      :open="true"
      ignore-filter
      loop
      :reset-search-term-on-blur="false"
      :reset-search-term-on-select="false"
      :model-value="undefined"
      @highlight="onHighlight"
    >
      <div
        data-cwa-sticky
        class="cwa:sticky cwa:top-0 cwa:z-1 cwa:bg-surface cwa:px-6 cwa:pt-5 cwa:pb-3 cwa:max-sm:px-4 cwa:max-sm:pt-4"
      >
        <slot name="header" />
        <div :class="[fieldBox, fieldFill(undefined, false), 'cwa:gap-2 cwa:px-3']">
          <SearchIcon
            aria-hidden="true"
            class="cwa:size-4 cwa:shrink-0 cwa:text-muted-on-field"
          />
          <ComboboxInput
            :id="`${id}-input`"
            ref="input"
            :model-value="query"
            :aria-controls="`${id}-listbox`"
            :aria-activedescendant="activeId"
            :aria-label="label"
            :placeholder="placeholder ?? label"
            spellcheck="false"
            data-testid="combobox-input"
            class="cwa:h-full cwa:min-w-0 cwa:flex-1 cwa:border-0 cwa:bg-transparent cwa:p-0 cwa:text-inherit cwa:outline-none cwa:placeholder:text-muted-on-field cwa:focus:ring-0"
            @update:model-value="emit('update:query', $event)"
            @focus="keepHighlight"
          />
        </div>
      </div>
      <slot name="before" />
      <div
        v-if="!flat.length"
        data-testid="combobox-empty"
        class="cwa:px-3 cwa:max-sm:px-1"
      >
        <slot name="empty" />
      </div>
      <ListboxContent
        :id="`${id}-listbox`"
        :aria-label="label"
        data-testid="combobox-listbox"
        class="cwa:px-3 cwa:pb-4 cwa:max-sm:px-1"
      >
        <ComboboxGroup
          v-for="section in sections"
          :key="section.key"
          data-testid="combobox-section"
        >
          <ComboboxLabel class="cwa:px-4 cwa:pt-3 cwa:pb-1 cwa:text-helper cwa:text-fg-muted">
            {{ section.label }}
          </ComboboxLabel>
          <ComboboxItem
            v-for="option in section.options"
            :id="optionId(option.value)"
            :key="option.value"
            :value="option.value"
            :aria-labelledby="`${optionId(option.value)}-name`"
            :aria-describedby="described(option, section) ? `${optionId(option.value)}-about` : undefined"
            :data-value="option.value"
            data-testid="combobox-option"
            class="cwa:group cwa:relative cwa:flex cwa:min-h-hit cwa:cursor-pointer cwa:items-center cwa:gap-3 cwa:px-4 cwa:py-1.5 cwa:text-control cwa:text-fg cwa:select-none cwa:hover:bg-menu-highlight cwa:data-highlighted:bg-menu-highlight"
            :class="{ 'cwa:outline-2 cwa:-outline-offset-2 cwa:outline-accent-fg': keyboard && highlighted === option.value }"
            @mousedown.prevent
            @pointermove="onPointerMove(option.value)"
            @select="onSelect($event, option.value)"
          >
            <span
              v-if="$slots.lead"
              class="cwa:flex cwa:h-8 cwa:w-12 cwa:shrink-0 cwa:items-center cwa:justify-center"
            >
              <slot
                name="lead"
                :option="option"
              />
            </span>
            <span class="cwa:flex cwa:min-w-0 cwa:flex-1 cwa:flex-col">
              <span
                :id="`${optionId(option.value)}-name`"
                class="cwa:truncate"
              >{{ parts(option.label).before }}<mark
                v-if="parts(option.label).match"
                class="cwa:bg-transparent cwa:font-[650] cwa:text-inherit"
              >{{ parts(option.label).match }}</mark>{{ parts(option.label).after }}</span>
              <span
                v-if="option.description"
                aria-hidden="true"
                class="cwa:text-helper cwa:text-fg-muted cwa:group-hover:text-muted-on-field cwa:group-data-highlighted:text-muted-on-field cwa:max-sm:line-clamp-2 cwa:sm:truncate"
              >{{ option.description }}</span>
            </span>
            <span
              v-if="described(option, section)"
              :id="`${optionId(option.value)}-about`"
              class="cwa:sr-only"
            >{{ described(option, section) }}</span>
          </ComboboxItem>
        </ComboboxGroup>
      </ListboxContent>
    </ComboboxRoot>
  </div>
</template>
