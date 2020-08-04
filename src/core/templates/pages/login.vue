<template>
  <div class="container login-page">
    <div class="logo">
      <cwa-logo />
      <h1>Admin</h1>
    </div>
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
        <span>Forgot your password?</span>
      </div>
      <div>
        <button class="is-dark" type="submit" :disabled="submitting">
          <span>Login</span>
          <span class="icon">
            <svg width="26px" height="34px" viewBox="0 0 26 34" version="1.1" xmlns="http://www.w3.org/2000/svg">
              <g transform="translate(-299.000000, -657.000000)" fill="currentColor">
                <g transform="translate(182.000000, 640.000000)">
                  <g transform="translate(117.000000, 17.000000)">
                    <path
                      d="M22.0779922,33.8232988 L3.92240174,33.8232988 C2.00506675,33.8232988 0.450555994,32.2357958 0.450555994,30.2771646 L0.450555994,18.8277115 C0.450555994,17.1197176 1.63377268,15.6933385 3.20876863,15.3578145 L3.20876863,10.1887744 C3.20876863,4.67535948 7.60126608,0.189235279 13.0004924,0.189235279 C18.3993248,0.189235279 22.7918223,4.67495718 22.7918223,10.1887744 L22.7918223,15.3578145 C24.3662273,15.6943442 25.549444,17.1197176 25.549444,18.8277115 L25.549444,30.2771646 L25.549838,30.2771646 C25.549838,32.2355946 23.9953272,33.8232988 22.0779922,33.8232988 Z M13.0001988,5.03448276 C10.3931797,5.03448276 8.27272727,7.1319369 8.27272727,9.710242 L8.27272727,14.6896552 L17.7272727,14.6896552 L17.7272727,9.710242 C17.7270739,7.13233024 15.6066214,5.03448276 13.0001988,5.03448276 Z M12.4090909,19.5172414 C10.7776317,19.5172414 9.45454545,20.9687187 9.45454545,22.7598858 C9.45454545,23.9606497 10.0510234,25.0065366 10.9352277,25.5674197 L10.9352277,29.1724138 L13.8829541,29.1724138 L13.8829541,25.5674197 C14.7671584,25.0067445 15.3636364,23.9606497 15.3636364,22.7598858 C15.3636364,20.9687187 14.0407395,19.5172414 12.4090909,19.5172414 Z"
                    ></path>
                  </g>
                </g>
              </g>
            </svg>
          </span>
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import CwaLogo from '../cwa-logo.vue'
export default {
  cwa: false,
  layout: 'primary',
  components: {CwaLogo},
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

<style lang="sass">
.login-page
  padding: 2rem
  .logo
    font-family: 'lemonmilk-bold', sans-serif
    text-transform: uppercase
    margin-bottom: 3rem
    h1
      font-size: 2.2rem
      margin-top: 1.5rem
    svg
      max-width: 300px
      height: auto
  button
    margin-top: 3rem
    font-size: 1.7rem
    height: 3.5em
    .icon
      height: 1.5em
      width: 1.5em
      align-items: center
      display: inline-flex
      justify-content: center
      margin-left: .35em
      margin-right: calc(-.5em - 1px)
      svg
        width: 1em
</style>
