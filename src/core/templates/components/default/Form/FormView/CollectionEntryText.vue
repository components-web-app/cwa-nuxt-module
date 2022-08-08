<template>
  <wrapper class="collection-entry-text" v-bind="wrapperProps">
    <div class="columns is-vcentered">
      <div class="column">
        <input
          v-if="inputType === 'number'"
          v-model.number="value"
          v-bind="textInputAttr"
          :class="classNames"
          class="input"
          v-on="events"
        />
        <textarea
          v-else-if="lastBlockPrefix === 'textarea'"
          v-model="value"
          v-bind="textInputAttr"
          :class="classNames"
          class="textarea"
          v-on="events"
        />
        <input
          v-else
          v-model="value"
          v-bind="textInputAttr"
          :class="classNames"
          class="input"
          v-on="events"
        />
      </div>
      <div class="column is-narrow">
        <button type="button" class="button" @click="deleteEntry">
          Delete
        </button>
      </div>
    </div>
  </wrapper>
</template>

<script lang="ts">
import Vue from 'vue'
import Text from './Text.vue'

export default Vue.extend({
  extends: Text,
  methods: {
    deleteEntry() {
      this.$cwa.forms.deleteView(this.storeId)
    }
  }
})
</script>

<style lang="sass">
.collection-entry-text
   > .columns
     margin-bottom: 0
</style>
