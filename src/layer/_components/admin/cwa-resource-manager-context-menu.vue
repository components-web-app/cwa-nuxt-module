<script lang="ts" setup>
import { computed } from 'vue'
import ContextMenu from '#cwa/layer/_components/admin/context-menu.vue'
import { useCwa } from '#imports'
import ResourceContextItem from '#cwa/layer/_components/admin/resource-context-item.vue'

const $cwa = useCwa()

const props = defineProps<{
  modelValue: boolean
  virtualElement: any
}>()

const emit = defineEmits(['update:modelValue'])

const stackSize = computed(() => $cwa.admin.componentManager.resourceStack.value.length)

const isOpen = computed({
  get () {
    return props.modelValue && stackSize.value > 0
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
    <resource-context-item :index="stackSize - 1" @click="index => selectResource(index)" />
  </context-menu>
</template>
