<template>
  <ListHeading
    title="Site settings"
    hide-add
  />
  <ListContainer class="cwa:relative cwa:py-10">
    <Spinner
      v-if="$cwa.siteConfig.isLoading || allSettings === undefined"
      :show="true"
    />
    <CwaUiAlertWarning v-else-if="!allSettings">
      Sorry, there was an error loading the settings
    </CwaUiAlertWarning>
    <div
      v-else
      class="cwa:flex cwa:flex-col"
    >
      <div :class="{ 'cwa:pointer-events-none cwa:opacity-50 cwa:transition': showUpdateProgress }">
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
                v-model="allSettings.concatTitle"
                label="Extend page titles with the default title"
              />
              <div
                class="cwa:text-sm cwa:font-normal cwa:mt-2.5 cwa:text-stone-300"
              >
                <p>
                  <span>Page titles will be formatted as</span>&nbsp;
                  <CwaCode v-if="allSettings.concatTitle">
                    [Page title] | [Site name]
                  </CwaCode>
                  <CwaCode
                    v-else
                  >
                    [Page title]
                  </CwaCode>
                </p>
              </div>
            </div>
            <div>
              <CwaUiFormToggle
                v-model="allSettings.fallbackTitle"
                label="Smart fallback page titles"
              />
              <div
                class="cwa:text-sm cwa:font-normal cwa:mt-2.5 cwa:text-stone-300"
              >
                <p v-if="allSettings.fallbackTitle">
                  Fallback title based on URL. Eg. <CwaCode>/blog-articles</CwaCode> becomes <CwaCode>Blog Articles</CwaCode>
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
              <ModalInput
                v-model="allSettings.canonicalUrl"
                label="Canonical URL"
                type="url"
                placeholder="https://your-site-domain.com"
              />
              <p
                v-if="canonicalMismatch"
                class="cwa:text-red-500 cwa:font-bold cwa:text-sm cwa:mt-2"
              >
                You are loading this page via <CwaCode>{{ currentHostDomain }}</CwaCode>&nbsp;which is different to the URL you have specified. Please ensure the canonical URL above is your primary domain and does not have redirects.
              </p>
            </div>
          </div>
        </div>
        <hr class="cwa:my-8 cwa:text-stone-600">
        <div>
          <h2 class="cwa:text-xl cwa:mb-4">
            Sitemap
          </h2>
          <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
            <div class="cwa:pb-4">
              <p class="cwa:text-sm cwa:text-stone-400">
                <strong>Please note:</strong><br>A sitemap will be created automatically for any pages (if any) which are not created within the CWA. You should submit <CwaCode>/sitemap_index.xml</CwaCode> in your chosen search engine search consoles
              </p>
            </div>
            <CwaUiFormToggle
              v-model="allSettings.sitemapEnabled"
              label="Add CWA URLs to your sitemap"
            />
            <ModalInput
              v-model="allSettings.sitemapXml"
              label="Additional custom XML sitemap"
              type="textarea"
            />
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
                v-model="allSettings.robotsAllowNonSeoCrawlers"
                label="Allow Non-SEO Crawlers (Web Scrapers etc.)"
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
            <div
              v-if="showErrors && formErrors.robotsText"
              class="cwa:text-sm cwa:flex cwa:items-center cwa:gap-x-2 cwa:transition cwa:text-red-500 cwa:font-bold"
            >
              <p
                v-for="(error, index) of formErrors.robotsText"
                :key="`rtxterr-${index}`"
              >
                {{ error }}
              </p>
            </div>
            <div
              v-if="formWarnings.robotsText"
              class="cwa:text-sm cwa:flex-col cwa:items-center cwa:gap-y-2 cwa:transition cwa:text-yellow-500 cwa:font-bold"
            >
              <p
                v-for="(warning, index) of formWarnings.robotsText"
                :key="`rtxtwarn-${index}`"
              >
                {{ warning }}
              </p>
            </div>
          </div>
        </div>
        <hr class="cwa:my-8 cwa:text-stone-600"><div>
          <h2 class="cwa:text-xl cwa:mb-4">
            Maintenance
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
          :color="showSubmitErrorState ? 'error' : 'blue'"
          :disabled="submitDisabled"
          type="button"
          @click="processChanges"
        >
          Save Changes
        </CwaUiFormButton>
      </div>
      <div
        v-if="showSubmitErrorState"
        class="cwa:mt-2 cwa:text-sm cwa:flex cwa:items-center cwa:gap-x-2 cwa:transition cwa:text-red-500 cwa:font-bold"
      >
        <p>An error occurred while saving your changes</p>
      </div>
      <div
        :class="[showUpdateProgress ? 'opacity-100' : 'opacity-0']"
        class="cwa:mt-2 cwa:text-sm cwa:flex cwa:items-center cwa:gap-x-2 cwa:transition"
      >
        <Spinner show /><p>Processing updates {{ updatingCount - $cwa.siteConfig.totalRequests.value }} / {{ updatingCount }}</p>
      </div>
    </div>
  </ListContainer>
