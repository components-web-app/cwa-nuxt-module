<template>
  <iri-modal-view
    title="Layout Details"
    v-bind="iriModalProps"
    @close="$emit('close')"
    @submit="saveLayout"
    @delete="deleteComponent"
  >
    <template slot="left">
      <cwa-admin-text
        v-model="component.reference"
        label="Reference"
        v-bind="inputProps('reference')"
      />
      <cwa-admin-select
        v-model="component.uiComponent"
        label="UI Component"
        :options="Object.keys($cwa.options.layouts)"
        v-bind="inputProps('uiComponent')"
      />
    </template>
    <template slot="right">
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
import CwaAdminText from '../../../components/admin/input/cwa-admin-text.vue'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select.vue'
import IriPageMixin from '../IriPageMixin'
import CommaDelimitedArrayBuilder from '../../../../../utils/CommaDelimitedArrayBuilder'

const postEndpoint = '/_/layouts'

export default Vue.extend({
  components: { CwaAdminSelect, CwaAdminText },
  mixins: [IriPageMixin(postEndpoint)],
  methods: {
    async saveLayout() {
      const uiClassNames = CommaDelimitedArrayBuilder(
        this.component?.uiClassNames
      )
      const data = {
        reference: this.component.reference,
        uiComponent: this.component.uiComponent,
        uiClassNames
      }
      await this.sendRequest(data)
    }
  }
})
</script>
