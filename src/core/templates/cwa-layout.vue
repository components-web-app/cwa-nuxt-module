<template>
  <div>
    <ul v-if="routes">
      <li v-for="route of sortedRoutes">
        <nuxt-link :to="route.path">{{ route.path }}</nuxt-link>
      </li>
    </ul>
    <p v-else>Loading routes</p>
    <nuxt />
  </div>
</template>

<script>
function dynamicSort(property) {
  let sortOrder = 1;

  if(property[0] === "-") {
    sortOrder = -1;
    property = property.substr(1);
  }

  return function (a,b) {
    if(sortOrder === -1){
      return b[property].localeCompare(a[property]);
    }else{
      return a[property].localeCompare(b[property]);
    }
  }
}

export default {
  data() {
    return {
      routes: null
    }
  },
  async mounted() {
    const { data } = await this.$axios.get('/_/routes')
    this.routes = data['hydra:member']
  },
  computed: {
    sortedRoutes() {
      return this.routes.sort(dynamicSort('path'))
    }
  }
}
</script>
