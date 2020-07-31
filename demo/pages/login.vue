<template>
  <div class="container">
    <div v-if="error" class="notice is-danger">
      {{ error }}
    </div>
    <form @submit.prevent="userLogin">
      <div>
        <label>Username</label>
        <input v-model="login.username" type="text">
      </div>
      <div>
        <label>Password</label>
        <input v-model="login.password" type="password">
      </div>
      <div>
        <button type="submit" :disabled="submitting">
          Submit
        </button>
      </div>
    </form>
  </div>
</template>

<script>
export default {
  cwa: false,
  layout: 'primary',
  data () {
    return {
      login: {
        username: '',
        password: ''
      },
      error: null,
      submitting: false
    }
  },
  methods: {
    async userLogin () {
      this.submitting = true
      this.error = null
      await this.$auth
        .loginWith('local', {
          data: this.login
        })
        .catch((e) => {
          if (e.response && e.response.status === 401) {
            this.error = 'Incorrect username and/or password'
            return
          }
          this.error = e + ''
        })
      this.submitting = false
    }
  },
  header () {
    return {
      title: 'Login'
    }
  }
}
</script>
