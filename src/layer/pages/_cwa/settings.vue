<template>
  <ListHeading
    title="Site settings"
    hide-add
  />
  <ListContainer class="cwa:relative cwa:py-10">
    <Spinner
      v-if="isLoading"
      :show="true"
    />
    <div
      v-else
      class="cwa:flex cwa:flex-col"
    >
      {{ allSettings }}
      <div :class="{ 'cwa:pointer-events-none cwa:opacity-50': requestTotal }">
        <div>
          <h2 class="cwa:text-xl cwa:mb-4">
            General
          </h2>
          <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
            <div>
              <ModalInput
                v-model="allSettings.siteName"
                label="Site name"
                type="text"
              />
            </div>
            <div>
              <CwaUiFormToggle
                v-model="allSettings.fallbackTitle"
                label="Fallback page titles to site name"
              />
              <div
                class="cwa:text-sm cwa:font-normal cwa:mt-2.5 cwa:text-stone-300"
              >
                <p v-if="allSettings.fallbackTitle">
                  If you do not specify a page title, your site name will be used instead
                </p>
                <p
                  v-else
                  class="cwa:text-red-500 cwa:font-bold"
                >
                  If you do not specify a page title, no page title will be used
                </p>
              </div>
            </div>
            <div>
              <CwaUiFormToggle
                v-model="allSettings.concatTitle"
                label="Extend page titles with the default title"
              />
              <div
                class="cwa:text-sm cwa:font-normal cwa:mt-2.5 cwa:text-stone-300"
              >
                <p>
                  <span>Page titles will be formatted as</span>
                  <b
                    v-if="allSettings.concatTitle"
                    class="cwa:border cwa:bg-dark/90 cwa:border-stone-700 cwa:rounded-lg cwa:px-1.5 cwa:py-1.5"
                  >[Page title] | [Site name]</b>
                  <b
                    v-else
                    class="cwa:border cwa:bg-dark/90 cwa:border-stone-700 cwa:rounded-lg cwa:px-1.5 cwa:py-1.5"
                  >[Page title]</b>
                </p>
              </div>
            </div>
          </div>
        </div>
        <hr class="cwa:my-8 cwa:text-stone-600">
        <div>
          <h2 class="cwa:text-xl cwa:mb-4">
            SEO Indexing
          </h2>
          <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
            <CwaUiFormToggle
              v-model="allSettings.indexable"
              label="Allow your website to be indexed"
            />
            <template v-if="allSettings.indexable">
              <CwaUiFormToggle
                v-model="allSettings.robotsAllowSearchEngineCrawlers"
                label="Allow Search Engine Crawlers"
              />
              <CwaUiFormToggle
                v-model="allSettings.robotsAllowAiBots"
                label="Allow Artificial Intelligence Bots"
              />
            </template>
            <CwaUiFormToggle
              v-model="allSettings.robotsRemoveSitemap"
              label="Remove sitemap.xml from robots.txt"
            />
            <ModalInput
              v-model="allSettings.robotsText"
              label="Additional custom robots.txt"
              type="textarea"
            />
          </div>
        </div>
        <hr class="cwa:my-8 cwa:text-stone-600">
        <div>
          <h2 class="cwa:text-xl cwa:mb-4">
            Sitemap
          </h2>
          <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
            <CwaUiFormToggle
              v-model="allSettings.sitemapEnabled"
              label="Auto-generate sitemap.xml"
            />
            <ModalInput
              v-if="!allSettings.sitemapEnabled"
              v-model="allSettings.sitemapXml"
              label="Custom sitemap.xml"
              type="textarea"
            />
          </div>
        </div>
        <hr class="cwa:my-8 cwa:text-stone-600"><div>
          <h2 class="cwa:text-xl cwa:mb-4">
            Advanced
          </h2>
          <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
            <div>
              <CwaUiFormToggle
                v-model="allSettings.maintenanceModeEnabled"
                label="Enable maintenance mode"
              />
              <div
                v-if="allSettings.maintenanceModeEnabled"
                class="cwa:text-sm cwa:font-normal cwa:mt-2.5 cwa:text-stone-300"
              >
                <p>Website visitors will be redirected to a 'website under maintenance page'</p>
                <p>Crawlers will receive an HTTP status code so they know this is not permanent</p>
              </div>
            </div>
          </div>
        </div>
        <hr class="cwa:my-8 cwa:text-stone-600">
        <div>
          <h2 class="cwa:text-bas cwa:mb-4">
            CWA Version Info
          </h2>
          <div class="cwa:flex cwa:flex-col cwa:gap-y-2 text-sm">
            <div>
              <MenuLink :to="moduleLink">
                App: <span class="cwa:text-xs">{{ displayAppVersion }}</span>
              </MenuLink>
            </div>
            <div>
              <MenuLink
                :to="apiPackagistLink"
                title="Hello"
              >
                API: <span class="cwa:text-xs">{{ displayApiVersion }}</span>
              </MenuLink>
            </div>
          </div>
        </div>
        <hr class="cwa:my-8 cwa:text-stone-600">
      </div>

      <div class="flex">
        <CwaUiFormButton
          :color="hasError ? 'error' : 'blue'"
          :disabled="submitDisabled"
          type="button"
          @click="processChanges"
        >
          Save Changes
        </CwaUiFormButton>
      </div>
      <div
        v-if="hasError"
        class="cwa:mt-2 cwa:text-sm cwa:flex cwa:items-center cwa:gap-x-2 cwa:transition cwa:text-red-500 cwa:font-bold"
      >
        <p>An error occurred while saving your changes</p>
      </div>
      <div
        :class="[showUpdateProgress ? 'opacity-100' : 'opacity-0']"
        class="cwa:mt-2 cwa:text-sm cwa:flex cwa:items-center cwa:gap-x-2 cwa:transition"
      >
        <Spinner show /><p>Processing updates {{ updatingCount - requestTotal }} / {{ updatingCount }}</p>
      </div>
    </div>
  </ListContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import { definePageMeta, useCwa } from '#imports'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'
