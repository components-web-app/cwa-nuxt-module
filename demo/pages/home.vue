<template>
  <div>
    State:
    <pre>
    {{ state }}
    </pre>
    <router-link to="/example">Go to home</router-link>
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
