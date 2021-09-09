<template>
  <ul class="redirect-tree">
    <li v-for="redirect of routes" :key="redirect['@id']">
      <span>{{ redirect.path }}</span>
      <cwa-admin-routes-redirect-tree
        v-if="redirect.redirectedFrom"
        :routes="redirect.redirectedFrom"
      />
    </li>
  </ul>
</template>

<script lang="ts">
import Vue from 'vue'

export default Vue.extend({
  name: 'CwaAdminRoutesRedirectTree',
  props: {
    routes: {
      type: Array,
      required: true
    }
  }
})
</script>

<style lang="sass">
.redirect-tree
  position: relative
  list-style: none
  margin-left: 0
  .redirect-tree
    font-size: 100%
    li
      padding-left: 2rem
      > span:before
        top: -50%
        height: 100%
  li
    position: relative
    > span
      position: relative
      padding-left: 2rem
      &::after
        position: absolute
        content: ''
        left: 0
        top: 50%
        width: 1.2rem
        height: 0
        border-top: 1px dashed $cwa-color-text-light
      &::before
        position: absolute
        content: ''
        left: 0
        top: 0
        height: 50%
        width: 0
        border-left: 1px solid $cwa-color-text-light
</style>
