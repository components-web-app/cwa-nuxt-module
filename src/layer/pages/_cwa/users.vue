<template>
  <ListHeading title="Users" />
  <ListContent fetch-url="/users">
    <template #item="data">
      <div class="cwa-flex cwa-border-b cwa-border-b-stone-700 cwa-py-4 cwa-space-x-4 cwa-items-center" :class="{ 'cwa-opacity-50': !data.enabled }">
        <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
          <span class="cwa-text-xl">{{ data.username }} <span class="cwa-text-stone-400 cwa-text-sm">{{ getUserRole(data.roles) }}</span></span>
          <span>{{ data.emailAddress }}</span>
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
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'

function getUserRole (roles: CwaUserRoles[]) {
  if (roles.includes(CwaUserRoles.SUPER_ADMIN)) {
    return 'Super Admin'
  }
  if (roles.includes(CwaUserRoles.ADMIN)) {
    return 'Admin'
  }
  if (roles.includes(CwaUserRoles.USER)) {
    return 'User'
  }
  return 'Unknown'
}

useHead({
  title: 'Users'
})
</script>
