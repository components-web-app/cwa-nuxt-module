<template>
  <div>
    <h5>Route</h5>
    <pre>{{ currentRoute }}</pre>

    <h5>Page</h5>
    <pre>{{ currentPage }}</pre>
  </div>
</template>

<script>
  export default {
    auth: false,
    layout: 'cwa-layout',
    computed: {
      state () {
        return this.$store.state.resources.current
      },
      currentRoute() {
        return this.state.Route.byId[this.state.Route.currentId]
      },
      currentPage() {
        return this.state.Page.byId[this.currentRoute.page]
      }
    }
  }
</script>
