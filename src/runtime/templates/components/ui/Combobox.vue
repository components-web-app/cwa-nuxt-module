<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
import SearchIcon from './icon/SearchIcon.vue'
import { useAnnounce } from '../core/ui/field-context'
import { fieldBox, fieldFill } from '../core/ui/field-looks'

export interface ComboboxOption {
  value: string
  label: string
  description?: string
  detail?: string
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

const id = useId()
const input = useTemplateRef<HTMLInputElement>('input')
const announce = useAnnounce()
const highlighted = ref<string>()
const keyboard = ref(false)

const flat = computed(() => props.sections.flatMap(section => section.options.map(option => ({ option, section }))))
const term = computed(() => props.query.trim().replace(/\s+/g, ' '))

function optionId(value: string) {
  return `${id}-option-${value}`
}

function highlightFirst(byKeyboard = false) {
  highlighted.value = flat.value[0]?.option.value
  keyboard.value = byKeyboard
}

watch(() => flat.value.map(entry => entry.option.value).join('\n'), () => {
  if (!flat.value.some(entry => entry.option.value === highlighted.value)) {
    highlightFirst()
  }
}, { immediate: true })

let settle: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(settle))

function onInput(event: Event) {
  emit('update:query', (event.target as HTMLInputElement).value)
  nextTick(() => highlightFirst())
  clearTimeout(settle)
  settle = setTimeout(() => {
    const count = flat.value.length
    announce(count ? `${count} ${count === 1 ? props.noun[0] : props.noun[1]}` : props.noneText)
  }, SETTLE)
}

function scrollToHighlight() {
  nextTick(() => {
    const element = highlighted.value ? document.getElementById(optionId(highlighted.value)) : null
    element?.scrollIntoView?.({ block: 'nearest' })
  })
}

function move(to: number) {
  const entry = flat.value[to]
  if (!entry) {
    return
  }
  highlighted.value = entry.option.value
  keyboard.value = true
  scrollToHighlight()
}

function onKeydown(event: KeyboardEvent) {
  const count = flat.value.length
  const index = flat.value.findIndex(entry => entry.option.value === highlighted.value)
  if (props.upLeaves && event.key === 'ArrowUp' && index === 0 && keyboard.value) {
    event.preventDefault()
    keyboard.value = false
    emit('leaveTop')
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!count) {
      return
    }
    const step = event.key === 'ArrowDown' ? 1 : -1
    move(index < 0 ? 0 : (index + step + count) % count)
    return
  }
  if ((event.key === 'Home' || event.key === 'End') && event.ctrlKey) {
    event.preventDefault()
    move(event.key === 'Home' ? 0 : count - 1)
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    highlighted.value && emit('choose', highlighted.value)
    return
  }
  if (event.key === 'Escape' && props.query) {
    event.preventDefault()
    event.stopPropagation()
    emit('update:query', '')
  }
}

function onPointerMove(value: string) {
  if (highlighted.value !== value || keyboard.value) {
    highlighted.value = value
    keyboard.value = false
  }
}

function parts(text: string) {
  const at = term.value ? text.toLowerCase().indexOf(term.value.toLowerCase()) : -1
  if (at < 0) {
    return { before: text }
  }
  return { before: text.slice(0, at), match: text.slice(at, at + term.value.length), after: text.slice(at + term.value.length) }
}

function described(option: ComboboxOption, section: ComboboxSection) {
  return [option.description, option.detail, section.label].filter(Boolean).join(', ')
}

function focus(byKeyboard = false) {
  input.value?.focus({ preventScroll: true })
  if (byKeyboard) {
    highlightFirst(true)
    scrollToHighlight()
  }
}

defineExpose({ focus, highlighted })
</script>

<template>
  <div data-testid="combobox">
    <div class="cwa:sticky cwa:top-0 cwa:z-1 cwa:bg-surface cwa:px-6 cwa:pt-5 cwa:pb-3 cwa:max-sm:px-4 cwa:max-sm:pt-4">
      <slot name="header" />
      <div :class="[fieldBox, fieldFill(undefined, false), 'cwa:gap-2 cwa:px-3']">
        <SearchIcon
          aria-hidden="true"
          class="cwa:size-4 cwa:shrink-0 cwa:text-muted-on-field"
        />
        <input
          :id="`${id}-input`"
          ref="input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          :aria-controls="`${id}-listbox`"
          :aria-activedescendant="highlighted ? optionId(highlighted) : undefined"
          :aria-label="label"
          :placeholder="placeholder ?? label"
          :value="query"
          autocomplete="off"
          spellcheck="false"
          data-testid="combobox-input"
          class="cwa:h-full cwa:min-w-0 cwa:flex-1 cwa:border-0 cwa:bg-transparent cwa:p-0 cwa:text-inherit cwa:outline-none cwa:placeholder:text-muted-on-field cwa:focus:ring-0"
          @input="onInput"
          @keydown="onKeydown"
        >
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
    <div
      :id="`${id}-listbox`"
      role="listbox"
      :aria-label="label"
      data-testid="combobox-listbox"
      class="cwa:px-3 cwa:pb-4 cwa:max-sm:px-1"
    >
      <div
        v-for="section in sections"
        :key="section.key"
        role="group"
        :aria-labelledby="`${id}-section-${section.key}`"
        data-testid="combobox-section"
      >
        <div
          :id="`${id}-section-${section.key}`"
          role="presentation"
          class="cwa:px-4 cwa:pt-3 cwa:pb-1 cwa:text-helper cwa:text-fg-muted"
        >
          {{ section.label }}
        </div>
        <div
          v-for="option in section.options"
          :id="optionId(option.value)"
          :key="option.value"
          role="option"
          :aria-selected="highlighted === option.value ? 'true' : 'false'"
          :aria-labelledby="`${optionId(option.value)}-name`"
          :aria-describedby="described(option, section) ? `${optionId(option.value)}-about` : undefined"
          :data-value="option.value"
          :data-highlighted="highlighted === option.value ? '' : undefined"
          data-testid="combobox-option"
          class="cwa:group cwa:relative cwa:flex cwa:min-h-hit cwa:cursor-pointer cwa:items-center cwa:gap-3 cwa:px-4 cwa:py-1.5 cwa:text-control cwa:text-fg cwa:select-none cwa:hover:bg-menu-highlight cwa:data-highlighted:bg-menu-highlight"
          :class="{ 'cwa:outline-2 cwa:-outline-offset-2 cwa:outline-accent-fg': keyboard && highlighted === option.value }"
          @mousedown.prevent
          @pointermove="onPointerMove(option.value)"
          @click="emit('choose', option.value)"
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
            v-if="option.detail"
            aria-hidden="true"
            class="cwa:shrink-0 cwa:text-helper cwa:text-fg-muted cwa:group-hover:text-muted-on-field cwa:group-data-highlighted:text-muted-on-field"
          >{{ option.detail }}</span>
          <span
            v-if="described(option, section)"
            :id="`${optionId(option.value)}-about`"
            class="cwa:sr-only"
          >{{ described(option, section) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
