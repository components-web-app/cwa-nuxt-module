<template>
  <div class="component-ui-tab">
    <div class="columns tab-row">
      <div v-if="context.UiComponents" class="column is-narrow">
        <cm-select
          :id="`componentUI-${iri}`"
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
          :id="`uiClassNames-${iri}`"
          :iri="iri"
          field="uiClassNames"
          label="Style"
          :options="context.UiClassNames"
          :expanded="isExpanded"
          @expanded="handleMultiselectExpanded"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'
import CmSelect from '../../input/cm-select.vue'
import ComponentManagerTabMixin from '../../../../../../mixins/ComponentManagerTabMixin'
import {
  COMPONENT_MANAGER_EVENTS,
  HighlightComponentEvent
} from '../../../../../../events'
import CmMultiselect from '../../input/cm-multiselect.vue'

export default Vue.extend({
  components: { CmMultiselect, CmSelect },
  mixins: [ComponentManagerTabMixin],
  computed: {
    isExpanded: {
      get() {
        return this.cmValue('isExpanded')
      },
      set(isExpanded) {
        this.saveCmValue('isExpanded', isExpanded)
      }
    }
  },
  watch: {
    'storeComponent.uiComponent'() {
      this.$cwa.$eventBus.$once(
        COMPONENT_MANAGER_EVENTS.componentMounted,
        () => {
          this.$nextTick(() => {
            this.$cwa.$eventBus.$emit(
              COMPONENT_MANAGER_EVENTS.highlightComponent,
              {
                iri: this.iri,
                selectedPosition: this.context.selectedPosition
              } as HighlightComponentEvent
            )
          })
        }
      )
    }
  },
  methods: {
    handleMultiselectExpanded(isExpanded) {
      this.isExpanded = isExpanded
    }
  }
})
</script>

<style lang="sass">
// .component-ui-tab
</style>
