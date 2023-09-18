<script lang="ts" setup>
import { computed } from 'vue'
import ContextMenu from '#cwa/layer/_components/admin/context-menu.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()

const props = defineProps<{
  modelValue: boolean
  virtualElement: any
}>()

const emit = defineEmits(['update:modelValue'])

const isOpen = computed({
  get () {
    return props.modelValue && $cwa.admin.componentManager.resourceStack.value.length > 0
  },
  set (value) {
    emit('update:modelValue', value)
  }
})

function selectResource (index) {
  $cwa.admin.componentManager.selectStackIndex(index)
  isOpen.value = false
}
</script>

<template>
  <context-menu
    v-model="isOpen"
    :virtual-element="virtualElement"
    @click.stop
  >
    <ul class="cwa-space-y-3">
      <li v-for="(stackItem, index) of $cwa.admin.componentManager.resourceStack.value" :key="stackItem?.iri">
        <button class="cwa-border cwa-p-2 cwa-w-full" @click="selectResource(index)">
          {{ stackItem?.iri }}
        </button>
      </li>
    </ul>
  </context-menu>
</template>
