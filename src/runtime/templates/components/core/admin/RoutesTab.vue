<template>
  <div>
    <div v-if="currentScreen === 'view'">
      <div class="cwa-flex cwa-flex-col cwa-space-y-6">
        <ModalInfo label="Route" :content="resource?.path">
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
            <Spinner v-if="isLoadingRoute || isLoadingRedirects" :show="true" />
            <pre v-else>{{ resource?.redirectedFrom }}</pre>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="currentScreen === 'manage-route'">
      <div class="cwa-flex cwa-flex-col cwa-space-y-8">
        <div>
          <button @click="goBackToViewing">
            &lt; Back to Routes
          </button>
        </div>
        <div class="cwa-flex cwa-flex-col cwa-space-4-4">
          Edit and Create Section
        </div>
        <template v-if="recommendedRoute !== resource?.path">
          <div class="cwa-w-full cwa-border-b cwa-border-b-stone-600" />
          <div class="cwa-flex cwa-flex-col">
            Section to generate route as recommended by page title: `{{ recommendedRoute }}`
          </div>
        </template>
      </div>
    </div>
    <div v-else-if="currentScreen === 'create-redirect'">
      <div>
        <button @click="goBackToViewing">
          &lt; Back to Routes
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import slugify from 'slugify'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'
import ModalInfo from '#cwa/runtime/templates/components/core/admin/form/ModalInfo.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import { useItemPage } from '#cwa/layer/pages/_cwa/composables/useItemPage'

const props = defineProps<{
  pageResource: CwaResource
}>()

const emit = defineEmits<{
  close: [],
  reload: []
}>()

const isLoadingRedirects = ref(true)
const currentScreen = ref<'view'|'manage-route'|'create-redirect'>('view')
const routeIri = computed(() => props.pageResource?.route)

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
  currentScreen.value = 'view'
}

function addRedirect () {
  currentScreen.value = 'create-redirect'
}

const { isLoading: isLoadingRoute, resource } = useItemPage({
  createEndpoint: '/_/routes',
  emit,
  resourceType: 'Route',
  defaultResource: {},
  endpoint: routeIri.value || 'add'
})
</script>
