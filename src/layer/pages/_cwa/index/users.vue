<template>
  <div>
    <ListHeading title="Users" />
    <ListFilter
      :order-options="orderOptions"
      search-label="Search users"
      :count="countText"
      create-noun="user"
      @add="goToAdd"
    />
    <ListContent
      ref="listContent"
      fetch-url="/users"
      noun="users"
      :columns="columns"
      :search-fields="['emailAddress', 'username']"
    >
      <template #item="{ data }">
        <ListRow
          :to="computedItemLink(data['@id'])"
          :title="data.username"
          :sub="data.emailAddress"
          :dim="!data.enabled"
        >
          <ListCell>
            {{ getUserRole(data.roles) }}
          </ListCell>
          <ListCell>
            <CwaUiBadge
              v-if="!data.enabled"
              dot
              data-testid="user-disabled"
            >
              Disabled
            </CwaUiBadge>
            <CwaUiBadge
              v-else-if="data.emailAddressVerified === false"
              tone="warning"
              dot
              data-testid="user-unverified"
            >
              Email not verified
            </CwaUiBadge>
          </ListCell>
        </ListRow>
      </template>
      <template #empty>
        <CwaUiButton
          variant="solid"
          :icon="PlusIcon"
          label="User"
          aria-label="Create user"
          @click="goToAdd"
        />
      </template>
    </ListContent>
    <ResourceModalOverlay @reload="triggerReload" />
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import ListContent from '#cwa/templates/components/core/admin/ListContent.vue'
import ListFilter from '#cwa/templates/components/core/admin/ListFilter.vue'
import ListRow from '#cwa/templates/components/core/admin/ListRow.vue'
import ListCell from '#cwa/templates/components/core/admin/ListCell.vue'
import ResourceModalOverlay from '#cwa/templates/components/core/admin/ResourceModalOverlay.vue'
import CwaUiBadge from '#cwa/templates/components/ui/Badge.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import PlusIcon from '#cwa/templates/components/ui/icon/PlusIcon.vue'
import { CwaUserRoles } from '#cwa/storage/stores/auth/state'
import { useListPage } from '#cwa-layer/_composables/useListPage'
import { definePageMeta, useHead } from '#imports'

const listContent = ref<InstanceType<typeof ListContent> | null>(null)

const { goToAdd, triggerReload, computedItemLink } = useListPage(listContent)

const columns = [
  { label: 'User' },
  { label: 'Role', width: '8rem' },
  { label: 'Status', width: '11rem' },
]

const orderOptions = [
  { label: 'Newest first', value: { createdAt: 'desc' } },
  { label: 'Oldest first', value: { createdAt: 'asc' } },
  { label: 'A to Z', value: { username: 'asc' } },
  { label: 'Z to A', value: { username: 'desc' } },
]

const countText = computed(() => {
  const total = listContent.value?.total
  return typeof total === 'number' ? `${total} ${total === 1 ? 'user' : 'users'}` : undefined
})

function getUserRole(roles: CwaUserRoles[]) {
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

definePageMeta({
  name: '_cwa-users-user',
})

useHead({
  title: 'Users',
})
</script>
