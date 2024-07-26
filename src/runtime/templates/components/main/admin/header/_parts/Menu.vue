<template>
  <div>
    <CwaUiHamburger v-model="showMenu" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const showMenu = ref(false)
</script>
