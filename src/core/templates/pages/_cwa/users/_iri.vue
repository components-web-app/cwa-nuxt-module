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
        v-model="component.username"
        label="Username"
        v-bind="inputProps('username')"
      />
      <cwa-admin-text
        v-model="component.emailAddress"
        label="Email"
        v-bind="inputProps('emailAddress')"
      />
      <cwa-admin-text
        v-model="component.plainPassword"
        label="New Password"
        type="password"
        v-bind="inputProps('plainPassword')"
      />
    </template>
    <template slot="right">
      <cwa-admin-select
        v-model="component.enabled"
        label="Enabled"
        :options="[
          {
            value: true,
            label: 'Yes'
          },
          {
            value: false,
            label: 'No'
          }
        ]"
        v-bind="inputProps('enabled')"
      />
      <cwa-admin-select
        v-model="highestRole"
        label="Roles"
        v-bind="inputProps('roles')"
        :options="[
          {
            value: 'ROLE_SUPER_ADMIN',
            label: 'Super Admin'
          },
          {
            value: 'ROLE_ADMIN',
            label: 'Admin'
          },
          {
            value: 'ROLE_USER',
            label: 'User'
          }
        ]"
      />
    </template>
  </iri-modal-view>
</template>

<script lang="ts">
import Vue from 'vue'
import CwaAdminText from '../../../components/admin/input/cwa-admin-text.vue'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select.vue'
import IriPageMixin from '../IriPageMixin'

const postEndpoint = '/users'

export default Vue.extend({
  components: { CwaAdminSelect, CwaAdminText },
  mixins: [IriPageMixin(postEndpoint)],
  computed: {
    highestRole: {
      get() {
        if (!this.component.roles) {
          return null
        }
        let highestIndex = null
        const roleHierarchy = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER']
        for (const role of this.component.roles) {
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
  },
  methods: {
    async saveUser() {
      const data = Object.assign({}, this.component)
      await this.sendRequest(data)
    }
  }
})
</script>
