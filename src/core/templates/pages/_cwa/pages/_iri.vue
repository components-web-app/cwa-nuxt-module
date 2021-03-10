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
        label="Reference"
        v-model="component.reference"
        v-bind="inputProps('reference')"
      />
      <cwa-admin-text
        label="Page Title"
        v-model="component.title"
        v-bind="inputProps('title')"
      />
      <cwa-admin-select
        label="Layout"
        v-model="component.layout"
        :options="layouts"
        v-bind="inputProps('layout')"
      />
      <cwa-admin-select
        label="UI Component"
        v-model="component.uiComponent"
        :options="Object.keys(pageComponents)"
        v-bind="inputProps('uiComponent')"
      />
    </template>
    <template slot="right">
      <cwa-admin-text
        label="Meta Description"
        :is-textarea="true"
        v-model="component.metaDescription"
        v-bind="inputProps('metaDescription')"
      />
      <cwa-admin-text
        label="Style Classes"
        v-model="component.uiClassNames"
        v-bind="inputProps('uiClassNames')"
      />
    </template>
  </iri-modal-view>
</template>

<script lang="ts">
import CwaAdminText from '../../../components/admin/input/cwa-admin-text'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select'
import {
  Notification,
  NotificationLevels
} from '../../../components/cwa-api-notifications/types'
import IriPageMixin, {notificationCategories} from "../IriPageMixin"
// @ts-ignore
import pageComponents from '~/.nuxt/cwa/pages'
import LoadLayoutsMixin from "../LoadLayoutsMixin";


const unsavedNotification: Notification = {
  code: 'unsaved',
  title: 'Page not saved',
  message: 'Your changes are not saved',
  level: NotificationLevels.WARNING,
  category: notificationCategories.unsaved
}
const postEndpoint = '/_/pages'

export default {
  components: {CwaAdminSelect, CwaAdminText},
  mixins: [IriPageMixin(unsavedNotification, postEndpoint), LoadLayoutsMixin],
  data() {
    return {
      pageComponents
    }
  },
  methods: {
    async savePage() {
      const uiClassNames = this.component?.uiClassNames?.split(',').map(item => (item.trim()))
      const data = Object.assign({
        title: ''
      }, this.component, {
        uiClassNames
      })
      await this.sendRequest(data)
    }
  }
}
</script>
