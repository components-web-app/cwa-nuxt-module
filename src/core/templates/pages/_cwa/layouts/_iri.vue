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
        label="Reference"
        v-model="component.reference"
        v-bind="inputProps('reference')"
      />
      <cwa-admin-select
        label="UI Component"
        v-model="component.uiComponent"
        :options="Object.keys($cwa.options.layouts)"
        v-bind="inputProps('uiComponent')"
      />
    </template>
    <template slot="right">
      <cwa-admin-text
        label="Style Classes"
        v-model="component.uiClassNames"
        v-bind="inputProps('uiClassNames')"
      />
    </template>
  </iri-modal-view>
</template>

<script lang="ts">
import CwaAdminText from '../../../components/admin/input/cwa-admin-text.vue'
import CwaAdminSelect from '../../../components/admin/input/cwa-admin-select.vue'
import IriPageMixin from "../IriPageMixin";
import CommaDelimitedArrayBuilder from '../../../../../utils/CommaDelimitedArrayBuilder';

const postEndpoint = '/_/layouts'

export default {
  components: {CwaAdminSelect, CwaAdminText},
  mixins: [IriPageMixin(postEndpoint)],
  methods: {
    async saveLayout() {
      const uiClassNames = CommaDelimitedArrayBuilder(this.component?.uiClassNames)
      const data = {
        reference: this.component.reference,
        uiComponent: this.component.uiComponent,
        uiClassNames
      }
      await this.sendRequest(data)
    }
  }
}
</script>
