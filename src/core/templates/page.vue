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
    layout: 'cwa-layout',
    computed: {
      state () {
        return this.$store.state.resources.current
      }
    }
  }
</script>
