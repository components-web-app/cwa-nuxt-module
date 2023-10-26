<script setup lang="ts">
import type { DefineComponent } from 'vue'
import { computed, toRef, watch } from 'vue'
import type { GlobalComponentNames } from '#cwa/module.js'

const p = defineProps<{
  components?:(GlobalComponentNames|DefineComponent<{}, {}, any>)[]
  props?: any
  modelValue: any
}>()

const componentsRef = toRef(p, 'components')

const emit = defineEmits(['update:modelValue'])

const allMeta = computed({
  get () {
    return p.modelValue
  },
  set (value: any[]) {
    // async components may exist without an initial value
    emit('update:modelValue', value.filter(v => !!v))
  }
})

watch(componentsRef, () => {
  allMeta.value = []
})

defineExpose({
  cwaMetaResolver: true
})
</script>

<template>
  <component
    :is="uiComponent"
    v-for="(uiComponent, index) of components"
    :key="`resolveComponent_${uiComponent}_${index}`"
    :ref="(meta: any) => (allMeta[index] = meta)"
    v-bind="props"
    class="cwa-hidden"
  />
</template>
