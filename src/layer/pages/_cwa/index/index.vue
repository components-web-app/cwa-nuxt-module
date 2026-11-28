<template>
  <ListHeading title="Dashboard" />
  <div class="cwa:mx-auto cwa:flex cwa:w-full cwa:max-w-6xl cwa:flex-col cwa:gap-section cwa:px-4 cwa:pb-12 cwa:sm:px-8">
    <section
      v-for="group in groups"
      :key="group.id"
      :aria-labelledby="`${idPrefix}-${group.id}`"
    >
      <h2
        :id="`${idPrefix}-${group.id}`"
        class="cwa:m-0 cwa:mb-2 cwa:text-section cwa:text-fg-secondary"
      >
        {{ group.title }}
      </h2>
      <ul class="cwa:m-0 cwa:list-none cwa:p-0">
        <DashboardRow
          v-for="row in group.rows"
          :key="row.id"
          :label="row.label"
          :to="row.to"
          :description="row.description"
          :button="row.button"
          @select="signOut"
        >
          <template
            v-if="row.icon"
            #icon
          >
            <component
              :is="builtInIcons[row.id]"
              v-if="builtInIcons[row.id]"
              class="cwa:h-full cwa:w-auto"
            />
            <span
              v-else-if="row.svg"
              class="cwa:block cwa:size-full cwa:[&>svg]:size-full"
              v-html="row.svg"
            />
            <IconComponents
              v-else
              class="cwa:size-full"
            />
          </template>
        </DashboardRow>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import DashboardRow from '#cwa/templates/components/core/admin/DashboardRow.vue'
import IconLayouts from '#cwa/templates/components/core/assets/IconLayouts.vue'
import IconPages from '#cwa/templates/components/core/assets/IconPages.vue'
import IconData from '#cwa/templates/components/core/assets/IconData.vue'
import IconRoutes from '#cwa/templates/components/core/assets/IconRoutes.vue'
import IconUsers from '#cwa/templates/components/core/assets/IconUsers.vue'
import IconComponents from '#cwa/templates/components/core/assets/IconComponents.vue'
import { useCwa } from '#cwa/composables/cwa'
import { adminAreas } from '#cwa/admin/top-bar'
import { hasPageDataTypes } from '#cwa/admin/page-data-presence'
import type { CwaExtensionArea } from '#cwa/admin/extension-areas'
import { definePageMeta, useHead } from '#imports'
// @ts-ignore
import { extensionAreas } from '#build/cwa-extension-areas'

interface Row {
  id: string
  label: string
  to?: RouteLocationRaw
  description?: string
  button?: boolean
  icon?: boolean
  svg?: string
}

const $cwa = useCwa()

const builtInIcons: Record<string, Component> = {
  layouts: IconLayouts,
  pages: IconPages,
  data: IconData,
  routes: IconRoutes,
  users: IconUsers,
}

const idPrefix = useId()
const hasPageData = ref(false)

onMounted(async () => {
  hasPageData.value = await hasPageDataTypes($cwa)
})

const groups = computed(() => {
  const areas = extensionAreas as CwaExtensionArea[]
  const areaRows: Row[] = adminAreas(areas, { hasRole: role => $cwa.auth.hasRole(role), hasPageData: hasPageData.value })
    .map(area => ({ id: area.id, label: area.label, to: area.to, description: area.description, icon: true, svg: area.icon }))
  const installedRows: Row[] = $cwa.auth.hasRole('ROLE_ADMIN')
    ? areas.filter(area => !area.pages.length).map(area => ({ id: `ext:${area.segment}`, label: area.label, description: area.description, icon: true, svg: area.icon }))
    : []
  const siteRows: Row[] = $cwa.auth.isAdmin.value ? [{ id: 'settings', label: 'Site settings', to: { name: '_cwa-settings' } }] : []
  const accountRows: Row[] = [
    { id: 'account', label: 'My account', to: { name: '_cwa-account' } },
    { id: 'quick-links', label: 'Edit quick links', to: { name: '_cwa-account', hash: '#quick-links' } },
    { id: 'sign-out', label: 'Sign out', button: true },
  ]
  return [
    { id: 'areas', title: 'Areas', rows: areaRows },
    { id: 'installed', title: 'Installed', rows: installedRows },
    { id: 'site', title: 'Site', rows: siteRows },
    { id: 'account', title: 'Account', rows: accountRows },
  ].filter(group => group.rows.length)
})

async function signOut() {
  if ($cwa.navigationDisabled) {
    return
  }
  await $cwa.auth.signOut()
}

useHead({
  title: 'Dashboard',
})

definePageMeta({
  pageTransition: false,
})
</script>
