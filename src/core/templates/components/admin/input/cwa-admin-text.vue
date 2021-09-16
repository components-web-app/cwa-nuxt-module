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
        v-model="currentValue"
        :required="required"
        @keypress="$emit('keypress')"
        @keydown="$emit('keydown')"
        @keyup="$emit('keyup')"
      />
      <input
        v-else
        :id="id"
        v-model="currentValue"
        :type="type"
        :required="required"
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
