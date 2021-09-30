<template>
  <cwa-admin-text v-if="!isNumberType" v-model="inputValue" v-bind="props" />
  <cwa-admin-text
    v-else
    v-model.number="inputValue"
    v-bind="props"
    @keyup="enforceNumber"
  />
</template>
<script lang="ts">
import Vue from 'vue'
import ApiInputMixin from '../../../../../mixins/ApiInputMixin'
import CwaTextMixin from '../../input/CwaTextMixin'
import CwaAdminText from '../../input/cwa-admin-text.vue'

export default Vue.extend({
  components: { CwaAdminText },
  mixins: [ApiInputMixin, CwaTextMixin],
  props: {
    notificationCategory: {
      required: false,
      default: 'components-manager',
      type: String
    }
  },
  data() {
    return {
      wrapperComponent: async () => await import('./wrapper.vue')
    }
  },
  computed: {
    isNumberType() {
      return this.type.toLowerCase() === 'number'
    },
    props() {
      return Object.assign({}, this.$props, {
        id: `input-${this.resource?.['@id']}-${this.field}`,
        wrapper: this.wrapperComponent
      })
    }
  },
  watch: {
    inputValue() {
      this.$nextTick(() => {
        this.enforceNumber()
      })
    }
  },
  methods: {
    enforceNumber() {
      const normalizedNumber = this.inputValue / 1 || 0
      if (normalizedNumber !== this.inputValue) {
        this.inputValue = normalizedNumber
      }
    }
  }
})
</script>
