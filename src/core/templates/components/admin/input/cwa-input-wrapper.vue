<template>
  <div class="cwa-input">
    <label :for="id">{{ label }}</label>
    <slot />
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
    }
  }
}
</script>
