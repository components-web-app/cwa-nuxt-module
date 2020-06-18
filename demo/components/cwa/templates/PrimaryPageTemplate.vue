<template>
  <div>
    {{ resource }}
  </div>
</template>

<script>
import ResourceMixin from "@cwa/nuxt-module/core/mixins/ResourceMixin.js"

export default {
  mixins: [ResourceMixin]
}
</script>
