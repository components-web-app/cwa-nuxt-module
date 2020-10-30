<template>
  <cwa-footer-logo class="cwa-error-page">
    <div class="container">
      <svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" fill="currentColor" viewBox="0 0 48 48">
        <path d="M22 30h4v4h-4zm0-16h4v12h-4zm1.99-10C12.94 4 4 12.95 4 24s8.94 20 19.99 20S44 35.05 44 24 35.04 4 23.99 4zM24 40c-8.84 0-16-7.16-16-16S15.16 8 24 8s16 7.16 16 16-7.16 16-16 16z" />
      </svg>

      <div class="title">{{ message }}</div>
      <p v-if="error.endpoint" class="description url">
        {{ error.endpoint }}
      </p>
      <p v-if="statusCode === 404" class="description">
        <NuxtLink class="error-link" to="/"><%= messages.back_to_home %></NuxtLink>
      </p>
      <% if(debug) { %>
      <p class="description" v-else><%= messages.client_error_details %></p>
      <% } %>
    </div>
  </cwa-footer-logo>
</template>

<script>
import CwaLogo from '@cwa/nuxt-module/core/templates/components/cwa-logo.vue'
import CwaNuxtLink from '@cwa/nuxt-module/core/templates/components/cwa-nuxt-link.vue'
import CwaFooterLogo from '@cwa/nuxt-module/core/templates/components/cwa-footer-logo.vue'

export default {
  name: 'NuxtError',
  components: {CwaFooterLogo, CwaNuxtLink, CwaLogo},
  layout: 'cwa-default',
  props: {
    error: {
      type: Object,
      default: null
    }
  },
  computed: {
    statusCode () {
      return (this.error && this.error.statusCode) || 500
    },
    message () {
      return this.error.message || '<%= messages.client_error %>'
    }
  },
  head () {
    return {
      title: this.message,
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width,initial-scale=1.0,minimum-scale=1.0'
        }
      ]
    }
  }
}
</script>

<style lang="sass">
.cwa-error-page
  text-align: center
</style>
