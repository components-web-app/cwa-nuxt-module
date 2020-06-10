<template>
  <div>
    Hello Pagey-Mc-Page-Face
    <pre>
    {{ state }}
    </pre>
    <button @click="$router.push({path:'/register'})">Register page</button>
  </div>
</template>

<script>
  export default {
    auth: false,
    layout: 'cwa-layout',
    mounted() {
      this.$cwa.initMercure()
    },
    computed: {
      state () {
        return this.$store.state.resources.current
      }
    },
  }
</script>
