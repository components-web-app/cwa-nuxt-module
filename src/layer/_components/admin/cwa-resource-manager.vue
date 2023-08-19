<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useCwa } from '#imports'

const $cwa = useCwa()
const current = $cwa.admin.componentManager.currentStackItem
const stack = $cwa.admin.componentManager.resourceStack

function clickHandler (e: any) {
  $cwa.admin.componentManager.addToStack({ clickTarget: e.target })
}

onMounted(() => {
  window.addEventListener('click', clickHandler)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', clickHandler)
})
</script>

<template>
  <div>
    {{ stack.length }}: {{ current }}
  </div>
</template>
