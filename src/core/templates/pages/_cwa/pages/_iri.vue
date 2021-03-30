<template>
  <iri-modal-view
    title="Page Details"
    v-bind="iriModalProps"
    :show-loader="isLoading || layoutsLoading"
    @close="$emit('close')"
    @submit="savePage"
    @delete="deleteComponent"
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
import CwaAdminText from '../../../components/admin/input/cwa-admin-text'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select'
import IriPageMixin from '../IriPageMixin'
// @ts-ignore
import LoadLayoutsMixin from '../LoadLayoutsMixin'
import pageComponents from '~/.nuxt/cwa/pages'

const postEndpoint = '/_/pages'

export default {
  components: { CwaAdminSelect, CwaAdminText },
  mixins: [IriPageMixin(postEndpoint), LoadLayoutsMixin],
  data() {
    return {
      pageComponents: Object.keys(pageComponents).map((item) =>
        item.replace(/^CwaPages/, '')
      )
    }
  },
  methods: {
    async savePage() {
      const uiClassNames = this.component?.uiClassNames
        ?.split(',')
        .map((item) => item.trim())
      const data = Object.assign(
        {
          title: ''
        },
        this.component,
        {
          uiClassNames
        }
      )
      await this.sendRequest(data)
    }
  }
}
</script>
