<template>
  <div>
    <div v-if="currentScreen === 'view'">
      <div class="cwa-flex cwa-flex-col cwa-space-y-6">
        <ModalInfo label="Route" :content="isLoadingRoute ? undefined : resource?.path">
          <Spinner v-if="isLoadingRoute" :show="true" />
          <CwaUiFormButton v-else :color="resource?.path ? 'dark' : 'blue'" @click="goToManageRoute">
            {{ resource?.path ? 'Edit' : 'Create New Route' }}
          </CwaUiFormButton>
        </ModalInfo>
        <div class="cwa-dark-blur cwa-p-6 cwa-flex cwa-flex-col cwa-space-y-2.5 cwa-border cwa-rounded-xl cwa-border-stone-600">
          <div class="cwa-flex cwa-space-x-4 cwa-items-center">
            <h2 class="cwa-text-stone-400 cwa-text-2xl">
              Redirects
            </h2>
            <div>
              <button class="cwa-text-white cwa-bg-blue-600/90 hover:cwa-bg-blue-600 cwa-border-transparent cwa-p-2.5" @click="addRedirect">
                <CwaUiIconPlusIcon class="cwa-w-4 cwa-h-4" />
                <span class="cwa-sr-only">Add</span>
              </button>
            </div>
          </div>
          <div>
            <Spinner v-if="isLoadingRoute" :show="true" />
            <RouteRedirectsTree v-else-if="resource?.redirectedFrom?.length" :redirects="resource.redirectedFrom" @reload="loadResource" />
            <p v-else class="cwa-text-lg cwa-font-bold cwa-text-stone-400 cwa-mb-2 cwa-mt-4">
              You do not have any redirects
            </p>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="currentScreen === 'manage-route' && localResourceData">
      <div class="cwa-flex cwa-flex-col cwa-space-y-8">
        <div>
          <button @click="goBackToViewing">
            &lt; Back to Routes
          </button>
        </div>
        <div class="cwa-flex cwa-flex-col cwa-space-y-4">
          <div>
            <ModalInput v-model="localResourceData.path" label="Route path" :placeholder="recommendedRoute" />
          </div>
          <div>
            <p class="cwa-text-sm cwa-text-stone-300">
              When updating, we will automatically create a new redirect from the old path.
            </p>
          </div>
          <div class="cwa-flex cwa-justify-between">
            <div>
              <CwaUiFormButton color="blue" :disabled="isUpdating" @click="saveRoute">
                Save Route
              </CwaUiFormButton>
            </div>
            <div>
              <CwaUiFormButton color="grey" :disabled="isUpdating" @click="deleteResource">
                Delete Route
              </CwaUiFormButton>
            </div>
          </div>
        </div>
        <template v-if="recommendedRoute !== resource?.path">
          <div class="cwa-w-full cwa-border-b cwa-border-b-stone-600" />
          <div class="cwa-flex cwa-flex-col cwa-space-y-4">
            <ModalInfo label="Recommended route path" :content="recommendedRoute" />
          </div>
          <div class="cwa-text-sm cwa-text-stone-300 cwa-flex cwa-flex-col cwa-space-y-2">
            <p>This is based on your page title <b>`{{ pageResource.title }}`</b>.</p>
            <p>It is optimal for search engines to increase the relevance of the page to the title provided. Relevance of page content is important too.</p>
          </div>
          <div class="cwa-flex cwa-justify-start">
            <CwaUiFormButton color="blue">
              Use Recommended Route
            </CwaUiFormButton>
          </div>
        </template>
      </div>
    </div>
    <div v-else-if="currentScreen === 'create-redirect'">
      <div class="cwa-flex cwa-flex-col cwa-space-y-6">
        <div>
          <button @click="goBackToViewing">
            &lt; Back to Routes
          </button>
        </div>
        <div class="cwa-flex cwa-flex-col cwa-space-y-4">
          <div>
            <ModalInput v-model="newRedirectPath" label="Redirect from path" placeholder="/some-path" />
          </div>
          <div class="cwa-text-sm cwa-text-stone-300 cwa-flex cwa-flex-col cwa-space-y-2">
            <p v-if="newRedirectPath">
              A user visiting <b class="cwa-bg-dark cwa-p-2">{{ finalPath }}</b> will be redirected to <b class="cwa-bg-dark cwa-p-2">{{ resource?.path }}</b>
            </p>
          </div>
        </div>
        <div class="cwa-flex cwa-justify-start">
          <CwaUiFormButton color="blue" :disabled="submitting" @click="createRedirect">
            Create Redirect
          </CwaUiFormButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, toRef, watch } from 'vue'
import slugify from 'slugify'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import { useItemPage } from '#cwa/layer/pages/_cwa/composables/useItemPage'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'
import { useCwa } from '#imports'
import RouteRedirectsTree from '#cwa/runtime/templates/components/core/admin/RouteRedirectsTree.vue'

const props = defineProps<{
  pageResource: CwaResource
}>()

const emit = defineEmits<{
  close: [],
  reload: []
}>()

const $cwa = useCwa()
const pageResource = toRef(props, 'pageResource')
const routeIri = computed(() => pageResource.value?.route)
const endpoint = computed(() => routeIri.value ? `${routeIri.value}/redirects` : 'add')

const submitting = ref(false)
const newRedirectPath = ref<string>()
const currentScreen = ref<'view'|'manage-route'|'create-redirect'>('view')

const recommendedRoute = computed(() => {
  if (!props.pageResource.title) {
    return
  }
  return '/' + slugify(props.pageResource.title.toLowerCase())
})

function goToManageRoute () {
  currentScreen.value = 'manage-route'
}
function goBackToViewing () {
  newRedirectPath.value = ''
  currentScreen.value = 'view'
}

function addRedirect () {
  currentScreen.value = 'create-redirect'
}

const finalPath = computed(() => {
  return newRedirectPath.value?.startsWith('/') ? newRedirectPath.value : `/${newRedirectPath.value}`
})

async function createRedirect () {
  submitting.value = true
  const newResource = await $cwa.resourcesManager.createResource({
    endpoint: '/_/routes',
    data: {
      name: newRedirectPath.value,
      path: finalPath.value,
      redirect: routeIri.value
    }
  })
  submitting.value = false
  if (newResource) {
    goBackToViewing()
    await loadResource()
  }
}

async function saveRoute () {
  const resource = await saveResource()
  if (resource) {
    emit('reload')
    goBackToViewing()
  }
}

watch(routeIri, async () => {
  await loadResource()
})

const defaultResource = computed(() => {
  const obj: {
    path: string
    pageData?: string
    page?: string
  } = {
    path: ''
  }
  if (pageResource.value['@type'] === 'Page') {
    obj.page = pageResource.value['@id']
  } else {
    obj.pageData = pageResource.value['@id']
  }
  return obj
})

const { isLoading: isLoadingRoute, isUpdating, resource, localResourceData, loadResource, deleteResource, saveResource } = useItemPage({
  createEndpoint: '/_/routes',
  emit,
  resourceType: 'Route',
  defaultResource: defaultResource.value,
  validate (data) {
    data.name = data.path
    return true
  },
  endpoint,
  iri: routeIri,
  excludeFields: ['redirectedFrom']
})
</script>
