<template>
  <div>
    <div class="navbar">
      <div class="container">
      <ul v-if="routes" class="row">
        <li v-for="route of sortedRoutes" class="column">
          <nuxt-link :to="route.path" :class="{ selected: route.path === $route.path }">{{ route.name }}</nuxt-link>
        </li>
        <li class="column">
          <button v-if="$auth.loggedIn" @click="$auth.logout('local')">Logout</button>
          <nuxt-link v-else to="/login" tag="button">Login</nuxt-link>
        </li>
      </ul>
      <ul v-else>
        <li>
          <span>Loading routes</span>
        </li>
      </ul>
      </div>
    </div>
    <div class="container">
      <p v-if="$cwa.$state.loadingRoute" style="color: orange;">Loading Route</p>
      <p v-else style="color: green;">Route Loaded</p>
    </div>
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

<style lang="sass" scoped>
.navbar
  margin-bottom: 1.25rem
  background-color: $color-secondary
  padding: 0 .75rem
  ul.row
    list-style-type: none
    margin: 0
    padding: 0
    overflow: hidden
    display: flex
    height: 100%
    li.column
      margin-bottom: 0
      display: flex
      align-items: center
      width: auto
      flex-grow: 0
      a,
      span
        display: block
        text-decoration: none
        padding: 1.25rem 2rem
        color: white
        text-align: center
      a
        &:hover,
        &.selected
          background-color: $color-primary
      button
        display: block
        margin: 0
        &:hover
          border: 1px solid $color-primary
          background: $color-initial
          color: $color-primary
</style>
