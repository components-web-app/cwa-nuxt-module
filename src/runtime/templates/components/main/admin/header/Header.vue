<template>
  <div>
    <div ref="spacer" />
    <div
      ref="header"
      data-cwa-sticky
      class="cwa:section cwa:border-0 cwa:border-b-2 cwa:border-b-light/30 cwa:fixed cwa:z-manager cwa:flex cwa:items-center cwa:w-full cwa:h-18 cwa:top-0 cwa:dark-blur"
      :class="highlightClass"
      @click.stop
    >
      <div class="cwa:flex cwa:min-w-0 cwa:flex-1 cwa:justify-between cwa:items-center cwa:max-sm:gap-x-2">
        <div class="cwa:flex cwa:shrink-0 cwa:items-center cwa:justify-start cwa:gap-x-4">
          <template v-if="!pageIsAdmin && !isErrorPage">
            <CwaUiButton
              variant="solid"
              class="cwa:min-w-24"
              :label="$cwa.admin.isEditing ? 'Done' : 'Edit'"
              :loading="$cwa.resources.isLoading.value"
              @click="toggleEditing"
            />
            <button
              v-if="strandedGroups.length"
              type="button"
              data-testid="stranded-groups-warning"
              class="cwa:flex cwa:min-h-hit cwa:items-center cwa:gap-x-1 cwa:px-2 cwa:text-label cwa:text-warning cwa:cursor-pointer cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:hover:bg-button cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg"
              title="Component groups attached to this page are not shown on it"
              :aria-label="`${strandedGroups.length} component groups attached to this page are not shown on it`"
              @click="showStrandedModal = true"
            >
              <WarningIcon
                class="cwa:size-5"
                aria-hidden="true"
              />
              <span aria-hidden="true">{{ strandedGroups.length }}</span>
            </button>
          </template>
          <PresenceIndicator />
          <CloneModeBar />
        </div>
        <div
          data-testid="header-centre"
          class="cwa:max-sm:flex cwa:max-sm:min-w-0 cwa:max-sm:flex-1 cwa:max-sm:justify-center cwa:sm:absolute cwa:sm:left-1/2 cwa:sm:top-1/2 cwa:sm:-translate-x-1/2 cwa:sm:-translate-y-1/2 cwa:text-center cwa:text-gray-300 cwa:z-manager"
        >
          <template v-if="!pageIsAdmin && !isErrorPage">
            <CwaUiButton
              v-if="!$cwa.admin.isEditing && $cwa.resources?.page?.value?.data"
              :label="editPageLabel"
              :aria-label="`Page settings: ${editPageLabel}`"
              :icon="CogIcon"
              truncate
              data-testid="page-settings"
              @click="showEditPage"
            />
            <path-selector
              v-else-if="$cwa.admin.resourceStackManager.showManager.value"
              :avoid="status"
            />
          </template>
          <template v-else>
            <ul class="cwa:flex cwa:gap-x-8 cwa:text-stone-400 cwa:items-center">
              <li>
                <NuxtLink
                  to="/_cwa/layouts"
                  class="cwa:hover:text-white cwa:transition-colors"
                  active-class="cwa:text-white"
                >
                  <IconLayouts />
                  <span class="cwa:sr-only">Layouts</span>
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/_cwa/pages"
                  class="cwa:hover:text-white cwa:transition-colors"
                  active-class="cwa:text-white"
                >
                  <IconPages class="cwa:h-6" />
                  <span class="cwa:sr-only">Pages</span>
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/_cwa/data"
                  class="cwa:hover:text-white cwa:transition-colors"
                  active-class="cwa:text-white"
                >
                  <IconData class="cwa:h-6" />
                  <span class="cwa:sr-only">Data</span>
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/_cwa/routes"
                  class="cwa:hover:text-white cwa:transition-colors"
                  active-class="cwa:text-white"
                >
                  <IconRoutes class="cwa:h-6" />
                  <span class="cwa:sr-only">Routes</span>
                </NuxtLink>
              </li>
              <li>
                <NuxtLink
                  to="/_cwa/users"
                  class="cwa:hover:text-white cwa:transition-colors"
                  active-class="cwa:text-white"
                >
                  <IconUsers />
                  <span class="cwa:sr-only">Users</span>
                </NuxtLink>
              </li>
            </ul>
          </template>
        </div>
        <div
          v-if="$cwa.admin.isEditing"
          ref="status"
          class="cwa:flex cwa:gap-x-4 cwa:items-center"
        >
          <SpinnerTick
            :is-loading="isLoading"
            :is-pending="!!$cwa.resources.newResource.value"
          />
        </div>
        <div
          v-else
          class="cwa:flex cwa:min-h-9 cwa:items-center"
        >
          <Menu />
        </div>
      </div>
      <OutdatedContentNotice class="cwa:absolute cwa:top-full cwa:mt-1.5 cwa:left-1/2 cwa:-translate-x-1/2 cwa:z-notifications" />
      <CloneHighlight v-if="cloneSource || clonePlaced" />
      <ResourceLoadingIndicator class="cwa:absolute cwa:top-full cwa:left-0 cwa:z-notifications" />
    </div>
    <RequestErrors />
    <FailedSaveToasts />
    <PageResourceAdminModal
      v-if="showEditModal && $cwa.resources.displayPageIri.value"
      :iri="$cwa.resources.displayPageIri.value"
      :resource-type="editPageResourceType"
      :hide-view-link="true"
      @close="closeModal"
      @reload="goToAdminPagesView"
    />
    <StrandedComponentGroupsModal
      v-if="showStrandedModal"
      :groups="strandedGroups"
      :targets="shownGroups"
      @close="showStrandedModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, useTemplateRef } from 'vue'
