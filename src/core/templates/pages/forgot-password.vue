<template>
  <cwa-admin-access-layout :title="pageTitle">
    <div v-if="success">
      <p>We've sent you an email with a link to reset your password</p>
      <div>
        <nuxt-link to="/login" class="button is-light">
          <span>Back to login</span>
        </nuxt-link>
      </div>
    </div>
    <form v-else @submit.prevent="submitRequest" class="login-form">
      <div v-if="error" class="notice is-danger">
        {{ error }}
      </div>
      <div>
        <label>Username</label>
        <input v-model="username" type="text" placeholder="E.g. you.rock@cwa.rocks">
      </div>
      <div>
        <button class="is-light" type="submit" :disabled="submitting">
          <span>Reset</span>
        </button>
      </div>
      <div class="login-nav row">
        <div class="column is-narrow">
          <nuxt-link to="/login">< Back to login</nuxt-link>
        </div>
      </div>
    </form>
  </cwa-admin-access-layout>
</template>

<script>
import CwaAdminAccessLayout from '../components/admin/cwa-admin-access-layout.vue'
import consola from 'consola'
export default {
  auth: false,
  cwa: false,
  layout: 'cwa-empty',
  components: {CwaAdminAccessLayout},
  data () {
    return {
      username: '',
      error: null,
      submitting: false,
      passwordRedirect: null,
      success: false
    }
  },
  methods: {
    async submitRequest () {
      if (!this.username) {
        this.error = 'Please enter a username'
        return
      }
      this.submitting = true
      this.error = null
      try {
        const query = new URLSearchParams({
          'password_redirect': this.passwordRedirect || ''
        }).toString()
        await this.$axios.get(`/password/reset/request/${encodeURIComponent(this.username)}?${query}`)
        this.success = true
      } catch (err) {
        if (err.response.status === 404) {
          this.error = 'Your username was not found'
          return
        }
        this.error = 'Unexpected error'
        consola.error(err)
      } finally {
        this.submitting = false
      }
    }
  },
  computed: {
    pageTitle() {
      return this.success ? 'Check your emails' : 'Password Recovery'
    }
  },
  header () {
    return {
      title: 'Forgot Password'
    }
  }
}
</script>

<style lang="sass" src="../../assets/sass/login.sass" />
