<template>
  <wrapper v-bind="wrapperProps" class="field">
    <label :for="`${vars.id}`" v-bind="vars.label_attr" class="checkbox">
      <input
        :id="`${vars.id}`"
        v-bind="vars.attr"
        v-model="checked"
        :value="vars.value"
        type="checkbox"
        @change="validate"
      />
      <span v-html="vars.label" />
    </label>
  </wrapper>
</template>

<script lang="ts">
import Vue from 'vue'
import FormViewBlockMixin from '@cwa/nuxt-module/core/mixins/FormViewBlockMixin'
import Wrapper from '@cwa/nuxt-module/core/templates/components/default/Form/FormView/_Wrapper.vue'

export default Vue.extend({
  name: 'CwaFormCheckbox',
  components: { Wrapper },
  mixins: [FormViewBlockMixin],
  computed: {
    checked: {
      get() {
        return !!this.metadata.checked
      },
      set(newValue) {
        this.$cwa.forms.setChecked(this.storeId, newValue)
      }
    }
  }
})
</script>
