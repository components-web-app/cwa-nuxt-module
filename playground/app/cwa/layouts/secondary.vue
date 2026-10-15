<template>
  <div class="relative">
    <div class="bg-inherit">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCwaLayout } from '#imports'

useCwaLayout()
</script>
