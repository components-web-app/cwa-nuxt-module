<script setup lang="ts">
import ModalInfo from '#cwa/templates/components/core/admin/form/ModalInfo.vue'
import Spinner from '#cwa/templates/components/utils/Spinner.vue'
import RouteRedirectsTree from '#cwa/templates/components/core/admin/RouteRedirectsTree.vue'
import type { CwaResource } from '#cwa/resources/resource-utils'
import type { TempCwaResource } from '#cwa-layer/pages/_cwa/index/composables/useItemPage'
import type { RouteScreens } from '#cwa/templates/components/core/admin/RoutesTab.vue'

defineProps<{
  resource: CwaResource | TempCwaResource | undefined
  isLoading: boolean
  parentHasNoRoute?: boolean
  forwardToPath?: string
}>()

const emit = defineEmits<{
  changePage: [page: RouteScreens]
  deleted: [resource: CwaResource]
  removeForward: []
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
      <p
        v-else-if="parentHasNoRoute"
        class="cwa:text-sm cwa:text-stone-400"
      >
        Parent page has no public URL — resources are not publicly accessible. Set a route on the parent first.
      </p>
      <CwaUiFormButton
        v-else
        :color="resource?.path ? 'dark' : 'blue'"
        @click="$emit('changePage', 'manage-route')"
      >
        {{ resource?.path ? 'Edit' : 'Create New Route' }}
      </CwaUiFormButton>
    </ModalInfo>

    <!-- Forward visitors to (outbound redirect) -->
    <div class="cwa:dark-blur cwa:p-4 cwa:flex cwa:flex-col cwa:gap-y-2.5 cwa:border cwa:rounded-xl cwa:border-stone-600">
      <h2 class="cwa:text-stone-400 cwa:text-2xl">
        Forward visitors to
      </h2>
      <div v-if="forwardToPath">
        <p class="cwa:text-sm cwa:font-mono cwa:text-white cwa:mb-3">
          {{ forwardToPath }}
        </p>
        <p class="cwa:text-xs cwa:text-amber-400 cwa:mb-3">
          Visitors are automatically forwarded here. This page's own content is not shown directly.
        </p>
        <div class="cwa:flex cwa:gap-x-2">
          <CwaUiFormButton
            data-edit-forward
            color="dark"
            @click="$emit('changePage', 'forward-to')"
          >
            Edit
          </CwaUiFormButton>
          <CwaUiFormButton
            data-remove-forward
            color="grey"
            @click="$emit('removeForward')"
          >
            Remove
          </CwaUiFormButton>
        </div>
      </div>
      <div v-else>
        <p class="cwa:text-stone-400 cwa:text-sm cwa:mb-3">
          None — visitors see this page's content
        </p>
        <CwaUiFormButton
          data-set-forward
          color="blue"
          @click="$emit('changePage', 'forward-to')"
        >
          Set Forward
        </CwaUiFormButton>
      </div>
    </div>

    <!-- Incoming redirects (routes that redirect to this page) -->
    <div class="cwa:dark-blur cwa:p-4 cwa:flex cwa:flex-col cwa:gap-y-2.5 cwa:border cwa:rounded-xl cwa:border-stone-600">
      <div class="cwa:flex cwa:gap-x-4 cwa:items-center">
        <h2 class="cwa:text-stone-400 cwa:text-2xl">
          Incoming redirects
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
          You do not have any incoming redirects
        </p>
      </div>
    </div>
  </div>
</template>
