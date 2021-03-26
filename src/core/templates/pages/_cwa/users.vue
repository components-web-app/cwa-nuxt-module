<template>
  <cwa-footer-logo class="cwa-users-page">
    <grid-page
      ref="gridPage"
      title="Users"
      endpoint="/users"
      :search-fields="['username', 'emailAddress']"
      @load="updateData"
      @add="showAddPage"
    >
      <li v-for="user of data" :key="user['@id']" class="column column-33">
        <nuxt-link
          :to="addRouteProps(user['@id'])"
          class="cwa-grid-item user-grid-item"
        >
          <p class="title">
            {{ user.username }}
          </p>
          <p class="subtitle">
            {{ user.enabled ? 'enabled' : 'disabled' }}
          </p>
        </nuxt-link>
      </li>
    </grid-page>
    <nuxt-child @close="closeModal" @change="reloadAndClose" />
  </cwa-footer-logo>
</template>

<script>
import GridPageMixin from './GridPageMixin'

export default {
  mixins: [GridPageMixin('_cwa_users', '_cwa_users_iri')]
}
</script>

<style lang="sass">
.cwa-users-page
  .user-grid-item
    padding-right: 7rem
    &:after
      content: ''
      position: absolute
      top: 0
      right: 0
      width: 7rem
      height: 100%
      background: url("../../../assets/images/icon-users.svg") 0 50% no-repeat
      opacity: .6
      transition: .25s
</style>
