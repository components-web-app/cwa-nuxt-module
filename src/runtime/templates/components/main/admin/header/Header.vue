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
      <div
        class="cwa:flex cwa:min-w-0 cwa:flex-1 cwa:justify-between cwa:items-center cwa:max-sm:gap-x-2"
        :class="{ 'cwa:sm:gap-x-4': adminChrome }"
      >
        <div class="cwa:flex cwa:shrink-0 cwa:items-center cwa:justify-start cwa:gap-x-4">
          <template v-if="adminChrome">
            <CwaUiButton
              label="View site"
              :icon="EyeIcon"
              @click="viewSite"
            />
          </template>
          <template v-else-if="$cwa.auth.isAdmin.value">
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
          class="cwa:text-center cwa:text-gray-300 cwa:z-manager"
          :class="centreClass"
        >
          <template v-if="!adminChrome">
            <CwaUiButton
              v-if="!$cwa.admin.isEditing && $cwa.resources?.page?.value?.data && $cwa.auth.isAdmin.value"
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
          <nav
            v-else
            aria-label="Admin"
            class="cwa:w-full cwa:min-w-0"
          >
            <ul
              ref="list"
              class="cwa:flex cwa:w-full cwa:items-center cwa:justify-center cwa:gap-x-8 cwa:pointer-coarse:gap-x-2 cwa:text-stone-400"
            >
              <li data-top-bar-home>
                <NuxtLink
                  to="/_cwa"
                  :class="linkClass"
                  :aria-current="onDashboard ? 'page' : undefined"
                >
                  <IconHome
                    class="cwa:h-6"
                    aria-hidden="true"
                    data-testid="top-bar-home-icon"
                  />
                  <span class="cwa:sr-only">Dashboard</span>
                </NuxtLink>
              </li>
              <li
                v-for="item in topBar"
                :key="item.id"
                :data-top-bar-id="item.id"
                :hidden="overflowIds.includes(item.id)"
              >
                <NuxtLink
                  :to="item.to"
                  :class="linkClass"
                  :aria-current="item.id === activeId ? 'page' : undefined"
                >
                  <component
                    :is="builtInIcons[item.id]?.icon"
                    v-if="builtInIcons[item.id]"
                    aria-hidden="true"
                    :class="builtInIcons[item.id]?.class"
                  />
                  <span
                    v-else
                    aria-hidden="true"
                    class="cwa:block cwa:size-6 cwa:[&>svg]:size-full"
                    v-html="item.icon"
                  />
                  <span class="cwa:sr-only">{{ item.label }}</span>
                </NuxtLink>
              </li>
              <li
                v-if="moreItems.length"
                data-top-bar-more
              >
                <CwaUiMenu
                  :items="moreItems"
                  label="More quick links"
                  side="bottom"
                  align="end"
                >
                  <button
                    type="button"
                    aria-label="More quick links"
                    :class="[linkClass, 'cwa:h-6 cwa:cursor-pointer cwa:aria-expanded:text-accent-fg']"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      fill="currentColor"
                      class="cwa:size-6"
                    ><circle
                      cx="3"
                      cy="8"
                      r="1.6"
                    /><circle
                      cx="8"
                      cy="8"
                      r="1.6"
                    /><circle
                      cx="13"
                      cy="8"
                      r="1.6"
                    /></svg>
                  </button>
                </CwaUiMenu>
              </li>
            </ul>
          </nav>
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
          :class="{ 'cwa:max-sm:hidden': pageIsAdmin }"
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
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { Component } from 'vue'
import ResourceLoadingIndicator from '../_common/ResourceLoadingIndicator.vue'
import SpinnerTick from '../../../utils/SpinnerTick.vue'
import PathSelector from './_parts/PathSelector.vue'
import RequestErrors from './_parts/RequestErrors.vue'
import Menu from './_parts/Menu.vue'
import CloneModeBar from './_parts/CloneModeBar.vue'
import { measureTopBar } from './_parts/top-bar-measure'
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
import IconHome from '#cwa/templates/components/core/assets/IconHome.vue'
import EyeIcon from '#cwa/templates/components/ui/icon/EyeIcon.vue'
import CwaUiMenu from '#cwa/templates/components/ui/Menu.vue'
import type { MenuItem } from '#cwa/templates/components/core/ui/menu-entries'
import { currentArea, fitTopBar, rememberSitePath, sitePath, topBarItems } from '#cwa/admin/top-bar'
import { hasPageDataTypes } from '#cwa/admin/page-data-presence'
import type { CwaExtensionArea } from '#cwa/admin/extension-areas'
// @ts-ignore
import { extensionAreas } from '#build/cwa-extension-areas'
// @ts-ignore
import { topBarDefault } from '#build/cwa-admin-top-bar'
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
const list = useTemplateRef<HTMLElement | null>('list')

