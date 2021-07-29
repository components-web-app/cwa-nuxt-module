<template>
  <cwa-admin-access-layout title="Reset password">
    <p>Hi {{ $route.params.username }}</p>
    <p>This page is not complete</p>
    <p>
      We need to build the form component and use that here to load the form
      component in and submit it.
    </p>
    <p>
      Please contact your website administrator for more information or so they
      can reset your password
    </p>
    <div>
      <nuxt-link to="/login" class="button is-light">
        <span>Back to login</span>
      </nuxt-link>
    </div>
  </cwa-admin-access-layout>
</template>

<script>
import CwaAdminAccessLayout from '../components/admin/cwa-admin-access-layout.vue'

export default {
  auth: false,
  cwa: false,
  components: { CwaAdminAccessLayout },
  layout: 'cwa-empty',
  head() {
    return {
      title: 'Reset Password'
    }
  }
}
</script>

<style lang="sass" src="../../assets/sass/login.sass" />
