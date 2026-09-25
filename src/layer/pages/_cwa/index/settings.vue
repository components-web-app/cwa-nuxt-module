<template>
  <ListHeading
    title="Site settings"
    hide-add
  />
  <ListContainer class="cwa:relative cwa:py-10">
    <CwaUiAlertInfo
      v-if="orphanCount"
      data-testid="orphaned-notice"
      class="cwa:mb-8 cwa:justify-between cwa:gap-x-4"
    >
      <span class="cwa:grow">Orphaned resources discovered: {{ orphanCount }} {{ orphanCount === 1 ? 'resource is' : 'resources are' }} no longer used anywhere on the site.</span>
      <CwaUiFormButton :to="{ name: '_cwa-orphaned' }">
        Review now
      </CwaUiFormButton>
    </CwaUiAlertInfo>
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
                  class="cwa:text-danger cwa:font-bold"
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
                class="cwa:text-danger cwa:font-bold cwa:text-sm cwa:mt-2"
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
              class="cwa:text-sm cwa:flex cwa:items-center cwa:gap-x-2 cwa:transition cwa:text-danger cwa:font-bold"
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
          <h2 class="cwa:text-xl cwa:mb-4">
            {{ pageCacheEnabled ? 'Page cache' : 'Cached data' }}
          </h2>
          <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
            <template v-if="pageCacheEnabled">
              <p class="cwa:text-sm cwa:text-stone-400">
                Visitors are served a cached copy of each page. Purging drops every cached page at once, and each one is rebuilt the next time it is visited. No content is lost. You do not need to do this after ordinary edits, because those refresh the cache automatically.
              </p>
              <p class="cwa:text-sm cwa:text-stone-400">
                Warming loads every public page into the cache ahead of visitors, for example after a purge.
              </p>
              <div class="cwa:flex cwa:flex-wrap cwa:gap-4">
                <CwaUiFormButton
                  :disabled="purgingPageCache"
                  type="button"
                  @click="purgePageCache"
                >
                  {{ purgingPageCache ? 'Purging…' : 'Purge page cache' }}
                </CwaUiFormButton>
                <CwaUiFormButton
                  :disabled="warmingPageCache"
                  type="button"
                  @click="warmPageCache"
                >
                  {{ warmPageCacheLabel }}
                </CwaUiFormButton>
              </div>
              <p
                v-if="purgePageCacheResult?.success"
                class="cwa:text-sm cwa:font-bold"
              >
                The page cache has been purged. Pages will be rebuilt as they are next visited.
              </p>
              <p
                v-else-if="purgePageCacheResult"
                class="cwa:text-sm cwa:text-danger cwa:font-bold"
              >
                {{ purgePageCacheResult.message }}
              </p>
              <p
                v-if="warmPageCacheResult"
                class="cwa:text-sm cwa:font-bold"
                :class="{ 'cwa:text-danger': !warmPageCacheResult.success }"
              >
                {{ warmPageCacheResult.message }}
              </p>
            </template>
            <p class="cwa:text-sm cwa:text-stone-400">
              <span>Purging all cached data also drops everything the API has cached, for use after data has been changed outside the admin.</span>
              <span v-if="!pageCacheEnabled">&nbsp;Pages are rendered fresh on every visit in this configuration, so this purges the API cache only.</span>
            </p>
            <div class="cwa:flex cwa:flex-wrap cwa:gap-4">
              <CwaUiFormButton
                :disabled="purgingHttpCache"
                type="button"
                @click="purgeHttpCache"
              >
                {{ purgingHttpCache ? 'Purging all cached data…' : 'Purge all cached data' }}
              </CwaUiFormButton>
              <CwaUiFormButton
                v-if="pageCacheEnabled && purgeHttpCacheResult?.success"
                :disabled="warmingPageCache"
                type="button"
                @click="warmPageCache"
              >
                {{ warmingPageCache ? warmPageCacheLabel : 'Warm page cache now' }}
              </CwaUiFormButton>
            </div>
            <p
              v-if="purgeHttpCacheResult?.success"
              class="cwa:text-sm cwa:font-bold"
            >
              All cached data has been purged. Pages will be slow until they have been rendered again.
            </p>
            <p
              v-else-if="purgeHttpCacheResult"
              class="cwa:text-sm cwa:text-danger cwa:font-bold"
            >
              {{ purgeHttpCacheResult.message }}
            </p>
          </div>
        </div>
        <hr class="cwa:my-8 cwa:text-stone-600">
        <div data-testid="orphaned-settings">
          <h2 class="cwa:text-xl cwa:mb-4">
            Orphaned resources
          </h2>
          <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
            <p class="cwa:text-sm cwa:text-stone-400">
              A scan finds component groups, component positions and components that are no longer used anywhere on the site. Scanning never deletes anything; you can review what it finds and choose what to delete.
            </p>
            <p
              v-if="orphanReport !== undefined"
              class="cwa:text-sm cwa:font-bold"
            >
              {{ orphanReport ? `Last scanned ${formatDateTime(orphanReport.generatedAt)}` : 'Never scanned' }}
            </p>
            <div class="cwa:flex cwa:flex-wrap cwa:gap-4">
              <CwaUiFormButton
                :disabled="scanningOrphans"
                type="button"
                @click="scanOrphans"
              >
                {{ scanningOrphans ? 'Scanning…' : 'Scan now' }}
              </CwaUiFormButton>
              <CwaUiFormButton :to="{ name: '_cwa-orphaned' }">
                Review orphaned resources
              </CwaUiFormButton>
            </div>
            <p
              v-if="orphanScanPending"
              class="cwa:text-sm cwa:font-bold"
            >
              The scan has been requested but has not finished yet. Reload this page in a moment to see the new report.
            </p>
            <p
              v-if="orphanScanError"
              class="cwa:text-sm cwa:text-danger cwa:font-bold"
            >
              {{ orphanScanError }}
            </p>
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
        class="cwa:mt-2 cwa:text-sm cwa:flex cwa:items-center cwa:gap-x-2 cwa:transition cwa:text-danger cwa:font-bold"
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
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import { definePageMeta, useCwa, useRequestURL, useHead } from '#imports'
import ListContainer from '#cwa/templates/components/core/admin/ListContainer.vue'
import Spinner from '#cwa/templates/components/utils/Spinner.vue'
import ModalInput from '#cwa/templates/components/core/admin/form/ModalInput.vue'
import MenuLink from '#cwa/templates/components/main/admin/header/_parts/MenuLink.vue'
import type { SiteConfigParams } from '#cwa/types'
import CwaCode from '#cwa/templates/components/core/admin/CwaCode.vue'
import { createConfirmDialog } from 'vuejs-confirm-dialog'
import ConfirmDialog from '#cwa/templates/components/core/ConfirmDialog.vue'
import { resolvePageCacheOptions } from '#cwa/api/http-cache'
import { PageCacheWarmInterruptedError } from '#cwa/api/page-cache-warm'
import type { PageCacheWarmFailure, PageCacheWarmProgress, PageCacheWarmSummary } from '#cwa/api/page-cache-warm'
import { options } from '#build/cwa-options'
import { formatDateTime } from '#cwa/resources/date-time-input'
import { useOrphanedResourceReport } from '#cwa-layer/_composables/useOrphanedResourceReport'