const error = useError()
const { source: cloneSource, placed: clonePlaced } = useCloneMode($cwa)

const pageIsAdmin = computed(() => route.meta.cwa?.admin)
const isErrorPage = computed(() => !!error.value)
const adminChrome = computed(() => !!pageIsAdmin.value || isErrorPage.value)
const homePath = ref(sitePath($cwa))

watch(() => [route.fullPath, pageIsAdmin.value, isErrorPage.value] as const, ([path, admin, failed]) => {
  if (!admin && !failed) {
    rememberSitePath($cwa, path)
  }
  homePath.value = sitePath($cwa)
}, { immediate: true })

const builtInIcons: Record<string, { icon: Component, class?: string }> = {
  layouts: { icon: IconLayouts },
  pages: { icon: IconPages, class: 'cwa:h-6' },
  data: { icon: IconData, class: 'cwa:h-6' },
  routes: { icon: IconRoutes, class: 'cwa:h-6' },
  users: { icon: IconUsers },
}

const hasPageData = ref(false)

watch(adminChrome, (shown) => {
  shown && hasPageDataTypes($cwa).then((answer) => {
    hasPageData.value = answer
  })
}, { immediate: true })

const topBar = computed(() => topBarItems(extensionAreas as CwaExtensionArea[], { own: $cwa.auth.user?.adminPreferences?.topBar, developer: topBarDefault }, { hasRole: role => $cwa.auth.hasRole(role), hasPageData: hasPageData.value }))

const activeId = computed(() => currentArea(topBar.value.map(item => ({ id: item.id, path: router.resolve(item.to).path })), route.path))

const onDashboard = computed(() => route.path === '/_cwa')

const linkClass = 'cwa:flex cwa:items-center cwa:justify-center cwa:pointer-coarse:min-h-hit cwa:pointer-coarse:min-w-hit cwa:hover:text-white cwa:aria-[current=page]:text-white cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:motion-reduce:transition-none cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg'

const centreClass = computed(() => {
  if (!adminChrome.value) {
    return 'cwa:max-sm:flex cwa:max-sm:min-w-0 cwa:max-sm:flex-1 cwa:max-sm:justify-center cwa:sm:absolute cwa:sm:left-1/2 cwa:sm:top-1/2 cwa:sm:-translate-x-1/2 cwa:sm:-translate-y-1/2'
  }
  return ['cwa:flex cwa:min-w-0 cwa:flex-1 cwa:justify-center', { 'cwa:max-sm:hidden': pageIsAdmin.value }]
})

const widths = new Map<string, number>()
const overflowIds = ref<string[]>([])

const moreItems = computed<MenuItem[]>(() => topBar.value.filter(item => overflowIds.value.includes(item.id)).map(item => ({
  label: item.label,
  value: item.id,
  onSelect: () => router.push(item.to),
})))

function fit() {
  const element = list.value
  if (!element) {
    return
  }
  const measured = measureTopBar(element)
  for (const [id, width] of Object.entries(measured.widths)) {
    widths.set(id, width)
  }
  const items = topBar.value
  const { overflow } = fitTopBar(items.map(item => widths.get(item.id) ?? 0), measured.available, {
    active: items.findIndex(item => item.id === activeId.value),
    more: measured.more,
  })
  const ids = overflow.map(index => items[index]!.id)
  if (ids.join() !== overflowIds.value.join()) {
    overflowIds.value = ids
  }
}

let resizes: ResizeObserver | undefined

watch([list, () => topBar.value.map(item => item.id).join(), activeId], () => {
  resizes?.disconnect()
  resizes = undefined
  const element = list.value
  if (!element) {
    return
  }
  fit()
  if (typeof ResizeObserver !== 'undefined') {
    resizes = new ResizeObserver(fit)
    resizes.observe(element)
    for (const item of element.children) {
      resizes.observe(item)
    }
  }
}, { flush: 'post', immediate: true })

onBeforeUnmount(() => resizes?.disconnect())

function viewSite() {
  router.push(homePath.value)
}

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
