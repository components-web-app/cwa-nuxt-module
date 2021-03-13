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
      <cwa-admin-select
        label="Roles"
        v-model="highestRole"
        v-bind="inputProps('roles')"
        :options="{ 'Super Admin': 'ROLE_SUPER_ADMIN', 'Admin': 'ROLE_ADMIN', 'User': 'ROLE_USER' }"
      />
    </template>
  </iri-modal-view>
</template>

<script lang="ts">
import CwaAdminText from '../../../components/admin/input/cwa-admin-text.vue'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select.vue'
import CwaAdminMultiselect from '../../../components/admin/input/cwa-admin-multiselect.vue'
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
  components: {CwaAdminSelect, CwaAdminText, CwaAdminMultiselect},
  mixins: [IriPageMixin(unsavedNotification, postEndpoint)],
  methods: {
    async saveUser() {
      const data = Object.assign({}, this.component)
      await this.sendRequest(data)
    }
  },
  computed: {
    highestRole: {
      get() {
        if (!this.component.roles) {
          return null
        }
        let highestIndex = null
        const roleHierarchy = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER']
        for(const role of this.component.roles) {
          const foundIndex = roleHierarchy.indexOf(role)
          if (foundIndex !== -1) {
            if (highestIndex === null || foundIndex < highestIndex) {
              highestIndex = foundIndex
            }
          }
        }
        return highestIndex !== null ? roleHierarchy[highestIndex] : null
      },
      set(value) {
        this.component.roles = [value]
      }
    }
  }
}
</script>
