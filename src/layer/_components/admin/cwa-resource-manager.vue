<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCwa } from '#imports'

const $cwa = useCwa()
const current = $cwa.admin.componentManager.currentStackItem
const spacer = ref<HTMLElement|null>(null)
const managerHolder = ref<HTMLElement|null>(null)

function clickHandler (e: MouseEvent) {
  completeStack(e)
  $cwa.admin.componentManager.selectStackIndex(0)
}

function completeStack (e: MouseEvent) {
  $cwa.admin.componentManager.addToStack({ clickTarget: e.target })
}

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
    <div v-if="$cwa.admin.componentManager.showManager.value" class="fixed cwa-bottom-0 cwa-z-50 cwa-dark-blur cwa-w-full cwa-text-white" @click.stop>
      <div v-if="current" ref="managerHolder" class="cwa-p-4">
        {{ current.displayName }}: {{ current.iri }}
      </div>
    </div>
  </Transition>
</template>
