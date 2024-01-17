<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ResourceLoadingIndicator
  from '../_common/ResourceLoadingIndicator.vue'
import ManagerTabs from './_parts/ManagerTabs.vue'
import CwaAdminResourceManagerContextMenu from './_parts/CwaResourceManagerContextMenu.vue'
import { useCwa } from '#imports'
import type { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'
import ComponentMetaResolver from '#cwa/runtime/templates/components/core/ComponentMetaResolver.vue'
import type { ManagerTab } from '#cwa/module'

const $cwa = useCwa()

const current = $cwa.admin.componentManager.currentStackItem
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

function onContextMenu (e: PointerEvent) {
  const pos: ContextPosition = {
    top: e.clientY,
    left: e.clientX
  }
  if (showDefaultContext(pos) || !$cwa.admin.isEditing || !$cwa.admin.componentManager.isContextPopulating.value) {
    isOpen.value = false
    return
  }
  e.preventDefault()
  openContext(pos)
}

function mousedownHandler (e: MouseEvent) {
  mousedownTarget = e.target
}

function clickHandler (e: MouseEvent) {
  // attempt to prevent selecting when dragging mouse over different resources which will not trigger a click on either
  if (e.target !== mousedownTarget && !$cwa.admin.componentManager.isPopulating.value) {
    return
  }
  completeStack(e)
  $cwa.admin.componentManager.selectStackIndex(0)
}

function contextHandler (e: MouseEvent) {
  completeStack(e, true)
}

function completeStack (e: MouseEvent, isContext: boolean = false) {
  $cwa.admin.componentManager.addToStack({ clickTarget: e.target }, isContext)
}

function selectTab (index: number) {
  selectedIndex.value = index
}

const showAdmin = computed(() => {
  return $cwa.auth.hasRole(CwaUserRoles.ADMIN)
})

watch(current, (newCurrent, oldCurrent) => {
  if (oldCurrent && newCurrent && $cwa.resources.isIriPublishableEquivalent(oldCurrent.iri, newCurrent.iri)) {
    return
  }
  allTabsMeta.value = []
  managerTabs.value?.resetTabs()
  currentManagerTabs.value = newCurrent?.managerTabs
})

onMounted(() => {
  window.addEventListener('mousedown', mousedownHandler)
  window.addEventListener('click', clickHandler)
  window.addEventListener('contextmenu', contextHandler)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', mousedownHandler)
  window.removeEventListener('click', clickHandler)
  window.removeEventListener('contextmenu', contextHandler)
})

const showSpacer = computed(() => {
  return $cwa.admin.componentManager.showManager.value && current
})

const selectedTab = computed(() => {
  return current.value?.managerTabs?.[selectedIndex.value]
})

watch([spacer, managerHolder, current, selectedIndex, allTabsMeta], () => {
  if (!spacer.value || !managerHolder.value || !current.value) {
    return
  }
  const newHeight = managerHolder.value.clientHeight
  spacer.value.style.height = `${newHeight}px`
}, {
  flush: 'post'
})

defineExpose({
  onContextMenu
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
    <div v-if="$cwa.admin.componentManager.showManager.value" class="fixed cwa-bottom-0 cwa-z-50 cwa-w-full cwa-text-white cwa-bg-dark/70" @click.stop @contextmenu.stop>
      <div class="cwa-dark-blur">
        <ComponentMetaResolver v-model="allTabsMeta" :components="currentManagerTabs" />
        <div v-if="allTabsMeta.length" ref="managerHolder">
          <ResourceLoadingIndicator class="cwa-absolute cwa-bottom-full cwa-left-0" />
          <div class="cwa-flex">
            <div class="cwa-flex-grow">
              <div class="cwa-flex cwa-items-center cwa-pt-3 cwa-px-4 cwa-space-x-3">
                <div class="cwa-flex-grow">
                  <ManagerTabs ref="managerTabs" :tabs="allTabsMeta" @click="selectTab" />
                </div>
                <div class="cwa-flex cwa-light cwa-items-center cwa-content-center cwa-justify-center">
                  <CwaUiFormButton
                    color="grey"
                    class="cwa-min-w-[150px]"
                    :options="['Option 1', 'Option 2']"
                  >
                    Quick Link
                  </CwaUiFormButton>
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
</template>
