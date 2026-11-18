<script setup lang="ts">
import { computed } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'reka-ui'
import { menuGroups } from '../core/ui/menu-entries'
import type { MenuEntry, MenuItem } from '../core/ui/menu-entries'

const { items, label, at, align = 'end', side = 'top' } = defineProps<{
  items: MenuEntry[]
  label: string
  at?: HTMLElement | null
  align?: 'start' | 'end'
  side?: 'top' | 'bottom'
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{ select: [item: MenuItem] }>()

const groups = computed(() => menuGroups(items))

function choose(item: MenuItem) {
  item.onSelect?.()
  emit('select', item)
}
</script>

<template>
  <DropdownMenuRoot
    v-model:open="open"
    :modal="false"
  >
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :reference="at ?? undefined"
        :align="align"
        :side="side"
        :side-offset="4"
        :collision-padding="8"
        :aria-label="label"
        data-testid="kit-menu"
        class="cwa:z-context cwa:min-w-48 cwa:max-w-72 cwa:max-h-72 cwa:overflow-y-auto cwa:bg-surface-menu cwa:py-1 cwa:text-control cwa:text-fg cwa:shadow-popover cwa:outline-none cwa:motion-safe:data-[state=open]:animate-[cwa-line-in_150ms_ease-out]"
      >
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
            <DropdownMenuItem
              v-for="(item, itemIndex) in group.items"
              :key="`${groupIndex}-${itemIndex}-${item.label}`"
              :disabled="item.disabled"
              :data-testid="item.testId"
              class="cwa:flex cwa:min-h-option cwa:cursor-pointer cwa:flex-col cwa:justify-center cwa:px-3 cwa:py-1.5 cwa:outline-none cwa:select-none cwa:data-highlighted:bg-menu-highlight cwa:data-highlighted:shadow-[inset_2px_0_0_var(--cwa-color-accent-fg)] cwa:data-disabled:cursor-not-allowed"
              :class="item.tone === 'danger' ? 'cwa:text-danger-fg' : 'cwa:text-fg'"
              @select="choose(item)"
            >
              <span :class="{ 'cwa:opacity-50': item.disabled }">{{ item.label }}</span>
              <span
                v-if="item.disabled && item.disabledReason"
                class="cwa:text-helper cwa:text-fg-muted"
              >{{ item.disabledReason }}</span>
              <span
                v-else-if="item.description"
                class="cwa:text-helper cwa:text-fg-muted"
              >{{ item.description }}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
