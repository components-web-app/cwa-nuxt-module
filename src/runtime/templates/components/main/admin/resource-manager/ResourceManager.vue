<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import ResourceLoadingIndicator
  from '../_common/ResourceLoadingIndicator.vue'
import ManagerTabs from './_parts/ManagerTabs.vue'
import CwaAdminResourceManagerContextMenu from './_parts/CwaResourceManagerContextMenu.vue'
import { useCwa } from '#imports'
import type { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'
import type { ManagerTab } from '#cwa/module'
import ResourceManagerCtaButton
  from '#cwa/runtime/templates/components/main/admin/resource-manager/cta/ResourceManagerCtaButton.vue'
import AddComponentDialog
  from '#cwa/runtime/templates/components/main/admin/resource-manager/_parts/AddComponentDialog.vue'
import { useDataResolver } from '#cwa/runtime/templates/components/core/useDataResolver'

const $cwa = useCwa()
const currentStackItem = $cwa.admin.resourceStackManager.currentStackItem
const spacer = ref<HTMLElement|null>(null)
const managerHolder = ref<HTMLElement|null>(null)
const allTabsMeta = ref<CwaResourceManagerTabOptions[]>([])
const selectedIndex = ref(0)
const isOpen = ref(false)
const virtualElement = ref({ getBoundingClientRect: () => ({}) })
const managerTabs = ref<typeof ManagerTabs|null>(null)
const currentManagerTabs = ref<ManagerTab[]|undefined>()
const cachedPosition = { top: 0, left: 0 }
let mousedownTarget: null|EventTarget = null

type ContextPosition = {
  top: number
  left: number
}

function showDefaultContext ({ top, left }: ContextPosition) {
  const difference = {
    top: Math.abs(top - cachedPosition.top),
    left: Math.abs(left - cachedPosition.left)
  }
  return isOpen.value && difference.top < 10 && difference.left < 10
}

function openContext ({ top, left }: ContextPosition) {
  cachedPosition.top = top
  cachedPosition.left = left
  virtualElement.value.getBoundingClientRect = () => ({
    width: 0,
    height: 0,
    top,
    left
  })
  isOpen.value = true
}

function contextMenuHandler (e: MouseEvent, type: 'page'|'layout') {
  const pos: ContextPosition = {
    top: e.clientY,
    left: e.clientX
  }
  if (showDefaultContext(pos) || !$cwa.admin.isEditing || !$cwa.admin.resourceStackManager.isContextPopulating.value) {
    isOpen.value = false
    return
  }
  e.preventDefault()
  completeStack(e, type, true)
  openContext(pos)
}

function closeContextMenu (e: MouseEvent) {
  isOpen.value = false
  completeStack(e, undefined, true)
}

function mousedownHandler (e: MouseEvent) {
  mousedownTarget = e.target
}

function clickHandler (e: MouseEvent, type: 'page'|'layout') {
  // attempt to prevent selecting when dragging mouse over different resources which will not trigger a click on either
  if (e.target !== mousedownTarget && !$cwa.admin.resourceStackManager.isPopulating.value) {
    return
  }
  completeStack(e, type)
  $cwa.admin.resourceStackManager.selectStackIndex(0, false)
}

function completeStack (e: MouseEvent, type: undefined|'page'|'layout', isContext: boolean = false) {
  $cwa.admin.resourceStackManager.completeStack({ clickTarget: e.target }, isContext, type)
}

function selectTab (index: number) {
  selectedIndex.value = index
}

const showAdmin = computed(() => {
  return $cwa.auth.hasRole(CwaUserRoles.ADMIN)
})

const showSpacer = computed(() => {
  return $cwa.admin.resourceStackManager.showManager.value && currentStackItem
})

const selectedTab = computed(() => {
  return currentStackItem.value?.managerTabs?.[selectedIndex.value]
})

watch([spacer, managerHolder, currentStackItem, selectedIndex, allTabsMeta], () => {
  if (!spacer.value || !managerHolder.value || !currentStackItem.value) {
    return
  }
  const newHeight = managerHolder.value.clientHeight
  spacer.value.style.height = `${newHeight}px`
}, {
  flush: 'post'
})

const resolverProps = computed(() => {
  return {
    iri: currentStackItem.value?.iri
  }
})
useDataResolver(allTabsMeta, {
  components: currentManagerTabs,
  props: resolverProps,
  propsValidator: (props: typeof resolverProps.value) => {
    return !!props.iri
  }
})

watch(currentStackItem, (newCurrent, oldCurrent) => {
  if (oldCurrent && newCurrent && $cwa.resources.isIriPublishableEquivalent(oldCurrent.iri, newCurrent.iri)) {
    return
  }
  allTabsMeta.value = []
  managerTabs.value?.resetTabs()
  currentManagerTabs.value = newCurrent?.managerTabs
})

onMounted(() => {
  window.addEventListener('mousedown', mousedownHandler)
})

defineExpose({
  clickHandler,
  contextMenuHandler,
  closeContextMenu
})
</script>

<template>
  <div v-if="showSpacer" ref="spacer" class="relative" />
  <Transition
    enter-from-class="cwa-transform cwa-translate-y-full"
    enter-active-class="cwa-duration-200 cwa-ease-out"
    enter-to-class="cwa-translate-y-0"
    leave-from-class="cwa-translate-y-0"
    leave-active-class="cwa-duration-200 cwa-ease-in"
    leave-to-class="cwa-transform cwa-translate-y-full"
  >
    <div v-if="$cwa.admin.resourceStackManager.showManager.value" class="fixed cwa-bottom-0 cwa-z-50 cwa-w-full cwa-text-white cwa-bg-dark/70" @click.stop>
      <div class="cwa-dark-blur">
        <div v-if="allTabsMeta.length" ref="managerHolder">
          <ResourceLoadingIndicator class="cwa-absolute cwa-bottom-full cwa-left-0" />
          <div class="cwa-flex">
            <div class="cwa-flex-grow">
              <div class="cwa-flex cwa-items-center cwa-pt-3 cwa-px-4 cwa-space-x-3">
                <div class="cwa-flex-grow">
                  <ManagerTabs ref="managerTabs" :tabs="allTabsMeta" @click="selectTab" />
                </div>
                <div class="cwa-flex cwa-light cwa-items-center cwa-content-center cwa-justify-center">
                  <ResourceManagerCtaButton />
                </div>
              </div>
              <div class="cwa-p-4 cwa-min-h-[74px] cwa-flex cwa-items-center">
                <component
                  :is="selectedTab"
                  v-if="selectedTab"
                  class="cwa-w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
  <CwaAdminResourceManagerContextMenu v-if="showAdmin" v-model="isOpen" :virtual-element="virtualElement" />
  <AddComponentDialog />
</template>
