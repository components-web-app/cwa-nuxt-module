<template>
  <div>
    <label for="page-load">{{ $cwa.resourcesManager.resourceLoadStatus.percent }}%</label>
    <progress id="page-load" :class="['page-load-progress', { 'is-complete': $cwa.resourcesManager.resourceLoadStatus.percent === 100 }]" :value="$cwa.resourcesManager.resourceLoadStatus.complete" :max="$cwa.resourcesManager.resourceLoadStatus.total">
      {{ $cwa.resourcesManager.resourceLoadStatus.percent }}%
    </progress><br>
    <nuxt-link to="/">
      Home
    </nuxt-link> |
    <nuxt-link to="/introduction">
      Introduction
    </nuxt-link> |
    <nuxt-link to="/new">
      New
    </nuxt-link>
    <hr>
    <div>
      <nuxt-page />
    </div>
    <hr>
    <button :disabled="fetchingApiDocs" @click="getApiDocumentation">
      Refresh Api Documentation
    </button>
    <pre>{{ fetchingApiDocs ? 'Loading' : apiDocumentation }}</pre>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useNuxtApp } from '#app'
const { $cwa } = useNuxtApp()

const fetchingApiDocs = ref(false)
const apiDocumentation = ref('API Documentation Not Loaded')
async function getApiDocumentation () {
  fetchingApiDocs.value = true
  apiDocumentation.value = await $cwa.getApiDocumentation(true)
  fetchingApiDocs.value = false
}
</script>

<style lang="sass">
body
  font-family: sans-serif
  color: black
  a
    color: #444
    text-decoration: none
    transition: .2s color ease
    &.router-link-exact-active
      font-weight: bold
    &:hover
      color: black
progress.page-load-progress
  width: 100%
  -webkit-appearance: none
  height: .5rem
  display: block
  &::-webkit-progress-bar
    background: lightgray
    border-radius: 1rem
    overflow: hidden
  &::-webkit-progress-value
    background: orange
    transition: .1s width ease, .2s background-color ease
  &.is-complete::-webkit-progress-value
    background: green
</style>
