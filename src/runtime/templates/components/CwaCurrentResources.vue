<template>
  <div class="resource-grid cwa-grid cwa-grid-cols-1 md:cwa-grid-cols-2 xl:cwa-grid-cols-3 cwa-gap-3 cwa-text-sm ">
    <div v-for="(resource, index) of $cwa.resources.currentResources" :key="`resource-grid-${index}`" class="resource-grid-item cwa-bg-slate-100 cwa-relative">
      <div class="resource-title cwa-px-2 cwa-py-1 cwa-font-bold cwa-whitespace-nowrap cwa-overflow-hidden cwa-text-ellipsis cwa-transition cwa-duration-300" :class="[{ 'cwa-bg-lime-200': resource.apiState.status === 1 }, { 'cwa-bg-red-200': resource.apiState.status === -1 }]">
        {{ index }}
      </div>
      <div class="path-header cwa-px-2 cwa-py-1 cwa-bg-slate-200">
        {{ resource.apiState?.headers?.path || '--' }}
      </div>
      <pre class="resource-code cwa-text-xs cwa-p-3 cwa-h-56 cwa-overflow-auto">{{ resource.data }}</pre>
      <div v-if="resource.apiState.error?.message" class="resource-error cwa-absolute cwa-top-16 cwa-bottom-2 cwa-left-2 cwa-right-2 cwa-bg-red-200/95 cwa-p-3 cwa-overflow-auto">
        <b>Status code:</b> {{ resource.apiState.error.statusCode || 'Unknown' }}<br>
        <b>Message:</b><br>{{ resource.apiState.error.primaryMessage }}<br>
        <b>Request:</b><br>{{ resource.apiState.error.request }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { useCwa } from '#cwa/runtime/composables/cwa'

const $cwa = useCwa()
</script>
