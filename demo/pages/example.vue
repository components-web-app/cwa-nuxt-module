<template>
  <div>
    State:
    <pre>
    {{ state }}
    </pre>
  </div>
</template>

<script>
export default {
  computed: {
    state () {
      return this.$store.state.resources.current
    }
  }
}
</script>
