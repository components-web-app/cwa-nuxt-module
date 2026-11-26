<template>
  <div
    class="cwa:flex cwa:relative cwa:h-full cwa:items-center cwa:z-dialog"
    @keydown.esc="closeToToggle"
    @focusout="closeOnFocusLeaving"
  >
    <CwaUiHamburger
      ref="hamburger"
      v-model="showMenu"
      :controls="panelId"
      class="cwa:relative cwa:z-20"
    />
    <Transition v-bind="menuTransition">
      <div
        v-show="showMenu"
        :id="panelId"
        ref="menu"
        class="cwa:absolute cwa:z-10 cwa:-top-1.5 cwa:-right-2 cwa:bg-dark cwa:pt-6 cwa:pb-12 cwa:px-12 cwa:w-[90vw] cwa:max-w-lg cwa:origin-top-right"
      >
        <div class="cwa:text-light cwa:flex cwa:flex-col cwa:text-center cwa:gap-y-2 cwa:mb-5">
          <div class="cwa:flex cwa:justify-center cwa:opacity-[.35]">
            <CwaLogo class="cwa:h-8 cwa:w-auto" />
          </div>
          <h2 class="cwa:opacity-50 cwa:text-sm cwa:font-bold">
            {{ $cwa.config.siteName }}
          </h2>
        </div>
        <div class="cwa:flex cwa:justify-center">
          <div class="cwa:flex cwa:justify-between cwa:w-full cwa:max-w-[350px]">
            <div class="cwa:mt-2">
              <ul class="cwa:text-xl cwa:flex cwa:flex-col cwa:gap-y-5">
                <li v-if="$cwa.auth.isAdmin.value">
                  <MenuPrimaryLink
                    label="Layouts"
                    to="/_cwa/layouts"
                  >
                    <IconLayouts class="cwa:w-7" />
                  </MenuPrimaryLink>
                </li>
                <li v-if="$cwa.auth.isAdmin.value">
                  <MenuPrimaryLink
                    label="Pages"
                    to="/_cwa/pages"
                  >
                    <IconPages class="cwa:w-5 cwa:mx-1" />
                  </MenuPrimaryLink>
                </li>
                <li v-if="$cwa.auth.isAdmin.value">
                  <MenuPrimaryLink
                    label="Data"
                    to="/_cwa/data"
                  >
                    <IconData class="cwa:w-6 cwa:mx-0.5" />
                  </MenuPrimaryLink>
                </li>
                <li v-if="$cwa.auth.isAdmin.value">
                  <MenuPrimaryLink
                    label="Routes"
                    to="/_cwa/routes"
                  >
                    <IconRoutes class="cwa:w-7" />
                  </MenuPrimaryLink>
                </li>
                <li v-if="$cwa.auth.hasRole('ROLE_USER_ADMIN')">
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
              <div v-if="$cwa.auth.isAdmin.value">
                <h3>General</h3>
                <ul class="cwa:text-sm">
                  <li>
                    <MenuLink :to="{ name: '_cwa-settings' }">
                      Site settings
                    </MenuLink>
                  </li>
                </ul>
              </div>
              <div v-if="extensionEntries.length">
                <h3>Extensions</h3>
                <ul class="cwa:text-sm">
                  <li
                    v-for="entry in extensionEntries"
                    :key="entry.to.name"
                  >
                    <MenuLink :to="entry.to">
                      {{ entry.label }}
                    </MenuLink>
                  </li>
                </ul>
              </div>
              <div>
                <h3>Account</h3>
                <ul class="cwa:text-sm">
                  <li>
                    <MenuLink :to="{ name: '_cwa-account' }">
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
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import MenuPrimaryLink from './MenuPrimaryLink.vue'
import CwaLogo from '#cwa/templates/components/core/assets/CwaLogo.vue'
import { useCwa } from '#cwa/composables/cwa'
import { useRoute } from '#app/composables/router'
import { useTransitions } from '#cwa/composables/transitions'
import IconLayouts from '#cwa/templates/components/core/assets/IconLayouts.vue'
import IconPages from '#cwa/templates/components/core/assets/IconPages.vue'
import IconUsers from '#cwa/templates/components/core/assets/IconUsers.vue'
import MenuLink from '#cwa/templates/components/main/admin/header/_parts/MenuLink.vue'
import IconRoutes from '#cwa/templates/components/core/assets/IconRoutes.vue'
import IconData from '#cwa/templates/components/core/assets/IconData.vue'
// @ts-ignore
import { extensionMenu } from '#build/cwa-extension-menu'

const $cwa = useCwa()
const { menu: menuTransition } = useTransitions()
const route = useRoute()

const showMenu = ref(false)
const extensionEntries = computed(() => (extensionMenu as { label: string, to: { name: string }, role: string }[]).filter(entry => $cwa.auth.hasRole(entry.role)))

const menu = useTemplateRef('menu')
const hamburger = ref<{ $el?: HTMLElement }>()
const panelId = useId()

function toggleElement() {
  return hamburger.value?.$el
}

function closeToToggle() {
  if (!showMenu.value) {
    return
  }
  showMenu.value = false
  toggleElement()?.focus()
}

function closeOnFocusLeaving(event: FocusEvent) {
  const next = event.relatedTarget
  if (!showMenu.value || !(next instanceof Node)) {
    return
  }
  if (menu.value?.contains(next) || toggleElement()?.contains(next)) {
    return
  }
  showMenu.value = false
}

watch(showMenu, async (open) => {
  if (!open) {
    return
  }
  await nextTick()
  menu.value?.querySelector<HTMLElement>('a[href], button')?.focus()
})
onClickOutside(menu, () => {
  showMenu.value = false
}, { ignore: [`[aria-controls="${panelId}"]`] })

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
