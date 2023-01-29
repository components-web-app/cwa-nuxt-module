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
    },
    emptyStringIsNull: {
      required: false,
      default: false,
      type: Boolean
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
      if (this.isNumberType) {
        this.enforceNumber()
        return
      }
      if (this.emptyStringIsNull && this.inputValue === '') {
        this.inputValue = null
      }
    }
  },
  methods: {
    enforceNumber() {
      if (this.inputValue === null && !this.emptyStringIsNull) {
        this.inputValue = ''
        return
      }
      const normalizedNumber = this.inputValue / 1 || 0
      if (normalizedNumber !== this.inputValue) {
        this.inputValue = normalizedNumber
      }
    }
  }
})
</script>
