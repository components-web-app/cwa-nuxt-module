<template>
  <div>
    Hello Pagey-Mc-Page-Face
    <pre>
    {{ state }}
    </pre>
  </div>
</template>

<script>
  export default {
    auth: false,
    computed: {
      state () {
        return this.$store.state.resources.current
      }
    }
  }
</script>
