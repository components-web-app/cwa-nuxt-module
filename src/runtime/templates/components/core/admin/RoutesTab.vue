<template>
  <div>
    <div v-if="currentScreen === 'view'">
      <RoutesTabView
        :resource="resource"
        :is-loading="isLoadingRoute"
        @deleted="handleRedirectDeleted"
        @change-page="handleChangePage"
      />
    </div>
    <div v-else-if="resource">
      <div class="cwa:flex cwa:flex-col cwa:gap-y-8">
        <div>
          <button
            class="cwa:cursor-pointer"
            type="button"
            @click="handleChangePage('view')"
          >
            &lt; Back to Routes
          </button>
        </div>

        <div v-if="currentScreen === 'manage-route'">
          <CwaUiAlertWarning v-if="!localResourceData">
            Critical Errors: Local Resource Data has not been propagated.
          </CwaUiAlertWarning>
          <RoutesTabManage
            v-else
            v-model="localResourceData.path"
            :current-path="resource.path"
            :disable-buttons="disableButtons"
            :page-resource="pageResource"
            @save="handleSaveRoute"
            @generate="handleGenerateRoute"
            @delete="handleDeleteRoute"
          />
        </div>

        <div v-if="currentScreen === 'create-redirect'">
          <RoutesTabAddRedirect
            :disable-buttons="disableButtons"
            :route-path="resource.path"
            @create="handleCreateRedirect"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import { useItemPage } from '#cwa/layer/pages/_cwa/composables/useItemPage'
import { useCwa } from '#imports'
import RoutesTabView from '#cwa/runtime/templates/components/core/admin/RoutesTabView.vue'
import RoutesTabAddRedirect from '#cwa/runtime/templates/components/core/admin/RoutesTabAddRedirect.vue'
import RoutesTabManage from '#cwa/runtime/templates/components/core/admin/RoutesTabManage.vue'

export type RouteScreens = 'view' | 'manage-route' | 'create-redirect'

const props = defineProps<{
  pageResource: CwaResource
}>()

const emit = defineEmits<{
  close: []
  reload: []
}>()

const $cwa = useCwa()

const routeIriFromPage = computed(() => (props.pageResource.route))
const endpoint = computed(() => routeIriFromPage.value ? `${routeIriFromPage.value}/redirects` : 'add')

const disableButtons = computed(() => submitting.value || isUpdating.value)

const submitting = ref(false)
const currentScreen = ref<'view' | 'manage-route' | 'create-redirect'>('view')

function handleChangePage(screen: RouteScreens) {
  if (screen === 'manage-route') {
    resetResource()
  }
  currentScreen.value = screen
}

async function handleCreateRedirect(path: string) {
  submitting.value = true
  const newResource = await $cwa.resourcesManager.createResource({
    endpoint: '/_/routes',
    data: {
      name: path,
      path: path,
      redirect: props.pageResource.route,
    },
  })
  submitting.value = false
  if (newResource) {
    handleChangePage('view')
    await loadResource()
  }
}

async function handleGenerateRoute() {
  submitting.value = true
  const newResource = await $cwa.resourcesManager.createResource({
    endpoint: '/_/routes/generate',
    data: {
      page: defaultResource.value.page,
      pageData: defaultResource.value.pageData,
    },
  })
  submitting.value = false
  if (newResource) {
    emit('reload')
    handleChangePage('view')
  }
}

async function handleSaveRoute() {
  const resource = await saveResource(false)
  if (resource) {
    isLoadingRoute.value = true
    // reload the parent, because the route IRI/ID will have changed so we need to reference the updated route
    emit('reload')
    handleChangePage('view')
  }
}

async function handleDeleteRoute() {
  await deleteResource()
  emit('reload')
  handleChangePage('view')
}

async function handleRedirectDeleted(deletedRoute: CwaResource) {
  console.log(deletedRoute)
  await loadResource()
}

watch(routeIriFromPage, async () => {
  await loadResource()
})

const defaultResource = computed(() => {
  const obj: {
    path: string
    pageData?: string
    page?: string
  } = {
    path: '',
  }
  if (props.pageResource['@type'] === 'Page') {
    obj.page = props.pageResource['@id']
  }
  else {
    obj.pageData = props.pageResource['@id']
  }
  return obj
})

const { isLoading: isLoadingRoute, isUpdating, resource, localResourceData, loadResource, deleteResource, saveResource, resetResource } = useItemPage({
  createEndpoint: '/_/routes',
  emit,
  resourceType: 'Route',
  defaultResource: defaultResource.value,
  validate(data) {
    data.name = data.path
    return true
  },
  endpoint,
  iri: routeIriFromPage,
  // exclude this field when updating the resource or creating
  excludeFields: ['redirectedFrom'],
})
</script>
