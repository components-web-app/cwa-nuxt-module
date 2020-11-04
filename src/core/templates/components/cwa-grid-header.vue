<template>
  <div>
    <div class="cwa-header row is-mobile">
      <div class="column is-narrow">
        <h1>{{ title }}</h1>
      </div>
      <div class="column is-narrow">
        <cwa-add-button @click="$emit('add')" :highlight="highlightAddButton" />
      </div>
    </div>
    <div class="cwa-filter-bar row cwa-input">
      <div class="column is-narrow">
        <input type="text" name="search" placeholder="Search" v-model="search" :class="{'has-content': search}" />
      </div>
      <div class="column is-narrow">
        <div class="select">
          <select name="order" v-model="order">
            <option value="createdAt=desc">New - Old</option>
            <option value="createdAt=asc">Old - New</option>
            <option value="reference=asc">A - Z</option>
            <option value="reference=desc">Z - A</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import CwaAddButton from './cwa-add-button'
export default {
  components: {CwaAddButton},
  props: {
    title: {
      type: String,
      required: true
    },
    highlightAddButton: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  data() {
    return {
      search: '',
      order: 'createdAt=desc'
    }
  },
  mounted() {
    this.$watch(vm => [vm.search, vm.order], val => {
      this.$emit('filter', {
        search: this.search,
        order: this.order
      })
    }, {
      deep: false,
      immediate: true
    })
  }
}
</script>

<style lang="sass">

.cwa-header
  align-items: center
  h1
    margin: 0 2rem 0 0
.cwa-filter-bar
  margin-top: 2rem
  input[type=text]
    width: 100%
    min-width: 300px
    max-width: 600px
    &:focus
      color: $white
</style>
