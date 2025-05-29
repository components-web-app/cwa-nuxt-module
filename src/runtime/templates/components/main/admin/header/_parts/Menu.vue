<template>
  <div class="cwa:flex cwa:relative cwa:h-full cwa:items-center cwa:z-50">
    <CwaUiHamburger
      ref="hamburger"
      v-model="showMenu"
      class="cwa:relative cwa:z-20"
    />
    <Transition
      enter-from-class="cwa:transform cwa:opacity-0 cwa:scale-[0.97]"
      enter-active-class="cwa:duration-200 cwa:ease-out"
      enter-to-class="cwa:opacity-100"
      leave-from-class="cwa:opacity-100"
      leave-active-class="cwa:duration-200 cwa:ease-in"
      leave-to-class="cwa:transform cwa:opacity-0 cwa:scale-[0.97]"
    >
      <div
        v-show="showMenu"
        ref="menu"
        class="cwa:absolute cwa:z-10 cwa:-top-1.5 cwa:-right-2 cwa:bg-dark cwa:pt-6 cwa:pb-12 cwa:px-12 cwa:w-[90vw] cwa:max-w-lg cwa:origin-top-right"
      >
        <div class="cwa:text-light cwa:flex cwa:flex-col cwa:text-center cwa:gap-y-2 cwa:mb-5">
          <div class="cwa:flex cwa:justify-center cwa:opacity-[.35]">
            <CwaLogo class="cwa:h-8 cwa:w-auto" />
          </div>
          <h2 class="cwa:opacity-50 cwa:text-sm cwa:font-bold">
            {{ $cwa.appName }}
          </h2>
        </div>
        <div class="cwa:flex cwa:justify-center">
          <div class="cwa:flex cwa:justify-between cwa:w-full cwa:max-w-[350px]">
            <div class="cwa:mt-2">
              <ul class="cwa:text-xl cwa:flex cwa:flex-col cwa:gap-y-5">
                <li>
                  <MenuPrimaryLink
                    label="Layouts"
                    to="/_cwa/layouts"
                  >
                    <IconLayouts class="cwa:w-7" />
                  </MenuPrimaryLink>
                </li>
                <li>
                  <MenuPrimaryLink
                    label="Pages"
                    to="/_cwa/pages"
                  >
                    <IconPages class="cwa:w-5 cwa:mx-1" />
                  </MenuPrimaryLink>
                </li>
                <li>
                  <MenuPrimaryLink
                    label="Data"
                    to="/_cwa/data"
                  >
                    <IconData class="cwa:w-6 cwa:mx-0.5" />
                  </MenuPrimaryLink>
                </li>
                <li>
                  <MenuPrimaryLink
                    label="Routes"
                    to="/_cwa/routes"
                  >
                    <IconRoutes class="cwa:w-7" />
                  </MenuPrimaryLink>
                </li>
                <li>
                  <MenuPrimaryLink
                    label="Users"
                    :to="{ name: '_cwa-users-user' }"
                  >
                    <IconUsers class="cwa:w-7" />
                  </MenuPrimaryLink>
                </li>
              </ul>
            </div>
            <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
              <div>
                <h3>General</h3>
                <ul class="cwa:text-sm">
                  <li>
                    <MenuLink :to="{ name: '_cwa-settings' }">
                      Site settings
                    </MenuLink>
                  </li>
                </ul>
              </div>
              <div>
                <h3>Account</h3>
                <ul class="cwa:text-sm">
                  <li>
                    <MenuLink :to="{ name: '_cwa-users-user-iri', params: { iri: '/me' } }">
                      My account
                    </MenuLink>
                  </li>
                  <li>
                    <MenuLink @click="signOut">
                      Sign out
                    </MenuLink>
                  </li>
                </ul>
              </div>
              <div class="cwa:py-2 cwa:rounded-lg">
                <h3>CWA</h3>
                <ul class="cwa:text-sm">
                  <li>
                    <MenuLink
                      to="https://cwa.rocks"
                    >
                      About the CWA
                    </MenuLink>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import MenuPrimaryLink from './MenuPrimaryLink.vue'
import CwaLogo from '#cwa/runtime/templates/components/core/assets/CwaLogo.vue'
import { useCwa, useRoute } from '#imports'
import IconLayouts from '#cwa/runtime/templates/components/core/assets/IconLayouts.vue'
import IconPages from '#cwa/runtime/templates/components/core/assets/IconPages.vue'
import IconUsers from '#cwa/runtime/templates/components/core/assets/IconUsers.vue'
import MenuLink from '#cwa/runtime/templates/components/main/admin/header/_parts/MenuLink.vue'
import IconRoutes from '#cwa/runtime/templates/components/core/assets/IconRoutes.vue'
import IconData from '#cwa/runtime/templates/components/core/assets/IconData.vue'

const $cwa = useCwa()
const route = useRoute()

const showMenu = ref(false)

const menu = useTemplateRef('menu')
const hamburger = ref()
onClickOutside(menu, () => {
  showMenu.value = false
}, {
  ignore: [hamburger],
})

async function signOut() {
  if ($cwa.navigationDisabled) {
    return
  }
  await $cwa.auth.signOut()
}

watch(
  () => route.path,
  () => {
    showMenu.value = false
  },
)
</script>
