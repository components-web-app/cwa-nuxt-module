<template>
  <div class="component-ui-tab">
    <div class="row">
      <div v-if="context.UiComponents" class="column is-narrow">
        <cm-select
          id="component"
          :iri="iri"
          field="uiComponent"
          label="Interface"
          :options="[
            { label: 'Default', value: null },
            ...context.UiComponents
          ]"
        />
      </div>
      <div v-if="context.UiClassNames" class="column is-narrow">
        <cm-multiselect
          id="uiClassNames"
          :iri="iri"
          field="uiClassNames"
          label="Style"
          :options="context.UiClassNames"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import CmSelect from '../../input/cm-select.vue'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import { COMPONENT_MANAGER_EVENTS } from '../../../../../../events'
import CmMultiselect from '../../input/cm-multiselect.vue'

export default Vue.extend({
  components: { CmMultiselect, CmSelect },
  mixins: [ComponentManagerTabMixin],
  watch: {
    'storeComponent.uiComponent'() {
      this.$nextTick(() => {
        // lazy load mount, first mount of new ui component may not be on nex tick...
        setTimeout(() => {
          this.$cwa.$eventBus.$emit(
            COMPONENT_MANAGER_EVENTS.highlightComponent,
            this.iri
          )
        }, 10)
      })
    }
  }
})
</script>

<style lang="sass">
// .component-ui-tab
</style>
