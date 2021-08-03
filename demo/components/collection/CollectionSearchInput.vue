<template>
  <div @click.stop>
    <input
      v-model="searchValue"
      type="text"
      @input="
        () => {
          updateSearch()
        }
      "
    />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import QuerySearchMixin from '@cwa/nuxt-module/core/mixins/QuerySearchMixin'

export default Vue.extend({
  mixins: [QuerySearchMixin]
})
</script>
