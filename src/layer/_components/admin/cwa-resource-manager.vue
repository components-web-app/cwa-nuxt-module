<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCwa } from '#imports'
import { CwaResourceManagerTabOptions } from '#cwa/runtime/composables/cwa-resource-manager-tab'
import ManagerTabs from '#cwa/layer/_components/admin/resource-manager/manager-tabs.vue'

const $cwa = useCwa()
const current = $cwa.admin.componentManager.currentStackItem
const spacer = ref<HTMLElement|null>(null)
const managerHolder = ref<HTMLElement|null>(null)
const tabs = ref<CwaResourceManagerTabOptions[]>([])
const selectedIndex = ref(0)

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

watch(current, () => {
  tabs.value = []
  selectedIndex.value = 0
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

watch([spacer, managerHolder], () => {
  if (!spacer.value || !managerHolder.value) {
    return
  }
  const newHeight = managerHolder.value.clientHeight
  spacer.value.style.height = `${newHeight}px`
}, {
  flush: 'post'
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
      <template v-if="current">
        <ManagerTabs :tabs="tabs" :selected-index="selectedIndex" @click="selectTab" />
        <div ref="managerHolder" class="cwa-p-4">
          <template v-if="current?.managerTabs">
            <component
              :is="tab"
              v-for="(tab, index) of current.managerTabs"
              :key="`managerTab_${current.displayName}_${tab}_${index}`"
              :ref="(el: CwaResourceManagerTabOptions) => (tabs[index] = el)"
              class="cwa-hidden"
            />
            <component
              :is="selectedTab"
              v-if="selectedTab"
            />
          </template>
        </div>
      </template>
    </div>
  </Transition>
</template>
