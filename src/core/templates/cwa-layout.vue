<template>
  <div>
    <ul v-if="routes">
      <li v-for="route of routes">
        <nuxt-link :to="route.path">{{ route.name }}</nuxt-link>
      </li>
    </ul>
    <p v-else>Loading routes</p>
    <nuxt />
  </div>
</template>

<script>
export default {
  data() {
    return {
      routes: null
    }
  },
  async mounted() {
    const { data } = await this.$axios.get('/_/routes')
    this.routes = data['hydra:member']
  }
}
</script>
