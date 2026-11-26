<template>
  <ListHeading title="Extensions" />
  <div class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:pb-12 cwa:sm:px-8">
    <ul
      v-if="listed.length"
      class="cwa:m-0 cwa:list-none cwa:p-0"
    >
      <li
        v-for="extension in listed"
        :key="extension.segment"
        data-testid="extension"
        class="cwa:relative cwa:flex cwa:min-h-16 cwa:items-center cwa:gap-4 cwa:border-b cwa:border-line cwa:px-4 cwa:py-2.5"
        :class="{ 'cwa:hover:bg-field-hover/50': extension.to }"
      >
        <span
          v-if="extension.icon"
          aria-hidden="true"
          data-testid="extension-icon"
          class="cwa:block cwa:size-5 cwa:shrink-0 cwa:text-fg-muted cwa:[&>svg]:size-full"
          v-html="extension.icon"
        />
        <span class="cwa:flex cwa:min-w-0 cwa:flex-col cwa:gap-0.5">
          <NuxtLink
            v-if="extension.to"
            :to="extension.to"
            data-testid="extension-link"
            class="cwa:truncate cwa:text-control cwa:font-medium cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:after:absolute cwa:after:inset-0 cwa:after:content-[''] cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg"
          >{{ extension.label }}</NuxtLink>
          <span
            v-else
            data-testid="extension-label"
            class="cwa:truncate cwa:text-control cwa:font-medium cwa:text-fg"
          >{{ extension.label }}</span>
          <span
            v-if="extension.description"
            data-testid="extension-description"
            class="cwa:text-helper cwa:text-fg-muted"
          >{{ extension.description }}</span>
        </span>
      </li>
    </ul>
    <ListState
      v-else
      state="empty"
      noun="extensions"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListState from '#cwa/templates/components/core/ui/ListState.vue'
import { useCwa } from '#cwa/composables/cwa'
import { extensionRouteName, openablePages } from '#cwa/admin/extension-areas'
import type { CwaExtensionArea } from '#cwa/admin/extension-areas'
import { definePageMeta, useHead } from '#imports'
// @ts-ignore
import { extensionAreas } from '#build/cwa-extension-areas'

const $cwa = useCwa()

const listed = computed(() => (extensionAreas as CwaExtensionArea[]).flatMap((area): (CwaExtensionArea & { to?: { name: string } })[] => {
  if (!area.pages.length) {
    return $cwa.auth.hasRole('ROLE_ADMIN') ? [{ ...area, to: undefined }] : []
  }
  return openablePages(area, role => $cwa.auth.hasRole(role)).length ? [{ ...area, to: { name: extensionRouteName(area.segment) } }] : []
}))

useHead({
  title: 'Extensions',
})

definePageMeta({
  name: '_cwa-extensions',
  pageTransition: false,
})
</script>
