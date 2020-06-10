<template>
  <div>
    <p>Hello Pagey-Mc-Page-Face</p>

    <ul>
      <li v-for="route of routes">
        <nuxt-link :to="route.path">{{ route.name }}</nuxt-link>
      </li>
    </ul>

    <pre>
    {{ state }}
    </pre>
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
    async asyncData({ $axios }) {
      const { data } = await $axios.get('/_/routes')
      return {
        routes: data['hydra:member']
      }
    }
  }
</script>