import MenuLink from '#cwa/runtime/templates/components/main/admin/header/_parts/MenuLink.vue'
import type { CwaResource } from '#cwa/runtime/resources/resource-utils'

const $cwa = useCwa()

const isLoading = ref(false)

const allSettings = ref($cwa.siteConfig.siteConfig)
const submitDisabled = ref(false)

// const allSettings = ref<SiteConfigParams>({ ...defaultSettings })
// const loadedSettings = ref<Partial<SiteConfigParams>>({})
// const isDataChanged = computed(() => {
//   return !isEqual(allSettings.value, loadedSettings.value)
// })
// const submitDisabled = computed(() => {
//   return !isDataChanged.value || isLoading.value || requestTotal.value > 0
// })

const apiVersion = ref('')
const showUpdateProgress = ref(false)

const requests = ref<Promise<CwaResource | undefined>[]>([])
const updatingCount = ref(0)
const requestTotal = computed(() => requests.value.length)
const hasError = ref(false)

const moduleLink = computed(() => {
  return `https://www.npmjs.com/package/${$cwa.currentModulePackageInfo.name}/v/${$cwa.currentModulePackageInfo.version}`
})

useHead({
  title: 'Site Settings',
})

definePageMeta({
  name: '_cwa-settings',
  pageTransition: false,
})

async function setApiVersion() {
  const docs = await $cwa.getApiDocumentation()
  const version = docs?.docs?.info.version
  if (!version) {
    return
  }
  const matches = version.match(/ \(([a-zA-Z0-9\-@]+)\)$/)
  apiVersion.value = matches ? matches[1] : version
}

function truncateVersion(version: string) {
  return version.length > 9
    ? `${version.substring(0, 3)}..${version.substring(version.length - 4)}`
    : version
}

const displayApiVersion = computed(() => {
  const unstablePostfix = apiVersion.value.substring(0, 3) === 'dev' ? ' (unstable)' : ''
  return truncateVersion(apiVersion.value) + unstablePostfix
})

const apiPackagistLink = computed(() => {
  const versionParts = apiVersion.value.split('@')
  return `https://packagist.org/packages/components-web-app/api-components-bundle#${versionParts[0]}`
})

const displayAppVersion = computed(() => {
  const unstablePostfix = $cwa.currentModulePackageInfo.name.substring($cwa.currentModulePackageInfo.name.length - 4) === 'edge' ? ' (unstable)' : ''
  return (
    truncateVersion($cwa.currentModulePackageInfo.version)
    + unstablePostfix
  )
})

watchDebounced(requestTotal, () => {
  showUpdateProgress.value = requestTotal.value > 0
}, {
  debounce: 500,
})

async function processChanges() {
  // hasError.value = false
  // if (submitDisabled.value) {
  //   return
  // }
  //
  // requests.value = []
  //
  // const newSettings = allSettings.value
  // const oldSettings = loadedSettings.value
  // const changedKeys: (keyof SiteConfigParams)[] = []
  // for (const [newKey, newValue] of Object.entries(newSettings) as [keyof SiteConfigParams, any][]) {
  //   if (oldSettings[newKey] === undefined || newValue !== oldSettings[newKey]) {
  //     changedKeys.push(newKey)
  //   }
  // }
  // if (!changedKeys.length) {
  //   return
  // }
  //
  // showUpdateProgress.value = true
  // updatingCount.value = changedKeys.length
  //
  // for (const changedKey of changedKeys) {
  //   const isCreatingConfig = loadedSettings.value[changedKey] === undefined
  //
  //   const iri = isCreatingConfig ? `/_/site_config_parameters` : `/_/site_config_parameters/${changedKey}`
  //   const data: {
  //     key: keyof SiteConfigParams
  //     value: any
  //   } = {
  //     key: changedKey,
  //     value: JSON.stringify(allSettings.value[changedKey]),
  //   }
  //   const request = $cwa.fetcher.fetch({
  //     path: iri,
  //     body: data,
  //     headers: {
  //       method: isCreatingConfig ? 'POST' : 'PATCH',
  //     },
  //   })
  //
  //   requests.value.push(request)
  // }

  // try {
  //   const responses = await Promise.all(requests.value)
  //   if (responses.filter(r => r === undefined).length) {
  //     hasError.value = true
  //   }
  //
  //   for (const response of responses) {
  //     if (!response) {
  //       continue
  //     }
  //     const configKey = response.key as keyof SiteConfigParams
  //     loadedSettings.value[configKey] = processApiValue(response.value)
  //     console.log(response.key, loadedSettings.value[configKey])
  //   }
  // }
  // catch (e) {
  //   hasError.value = true
  //   throw e
  // }
  // requests.value = []
}

onMounted(() => {
  // loadSettings()
  setApiVersion()
})
</script>
