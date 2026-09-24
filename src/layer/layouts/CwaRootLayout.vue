<template>
  <div
    id="cwa-root-layout"
    ref="rootLayout"
    class="cwa:relative cwa:h-full cwa:flex cwa:flex-col"
    @click="onRootClick"
    @contextmenu="onRootContextMenu"
  >
    <ClientOnly>
      <LazyCwaAdminHeader v-if="showAdmin" />
      <OutdatedContentNotice
        v-else
        class="cwa:absolute cwa:top-0 cwa:mt-1.5 cwa:left-1/2 cwa:-translate-x-1/2 cwa:z-50"
      />
    </ClientOnly>
    <CwaUiAlertWarning v-if="unresolvableWarning">
      <p>{{ unresolvableWarning }}</p>
    </CwaUiAlertWarning>
    <component
      :is="resolvedComponent"
      v-if="resolvedComponent"
      class="cwa:relative"
    >
      <div
        ref="page"
        class="cwa:grow"
      >
        <slot />
      </div>
    </component>
    <ClientOnly>
      <template v-if="showAdmin">
        <LazyCwaAdminResourceManager ref="resourceManager" />
        <LazyCwaAdminResourceManagerLayoutPageOverlay
          v-if="$cwa.admin.isEditing && page && rootLayout"
          :page="page"
          :layout="rootLayout"
        />
        <teleport to="body">
          <DialogsWrapper />
        </teleport>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, getCurrentInstance, watch, nextTick } from 'vue'
import { consola as logger } from 'consola'
import { DialogsWrapper } from 'vuejs-confirm-dialog'
import { useRouter } from 'vue-router'
import { useWindowScroll } from '@vueuse/core'
import { useCwa, useHead } from '#imports'
import { LazyCwaAdminHeader, LazyCwaAdminResourceManager, LazyCwaAdminResourceManagerLayoutPageOverlay, LazyCwaDefaultLayout } from '#components'
import OutdatedContentNotice from '#cwa/templates/components/main/admin/header/_parts/OutdatedContentNotice.vue'
import type { GlobalComponentNames } from '#cwa/types'

const $cwa = useCwa()
const currentRoute = useRouter().currentRoute
const resourceManager = ref<null | InstanceType<typeof LazyCwaAdminResourceManager>>(null)
const page = ref<null | HTMLElement>(null)
const rootLayout = ref<null | HTMLElement>(null)
const instance = getCurrentInstance()

const cwaPageMeta = computed(() => {
  return currentRoute.value.meta?.cwa
})

function callResourceManagerHandler(handler: 'contextMenuHandler' | 'clickHandler', e: MouseEvent, type: 'layout' | 'page') {
  resourceManager.value && resourceManager.value[handler](e, type)
}

function isInPage(e: MouseEvent) {
  return !!page.value && (page.value === e.target || page.value.contains(e.target as Node))
}

function onRootClick(e: MouseEvent) {
  callResourceManagerHandler('clickHandler', e, isInPage(e) ? 'page' : 'layout')
}

function onRootContextMenu(e: MouseEvent) {
  callResourceManagerHandler('contextMenuHandler', e, isInPage(e) ? 'page' : 'layout')
}

const layoutResource = computed(() => {
  return $cwa.resources.layout.value
})

const layoutUiComponent = computed<GlobalComponentNames>(() => {
  return cwaPageMeta.value?.staticLayout || (layoutResource.value?.data?.uiComponent as GlobalComponentNames) || LazyCwaDefaultLayout
})

const hasNamedLayout = computed(() => !!(cwaPageMeta.value?.staticLayout || layoutResource.value?.data?.uiComponent))

const stableLayoutUiComponent = ref<GlobalComponentNames | undefined>(hasNamedLayout.value ? layoutUiComponent.value : undefined)
watch(hasNamedLayout, (isNamed) => {
  if (isNamed) {
    stableLayoutUiComponent.value = layoutUiComponent.value
  }
})

const unresolvableUiComponent = computed<string | undefined>(() => {
  const components = instance?.appContext.components
  if (typeof components !== 'object') {
    return
  }
  const name = layoutUiComponent.value
  if (typeof name !== 'string' || name in components) {
    return
  }
  return name
})

const unresolvableWarning = computed(() => {
  if (!unresolvableUiComponent.value) {
    return
  }
  const iri = $cwa.resources.layoutIri.value
  return `The layout component '${unresolvableUiComponent.value}' for resource '${iri}' cannot be resolved`
})

watch(unresolvableWarning, (warning) => {
  warning && logger.warn(warning)
}, { immediate: true })

// todo: adjust to not be global https://github.com/nuxt/nuxt/issues/14036#issuecomment-2110180751
const resolvedComponent = computed(() => {
  if (typeof instance?.appContext.components !== 'object') {
    return LazyCwaDefaultLayout
  }
  if (unresolvableUiComponent.value) {
    return LazyCwaDefaultLayout
  }
  if (!hasNamedLayout.value && $cwa.resources.layoutIri.value && stableLayoutUiComponent.value) {
    return stableLayoutUiComponent.value
  }
  return layoutUiComponent.value
})

const cachedWindowScroll = ref<{ x: number, y: number }>()
const windowScroll = useWindowScroll()

watch(() => $cwa.admin.isEditing, () => {
  cachedWindowScroll.value = {
    x: windowScroll.x.value,
    y: windowScroll.y.value,
  }
}, {
  flush: 'pre',
})

watch(() => $cwa.admin.isEditing, async () => {
  // when lots of elements on the page are replaced with drafts, it can cause the scroll to revert to the top of the page. Prevent this.
  // we may need to wait for other components to have loaded in from drafts... todo: have a think about draft component loading and taking some time.
  await nextTick()
  setTimeout(() => {
    if (cachedWindowScroll.value) {
      window.scrollTo(cachedWindowScroll.value.x, cachedWindowScroll.value.y)
      cachedWindowScroll.value = undefined
    }
  }, 10)
}, {
  flush: 'post',
})

const showAdmin = $cwa.auth.isAdmin
useHead({
  titleTemplate: () => {
    if ($cwa.siteConfig.config.concatTitle) {
      return '%s %separator %siteName'
    }
    return '%s'
  },
})

defineSlots<{
  default(): any
}>()
</script>
