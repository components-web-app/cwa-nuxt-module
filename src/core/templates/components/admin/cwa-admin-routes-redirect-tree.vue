<template>
  <ul class="redirect-tree">
    <li v-for="redirect of routes" :key="redirect['@id']">
      <div>
        <div class="row">
          <div class="column">{{ redirect.path }}</div>
          <div class="column is-narrow">
            <a
              href="#"
              class="trash-link"
              @click.prevent="deleteRedirect(redirect['@id'])"
            >
              <icon-trash />
              <img
                src="../../../assets/images/icon-trash.svg"
                alt="Trash Icon"
              />
            </a>
          </div>
        </div>
      </div>
      <cwa-admin-routes-redirect-tree
        v-if="redirect.redirectedFrom"
        :routes="redirect.redirectedFrom"
        @reload="$emit('reload')"
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
  },
  methods: {
    async deleteRedirect(iri) {
      await this.$cwa.deleteResource(iri)
      this.$emit('reload')
    }
  }
})
</script>

<style lang="sass">
.redirect-tree
  position: relative
  list-style: none
  margin-left: 0
  .trash-link
    display: block
    opacity: .6
    padding: .15rem .75rem
    img
      width: .9em
      height: auto
    &:hover
      opacity: 1
  .redirect-tree
    font-size: 100%
    margin: 0 0 0 2rem
    li
      padding-left: 0
      > div:before
        top: -50%
        height: 100%
  li
    position: relative
    margin-bottom: 0
    > div
      display: block
      position: relative
      padding: .5rem 0 .5rem 2rem
      &:hover
        background: $cwa-background-dark
      &::after
        position: absolute
        content: ''
        left: -1px
        top: 50%
        width: 1.2rem
        height: 0
        border-top: 1px dashed $cwa-color-text-light
    &:last-child > div::before
      position: absolute
      content: ''
      left: -1px
      top: 0
      height: 50%
      width: 0
      border-left: 1px solid $cwa-color-text-light
    &:not(:last-child)::before
      position: absolute
      content: ''
      left: -1px
      top: 0
      height: 100%
      width: 0
      border-left: 1px solid $cwa-color-text-light
</style>
