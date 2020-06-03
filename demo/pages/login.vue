<template>
  <div>
    <form @submit.prevent="userLogin">
      <div>
        <label>Username</label>
        <input v-model="login.username" type="text">
      </div>
      <div>
        <label>Password</label>
        <input v-model="login.password" type="text">
      </div>
      <div>
        <button type="submit">
          Submit
        </button>
      </div>
    </form>
  </div>
</template>

<script>
export default {
  data () {
    return {
      login: {
        username: '',
        password: ''
      }
    }
  },
  methods: {
    async userLogin () {
      this.error = null
      return this.$auth
        .loginWith('local', {
          data: this.login
        })
        .catch((e) => {
          this.error = e + ''
        })
    }
  }
}
</script>
