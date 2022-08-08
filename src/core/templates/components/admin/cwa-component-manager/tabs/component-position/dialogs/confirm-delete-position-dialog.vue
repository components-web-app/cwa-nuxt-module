<template>
  <div class="content">
    <p>Are you sure you want to delete this position?</p>
    <p class="warning">
      <span class="cwa-icon">
        <span class="cwa-warning-triangle"></span>
      </span>
      <span>This action cannot be reversed!</span>
    </p>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import IriMixin from '../../../../../../../mixins/IriMixin'

export default Vue.extend({
  components: {},
  mixins: [IriMixin],
  props: {
    value: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      submitObj: {
        deleteAll: false
      }
    }
  },
  watch: {
    submitObj: {
      immediate: true,
      handler(newObj) {
        this.$emit('input', newObj)
      }
    }
  }
})
</script>
