<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useCwa } from '#imports'

const $cwa = useCwa()
const current = $cwa.admin.componentManager.currentStackItem

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
</script>

<template>
  <div v-if="$cwa.admin.componentManager.showManager.value">
    {{ current }}
    <pre>{{ $cwa.admin.componentManager.resourceStack }}</pre>
  </div>
</template>
