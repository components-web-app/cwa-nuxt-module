<template>
  <div class="cwa-admin-bar-menu">
    <transition name="menu">
      <div v-if="showMenu" class="menu" @click.stop>
        <div class="menu-scroll">
          <div class="menu-header">
            <div>
              <cwa-logo class="cwa-logo" />
            </div>
            <span>
              {{ $cwa.options.websiteName }}
            </span>
          </div>
          <div class="menu-columns-aligner">
            <nav class="menu-columns">
              <ul class="menu-links-left">
                <li>
                  <cwa-nuxt-link to="/_cwa/layouts">
                    <span class="icon">
                      <img
                        src="../../../assets/images/icon-layout.svg"
                        alt="Layouts Icon"
                      />
                    </span>
                    <span>Layouts</span>
                  </cwa-nuxt-link>
                </li>
                <li>
                  <cwa-nuxt-link to="/_cwa/pages">
                    <span class="icon">
                      <img
                        src="../../../assets/images/icon-pages.svg"
                        alt="Pages Icon"
                      />
                    </span>
                    <span>Pages</span>
                  </cwa-nuxt-link>
                </li>
                <!--<li>
                  <cwa-nuxt-link>
                    <span class="icon">
                      <img
                        src="../../../assets/images/icon-components.svg"
                        alt="Components Icon"
                      />
                    </span>
                    <span>Components</span>
                  </cwa-nuxt-link>
                </li>-->
                <li>
                  <cwa-nuxt-link to="/_cwa/users">
                    <span class="icon">
                      <img
                        src="../../../assets/images/icon-users.svg"
                        alt="Users Icon"
                      />
                    </span>
                    <span>Users</span>
                  </cwa-nuxt-link>
                </li>
              </ul>
              <ul class="menu-links-right">
                <!--
                Unsure of what global settings would be - MW idea not thought through yet
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
                -->
                <li>
                  Account
                  <ul>
                    <li>
                      <cwa-nuxt-link :to="`/_cwa/users/${$cwa.user['@id']}`"
                        >My account</cwa-nuxt-link
                      >
                    </li>
                    <li>
                      <a href="#" @click.prevent="logout">Sign out</a>
                    </li>
                  </ul>
                </li>
                <li>
                  CWA
                  <ul>
                    <li>
                      <cwa-nuxt-link to="https://cwa.rocks">
                        About CWA
                      </cwa-nuxt-link>
                    </li>
                    <li>
                      <cwa-nuxt-link :to="cwaModuleVersionLink">
                        CWA
                        <span class="small">{{ cwaModuleVersionText }}</span>
                      </cwa-nuxt-link>
                    </li>
                    <li>
                      <cwa-nuxt-link :to="$config.API_URL">
                        API <span class="small">{{ apiVersionText }}</span>
                      </cwa-nuxt-link>
                    </li>
                  </ul>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </transition>
    <div class="hamburger-holder">
      <cwa-hamburger class="hamburger" @toggle="toggleMenu" />
    </div>
  </div>
</template>

<script>
import CwaHamburger from '../utils/cwa-hamburger.vue'
import CwaLogo from '../utils/cwa-logo'
import CwaNuxtLink from '../utils/cwa-nuxt-link.vue'
export default {
  components: { CwaLogo, CwaHamburger, CwaNuxtLink },
  props: {
    forceHide: {
      type: Boolean,
      default: false
    }
  },
  data() {
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
      ],
      apiVersion: '--'
    }
  },
  computed: {
    apiVersionText() {
      const unstablePostfix =
        this.apiVersion.substr(0, 3) === 'dev' ? ' (unstable)' : ''
      return this.truncateVersion(this.apiVersion) + unstablePostfix
    },
    cwaModuleVersionText() {
      const unstablePostfix =
        this.$cwa.options.package.name.substr(-4) === 'next'
          ? ' (unstable)'
          : ''
      return (
        this.truncateVersion(this.$cwa.options.package.version) +
        unstablePostfix
      )
    },
    cwaModuleVersionLink() {
      return `https://www.npmjs.com/package/${this.$cwa.options.package.name}/v/${this.$cwa.options.package.version}`
    }
  },
  watch: {
    forceHide: {
      handler(isForcedHide) {
        if (isForcedHide) {
          this.showMenu = false
        }
      }
    }
  },
  async mounted() {
    const { docs } = await this.$cwa.getApiDocumentation()
    const version = docs.info.version
    const matches = version.match(/ \(([a-zA-Z0-9\-@]+)\)$/)
    this.apiVersion = matches ? matches[1] : version || '??'
  },
  methods: {
    toggleMenu(showMenu) {
      this.showMenu = this.forceHide ? false : showMenu
    },
    truncateVersion(version) {
      return version.length > 9
        ? `${version.substr(0, 3)}..${version.substr(-4)}`
        : version
    },
    async logout() {
      await this.$cwa.logout()
    }
  }
}
</script>

<style lang="sass">
.cwa-admin-bar-menu
  position: relative
  z-index: 100
  > .hamburger-holder
    z-index: 2
    line-height: 0
  > .menu
    position: absolute
    top: -1rem
    right: -1rem
    width: 80vw
    max-width: 600px
    background: $cwa-navbar-background
    backface-visibility: hidden
    transform: scale(1)
    transition: all .2s
    transform-origin: 100% 0
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
    .menu-scroll
      max-height: 90vh
      overflow: auto
      padding: 1.5rem 2rem 2rem
      +tablet
        padding: 1.5rem 3rem 3rem

    .menu-header
      text-align: center
      color: $cwa-color-text-light
      opacity: .6
      font-size: 1rem
      margin-bottom: 1.5rem
      font-weight: $weight-semibold
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
      +mobile
        flex-direction: column

      ul
        list-style: none
        margin: 0
        color: $white
        font-weight: $weight-semibold
        a
          pointer-events: all
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
            margin-bottom: 1rem
            > li
              color: $cwa-color-text-light
          &:last-child > ul
            margin-bottom: 0

        &.menu-links-right
          padding-right: 30px
          font-size: .95rem
          +mobile
            margin-top: 1.5rem
        &.menu-links-left
          font-size: 1.2rem
          li
            > a
              display: flex
              align-content: center
              > span
                display: block
              > .icon
                margin-right: 1rem
                min-width: 1.5rem
            &:not(:last-child)
              margin-bottom: 1rem
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
