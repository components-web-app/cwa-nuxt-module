<template>
  <div>
    <pre>{{ $cwa.store.resources }}</pre>
  </div>
</template>

<script setup>
import { useNuxtApp } from 'nuxt/app'

const { $cwa } = useNuxtApp()
</script>
