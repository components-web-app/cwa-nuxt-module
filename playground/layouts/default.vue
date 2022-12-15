<template>
  <div>
    <progress class="page-load-progress" :value="$cwa.resourcesManager.resourceLoadStatus.complete" :max="$cwa.resourcesManager.resourceLoadStatus.total">{{ $cwa.resourcesManager.resourceLoadStatus.percent }}%</progress><br>
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
.page-load-progress
  width: 100%
</style>
