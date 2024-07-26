<template>
  <div class="flex">
    <CwaUiHamburger v-model="showMenu" class="cwa-relative cwa-z-10" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const showMenu = ref(false)
</script>
