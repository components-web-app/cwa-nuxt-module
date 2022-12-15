<template>
  <div class="resource-grid">
    <div v-for="(resource, index) of $cwa.resourcesManager.currentResources" :key="`resource-grid-${index}`" class="resource-grid-item">
      <div class="resource-title">
        {{ index }}
      </div>
      <pre class="resource-code">{{ resource }}</pre>
    </div>
  </div>
</template>

<script setup>
import { useNuxtApp } from '#app'
const { $cwa } = useNuxtApp()
</script>

<style lang="sass">
.resource-grid
  display: flex
  flex-wrap: wrap
  font-family: sans-serif
  .resource-grid-item
    width: 33.33%
    padding: 1rem
    box-sizing: border-box
    .resource-title
      padding: .5rem
      background: #e9e9e9
      font-weight: bold
      color: #333
      font-size: .8rem
      white-space: nowrap
      text-overflow: ellipsis
      overflow: hidden
    .resource-code
      background: #f2f2f2
      box-sizing: border-box
      padding: 1rem
      max-height: 10rem
      overflow: auto
      margin: 0
</style>
