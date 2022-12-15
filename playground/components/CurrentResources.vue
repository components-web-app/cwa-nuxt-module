<template>
  <div class="resource-grid">
    <div v-for="(resource, index) of $cwa.resourcesManager.currentResources" :key="`resource-grid-${index}`" :class="['resource-grid-item', { 'is-success': resource.apiState.status === 1 }, { 'is-error': resource.apiState.status === -1 }]">
      <div class="resource-title">
        {{ index }}
      </div>
      <pre class="resource-code">{{ resource.data }}</pre>
      <div v-if="resource.apiState.error?.message" class="resource-error">
        Status code '{{ resource.apiState.error.statusCode || 'Unknown' }}': {{ resource.apiState.error.message }}
      </div>
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
    min-width: 350px
    padding: 1rem
    box-sizing: border-box
    position: relative
    .resource-title
      padding: .5rem
      background: #e9e9e9
      font-weight: bold
      color: #333
      font-size: .8rem
      white-space: nowrap
      text-overflow: ellipsis
      overflow: hidden
    .resource-error
      position: absolute
      top: 4rem
      right: 2rem
      left: 2rem
      bottom: 2rem
      z-index: 2
      background: rgba(mistyrose, .4)
      box-sizing: border-box
      padding: .5rem
      font-size: .8rem
      overflow: auto
    .resource-code
      background: #f2f2f2
      box-sizing: border-box
      padding: 1rem
      height: 8rem
      overflow: auto
      margin: 0
    &.is-error
      .resource-title
        background: mistyrose
    &.is-success
      .resource-title
        background: #e4ffe8
</style>
