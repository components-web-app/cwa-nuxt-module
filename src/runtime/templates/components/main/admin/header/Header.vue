<template>
  <div>
    <div ref="spacer" />
    <div
      ref="header"
      class="cwa:section cwa:border-0 cwa:border-b-2 cwa:border-b-light/30 cwa:fixed cwa:z-manager cwa:w-full cwa:h-18 cwa:top-0 cwa:dark-blur"
      :class="highlightClass"
      @click.stop
    >
      <div class="cwa:flex cwa:justify-between cwa:items-center">
        <div class="cwa:absolute cwa:left-1/2 cwa:top-1/2 cwa:-translate-x-1/2 cwa:-translate-y-1/2 cwa:text-center cwa:text-gray-300 cwa:z-20">
          <template v-if="!pageIsAdmin && !isErrorPage">
            <CwaUiFormButton
              v-if="!$cwa.admin.isEditing && $cwa.resources?.page?.value?.data"
              color="dark"
              class="cwa:min-w-[120px]"
            >
              <span
                class="cwa:flex cwa:items-center cwa:gap-x-2 cwa:justify-center"
                @click="showEditPage"
              >
                <span>{{ $cwa.resources.page.value.data?.reference }}</span> <CwaUiIconCogIcon
                  class="cwa:h-5 cwa:w-5"
                  aria-hidden="true"
                />
              </span>
            </CwaUiFormButton>
            <path-selector v-else-if="$cwa.admin.resourceStackManager.showManager.value" />
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
        <div class="cwa:flex cwa:justify-start cwa:gap-x-4">
          <template v-if="!pageIsAdmin && !isErrorPage">
            <CwaUiFormButton
              class="cwa:min-w-[100px]"
              color="blue"
              :loading="$cwa.resources.isLoading.value"
              @click="$cwa.admin.toggleEdit()"
            >
              {{ $cwa.admin.isEditing ? 'Done' : 'Edit' }}
            </CwaUiFormButton>
            <!-- this will be used when cloning a component only -->
            <CwaUiFormToggle
              v-if="false && $cwa.admin.isEditing"
              v-model="isNavEnabled"
              label="Enable Navigation"
            />
          </template>
        </div>
        <div
          v-if="$cwa.admin.isEditing"
          class="cwa:flex cwa:gap-x-4 cwa:items-center"
        >
          <SpinnerTick
            :is-loading="isLoading"
            :is-pending="!!$cwa.resources.newResource.value"
          />
        </div>
        <div
          v-else
          class="cwa:flex cwa:self-stretch cwa:min-h-9"
        >
          <Menu />
        </div>
      </div>
      <OutdatedContentNotice class="cwa:absolute cwa:top-full cwa:mt-1.5 cwa:left-1/2 cwa:-translate-x-1/2 cwa:z-20" />
      <ResourceLoadingIndicator class="cwa:absolute cwa:top-full cwa:left-0 cwa:z-10" />
    </div>
    <RequestErrors />
    <ResourceModalOverlayTemplate :show="showEditModal && !!($cwa.resources.pageDataIri.value || $cwa.resources.pageIri.value)">
      <PageDataAdminModal
        v-if="$cwa.resources.pageDataIri.value"
        :resource-type="$cwa.resources.pageData?.value?.data?.['@type'] || ''"
        :iri="$cwa.resources.pageDataIri.value"
        :hide-view-link="true"
        @close="closeModal"
        @reload="goToAdminPagesView"
      />
      <PageAdminModal
        v-else-if="$cwa.resources.pageIri.value"
        :iri="$cwa.resources.pageIri.value"
        :hide-view-link="true"
        @close="closeModal"
        @reload="goToAdminPagesView"
      />
    </ResourceModalOverlayTemplate>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import ResourceLoadingIndicator from '../_common/ResourceLoadingIndicator.vue'
import SpinnerTick from '../../../utils/SpinnerTick.vue'
import PathSelector from './_parts/PathSelector.vue'
import RequestErrors from './_parts/RequestErrors.vue'
import Menu from './_parts/Menu.vue'
import { useRoute, useRouter } from '#app'
import { useCwa } from '#imports'
import OutdatedContentNotice from '#cwa/runtime/templates/components/main/admin/header/_parts/OutdatedContentNotice.vue'
import IconPages from '#cwa/runtime/templates/components/core/assets/IconPages.vue'
import IconLayouts from '#cwa/runtime/templates/components/core/assets/IconLayouts.vue'
import IconUsers from '#cwa/runtime/templates/components/core/assets/IconUsers.vue'
import ResourceModalOverlayTemplate from '#cwa/runtime/templates/components/core/admin/ResourceModalOverlayTemplate.vue'
import PageAdminModal from '#cwa/runtime/templates/components/core/admin/PageAdminModal.vue'
import PageDataAdminModal from '#cwa/runtime/templates/components/core/admin/PageDataAdminModal.vue'
import IconRoutes from '#cwa/runtime/templates/components/core/assets/IconRoutes.vue'
import IconData from '#cwa/runtime/templates/components/core/assets/IconData.vue'
import { useError } from '#app/composables/error'

const $cwa = useCwa()
const route = useRoute()
const router = useRouter()

const header = useTemplateRef<undefined | HTMLElement>('header')
const spacer = useTemplateRef<undefined | HTMLElement>('spacer')

const error = useError()

const pageIsAdmin = computed(() => route.meta.cwa?.admin)
const isErrorPage = computed(() => !!error.value)
const showEditModal = ref(false)

const isNavEnabled = computed({
  get: () => {
    return $cwa.admin.navigationGuardDisabled
  },
  set: (newValue: boolean) => {
    $cwa.admin.setNavigationGuardDisabled(newValue)
  },
})

const isLoading = computed(() => $cwa.resourcesManager.requestCount.value > 0)

const highlightClass = computed(() => {
  const classes = ['cwa:before:content-[""] cwa:before:absolute cwa:before:top-0 cwa:before:left-0 cwa:before:w-full cwa:before:h-0.5 cwa:before:transition-colors']
  if ($cwa.resources.isDynamicPage.value) {
    return [...classes, 'cwa:before:bg-yellow']
  }
  if ($cwa.resources.isDataPage.value) {
    return [...classes, $cwa.resources.pageData?.value?.data?.route ? 'cwa:before:bg-green' : 'cwa:before:bg-orange']
  }
  if (pageIsAdmin.value) {
    return [...classes, 'cwa:before:bg-stone-400']
  }
  return [...classes, 'cwa:before:bg-blue-600']
})

function showEditPage() {
  showEditModal.value = true
}

function closeModal() {
  showEditModal.value = false
}

function goToAdminPagesView() {
  router.replace('/_cwa/pages')
}

onMounted(() => {
  if (header.value && spacer.value) {
    spacer.value.style.height = `${header.value.clientHeight}px`
  }
})
</script>
