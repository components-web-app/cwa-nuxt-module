<template>
  <nav
    aria-label="Admin"
    class="cwa:sm:hidden cwa:fixed cwa:inset-x-0 cwa:bottom-0 cwa:z-manager cwa:bg-surface cwa:border-t cwa:border-line cwa:pb-[env(safe-area-inset-bottom)]"
  >
    <ul class="cwa:flex">
      <li class="cwa:flex cwa:min-w-0 cwa:flex-1">
        <NuxtLink
          to="/_cwa"
          :aria-current="route.path === '/_cwa' ? 'page' : undefined"
          :class="tabLook"
        >
          <IconHome
            aria-hidden="true"
            class="cwa:size-5 cwa:shrink-0"
          />
          <span
            data-testid="admin-bottom-bar-label"
            :class="labelLook"
          >Dashboard</span>
        </NuxtLink>
      </li>
      <li
        v-for="item in bar.shown"
        :key="item.id"
        class="cwa:flex cwa:min-w-0 cwa:flex-1"
      >
        <NuxtLink
          :to="item.to"
          :aria-current="current === item.id ? 'page' : undefined"
          :class="tabLook"
        >
          <component
            :is="builtInIcons[item.id]"
            v-if="builtInIcons[item.id]"
            aria-hidden="true"
            class="cwa:size-5 cwa:shrink-0"
          />
          <span
            v-else
            aria-hidden="true"
            class="cwa:block cwa:size-5 cwa:shrink-0 cwa:[&>svg]:size-full"
            v-html="item.icon"
          />
          <span
            data-testid="admin-bottom-bar-label"
            :class="labelLook"
          >{{ item.label }}</span>
        </NuxtLink>
      </li>
      <li
        v-if="bar.more.length"
        class="cwa:flex cwa:min-w-0 cwa:flex-1"
      >
        <button
          ref="moreButton"
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="moreOpen ? 'true' : 'false'"
          data-testid="admin-bottom-bar-more"
          :class="tabLook"
          @click="moreOpen = true"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="cwa:size-5 cwa:shrink-0"
          ><circle
            cx="5"
            cy="12"
            r="2"
          /><circle
            cx="12"
            cy="12"
            r="2"
          /><circle
            cx="19"
            cy="12"
            r="2"
          /></svg>
          <span
            data-testid="admin-bottom-bar-label"
            :class="labelLook"
          >More</span>
        </button>
      </li>
    </ul>
  </nav>
  <BottomSheet
    v-if="moreOpen"
    :open="true"
    label="More"
    :return-to="moreButton"
    test-id="admin-more-sheet"
    @update:open="moreOpen = $event"
  >
    <ul class="cwa:py-1">
      <li
        v-for="(item, index) in bar.more"
        :key="item.id"
      >
        <NuxtLink
          :to="item.to"
          :aria-current="current === item.id ? 'page' : undefined"
          :data-sheet-focus="index === 0 ? '' : undefined"
          class="cwa:flex cwa:min-h-hit cwa:items-center cwa:gap-3 cwa:px-4 cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:hover:bg-menu-highlight cwa:focus-visible:bg-menu-highlight cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:aria-[current=page]:text-accent-fg"
          @click="moreOpen = false"
        >
          <component
            :is="builtInIcons[item.id]"
            v-if="builtInIcons[item.id]"
            aria-hidden="true"
            class="cwa:size-5 cwa:shrink-0"
          />
          <span
            v-else
            aria-hidden="true"
            class="cwa:block cwa:size-5 cwa:shrink-0 cwa:[&>svg]:size-full"
            v-html="item.icon"
          />
          <span class="cwa:min-w-0 cwa:truncate">{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </BottomSheet>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { Component } from 'vue'
import BottomSheet from '../../../../core/ui/BottomSheet.vue'
import { useCwa, useRoute, useRouter } from '#imports'
import IconHome from '#cwa/templates/components/core/assets/IconHome.vue'
import IconLayouts from '#cwa/templates/components/core/assets/IconLayouts.vue'
import IconPages from '#cwa/templates/components/core/assets/IconPages.vue'
import IconData from '#cwa/templates/components/core/assets/IconData.vue'
import IconRoutes from '#cwa/templates/components/core/assets/IconRoutes.vue'
import IconUsers from '#cwa/templates/components/core/assets/IconUsers.vue'
import { bottomBar, currentArea, topBarItems } from '#cwa/admin/top-bar'
import { hasPageDataTypes } from '#cwa/admin/page-data-presence'
import type { CwaExtensionArea } from '#cwa/admin/extension-areas'
// @ts-ignore
import { extensionAreas } from '#build/cwa-extension-areas'
// @ts-ignore
import { topBarDefault } from '#build/cwa-admin-top-bar'

const $cwa = useCwa()
const route = useRoute()
const router = useRouter()

const builtInIcons: Record<string, Component> = {
  layouts: IconLayouts,
  pages: IconPages,
  data: IconData,
  routes: IconRoutes,
  users: IconUsers,
}

const hasPageData = ref(false)
hasPageDataTypes($cwa).then((found) => {
  hasPageData.value = found
})

const items = computed(() => topBarItems(
  extensionAreas as CwaExtensionArea[],
  { own: $cwa.auth.user?.adminPreferences?.topBar, developer: topBarDefault },
  { hasRole: role => $cwa.auth.hasRole(role), hasPageData: hasPageData.value },
))

const bar = computed(() => bottomBar(items.value))

const current = computed(() => currentArea(items.value.map(item => ({ id: item.id, path: router.resolve(item.to).path })), route.path))

const moreOpen = ref(false)
const moreButton = useTemplateRef<HTMLElement>('moreButton')

const tabLook = 'cwa:flex cwa:h-14 cwa:min-w-0 cwa:flex-1 cwa:cursor-pointer cwa:flex-col cwa:items-center cwa:justify-center cwa:gap-0.5 cwa:px-1 cwa:text-fg-muted cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:hover:text-fg cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:aria-[current=page]:text-fg cwa:aria-expanded:text-accent-fg'
const labelLook = 'cwa:max-w-full cwa:truncate cwa:text-flag'
</script>
