<template>
  <div>
    <NuxtLayout :name="layout">
      <div class="cwa-p-4">
        <CwaCurrentResources />
      </div>
    </NuxtLayout>
  </div>
</template>

<script setup>
import CwaCurrentResources from './components/CwaCurrentResources.vue'
const layout = 'cwa-default'
</script>
