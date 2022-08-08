<template>
  <div>
    <p>Are you sure you want to delete this component instance?</p>
    <p>{{ usedInStr }}</p>
    <p class="warning">
      <span class="cwa-icon">
        <span class="cwa-warning-triangle"></span>
      </span>
      <span>This action cannot be reversed!</span>
    </p>
    <p v-if="locationCount > 1">
      <cwa-admin-toggle
        id="delete-all"
        v-model="submitObj.deleteAll"
        label="Delete everywhere"
      />
    </p>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import IriMixin from '../../../../../../../mixins/IriMixin'
import CwaAdminToggle from '../../../../input/cwa-admin-toggle.vue'

export default Vue.extend({
  components: { CwaAdminToggle },
  mixins: [IriMixin],
  props: {
    value: {
      type: Object,
      required: true
    },
    usageMetadata: {
      type: Object,
      required: false,
      default: null
    }
  },
  data() {
    return {
      submitObj: {
        deleteAll: false
      }
    }
  },
  computed: {
    locationCount() {
      return this.usageMetadata ? this.usageMetadata.total : null
    },
    usedInStr() {
      const locationCount = this.locationCount
      return locationCount === 1
        ? 'This is the only place you have used this component, so it will not affect any other part of your website.'
        : `It is being used in ${locationCount} locations. You can choose to delete it just here, or everywhere it is being used.`
    }
  },
  watch: {
    submitObj: {
      immediate: true,
      handler(newObj) {
        this.$emit('input', newObj)
      }
    },
    locationCount: {
      immediate: true,
      handler(newValue) {
        this.submitObj.deleteAll = newValue < 2
      }
    }
  }
})
</script>
