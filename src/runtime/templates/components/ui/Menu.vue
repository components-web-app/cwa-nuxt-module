<script setup lang="ts">
import { POPOVER_GAP } from '../core/ui/popover-gap'
import { computed, reactive, ref, useId, useTemplateRef, watch } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  RovingFocusGroup,
  RovingFocusItem,
} from 'reka-ui'
import BottomSheet from '../core/ui/BottomSheet.vue'
import { opensAsSheet } from '../core/ui/sheet-media'
import { infoPanel } from '../core/ui/field-looks'
import { menuGroups } from '../core/ui/menu-entries'
import type { MenuEntry, MenuItem } from '../core/ui/menu-entries'

defineOptions({ inheritAttrs: false })

const { items, label, at, align = 'end', side = 'top' } = defineProps<{
  items: MenuEntry[]
  label: string
  at?: HTMLElement | { x: number, y: number } | null
  align?: 'start' | 'end'
  side?: 'top' | 'bottom'
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{ select: [item: MenuItem] }>()

defineSlots<{
  default?: () => any
  header?: (props: { sheet: boolean }) => any
}>()

const groups = computed(() => menuGroups(items))

const id = useId()
const sheet = ref(false)
const sheetReturnTo = ref<HTMLElement | null>()
const trigger = useTemplateRef<{ $el?: unknown }>('trigger')
const sheetReasons = reactive(new Set<MenuItem>())

watch(open, (isOpen) => {
  if (!isOpen) {
    sheetReasons.clear()
    return
  }
  sheet.value = opensAsSheet()
  const own = trigger.value?.$el
  sheetReturnTo.value = own instanceof HTMLElement ? own : document.activeElement as HTMLElement | null
}, { immediate: true, flush: 'sync' })

const anchoredOpen = computed({
  get: () => open.value && !sheet.value,
  set: (next: boolean) => {
    open.value = next
  },
})

function pickInSheet(item: MenuItem) {
  if (item.disabled) {
    return
  }
  choose(item)
  open.value = false
}

function toggleSheetReasons(item: MenuItem) {
  sheetReasons.has(item) ? sheetReasons.delete(item) : sheetReasons.add(item)
}

function typeahead(event: KeyboardEvent) {
  if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey || event.key === ' ') {
    return
  }
  const entries = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-sheet-item]:not([data-disabled])')]
  const at = entries.indexOf(document.activeElement as HTMLElement)
  const letter = event.key.toLowerCase()
  const next = [...entries.slice(at + 1), ...entries.slice(0, at + 1)].find(entry => entry.dataset.sheetItem!.toLowerCase().startsWith(letter))
  next?.focus()
}

const firstEnabled = computed(() => groups.value.flatMap(group => group.items).find(item => !item.disabled || item.reasons?.length))

