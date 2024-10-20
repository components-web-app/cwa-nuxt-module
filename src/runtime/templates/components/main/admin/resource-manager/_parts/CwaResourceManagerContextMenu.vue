<script lang="ts" setup>
import { computed } from 'vue'
import ResourceContextItem from '../../_common/ResourceContextItem.vue'
import ContextMenu from '../../../../utils/ContextMenu.vue'
import { useCwa } from '#imports'

const $cwa = useCwa()

const props = defineProps<{
  modelValue: boolean
  virtualElement: any
}>()

const emit = defineEmits(['update:modelValue'])

const stackSize = computed(() => $cwa.admin.resourceStackManager.contextStack.value.length)

const isOpen = computed({
  get() {
    return props.modelValue && stackSize.value > 0
  },
  set(value) {
    emit('update:modelValue', value)
  },
})

function selectResource(index: number) {
  $cwa.admin.resourceStackManager.selectStackIndex(index, true)
  isOpen.value = false
}
</script>

<template>
  <context-menu
    v-model="isOpen"
    :virtual-element="virtualElement"
    @click.stop
  >
    <resource-context-item
      :index="stackSize - 1"
      @click="index => selectResource(index)"
    />
  </context-menu>
</template>
