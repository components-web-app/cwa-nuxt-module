<template>
  <NuxtLayout :name="layoutName">
    <slot />
  </NuxtLayout>
</template>

<script setup>
// todo: load in the layout to be used for the page from $cwa
const layoutName = 'cwa-default'
</script>
