<template>
  <ListHeading title="Layouts" />
  <ListContent fetch-url="/_/layouts">
    <template #item="data">
      <div class="cwa-flex cwa-border-b cwa-border-b-stone-700 cwa-py-4 cwa-space-x-4 cwa-items-center">
        <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
          <span class="cwa-text-xl">{{ data.reference }}</span>
          <span class="cwa-text-stone-400">UI: {{ getDisplayLayoutUi(data.uiComponent) }}</span>
        </div>
        <div>
          <CwaUiFormButton>
            <CwaUiIconCogIcon class="cwa-w-6" />
            <span class="cwa-sr-only">Settings</span>
          </CwaUiFormButton>
        </div>
      </div>
    </template>
  </ListContent>
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'

function getDisplayLayoutUi (ui: string) {
  return ui.replace(/CwaLayout/, '')
}

useHead({
  title: 'Layouts'
})
</script>