</template>

<script lang="ts" setup>
import { consola } from 'consola'
import { computed, onMounted, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import isEqual from 'lodash-es/isEqual'
import { asArray, parseRobotsTxt, validateRobots } from '#robots/util'
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import { definePageMeta, useCwa, useRequestURL } from '#imports'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'
import MenuLink from '#cwa/runtime/templates/components/main/admin/header/_parts/MenuLink.vue'
import type { SiteConfigParams } from '#cwa/module'
import CwaCode from '#cwa/runtime/templates/components/core/admin/CwaCode.vue'

const $cwa = useCwa()

const allSettings = ref<SiteConfigParams>()

const isDataChanged = computed(() => {
  return !isEqual(allSettings.value, $cwa.siteConfig.config)
})

const submitDisabled = computed(() => {
  return !isDataChanged.value || $cwa.siteConfig.isLoading || $cwa.siteConfig.totalRequests.value > 0
})

const apiVersion = ref('')
const showUpdateProgress = ref(false)
const updatingCount = ref(0)

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

const url = useRequestURL()
const currentHostDomain = computed(() => {
  return url.origin
})

const canonicalMismatch = computed(() => {
  const canonical = $cwa.siteConfig.config?.canonicalUrl
  if (!canonical) {
    return false
  }
  return canonical !== currentHostDomain.value
})

watchDebounced($cwa.siteConfig.totalRequests, (newTotal) => {
  showUpdateProgress.value = newTotal > 0
}, {
  debounce: 300,
})

const showErrors = ref(false)
const formErrors = ref<{ [property: string]: string[] }>({})
const formWarnings = ref<{ [property: string]: string[] }>({})

function validateRobotsTxt(robotsText: string) {
  clearErrorsAndWarnings('robotsText')
  const parsedRobotsTxt = parseRobotsTxt(robotsText)
  const { errors } = validateRobots(parsedRobotsTxt)
  if (errors.length > 0) {
    formErrors.value.robotsText = errors
  }
  // check if the robots.txt is blocking indexing
  const wildCardGroups = parsedRobotsTxt.groups.filter((group: any) => asArray(group.userAgent).includes('*'))
  if (wildCardGroups.some((group: any) => asArray(group.disallow).includes('/'))) {
    formWarnings.value.robotsText = [
      `The user defined robots.txt is blocking indexing for all environments.`,
      'It\'s recommended to use the `indexable` Site Config to toggle this instead.',
    ]
  }
}

function clearErrorsAndWarnings(prop: string) {
  delete formErrors.value[prop]
  delete formWarnings.value[prop]
}

watch(() => allSettings.value?.robotsText, (robotsText: string | undefined) => {
  if (!robotsText) {
    clearErrorsAndWarnings('robotsText')
    return
  }
  validateRobotsTxt(robotsText)
}, {
  immediate: true,
})

const hasClientSideErrors = computed(() => {
  return Object.values(formErrors.value).length > 0
})
const showSubmitErrorState = computed(() => {
  return $cwa.siteConfig.apiState.hasError.value || (showErrors.value && hasClientSideErrors.value)
})

async function processChanges() {
  if (!allSettings.value) return
  if (hasClientSideErrors.value) {
    showErrors.value = true
    consola.error(formErrors.value)
    return
  }
  const { totalConfigsChanged } = $cwa.siteConfig.saveConfig(allSettings.value)
  showUpdateProgress.value = totalConfigsChanged > 0
  updatingCount.value = totalConfigsChanged
}

onMounted(async () => {
  setApiVersion()
  allSettings.value = await $cwa.siteConfig.loadConfig()
  watch(() => $cwa.siteConfig.config, (newConfig) => {
    allSettings.value = { ...newConfig }
  }, {
    deep: true,
  })
})
</script>
