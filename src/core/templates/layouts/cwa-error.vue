<template>
  <cwa-footer-logo class="cwa-error-page">
    <div class="error-page-container">
      <div class="top">
        <div class="container">
          <nuxt-error-icon />

          <div class="title">
            {{ message }}
          </div>
          <p v-if="error.endpoint" class="description url">
            {{ error.endpoint }}
          </p>
          <!-- eslint-disable vue/no-parsing-error -->
          <p v-if="statusCode === 404" class="description">
            <NuxtLink class="error-link button is-light button-outline" to="/">
              <%= messages.back_to_home %>
            </NuxtLink>
          </p>
          <% if(debug) { %>
          <p v-else class="description"><%= messages.client_error_details %></p>
          <% } %>
          <!-- eslint-enable vue/no-parsing-error -->
        </div>
      </div>
      <div v-if="!$cwa.isAdmin" class="bottom">
        <strong>Unexpected error?</strong> As a visitor, please contact the
        website administrator. If you are the owner,
        <cwa-nuxt-link to="/login"> click here to login </cwa-nuxt-link>.
      </div>
    </div>
  </cwa-footer-logo>
</template>

<script>
import CwaNuxtLink from '@cwa/nuxt-module/core/templates/components/utils/cwa-nuxt-link.vue'
import CwaFooterLogo from '@cwa/nuxt-module/core/templates/components/utils/cwa-footer-logo.vue'
import NuxtErrorIcon from '@cwa/nuxt-module/core/templates/components/utils/nuxt-error-icon.vue'

export default {
  name: 'NuxtError',
  components: { NuxtErrorIcon, CwaFooterLogo, CwaNuxtLink },
  layout: 'cwa-default',
  props: {
    error: {
      type: Object,
      default: null
    }
  },
  head() {
    return {
      title: this.message,
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width,initial-scale=1.0,minimum-scale=1.0'
        }
      ]
    }
  },
  computed: {
    statusCode() {
      return (this.error && this.error.statusCode) || 500
    },
    message() {
      return this.error.message || '<%= messages.client_error %>'
    }
  }
}
</script>

<style lang="sass">
.cwa-error-page
  text-align: center
  .error-page-container
    height: 100%
    display: flex
    flex-direction: column
    > .top
      flex-grow: 1
      .title
        font-size: 1.8rem
      .description.url
        opacity: .6
        font-size: .8em
    > .bottom
      font-weight: $weight-light
      opacity: .4
      font-size: .8em
      a
        &:hover,
        &:focus
          color: $white
</style>
