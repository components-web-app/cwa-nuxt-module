<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import { useMouse, useWindowScroll } from '@vueuse/core'
import ManagerTabs from './_parts/manager-tabs.vue'
import CwaAdminResourceManagerContextMenu from './_parts/cwa-resource-manager-context-menu.vue'
import { useCwa } from '#imports'
import { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import { CwaUserRoles } from '#cwa/runtime/storage/stores/auth/state'

const $cwa = useCwa()
const { x, y } = useMouse()
const { y: windowY } = useWindowScroll()

const current = $cwa.admin.componentManager.currentStackItem
const spacer = ref<HTMLElement|null>(null)
const managerHolder = ref<HTMLElement|null>(null)
const tabRefs = ref<CwaResourceManagerTabOptions[]>([])
const selectedIndex = ref(0)
const isOpen = ref(false)
const virtualElement = ref({ getBoundingClientRect: () => ({}) })
const managerTabs = ref<typeof ManagerTabs|null>(null)
const cachedPosition = { top: 0, left: 0 }

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
    top: unref(y) - unref(windowY),
    left: unref(x)
  }
  if (showDefaultContext(pos)) {
    isOpen.value = false
    return
  }
  e.preventDefault()
  $cwa.admin.isEditing && openContext(pos)
}

function clickHandler (e: MouseEvent) {
  completeStack(e)
  $cwa.admin.componentManager.selectStackIndex(0)
}

function completeStack (e: MouseEvent) {
  $cwa.admin.componentManager.addToStack({ clickTarget: e.target })
}

function selectTab (index: number) {
  selectedIndex.value = index
}

const showAdmin = computed(() => {
  return $cwa.auth.hasRole(CwaUserRoles.ADMIN)
})

watch(current, () => {
  tabRefs.value = []
  managerTabs.value?.resetTabs()
})

onMounted(() => {
  window.addEventListener('click', clickHandler)
  window.addEventListener('contextmenu', completeStack)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', clickHandler)
  window.removeEventListener('contextmenu', completeStack)
})

const showSpacer = computed(() => {
  return $cwa.admin.componentManager.showManager.value && current
})

const selectedTab = computed(() => {
  return current.value?.managerTabs?.[selectedIndex.value]
})

// tabs can be async components and need to be loaded before having a value
const allTabsMeta = computed(() => {
  return tabRefs.value.filter(i => i)
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
    <div v-if="$cwa.admin.componentManager.showManager.value" class="fixed cwa-bottom-0 cwa-z-50 cwa-dark-blur cwa-w-full cwa-text-white" @click.stop @contextmenu.stop>
      <component
        :is="tab"
        v-for="(tab, index) of current?.managerTabs"
        :key="`managerTab_${current.displayName}_${tab}_${index}`"
        :ref="(el: CwaResourceManagerTabOptions) => (tabRefs[index] = el)"
        class="cwa-hidden"
      />
      <div v-if="allTabsMeta.length" ref="managerHolder">
        <ManagerTabs ref="managerTabs" :tabs="allTabsMeta" @click="selectTab" />
        <div class="cwa-p-4 cwa-bg-dark">
          <component
            :is="selectedTab"
            v-if="selectedTab"
          />
        </div>
      </div>
    </div>
  </Transition>
  <CwaAdminResourceManagerContextMenu v-if="showAdmin" v-model="isOpen" :virtual-element="virtualElement" />
</template>