const $cwa = useCwa()

const {
  report: orphanReport,
  orphanCount,
  scanError: orphanScanError,
  scanning: scanningOrphans,
  scanPending: orphanScanPending,
  loadReport: loadOrphanReport,
  scan: scanOrphans,
} = useOrphanedResourceReport()

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
    apiVersion.value = ''
    return
  }
  const matches: RegExpMatchArray | null = version.match(/ \(([a-zA-Z0-9\-@]+)\)$/)
  if (!matches) {
    apiVersion.value = version
    return
  }
  apiVersion.value = matches[1] || version
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

const pageCacheEnabled = resolvePageCacheOptions(options.pageCache).enabled
const purgingPageCache = ref(false)
const purgePageCacheResult = ref<{ success: true } | { success: false, message: string }>()

function purgePageCacheFailureMessage(error: unknown) {
  const statusCode = (error as { statusCode?: number } | undefined)?.statusCode
  if (statusCode === 401 || statusCode === 403) {
    return 'The page cache could not be purged: your account does not have permission to do this.'
  }
  return `The page cache could not be purged (${statusCode || 'network error'}). Please try again.`
}

async function purgePageCache() {
  const dialog = createConfirmDialog(ConfirmDialog as Parameters<typeof createConfirmDialog>[0])
  const { isCanceled } = await dialog.reveal({
    title: 'Purge the page cache?',
    content: '<p>Every cached page will be dropped at once and rebuilt on its next visit, so the site may be slower for a short while. No content will be lost.</p>',
  })
  if (isCanceled) {
    return
  }
  purgePageCacheResult.value = undefined
  purgingPageCache.value = true
  try {
    await $cwa.siteConfig.purgePageCache()
    purgePageCacheResult.value = { success: true }
  }
  catch (error) {
    purgePageCacheResult.value = { success: false, message: purgePageCacheFailureMessage(error) }
  }
  finally {
    purgingPageCache.value = false
  }
}

const purgingHttpCache = ref(false)
const purgeHttpCacheResult = ref<{ success: true } | { success: false, message: string }>()

