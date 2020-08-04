<template>
  <div>
    <input v-model="inputValue" @dblclick="$emit('hide')">
    <span v-if="outdated">saving...</span>
  </div>
</template>

<script>
import InputMixin from '@cwa/nuxt-module/core/mixins/InputMixin'

export default {
  mixins: [InputMixin]
}
</script>
