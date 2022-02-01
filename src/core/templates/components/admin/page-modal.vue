<template>
  <iri-page-modal-view
    v-model="component"
    title="Page Details"
    v-bind="iriModalProps"
    :show-loader="isLoading || showLoader"
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
        v-if="isPageData"
        v-model="component.page"
        label="Page template"
        :options="pageTemplateOptions"
        v-bind="inputProps('page')"
      />
      <template v-else>
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
    </template>
    <template slot="right">
      <cwa-admin-select
        v-if="!isPageData"
        v-model="component.isTemplate"
        label="Page Template?"
        :options="[
          {
            value: false,
            label: 'No'
          },
          {
            value: true,
            label: 'Yes'
          }
        ]"
        v-bind="inputProps('isTemplate')"
      />
      <cwa-admin-text
        v-if="!isPageData"
        v-model="component.uiClassNames"
        label="Style Classes"
        v-bind="inputProps('uiClassNames')"
      />
      <cwa-admin-text
        v-model="component.metaDescription"
        label="Meta Description"
        :is-textarea="true"
        v-bind="inputProps('metaDescription')"
      />
    </template>
  </iri-page-modal-view>
</template>

<script lang="ts">
import Vue from 'vue'
import IriPageModalView from '../iri-page-modal-view.vue'
import IriModalPropsMixin from '../IriModalPropsMixin'
import CwaAdminSelect from './input/cwa-admin-select.vue'
import CwaAdminText from './input/cwa-admin-text.vue'
import PageTemplateLoadMixin from '@cwa/nuxt-module/core/mixins/PageTemplateLoadMixin'

// treat component as the v-model variable
// get props for everything else to pass through
// this is a PROXY for the UI

export default Vue.extend({
  components: { CwaAdminSelect, CwaAdminText, IriPageModalView },
  mixins: [IriModalPropsMixin, PageTemplateLoadMixin],
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
  data() {
    return {
      showLoaderPageTemplateOps: false
    }
  },
  computed: {
    isPageData() {
      return this.component.page !== undefined
    },
    iriModalProps() {
      return {
        notificationCategories: this.notificationCategories,
        isSaved: this.isSaved,
        isNew: this.isNew,
        showLoader:
          this.isLoading || this.showLoader || this.showLoaderPageTemplateOps
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
    component: {
      handler(newValue) {
        this.$emit('input', newValue)
      },
      deep: true
    },
    value: {
      handler(newValue) {
        this.component = newValue
      },
      immediate: true
    }
  },
  async mounted() {
    this.showLoaderPageTemplateOps = true
    await this.loadPageTemplateOptions()
    this.showLoaderPageTemplateOps = false
  }
})
</script>
