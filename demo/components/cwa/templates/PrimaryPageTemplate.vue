<template>
  <div>
    <div>
      <component-collection location="primary" :page-id="iri" />
    </div>
    <div>
      <component-collection location="secondary" :page-id="iri" />
    </div>
  </div>
</template>

<script>
import PageMixin from "@cwa/nuxt-module/core/mixins/PageMixin.js"

export default {
  mixins: [PageMixin]
}
</script>
