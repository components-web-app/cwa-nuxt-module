<template>
  <div>
    <div
      v-if="parentRoutePrefix"
      data-route-prefix
      class="cwa:text-sm cwa:text-stone-400 cwa:mb-4"
    >
      <span class="cwa:font-medium cwa:text-stone-300">Route prefix:</span> {{ parentRoutePrefix }}
    </div>
    <div v-if="currentScreen === 'view'">
      <RoutesTabView
        :resource="resource"
        :is-loading="isLoadingRoute"
        :parent-has-no-route="parentHasNoRoute"
        @deleted="handleRedirectDeleted"
        @change-page="handleChangePage"
      />
    </div>
    <div
      v-else-if="!resource"
      class="p-4"
    >
      <CwaUiAlertWarning>
        Internal Error: No Route Resource Loaded.
      </CwaUiAlertWarning>
    </div>
    <div v-else>
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
            :parent-route-prefix="parentRoutePrefix"
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
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import type { CwaResource } from '#cwa/resources/resource-utils'
import { useItemPage } from '#cwa-layer/pages/_cwa/index/composables/useItemPage'
import { useCwa, navigateTo, useRoute } from '#imports'
import RoutesTabView from '#cwa/templates/components/core/admin/RoutesTabView.vue'
import RoutesTabAddRedirect from '#cwa/templates/components/core/admin/RoutesTabAddRedirect.vue'
import RoutesTabManage from '#cwa/templates/components/core/admin/RoutesTabManage.vue'
import ConfirmDialog from '#cwa/templates/components/core/ConfirmDialog.vue'
import { CwaResourceApiStatuses } from '#cwa/storage/stores/resources/state'

export type RouteScreens = 'view' | 'manage-route' | 'create-redirect'

const props = defineProps<{
  pageResource: CwaResource
}>()

const emit = defineEmits<{
  close: []
  reload: []
}>()

const $cwa = useCwa()
const route = useRoute()

const parentIri = computed(() => props.pageResource.parentPage || props.pageResource.parentPageData)
const parentResource = computed(() => parentIri.value ? $cwa.resources.getResource(parentIri.value).value : null)
const parentRoutePrefix = computed(() => {
  const routeIri = parentResource.value?.data?.route
  if (!routeIri) {
    return null
  }
  return routeIri.replace(/^\/_\/routes\//, '')
})
const parentHasNoRoute = computed(() => !!parentIri.value && !parentRoutePrefix.value)

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
  const pathChanged = localResourceData.value?.path !== resource.value?.path
  let cascadeData: Record<string, any> | undefined

  if (pathChanged) {
    // @ts-expect-error
    const dialog = createConfirmDialog(ConfirmDialog)
    const { isCanceled } = await dialog.reveal({
      title: 'Update child routes?',
      content: '<p>The route path has changed. If this page has child routes that share the old prefix, would you like to update them too? Routes using a different prefix will be unchanged.</p>',
    })
    if (!isCanceled) {
      cascadeData = { cascadeChildPaths: true }
    }
  }

  const savedResource = await saveResource(false, cascadeData)
  if (savedResource) {
    isLoadingRoute.value = true
    // reload the parent, because the route IRI/ID will have changed so we need to reference the updated route
    emit('reload')
    handleChangePage('view')

    if (routeIriFromPage.value === savedResource['@id']) {
      await loadResource()
    }
  }
}

async function handleDeleteRoute() {
  const deletingPath = resource.value?.path
  const requestCompleteFn = (_?: CwaResource) => {
    if (deletingPath === route.path) {
      // if we are viewing the page via the route, reload the page via the direct IRI now the route no longer exists
      navigateTo($cwa.resources.isDataPage.value ? $cwa.resources.pageDataIri.value : $cwa.resources.pageIri.value)
    }
  }

  await deleteResource(undefined, requestCompleteFn)

  handleChangePage('view')
}

async function handleRedirectDeleted() {
  isLoadingRoute.value = true
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

const { isLoading: isLoadingRoute, isUpdating, resource, localResourceData, loadResource, deleteResource, saveResource, resetResource, apiState } = useItemPage({
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

// if the route resource is reloaded without the redirects postfix, we need to fix this.
watch(apiState, (newState) => {
  if (newState?.status === CwaResourceApiStatuses.SUCCESS && !newState?.path?.endsWith('/redirects')) {
    isLoadingRoute.value = true
    loadResource()
  }
})
</script>
