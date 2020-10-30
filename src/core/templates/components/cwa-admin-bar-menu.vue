<template>
  <div class="cwa-admin-bar-menu">
    <transition name="menu">
      <div v-if="showMenu" class="menu">
        <div class="menu-header">
          <div>
            <cwa-logo class="cwa-logo" />
          </div>
          <span>
            {{ $cwa.websiteName }}
          </span>
        </div>
        <div class="menu-columns-aligner">
          <nav class="menu-columns">
            <ul class="menu-links-left">
              <li>
                <cwa-nuxt-link to="/_cwa/layouts">
                  <span class="icon">
                    <img src="../../assets/images/icon-layout.svg" alt="Layouts Icon" />
                  </span>
                  <span>Layouts</span>
                </cwa-nuxt-link>
              </li>
              <li>
                <cwa-nuxt-link>
                  <span class="icon">
                    <img src="../../assets/images/icon-pages.svg" alt="Pages Icon" />
                  </span>
                  <span>Pages</span>
                </cwa-nuxt-link>
              </li>
              <li>
                <cwa-nuxt-link>
                  <span class="icon">
                    <img src="../../assets/images/icon-components.svg" alt="Components Icon" />
                  </span>
                  <span>Components</span>
                </cwa-nuxt-link>
              </li>
              <li>
                <cwa-nuxt-link>
                  <span class="icon">
                    <img src="../../assets/images/icon-users.svg" alt="Users Icon" />
                  </span>
                  <span>Users</span>
                </cwa-nuxt-link>
              </li>
            </ul>
            <ul class="menu-links-right">
              <li>
                Global Settings
                <ul>
                  <li>
                    <cwa-nuxt-link>Domain</cwa-nuxt-link>
                  </li>
                  <li>
                    <cwa-nuxt-link>Redirects</cwa-nuxt-link>
                  </li>
                </ul>
              </li>
              <li>
                Account
                <ul>
                  <li>
                    <cwa-nuxt-link>My account</cwa-nuxt-link>
                  </li>
                  <li>
                    <a href="#" @click.prevent="$auth.logout('local')">Sign out</a>
                  </li>
                </ul>
              </li>
              <li>
                CWA
                <ul>
                  <li>
                    <cwa-nuxt-link to="https://cwa.rocks">About CWA</cwa-nuxt-link>
                  </li>
                  <li>
                    <cwa-nuxt-link :to="cwaModuleVersionLink">CWA Module <span class="small">{{ cwaModuleVersionText }}</span></cwa-nuxt-link>
                  </li>
                  <li>
                    <cwa-nuxt-link :to="$config.API_URL">API documentation</cwa-nuxt-link>
                  </li>
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </transition>
    <div class="hamburger-holder">
      <cwa-hamburger class="hamburger" @toggle="toggleMenu" />
    </div>
  </div>
</template>

<script>
import CwaHamburger from './cwa-hamburger.vue'
import CwaLogo from "./cwa-logo"
import CwaNuxtLink from './cwa-nuxt-link.vue'
export default {
  components: {CwaLogo, CwaHamburger, CwaNuxtLink},
  data(){
    return {
      showMenu: false,
      leftLinks: [
        {
          text: 'Builder'
        },
        {
          text: 'Layouts'
        },
        {
          text: 'Pages'
        },
        {
          text: 'Components'
        },
        {
          text: 'Users'
        }
      ]
    }
  },
  computed: {
    cwaModuleVersionText() {
      const version = this.$cwa.package.version
      const truncated = version.length > 9
        ? `${version.substr(0, 3)}..${version.substr(-4)}`
        : version
      const nextPostfix = this.$cwa.package.name.substr(-4) === 'next' ? ' (unstable)' : ''
      return truncated + nextPostfix
    },
    cwaModuleVersionLink() {
      return `https://www.npmjs.com/package/${this.$cwa.package.name}/v/${this.$cwa.package.version}`
    }
  },
  methods: {
    toggleMenu(showMenu) {
      this.showMenu = showMenu
    }
  }
}
</script>

<style lang="sass">
.cwa-admin-bar-menu
  position: relative
  > .hamburger-holder
    z-index: 2
  > .menu
    position: absolute
    top: -1.5rem
    right: -1.5rem
    width: 80vw
    max-width: 600px
    background: $cwa-navbar-background
    backface-visibility: hidden
    transform: scale(1)
    transition: all .2s
    transform-origin: 100% 0
    padding: 2.5rem 6rem 6rem
    &:after
      top: 0
      left: 0
      content: ''
      position: absolute
      z-index: -1
      width: 100%
      height: 100%
      opacity: 1
      box-shadow: 0 0 10px 0 black
      transition: opacity 0.2s ease-in-out
    .menu-header
      text-align: center
      color: $cwa-color-text-light
      opacity: .6
      font-size: 1.5rem
      margin-bottom: 3rem
      .cwa-logo
        width: auto
        height: 25px
    .menu-columns-aligner
      display: flex
      justify-content: center
    .menu-columns
      display: flex
      justify-content: space-between
      max-width: 450px
      width: 100%

      ul
        list-style: none
        margin: 0
        color: $white
        a
          color: inherit
          opacity: .6
          &:hover,
          &.nuxt-link-active
            opacity: 1
          .small
            font-size: .8em
        > li
          margin: 0
          > ul
            margin-bottom: 2rem
            > li
              color: $cwa-color-text-light
          &:last-child > ul
            margin-bottom: 0

        &.menu-links-right
          padding-right: 30px
          font-size: 1.45rem
        &.menu-links-left
          font-size: 1.7rem
          li
            > a
              display: flex
              align-content: center
              > .icon
                margin-right: 2rem
                min-width: 3.2rem
            &:not(:last-child)
              margin-bottom: 2rem
  .menu-enter,
  .menu-leave-to
    transform: scale(.97)
    opacity: 0
    &:after
      opacity: 0
  .menu-leave-active
    transition-delay: .1s
  .menu-enter-active
    &:after
      transition-delay: .1s
</style>
