<template>
  <iri-modal-view
    title="User Details"
    v-bind="iriModalProps"
    @close="$emit('close')"
    @submit="saveUser"
    @delete="deleteComponent"
  >
    <template slot="left">
      <cwa-admin-text
        label="Username"
        v-model="component.username"
        v-bind="inputProps('username')"
      />
      <cwa-admin-text
        label="Email"
        v-model="component.emailAddress"
        v-bind="inputProps('emailAddress')"
      />
      <cwa-admin-text
        label="New Password"
        type="password"
        v-model="component.plainPassword"
        v-bind="inputProps('plainPassword')"
      />
    </template>
    <template slot="right">
      <cwa-admin-select
        label="Enabled"
        v-model="component.enabled"
        :options="{ Yes: true, No: false }"
        v-bind="inputProps('enabled')"
      />
      <cwa-admin-text
        label="Roles"
        v-model="component.roles"
        v-bind="inputProps('roles')"
      />
    </template>
  </iri-modal-view>
</template>

<script lang="ts">
import Multiselect from 'vue-multiselect';
import CwaAdminText from '../../../components/admin/input/cwa-admin-text.vue'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select.vue'
import {
  Notification,
  NotificationLevels
} from '../../../components/cwa-api-notifications/types'
import IriPageMixin, {notificationCategories} from "../IriPageMixin";

const unsavedNotification: Notification = {
  code: 'unsaved',
  title: 'Layout not saved',
  message: 'Your changes are not saved',
  level: NotificationLevels.WARNING,
  category: notificationCategories.unsaved
}
const postEndpoint = '/_/layouts'

export default {
  components: {CwaAdminSelect, CwaAdminText, Multiselect},
  mixins: [IriPageMixin(unsavedNotification, postEndpoint)],
  methods: {
    async saveUser() {
      const data = Object.assign({}, this.component)
      await this.sendRequest(data)
    }
  }
}
</script>
