<template>
  <div>
    <div data-placeholder class="h-40 w-40 overflow-hidden relative bg-gray-200" />
    <nuxt-img src="/logo.svg" placeholder />
    <CodeBlock>{{ resource }}</CodeBlock>
  </div>
</template>

<script setup lang="ts">
import type { IriProp } from '#cwa/runtime/composables/cwa-resource'
import { toRef } from 'vue'
import { useCwaResource } from '#imports'

const props = defineProps<IriProp>()

const resource = useCwaResource(toRef(props, 'iri')).getResource()
</script>
