<template>
  <div>
    <h4>Home route loaded in asyncData:</h4>
    <pre>{{ homeRoute }}</pre>
    <resource-component-loader v-bind="resourceComponentLoaderProps" />
  </div>
</template>
<script>
import Page from "@cwa/nuxt-module/core/templates/page"
import ResourceComponentLoader from "../../src/core/templates/resource-component-loader";

export default {
  components: {ResourceComponentLoader},
  auth: false,
  extends: Page,
  async asyncData({ $axios }) {
    const { data } = await $axios.get('/_/routes//')
    return {
      homeRoute: data
    }
  }
}
</script>
