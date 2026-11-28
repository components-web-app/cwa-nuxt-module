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
      <nav
        v-show="panelShown"
        :id="panelId"
        ref="menu"
        aria-label="Admin menu"
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
          <div
            data-testid="menu-columns"
            class="cwa:flex cwa:flex-col cwa:gap-y-8 cwa:sm:flex-row cwa:sm:justify-between cwa:w-full cwa:max-w-[350px]"
          >
            <div class="cwa:mt-2">
              <h3
                v-if="quickLinks.length"
                class="cwa:sr-only"
              >
                Quick links
              </h3>
              <ul class="cwa:text-xl cwa:flex cwa:flex-col cwa:gap-y-5">
                <li
                  v-for="item in quickLinks"
                  :key="item.id"
                >
                  <MenuPrimaryLink
                    :label="item.label"
                    :to="item.to"
                  >
                    <component
                      :is="builtInIcons[item.id]?.icon"
                      v-if="builtInIcons[item.id]"
                      aria-hidden="true"
                      :class="builtInIcons[item.id]?.class"
                    />
                    <span
                      v-else
                      aria-hidden="true"
                      class="cwa:block cwa:size-7 cwa:[&>svg]:size-full"
                      v-html="item.icon"
                    />
                  </MenuPrimaryLink>
                </li>
                <li>
                  <MenuPrimaryLink
                    label="Dashboard"
                    to="/_cwa"
                  >
                    <IconHome
                      aria-hidden="true"
                      class="cwa:w-6 cwa:mx-0.5"
                    />
                  </MenuPrimaryLink>
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
          </div>
        </div>
      </nav>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import type { Component } from 'vue'
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
import IconHome from '#cwa/templates/components/core/assets/IconHome.vue'
import { hasPageDataTypes } from '#cwa/admin/page-data-presence'
import { topBarItems } from '#cwa/admin/top-bar'
import type { CwaExtensionArea } from '#cwa/admin/extension-areas'
// @ts-ignore
import { extensionAreas } from '#build/cwa-extension-areas'
// @ts-ignore
import { topBarDefault } from '#build/cwa-admin-top-bar'

const $cwa = useCwa()
const { menu: menuTransition } = useTransitions()
const route = useRoute()

const showMenu = ref(false)
const hasPageData = ref(false)
const pageDataDecided = ref(false)
const panelShown = computed(() => showMenu.value && (pageDataDecided.value || !$cwa.auth.isAdmin.value))

const quickLinks = computed(() => topBarItems(
  extensionAreas as CwaExtensionArea[],
  { own: $cwa.auth.user?.adminPreferences?.topBar, developer: topBarDefault },
  { hasRole: role => $cwa.auth.hasRole(role), hasPageData: hasPageData.value },
))

const builtInIcons: Record<string, { icon: Component, class: string }> = {
  layouts: { icon: IconLayouts, class: 'cwa:w-7' },
  pages: { icon: IconPages, class: 'cwa:w-5 cwa:mx-1' },
  data: { icon: IconData, class: 'cwa:w-6 cwa:mx-0.5' },
  routes: { icon: IconRoutes, class: 'cwa:w-7' },
  users: { icon: IconUsers, class: 'cwa:w-7' },
}

async function decidePageData() {
  hasPageData.value = await hasPageDataTypes($cwa)
  pageDataDecided.value = true
}

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

watch(showMenu, (open) => {
  if (open && $cwa.auth.isAdmin.value) {
    decidePageData()
  }
})

watch(panelShown, async (open) => {
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
