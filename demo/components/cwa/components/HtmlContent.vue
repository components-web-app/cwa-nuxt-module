<template>
  <div>
    <h4>My custom HtmlContent component. See the HTML below. That was easy!</h4>
    <div v-html="resource.html"></div>
  </div>
</template>

<script>
import ComponentMixin from "@cwa/nuxt-module/core/mixins/ComponentMixin.js"
export default {
  mixins: [ComponentMixin]
}
</script>