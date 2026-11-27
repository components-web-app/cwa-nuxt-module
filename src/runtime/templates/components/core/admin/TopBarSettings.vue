<template>
  <div class="cwa:flex cwa:flex-col cwa:gap-3">
    <ul class="cwa:m-0 cwa:flex cwa:list-none cwa:flex-col cwa:p-0">
      <li
        v-for="(choice, index) in choices"
        :key="choice.item.id"
        data-testid="top-bar-choice"
        class="cwa:flex cwa:items-center cwa:gap-3 cwa:border-b cwa:border-line cwa:py-1"
      >
        <component
          :is="builtInIcons[choice.item.id]"
          v-if="builtInIcons[choice.item.id]"
          aria-hidden="true"
          class="cwa:size-5 cwa:shrink-0 cwa:text-fg-muted"
        />
        <span
          v-else
          aria-hidden="true"
          class="cwa:block cwa:size-5 cwa:shrink-0 cwa:text-fg-muted cwa:[&>svg]:size-full"
          v-html="choice.item.icon"
        />
        <CwaUiToggle
          :label="choice.item.label"
          :model-value="choice.shown"
          class="cwa:min-w-0 cwa:flex-1"
          @update:model-value="toggle(choice.item.id, !!$event)"
        />
        <template v-if="choice.shown">
          <CwaUiButton
            size="sm"
            icon-only
            :icon="ChevronDownIcon"
            class="cwa:[&_svg]:rotate-180"
            :label="`Move ${choice.item.label} up`"
            :disabled="index === 0"
            @click="move(index, -1)"
          />
          <CwaUiButton
            size="sm"
            icon-only
            :icon="ChevronDownIcon"
            :label="`Move ${choice.item.label} down`"
            :disabled="index === shownIds.length - 1"
            @click="move(index, 1)"
          />
        </template>
      </li>
    </ul>
    <div>
      <CwaUiButton
        label="Reset to default"
        data-testid="top-bar-reset"
        :disabled="!modelValue"
        @click="emit('update:modelValue', null)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import CwaUiToggle from '#cwa/templates/components/ui/Toggle.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import ChevronDownIcon from '#cwa/templates/components/ui/icon/ChevronDownIcon.vue'
import IconLayouts from '#cwa/templates/components/core/assets/IconLayouts.vue'
import IconPages from '#cwa/templates/components/core/assets/IconPages.vue'
import IconData from '#cwa/templates/components/core/assets/IconData.vue'
import IconRoutes from '#cwa/templates/components/core/assets/IconRoutes.vue'
import IconUsers from '#cwa/templates/components/core/assets/IconUsers.vue'
import { topBarChoices } from '#cwa/admin/top-bar'
import type { CwaExtensionArea } from '#cwa/admin/extension-areas'
// @ts-ignore
import { extensionAreas } from '#build/cwa-extension-areas'
// @ts-ignore
import { topBarDefault } from '#build/cwa-admin-top-bar'

const { modelValue } = defineProps<{
  modelValue: string[] | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[] | null] }>()

const builtInIcons: Record<string, Component> = {
  layouts: IconLayouts,
  pages: IconPages,
  data: IconData,
  routes: IconRoutes,
  users: IconUsers,
}

const choices = computed(() => topBarChoices(extensionAreas as CwaExtensionArea[], { own: modelValue, developer: topBarDefault }))
const shownIds = computed(() => choices.value.filter(choice => choice.shown).map(choice => choice.item.id))

function toggle(id: string, shown: boolean) {
  emit('update:modelValue', shown ? [...shownIds.value, id] : shownIds.value.filter(other => other !== id))
}

function move(index: number, by: number) {
  const ids = [...shownIds.value]
  const [id] = ids.splice(index, 1)
  ids.splice(index + by, 0, id!)
  emit('update:modelValue', ids)
}
</script>
