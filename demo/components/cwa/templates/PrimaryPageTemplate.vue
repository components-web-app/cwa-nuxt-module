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
import ResourceMixin from "@cwa/nuxt-module/core/mixins/ResourceMixin.js"

export default {
  mixins: [ResourceMixin]
}
</script>
