<template>
  <component
    :is="wrapper || (wrapper === false ? 'div' : 'cwa-input-wrapper')"
    :id="id"
    :label="label"
    :has-error="hasError"
  >
    <div>
      <textarea
        v-if="isTextarea"
        :id="id"
        v-model="value"
        :required="required"
        @input="updateValue($event.target.value)"
        @keypress="$emit('keypress')"
        @keydown="$emit('keydown')"
        @keyup="$emit('keyup')"
      />
      <input
        v-else
        :id="id"
        :type="type"
        :value="value"
        :required="required"
        @input="updateValue($event.target.value)"
        @keypress="$emit('keypress')"
        @keydown="$emit('keydown')"
        @keyup="$emit('keyup')"
      />
    </div>
  </component>
</template>

<script>
import CwaTextMixin from './CwaTextMixin'
export default {
  mixins: [CwaTextMixin]
}
</script>
