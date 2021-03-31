<template>
  <component
    :is="wrapper || (wrapper === false ? 'div' : 'cwa-input-wrapper')"
    :id="id"
    :label="label"
    :has-error="hasError"
  >
    <div class="select">
      <select
        :id="id"
        v-model="currentValue"
        :required="required"
        @change="selectChanged"
      >
        <option
          v-if="!hasNullOption"
          :value="null"
          disabled
          :selected="value === null"
        >
          Please select
        </option>
        <option
          v-for="op in normalizedOptions"
          :key="op.value"
          :value="op.value"
          :selected="value === op.value"
        >
          {{ op.label }}
        </option>
      </select>
    </div>
  </component>
</template>

<script>
import CwaSelectMixin from './CwaSelectMixin'
export default {
  mixins: [CwaSelectMixin]
}
</script>
