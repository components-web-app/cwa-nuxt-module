<template>
  <cwa-input-wrapper :id="id" :label="label" :has-error="hasError">
    <div>
      <input
        type="text"
        :id="id"
        :value="value"
        :required="required"
        @input="updateValue($event.target.value)" />
    </div>
  </cwa-input-wrapper>
</template>

<script>
import CwaInputMixin from './cwa-input-mixin'
export default {
  mixins: [CwaInputMixin]
}
</script>
