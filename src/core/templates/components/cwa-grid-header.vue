<template>
  <div>
    <div class="cwa-header row is-mobile">
      <div class="column is-narrow">
        <h1>{{ title }}</h1>
      </div>
      <div class="column is-narrow">
        <cwa-add-button @click="$emit('add')" />
      </div>
    </div>
    <div class="cwa-filter-bar row">
      <div class="column is-narrow">
        <input type="text" name="search" placeholder="Search" v-model="search" :class="{'has-content': search}" />
      </div>
      <div class="column is-narrow">
        <div class="select">
          <select name="order" v-model="order">
            <option value="created=desc">New - Old</option>
            <option value="created=asc">Old - New</option>
            <option value="title=asc">A - Z</option>
            <option value="title=desc">Z - A</option>
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
    }
  },
  data() {
    return {
      search: '',
      order: 'created=desc'
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
  input[type=text],
  select
    border-color: $cwa-navbar-background
    background-color: $cwa-navbar-background
    color: $cwa-color-text-light
    padding: .2rem 3.8rem .3rem 1.0rem
    height: 3.4rem
    font-size: 1.4rem
    &:hover
      color: $white
    &::placeholder
      color: rgba($cwa-color-text-light, .6)
  .select
    position: relative
    &:hover
      &::before
        opacity: 1
    select
      background-image: none
      margin: 0
    &::before
      content: ''
      position: absolute
      right: 0
      top: 0
      height: 100%
      width: 3.5rem
      background: url("../../assets/images/icon-dropdown.svg") 50% 50% no-repeat
      opacity: .6
      pointer-events: none
  input[type=text]
    width: 100%
    min-width: 300px
    max-width: 600px
    &:focus
      color: $white
</style>