const reference = computed(() => {
  if (!at || (typeof HTMLElement !== 'undefined' && at instanceof HTMLElement)) {
    return at ?? undefined
  }
  const { x, y } = at as { x: number, y: number }
  return {
    getBoundingClientRect: () => ({ x, y, top: y, left: x, right: x, bottom: y, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect,
  }
})

const reasonsFor = ref<{ item: MenuItem, anchor: HTMLElement }>()
const whyElements = new Map<MenuItem, HTMLElement>()

function keepWhy(item: MenuItem, instance: unknown) {
  const element = (instance as { $el?: unknown } | null)?.$el
  element instanceof HTMLElement ? whyElements.set(item, element) : whyElements.delete(item)
}

function choose(item: MenuItem) {
  item.onSelect?.()
  emit('select', item)
}

function showReasons(event: Event, item: MenuItem) {
  event.preventDefault()
  const cell = whyElements.get(item)
  const anchor = cell?.querySelector('svg') ?? cell
  reasonsFor.value = reasonsFor.value?.item === item || !anchor ? undefined : { item, anchor: anchor as HTMLElement }
}

function keepOpenForReasons(event: CustomEvent<{ originalEvent: Event }>) {
  const target = event.detail?.originalEvent?.target
  const layer = target instanceof Element ? target.closest('[data-reka-popper-content-wrapper]') ?? target : undefined
  if (reasonsFor.value && layer?.querySelector('[data-cwa-menu-reasons]')) {
    event.preventDefault()
  }
}

function hideReasons() {
  const anchor = reasonsFor.value?.anchor
  reasonsFor.value = undefined
  anchor?.isConnected && anchor.focus({ preventScroll: true })
}
</script>

<template>
  <DropdownMenuRoot
    v-model:open="anchoredOpen"
    :modal="false"
  >
    <DropdownMenuTrigger
      v-if="$slots.default"
      ref="trigger"
      as-child
    >
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :reference="reference"
        :align="align"
        :side="side"
        :side-offset="4"
        :collision-padding="8"
        :avoid-collisions="true"
        :aria-label="label"
        data-testid="kit-menu"
        class="cwa:z-context cwa:min-w-48 cwa:max-w-72 cwa:max-h-72 cwa:overflow-y-auto cwa:bg-surface-menu cwa:py-1 cwa:text-control cwa:text-fg cwa:shadow-popover cwa:outline-none cwa:motion-safe:data-[state=open]:animate-[cwa-line-in_150ms_ease-out]"
        v-bind="$attrs"
        @focus-outside="keepOpenForReasons"
        @pointer-down-outside="keepOpenForReasons"
      >
        <slot
          name="header"
          :sheet="false"
        />
        <template
          v-for="(group, groupIndex) in groups"
          :key="groupIndex"
        >
          <DropdownMenuSeparator
            v-if="groupIndex > 0"
            class="cwa:my-1 cwa:h-px cwa:bg-line"
          />
          <DropdownMenuGroup>
            <DropdownMenuLabel
              v-if="group.group"
              class="cwa:px-3 cwa:pt-2 cwa:pb-1 cwa:text-helper cwa:text-fg-muted"
            >
              {{ group.group }}
            </DropdownMenuLabel>
            <div
              v-for="(item, itemIndex) in group.items"
              :key="`${groupIndex}-${itemIndex}-${item.label}`"
              class="cwa:flex cwa:items-stretch"
            >
              <DropdownMenuItem
                :disabled="item.disabled"
                :data-testid="item.testId"
                class="cwa:flex cwa:min-h-option cwa:pointer-coarse:min-h-hit cwa:min-w-0 cwa:flex-1 cwa:cursor-pointer cwa:flex-col cwa:justify-center cwa:px-3 cwa:py-1.5 cwa:outline-none cwa:select-none cwa:data-highlighted:bg-menu-highlight cwa:data-highlighted:shadow-[inset_2px_0_0_var(--cwa-color-accent-fg)] cwa:data-disabled:cursor-not-allowed"
                :class="item.tone === 'danger' ? 'cwa:text-danger-fg' : 'cwa:text-fg'"
                @select="choose(item)"
              >
                <span :class="{ 'cwa:opacity-50': item.disabled }">{{ item.label }}</span>
                <span
                  v-if="item.disabled && item.disabledReason && !item.reasons?.length"
                  class="cwa:text-helper cwa:text-fg-muted"
                >{{ item.disabledReason }}</span>
                <span
                  v-else-if="item.description"
                  class="cwa:text-helper cwa:text-fg-muted"
                >{{ item.description }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="item.reasons?.length"
                :ref="instance => keepWhy(item, instance)"
                :aria-label="item.reasonsLabel ?? `Why ${item.label} is unavailable`"
                :aria-expanded="reasonsFor?.item === item ? 'true' : 'false'"
                data-testid="menu-item-why"
                class="cwa:grid cwa:min-h-option cwa:pointer-coarse:min-h-hit cwa:w-option cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg-muted cwa:outline-none cwa:select-none cwa:data-highlighted:bg-menu-highlight cwa:data-highlighted:text-fg cwa:data-highlighted:shadow-[inset_2px_0_0_var(--cwa-color-accent-fg)] cwa:aria-expanded:text-accent-fg cwa:aria-expanded:data-highlighted:text-accent-fg"
                @select="showReasons($event, item)"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  fill="currentColor"
                  class="cwa:size-4"
                ><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm-.9 6v5h1.8V7H7.1Zm.9-3a1.05 1.05 0 1 0 0 2.1A1.05 1.05 0 0 0 8 4Z" /></svg>
              </DropdownMenuItem>
            </div>
          </DropdownMenuGroup>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
  <BottomSheet
    v-if="open && sheet"
    :open="true"
    :label="label"
    :return-to="sheetReturnTo"
    test-id="kit-menu-sheet"
    @update:open="open = $event"
  >
    <template #header>
      <slot
        name="header"
        :sheet="true"
      />
    </template>
    <RovingFocusGroup
      as="div"
      role="menu"
      orientation="vertical"
      loop
      :aria-label="label"
      data-testid="kit-menu"
      class="cwa:py-1 cwa:text-control cwa:text-fg cwa:outline-none"
      v-bind="$attrs"
      @keydown="typeahead"
    >
      <template
        v-for="(group, groupIndex) in groups"
        :key="groupIndex"
      >
        <div
          v-if="groupIndex > 0"
          role="separator"
          class="cwa:my-1 cwa:h-px cwa:bg-line"
        />
        <div
          role="group"
          :aria-labelledby="group.group ? `${id}-group-${groupIndex}` : undefined"
        >
          <div
            v-if="group.group"
            :id="`${id}-group-${groupIndex}`"
            class="cwa:px-4 cwa:pt-3 cwa:pb-1 cwa:text-helper cwa:text-fg-muted"
          >
            {{ group.group }}
          </div>
          <template
            v-for="(item, itemIndex) in group.items"
            :key="`${groupIndex}-${itemIndex}-${item.label}`"
          >
            <div class="cwa:flex cwa:items-stretch">
              <RovingFocusItem
                as="button"
                type="button"
                role="menuitem"
                :focusable="!item.disabled"
                :aria-disabled="item.disabled ? 'true' : undefined"
                :data-sheet-item="item.label"
                :data-sheet-focus="item === firstEnabled && !item.disabled ? '' : undefined"
                :data-testid="item.testId"
                class="cwa:flex cwa:min-h-hit cwa:min-w-0 cwa:flex-1 cwa:cursor-pointer cwa:flex-col cwa:justify-center cwa:px-4 cwa:py-1.5 cwa:text-left cwa:outline-none cwa:select-none cwa:focus-visible:bg-menu-highlight cwa:focus-visible:shadow-[inset_2px_0_0_var(--cwa-color-accent-fg)] cwa:aria-disabled:cursor-not-allowed"
                :class="item.tone === 'danger' ? 'cwa:text-danger-fg' : 'cwa:text-fg'"
                @click="pickInSheet(item)"
              >
                <span :class="{ 'cwa:opacity-50': item.disabled }">{{ item.label }}</span>
                <span
                  v-if="item.disabled && item.disabledReason && !item.reasons?.length"
                  class="cwa:text-helper cwa:text-fg-muted"
                >{{ item.disabledReason }}</span>
                <span
                  v-else-if="item.description"
                  class="cwa:text-helper cwa:text-fg-muted"
                >{{ item.description }}</span>
              </RovingFocusItem>
              <RovingFocusItem
                v-if="item.reasons?.length"
                as="button"
                type="button"
                role="menuitem"
                :aria-label="item.reasonsLabel ?? `Why ${item.label} is unavailable`"
                :aria-expanded="sheetReasons.has(item) ? 'true' : 'false'"
                :aria-controls="`${id}-reasons-${groupIndex}-${itemIndex}`"
                :data-sheet-focus="item === firstEnabled && item.disabled ? '' : undefined"
                data-testid="menu-item-why"
                class="cwa:grid cwa:min-h-hit cwa:w-hit cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg-muted cwa:outline-none cwa:select-none cwa:focus-visible:bg-menu-highlight cwa:focus-visible:shadow-[inset_2px_0_0_var(--cwa-color-accent-fg)] cwa:aria-expanded:text-accent-fg"
                @click="toggleSheetReasons(item)"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  fill="currentColor"
                  class="cwa:size-4"
                ><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm-.9 6v5h1.8V7H7.1Zm.9-3a1.05 1.05 0 1 0 0 2.1A1.05 1.05 0 0 0 8 4Z" /></svg>
              </RovingFocusItem>
            </div>
            <ul
              v-if="item.reasons?.length && sheetReasons.has(item)"
              :id="`${id}-reasons-${groupIndex}-${itemIndex}`"
              role="none"
              data-testid="menu-item-reasons"
              class="cwa:m-0 cwa:flex cwa:list-none cwa:flex-col cwa:gap-2 cwa:px-4 cwa:pt-1 cwa:pb-3 cwa:text-helper cwa:text-fg-muted"
            >
              <li
                v-for="reason of item.reasons"
                :key="reason"
                role="none"
              >
                {{ reason }}
              </li>
            </ul>
          </template>
        </div>
      </template>
    </RovingFocusGroup>
  </BottomSheet>
  <PopoverRoot
    v-if="reasonsFor && open && !sheet"
    :open="true"
    @update:open="value => value || hideReasons()"
  >
    <PopoverAnchor :reference="reasonsFor.anchor" />
    <PopoverPortal>
      <PopoverContent
        side="right"
        :side-offset="POPOVER_GAP"
        :collision-padding="8"
        :aria-label="reasonsFor.item.reasonsLabel ?? `Why ${reasonsFor.item.label} is unavailable`"
        data-testid="menu-item-reasons"
        data-cwa-menu-reasons
        :class="['cwa:z-context cwa:max-w-[min(18rem,calc(100vw-1rem))] cwa:p-popover cwa:text-control cwa:outline-1 cwa:outline-transparent', infoPanel]"
        @close-auto-focus.prevent
      >
        <ul class="cwa:m-0 cwa:flex cwa:list-none cwa:flex-col cwa:gap-3 cwa:p-0">
          <li
            v-for="reason of reasonsFor.item.reasons"
            :key="reason"
            class="cwa:trim-text"
          >
            {{ reason }}
          </li>
        </ul>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
