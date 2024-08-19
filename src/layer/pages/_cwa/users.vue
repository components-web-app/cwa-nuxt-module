<template>
  <ListHeading title="Users" @add="goToAdd" />
  <ListFilter :order-options="orderOptions" :search-fields="['emailAddress', 'username']" />
  <ListContent ref="listContent" fetch-url="/users">
    <template #item="{data}">
      <div class="cwa-flex cwa-border-b cwa-border-b-stone-700 cwa-py-6 cwa-space-x-4 cwa-items-center" :class="{ 'cwa-opacity-50': !data.enabled }">
        <div class="cwa-grow cwa-flex cwa-flex-col cwa-space-y-1">
          <span class="cwa-text-xl">{{ data.username }} <span class="cwa-text-stone-400 cwa-text-sm">{{ getUserRole(data.roles) }}</span></span>
          <span>{{ data.emailAddress }}</span>
        </div>
        <div>
          <CwaUiFormButton :to="computedItemLink(data['@id'])">
            <CwaUiIconCogIcon class="cwa-w-6" />
            <span class="cwa-sr-only">Settings</span>
          </CwaUiFormButton>
        </div>
      </div>
    </template>
  </ListContent>
  <ResourceModalOverlay @reload="triggerReload" />
</template>

<script lang="ts" setup>
import { useHead } from '#app'
import { ref } from 'vue'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/runtime/templates/components/core/admin/ListContent.vue'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'
import ListFilter from '#cwa/runtime/templates/components/core/admin/ListFilter.vue'
import ResourceModalOverlay from '#cwa/runtime/templates/components/core/admin/ResourceModalOverlay.vue'
import { useListPage } from '#cwa/layer/pages/_cwa/composables/useListPage'

const listContent = ref<InstanceType<typeof ListContent> | null>(null)

const { goToAdd, triggerReload, computedItemLink } = useListPage(listContent)

const orderOptions = [
  {
    label: 'New - Old',
    value: { createdAt: 'desc' }
  },
  {
    label: 'Old - New',
    value: { createdAt: 'asc' }
  },
  {
    label: 'A - Z',
    value: { username: 'asc' }
  },
  {
    label: 'Z - A',
    value: { username: 'desc' }
  }
]

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