import ResourceLoadingIndicator from '../_common/ResourceLoadingIndicator.vue'
import SpinnerTick from '../../../utils/SpinnerTick.vue'
import PathSelector from './_parts/PathSelector.vue'
import RequestErrors from './_parts/RequestErrors.vue'
import Menu from './_parts/Menu.vue'
import CloneModeBar from './_parts/CloneModeBar.vue'
import { useCwa, useError, useRoute, useRouter } from '#imports'
import OutdatedContentNotice from '#cwa/templates/components/main/admin/header/_parts/OutdatedContentNotice.vue'
import IconPages from '#cwa/templates/components/core/assets/IconPages.vue'
import IconLayouts from '#cwa/templates/components/core/assets/IconLayouts.vue'
import IconUsers from '#cwa/templates/components/core/assets/IconUsers.vue'
import CogIcon from '#cwa/templates/components/ui/icon/CogIcon.vue'
import WarningIcon from '#cwa/templates/components/ui/icon/WarningIcon.vue'
import PageResourceAdminModal from '#cwa/templates/components/core/admin/PageResourceAdminModal.vue'
import IconRoutes from '#cwa/templates/components/core/assets/IconRoutes.vue'
import IconData from '#cwa/templates/components/core/assets/IconData.vue'
import { useStrandedComponentGroups } from '#cwa/admin/stranded-component-groups'
import { useCloneMode } from '#cwa/admin/clone-mode'

const CloneHighlight = defineAsyncComponent(() => import('../resource-manager/CloneHighlight.vue').then(module => module.default))
const FailedSaveToasts = defineAsyncComponent(() => import('./_parts/FailedSaveToasts.vue').then(module => module.default))
const PresenceIndicator = defineAsyncComponent(() => import('./_parts/PresenceIndicator.vue').then(module => module.default))
const StrandedComponentGroupsModal = defineAsyncComponent(() => import('#cwa/templates/components/core/admin/StrandedComponentGroupsModal.vue').then(module => module.default))

const $cwa = useCwa()
const route = useRoute()
const router = useRouter()

const header = useTemplateRef<undefined | HTMLElement>('header')
const spacer = useTemplateRef<undefined | HTMLElement>('spacer')
const status = useTemplateRef<HTMLElement | null>('status')

const error = useError()
const { source: cloneSource, placed: clonePlaced } = useCloneMode($cwa)

const pageIsAdmin = computed(() => route.meta.cwa?.admin)
const isErrorPage = computed(() => !!error.value)
const showEditModal = ref(false)
const showStrandedModal = ref(false)
const { stranded: strandedGroups, shown: shownGroups } = useStrandedComponentGroups()
const editPageLabel = computed(() => {
  if ($cwa.resources.isDataPage.value) {
    return $cwa.resources.pageData?.value?.data?.title || 'Data Page'
  }
  return $cwa.resources.page?.value?.data?.reference
})

const isLoading = computed(() => $cwa.resourcesManager.requestCount.value > 0)

async function toggleEditing() {
  if (!$cwa.admin.isEditing) {
    $cwa.admin.toggleEdit(true)
    return
  }
  if (!await $cwa.resourcesManager.confirmDiscardAddingResource()) {
    return
  }
  $cwa.admin.toggleEdit(false)
}

const editPageResourceType = computed(() => {
  if ($cwa.resources.isDataPage.value) {
    return $cwa.resources.pageData?.value?.data?.['@type'] || ''
  }
  return 'Page'
})

const highlightClass = computed(() => {
  const classes = ['cwa:before:content-[""] cwa:before:absolute cwa:before:top-0 cwa:before:left-0 cwa:before:w-full cwa:before:h-[3px] cwa:before:transition-colors']
  if ($cwa.resources.isDynamicPage.value) {
    return [...classes, 'cwa:before:bg-type-dynamic']
  }
  if ($cwa.resources.isDataPage.value) {
    return [...classes, $cwa.resources.pageData?.value?.data?.route ? 'cwa:before:bg-success' : 'cwa:before:bg-warning']
  }
  if (pageIsAdmin.value) {
    return [...classes, 'cwa:before:bg-stone-400']
  }
  return [...classes, 'cwa:before:bg-type-static']
})

function showEditPage() {
  showEditModal.value = true
}

function closeModal() {
  showEditModal.value = false
}

function goToAdminPagesView() {
  if (pageIsAdmin.value) {
    return
  }
  router.replace('/_cwa/pages')
}

onMounted(() => {
  if (header.value && spacer.value) {
    spacer.value.style.height = `${header.value.clientHeight}px`
  }
})
</script>
