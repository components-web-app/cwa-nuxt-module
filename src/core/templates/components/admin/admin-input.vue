<template>
  <div class="cwa-input">
    <label :for="id">{{ label }}</label>
    <div>
      <input
        type="text"
        :id="id"
        :value="value"
        :required="required"
        @input="updateValue($event.target.value)" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    id: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    value: {
      type: String,
      required: false
    },
    required: {
      type: Boolean,
      default: false,
      required: false
    }
  },
  methods: {
    updateValue: function (value) {
      this.$emit('input', value)
    }
  }
}
</script>
