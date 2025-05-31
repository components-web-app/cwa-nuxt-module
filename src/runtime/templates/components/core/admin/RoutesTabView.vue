<script setup lang="ts">
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import RouteRedirectsTree from '#cwa/runtime/templates/components/core/admin/RouteRedirectsTree.vue'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import type { TempCwaResource } from '#cwa/layer/pages/_cwa/composables/useItemPage'
import type { RouteScreens } from '#cwa/runtime/templates/components/core/admin/RoutesTab.vue'

defineProps<{
  resource: CwaResource | TempCwaResource | undefined
  isLoading: boolean
}>()

const emit = defineEmits<{
  changePage: [page: RouteScreens]
  deleted: [resource: CwaResource]
}>()

function handleDeletedEvent(resource: CwaResource) {
  emit('deleted', resource)
}
</script>

<template>
  <div class="cwa:flex cwa:flex-col cwa:gap-y-6">
    <ModalInfo
      label="Route"
      :content="isLoading ? undefined : resource?.path"
    >
      <Spinner
        v-if="isLoading"
        :show="true"
      />
      <CwaUiFormButton
        v-else
        :color="resource?.path ? 'dark' : 'blue'"
        @click="$emit('changePage', 'manage-route')"
      >
        {{ resource?.path ? 'Edit' : 'Create New Route' }}
      </CwaUiFormButton>
    </ModalInfo>
    <div class="cwa:dark-blur cwa:p-4 cwa:flex cwa:flex-col cwa:gap-y-2.5 cwa:border cwa:rounded-xl cwa:border-stone-600">
      <div class="cwa:flex cwa:gap-x-4 cwa:items-center">
        <h2 class="cwa:text-stone-400 cwa:text-2xl">
          Redirects
        </h2>
        <div>
          <button
            class="cwa:text-white cwa:bg-blue-600/90 cwa:hover:bg-blue-600 cwa:border-transparent cwa:p-2.5 cwa:cursor-pointer"
            @click="$emit('changePage', 'create-redirect')"
          >
            <CwaUiIconPlusIcon class="cwa:w-4 cwa:h-4" />
            <span class="cwa:sr-only">Add</span>
          </button>
        </div>
      </div>
      <div>
        <Spinner
          v-if="isLoading"
          :show="true"
        />
        <RouteRedirectsTree
          v-else-if="resource?.redirectedFrom?.length"
          :redirects="resource.redirectedFrom"
          @deleted="handleDeletedEvent"
        />
        <p
          v-else
          class="cwa:text-lg cwa:font-bold cwa:text-stone-400 cwa:mb-2 cwa:mt-4"
        >
          You do not have any redirects
        </p>
      </div>
    </div>
  </div>
</template>