function purgeHttpCacheFailureMessage(error: unknown) {
  const statusCode = (error as { statusCode?: number } | undefined)?.statusCode
  if (statusCode === 501) {
    return 'Nothing was purged. This deployment\'s cache cannot be flushed.'
  }
  if (statusCode === 401 || statusCode === 403) {
    return 'The cache could not be purged: your account does not have permission to do this.'
  }
  return `The cache could not be purged (${statusCode || 'network error'}). Please try again.`
}

async function purgeHttpCache() {
  const dialog = createConfirmDialog(ConfirmDialog as Parameters<typeof createConfirmDialog>[0])
  const { isCanceled } = await dialog.reveal({
    title: 'Purge all cached data?',
    content: '<p>Everything the API has cached will be dropped at once, along with every cached page. Use this after data has been changed outside the admin — ordinary edits are purged for you. Pages will be slow until they have been rendered again, and no content will be lost.</p>',
  })
  if (isCanceled) {
    return
  }
  purgeHttpCacheResult.value = undefined
  purgingHttpCache.value = true
  try {
    await $cwa.siteConfig.purgeHttpCache()
    purgeHttpCacheResult.value = { success: true }
  }
  catch (error) {
    purgeHttpCacheResult.value = { success: false, message: purgeHttpCacheFailureMessage(error) }
  }
  finally {
    purgingHttpCache.value = false
  }
}

const warmingPageCache = ref(false)
const warmPageCacheProgress = ref<PageCacheWarmProgress>()
const warmPageCacheResult = ref<{ success: boolean, message: string }>()

const warmPageCacheLabel = computed(() => {
  if (!warmingPageCache.value) {
    return 'Warm page cache'
  }
  const progress = warmPageCacheProgress.value
  return progress ? `Warming… ${progress.completed} of ${progress.total}` : 'Warming…'
})

function describeWarmFailure(failure: PageCacheWarmFailure) {
  if (failure.error === 'timeout') {
    return `${failure.path} (timed out)`
  }
  if (failure.error === 'network') {
    return failure.detail ? `${failure.path} (no response: ${failure.detail})` : `${failure.path} (no response)`
  }
  return failure.location ? `${failure.path} (${failure.status} → ${failure.location})` : `${failure.path} (${failure.status})`
}

function warmPageCacheSummaryResult(summary: PageCacheWarmSummary) {
  if (!summary.failed.length) {
    return { success: true, message: `The page cache has been warmed. All ${summary.total} pages were loaded.` }
  }
  return { success: false, message: `${summary.total} pages were checked, but ${summary.failed.length} could not be warmed: ${summary.failed.map(describeWarmFailure).join(', ')}.` }
}

function warmPageCacheFailureMessage(error: unknown) {
  if (error instanceof PageCacheWarmInterruptedError) {
    return `Warming stopped before it finished (${error.progress.completed} of ${error.progress.total} pages). Please try again.`
  }
  const statusCode = (error as { statusCode?: number } | undefined)?.statusCode
  if (statusCode === 401 || statusCode === 403) {
    return 'The page cache could not be warmed: your account does not have permission to do this.'
  }
  if (statusCode === 409) {
    return 'The page cache is already being warmed on this server. Please wait for it to finish.'
  }
  return `The page cache could not be warmed (${statusCode || 'network error'}). Please try again.`
}

async function warmPageCache() {
  const dialog = createConfirmDialog(ConfirmDialog as Parameters<typeof createConfirmDialog>[0])
  const { isCanceled } = await dialog.reveal({
    title: 'Warm the page cache?',
    content: '<p>Every public page will be loaded and stored in the page cache, so visitors get fast responses straight away. Pages are loaded a few at a time, which can take a few minutes on a large site. Keep this page open until it finishes.</p>',
  })
  if (isCanceled) {
    return
  }
  warmPageCacheResult.value = undefined
  warmPageCacheProgress.value = undefined
  warmingPageCache.value = true
  try {
    const summary = await $cwa.siteConfig.warmPageCache((progress) => {
      warmPageCacheProgress.value = progress
    })
    warmPageCacheResult.value = warmPageCacheSummaryResult(summary)
  }
  catch (error) {
    warmPageCacheResult.value = { success: false, message: warmPageCacheFailureMessage(error) }
  }
  finally {
    warmingPageCache.value = false
  }
}

async function processChanges() {
  if (!allSettings.value) return
  if (hasClientSideErrors.value) {
    showErrors.value = true
    consola.error(formErrors.value)
    return
  }
  const { totalConfigsChanged } = await $cwa.siteConfig.saveConfig(allSettings.value)
  showUpdateProgress.value = totalConfigsChanged > 0
  updatingCount.value = totalConfigsChanged
}

onMounted(async () => {
  setApiVersion()
  loadOrphanReport()
  allSettings.value = await $cwa.siteConfig.loadConfig()
  watch(() => $cwa.siteConfig.config, (newConfig) => {
    allSettings.value = { ...newConfig }
  }, {
    deep: true,
  })
})
</script>
