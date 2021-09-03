<template>
  <iri-modal-view
    title="Page Details"
    v-bind="iriModalProps"
    :show-loader="isLoading"
    @close="$emit('close')"
    @submit="$emit('submit')"
    @delete="$emit('delete')"
  >
    <template slot="left">
      <cwa-admin-text
        v-model="component.reference"
        label="Reference"
        v-bind="inputProps('reference')"
      />
      <cwa-admin-text
        v-model="component.title"
        label="Page Title"
        v-bind="inputProps('title')"
      />
      <cwa-admin-select
        v-model="component.layout"
        label="Layout"
        :options="layouts"
        v-bind="inputProps('layout')"
      />
      <cwa-admin-select
        v-model="component.uiComponent"
        label="UI Component"
        :options="pageComponents"
        v-bind="inputProps('uiComponent')"
      />
    </template>
    <template slot="right">
      <cwa-admin-text
        v-model="component.metaDescription"
        label="Meta Description"
        :is-textarea="true"
        v-bind="inputProps('metaDescription')"
      />
      <cwa-admin-text
        v-model="component.uiClassNames"
        label="Style Classes"
        v-bind="inputProps('uiClassNames')"
      />
    </template>
  </iri-modal-view>
</template>

<script lang="ts">
import Vue from 'vue'
import IriModalView from '../iri-modal-view.vue'
import IriModalPropsMixin from '../IriModalPropsMixin'
import CwaAdminSelect from './input/cwa-admin-select.vue'
import CwaAdminText from './input/cwa-admin-text.vue'

// treat component as the v-model variable
// get props for everything else to pass through
// this is a PROXY for the UI

export default Vue.extend({
  components: { CwaAdminSelect, CwaAdminText, IriModalView },
  mixins: [IriModalPropsMixin],
  props: {
    value: {
      type: Object,
      required: true,
      default: null
    },
    isLoading: {
      type: Boolean,
      required: true
    },
    notifications: {
      type: Object,
      required: true
    },
    pageComponents: {
      type: [Array, Object],
      required: true
    },
    layouts: {
      type: [Array, Object],
      required: true
    }
  },
  computed: {
    iriModalProps() {
      return {
        notificationCategories: this.notificationCategories,
        isSaved: this.isSaved,
        isNew: this.isNew,
        component: this.component,
        showLoader: this.isLoading
      }
    },
    inputProps() {
      return (key) => ({
        id: `component-${key}`,
        required: true,
        notifications: this.notifications[key],
        isLoading: this.isLoading
      })
    }
  },
  watch: {
    component(newValue) {
      this.$emit('input', newValue)
    },
    value: {
      handler(newValue) {
        this.component = newValue
      },
      immediate: true
    }
  }
})
</script>
