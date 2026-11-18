<template>
  <ListHeading title="Site settings" />
  <div class="cwa:mx-auto cwa:w-full cwa:max-w-6xl cwa:px-4 cwa:pb-16 cwa:sm:px-8">
    <CwaUiAlert
      v-if="orphanNotice"
      tone="info"
      title="Orphaned resources discovered"
      data-testid="orphaned-notice"
      class="cwa:mb-section cwa:max-w-[40rem]"
    >
      <p class="cwa:m-0">
        {{ orphanNotice }}
      </p>
      <template #actions>
        <NuxtLink
          :to="{ name: '_cwa-orphaned' }"
          :class="linkButton"
        >
          Review now
        </NuxtLink>
      </template>
    </CwaUiAlert>
    <div
      v-if="loading"
      class="cwa:grid cwa:min-h-40 cwa:max-w-[40rem] cwa:place-items-center"
      aria-busy="true"
      data-testid="settings-loading"
    >
      <Spinner size="md" />
      <span class="cwa:sr-only">Loading settings</span>
    </div>
    <CwaUiAlert
      v-else-if="loadError || !local"
      tone="danger"
      title="The settings couldn't be loaded."
      data-testid="settings-load-error"
      class="cwa:max-w-[40rem]"
    >
      <p class="cwa:m-0">
        Nothing has changed. Check your connection, then try again.
      </p>
      <template #actions>
        <CwaUiButton
          label="Try again"
          data-testid="settings-retry"
          @click="load"
        />
      </template>
    </CwaUiAlert>
    <FormGroup
      v-else
      ref="group"
      :form="form"
      @save="save"
    >
      <CwaUiFormSection title="General">
        <CwaUiInput
          field="siteName"
          label="Site name"
          width="full"
        />
        <CwaUiToggle
          field="concatTitle"
          label="Extend page titles with the default title"
          :description="local.concatTitle ? 'Page titles are formatted as “Page title | Site name”.' : 'Page titles are formatted as “Page title”.'"
        />
        <CwaUiToggle
          field="fallbackTitle"
          label="Smart fallback page titles"
          :description="local.fallbackTitle ? 'A page without a title takes one from its address: /blog-articles becomes “Blog Articles”.' : 'A page without a title has no title at all.'"
        />
        <div class="cwa:flex cwa:flex-col cwa:gap-2">
          <CwaUiInput
            field="canonicalUrl"
            label="Canonical URL"
            type="url"
            inputmode="url"
            placeholder="https://your-site-domain.com"
            description="Your primary domain, with no redirects."
            width="full"
          />
          <CwaUiAlert
            v-if="canonicalMismatch"
            tone="warning"
            title="This isn't the address you're using now."
            data-testid="canonical-mismatch"
          >
            <p class="cwa:m-0">
              You're on <code class="cwa:font-mono">{{ currentHostDomain }}</code>. Make sure the canonical URL is your primary domain and does not redirect.
            </p>
          </CwaUiAlert>
        </div>
      </CwaUiFormSection>
      <CwaUiFormSection
        title="Sitemap"
        description="Pages not created in the CWA are added to the sitemap automatically. Submit /sitemap_index.xml to each search engine's console."
      >
        <CwaUiToggle
          field="sitemapEnabled"
          label="Add CWA URLs to your sitemap"
        />
        <CwaUiTextarea
          field="sitemapXml"
          label="Additional custom XML sitemap"
          optional
        />
      </CwaUiFormSection>
      <CwaUiFormSection title="Search engines">
        <CwaUiToggle
          field="indexable"
          label="Allow your website to be indexed"
        />
        <template v-if="local.indexable">
          <CwaUiToggle
            field="robotsAllowNonSeoCrawlers"
            label="Allow non-SEO crawlers (web scrapers and the like)"
          />
          <CwaUiToggle
            field="robotsAllowAiBots"
            label="Allow AI bots"
          />
        </template>
        <CwaUiToggle
          field="robotsRemoveSitemap"
          label="Remove sitemap.xml from robots.txt"
        />
        <div class="cwa:flex cwa:flex-col cwa:gap-2">
          <CwaUiTextarea
            field="robotsText"
            label="Additional custom robots.txt"
            optional
          />
          <CwaUiAlert
            v-if="robotsWarnings.length"
            tone="warning"
            :title="robotsWarnings[0]!"
            data-testid="robots-warning"
          >
            <p
              v-for="warning in robotsWarnings.slice(1)"
              :key="warning"
              class="cwa:m-0"
            >
              {{ warning }}
            </p>
          </CwaUiAlert>
        </div>
      </CwaUiFormSection>
      <CwaUiFormSection title="Maintenance">
        <CwaUiToggle
          field="maintenanceModeEnabled"
          label="Enable maintenance mode"
          :description="local.maintenanceModeEnabled ? 'Visitors are sent to a “website under maintenance” page, and crawlers get a status code saying it is temporary.' : undefined"
        />
      </CwaUiFormSection>
      <CwaUiFormSection
        :title="pageCacheEnabled ? 'Page cache' : 'Cached data'"
        data-testid="settings-cache"
      >
        <template v-if="pageCacheEnabled">
          <div class="cwa:flex cwa:flex-col cwa:gap-2 cwa:text-control cwa:text-fg-secondary">
            <p class="cwa:m-0">
              Visitors are served a cached copy of each page. Purging drops every cached page at once, and each one is rebuilt the next time it is visited. No content is lost. You do not need to do this after ordinary edits, because those refresh the cache automatically.
            </p>
            <p class="cwa:m-0">
              Warming loads every public page into the cache ahead of visitors, for example after a purge.
            </p>
          </div>
          <div class="cwa:flex cwa:flex-wrap cwa:gap-actions">
            <CwaUiButton
              :label="purgingPageCache ? 'Purging…' : 'Purge page cache'"
              :loading="purgingPageCache"
              data-testid="purge-page-cache"
              @click="purgePageCache"
            />
            <CwaUiButton
              :label="warmPageCacheLabel"
              :loading="warmingPageCache"
              data-testid="warm-page-cache"
              @click="warmPageCache"
            />
          </div>
          <CwaUiAlert
            v-if="purgePageCacheResult"
            :tone="purgePageCacheResult.success ? 'success' : 'danger'"
            :title="purgePageCacheResult.success ? 'The page cache has been purged. Pages will be rebuilt as they are next visited.' : purgePageCacheResult.message"
            data-testid="purge-page-cache-result"
          />
          <CwaUiAlert
            v-if="warmPageCacheResult"
            :tone="warmPageCacheResult.success ? 'success' : 'danger'"
            :title="warmPageCacheResult.message"
            data-testid="warm-page-cache-result"
          />
        </template>
        <p class="cwa:m-0 cwa:text-control cwa:text-fg-secondary">
          <span>Purging all cached data is a last resort: every page is slow until it has been rendered again. After data has been changed outside the admin, purge the pages it affects from each page's settings instead.</span>
          <span v-if="!pageCacheEnabled">&nbsp;Pages are rendered fresh on every visit in this configuration, so this purges the API cache only.</span>
        </p>
        <div class="cwa:flex cwa:flex-wrap cwa:gap-actions">
          <CwaUiButton
            tone="danger"
            :label="purgingHttpCache ? 'Purging all cached data…' : 'Purge all cached data'"
            :loading="purgingHttpCache"
            data-testid="purge-http-cache"
            @click="purgeHttpCache"
          />
          <CwaUiButton
            v-if="pageCacheEnabled && purgeHttpCacheResult?.success"
            :label="warmingPageCache ? warmPageCacheLabel : 'Warm page cache now'"
            :loading="warmingPageCache"
            data-testid="warm-page-cache-now"
            @click="warmPageCache"
          />
        </div>
        <CwaUiAlert
          v-if="purgeHttpCacheResult"
          :tone="purgeHttpCacheResult.success ? 'success' : 'danger'"
          :title="purgeHttpCacheResult.success ? 'All cached data has been purged. Pages will be slow until they have been rendered again.' : purgeHttpCacheResult.message"
          data-testid="purge-http-cache-result"
        />
      </CwaUiFormSection>
      <CwaUiFormSection
        title="Orphaned resources"
        description="A scan finds component groups, component positions and components that are no longer used anywhere on the site. A file scan finds uploaded files nothing uses any more, and resources whose file is missing from storage; it is separate because listing storage can be slow. Scanning never deletes anything; you can review what it finds and choose what to delete."
        data-testid="orphaned-settings"
      >
        <dl
          v-if="orphanReport !== undefined || fileReport !== undefined"
          class="cwa:m-0 cwa:grid cwa:grid-cols-[auto_1fr] cwa:gap-x-4 cwa:gap-y-1 cwa:text-control"
          data-testid="orphaned-last-scans"
        >
          <template v-if="orphanReport !== undefined">
            <dt class="cwa:text-fg-muted">
              Components
            </dt>
            <dd class="cwa:m-0 cwa:text-fg">
              {{ orphanReport ? `Last scanned ${formatDateTime(orphanReport.generatedAt)}` : 'Never scanned' }}
            </dd>
          </template>
          <template v-if="fileReport !== undefined">
            <dt class="cwa:text-fg-muted">
              Files
            </dt>
            <dd class="cwa:m-0 cwa:text-fg">
              {{ fileReport ? `Last scanned ${formatDateTime(fileReport.generatedAt)}` : 'Never scanned' }}
            </dd>
          </template>
        </dl>
        <div class="cwa:flex cwa:flex-wrap cwa:gap-actions">
          <CwaUiButton
            :label="scanningOrphans ? 'Scanning…' : 'Scan now'"
            :loading="scanningOrphans"
            data-testid="scan-orphans"
            @click="scanOrphans"
          />
          <CwaUiButton
            :label="scanningFiles ? 'Scanning…' : 'Scan files'"
            :loading="scanningFiles"
            data-testid="scan-files"
            @click="scanFiles"
          />
          <NuxtLink
            :to="{ name: '_cwa-orphaned' }"
            :class="linkButton"
          >
            Review orphaned resources
          </NuxtLink>
        </div>
        <CwaUiAlert
          v-if="orphanScanPending || fileScanPending"
          tone="info"
          title="The scan has been requested but has not finished yet."
          data-testid="orphaned-scan-pending"
        >
          <p class="cwa:m-0">
            Reload this page in a moment to see the new report.
          </p>
        </CwaUiAlert>
        <CwaUiAlert
          v-if="orphanScanError || fileScanError"
          tone="danger"
          :title="(orphanScanError || fileScanError)!"
          data-testid="orphaned-scan-error"
        />
      </CwaUiFormSection>
      <CwaUiFormSection title="CWA version">
        <dl class="cwa:m-0 cwa:grid cwa:grid-cols-[auto_1fr] cwa:gap-x-4 cwa:gap-y-1 cwa:text-control">
          <dt class="cwa:text-fg-muted">
            App
          </dt>
          <dd class="cwa:m-0">
            <a
              :href="moduleLink"
              target="_blank"
              rel="noopener"
              :class="textLink"
              data-testid="version-app"
            >{{ displayAppVersion }}</a>
          </dd>
          <dt class="cwa:text-fg-muted">
            API
          </dt>
          <dd class="cwa:m-0">
            <a
              :href="apiPackagistLink"
              target="_blank"
              rel="noopener"
              :class="textLink"
              data-testid="version-api"
            >{{ displayApiVersion || 'Unknown' }}</a>
          </dd>
        </dl>
      </CwaUiFormSection>
    </FormGroup>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import ListHeading from '#cwa/templates/components/core/admin/ListHeading.vue'
import FormGroup from '#cwa/templates/components/core/ui/FormGroup.vue'
import CwaUiFormSection from '#cwa/templates/components/ui/FormSection.vue'
import CwaUiInput from '#cwa/templates/components/ui/Input.vue'
import CwaUiToggle from '#cwa/templates/components/ui/Toggle.vue'
import CwaUiTextarea from '#cwa/templates/components/ui/Textarea.vue'
import CwaUiAlert from '#cwa/templates/components/ui/Alert.vue'
import CwaUiButton from '#cwa/templates/components/ui/Button.vue'
import Spinner from '#cwa/templates/components/ui/Spinner.vue'
import { buttonLooks } from '#cwa/templates/components/ui/kit-looks'
import { useCwaConfirm } from '#cwa/composables/cwa-confirm'
import { definePageMeta, useCwa, useRequestURL, useHead } from '#imports'
import { resolvePageCacheOptions } from '#cwa/api/http-cache'
import { PageCacheWarmInterruptedError } from '#cwa/api/page-cache-warm'
import type { PageCacheWarmFailure, PageCacheWarmProgress, PageCacheWarmSummary } from '#cwa/api/page-cache-warm'
import { options } from '#build/cwa-options'
import { formatDateTime } from '#cwa/resources/date-time-input'
import { useOrphanedFileReport, useOrphanedResourceReport } from '#cwa-layer/_composables/useOrphanReport'
import { useSiteSettingsForm } from '#cwa-layer/_composables/useSiteSettingsForm'

const $cwa = useCwa()
const confirm = useCwaConfirm()
const group = useTemplateRef<InstanceType<typeof FormGroup>>('group')

const focusRing = 'cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:outline-offset-2 cwa:focus-visible:outline-accent-fg'
const linkButton = `cwa:inline-flex cwa:h-control cwa:items-center cwa:px-4 cwa:text-label cwa:no-underline cwa:transition-colors cwa:duration-(--cwa-duration-fast) ${buttonLooks.soft.accent.rest} ${buttonLooks.soft.accent.hover} ${focusRing}`
const textLink = `cwa:font-mono cwa:text-fg cwa:underline cwa:underline-offset-2 ${focusRing}`

const { form, local, loading, loadError, load, save, robotsWarnings } = useSiteSettingsForm()

const {
  report: orphanReport,
  orphanCount,
  scanError: orphanScanError,
  scanning: scanningOrphans,
  scanPending: orphanScanPending,
  loadReport: loadOrphanReport,
  scan: scanOrphans,
} = useOrphanedResourceReport()

const {
  report: fileReport,
  orphanCount: fileOrphanCount,
  missingCount: missingFileCount,
  invalidCount: invalidFileCount,
  scanError: fileScanError,
  scanning: scanningFiles,
  scanPending: fileScanPending,
  loadReport: loadFileReport,
  scan: scanFiles,
} = useOrphanedFileReport()

function countLabel(count: number, noun: string) {
  return count ? `${count} ${noun}${count === 1 ? '' : 's'}` : undefined
}

const orphanNotice = computed(() => {
  const unused = [countLabel(orphanCount.value, 'resource'), countLabel(fileOrphanCount.value, 'file')].filter(Boolean)
  const sentences: string[] = []
  if (unused.length) {
    sentences.push(`${unused.join(' and ')} ${orphanCount.value + fileOrphanCount.value === 1 ? 'is' : 'are'} no longer used anywhere on the site.`)
  }
  if (missingFileCount.value) {
    sentences.push(`${countLabel(missingFileCount.value, 'file')} ${missingFileCount.value === 1 ? 'is' : 'are'} missing from storage.`)
  }
  if (invalidFileCount.value) {
    sentences.push(`${countLabel(invalidFileCount.value, 'file')} ${invalidFileCount.value === 1 ? 'no longer meets its' : 'no longer meet their'} upload rules.`)
  }
  return sentences.join(' ')
})

const apiVersion = ref('')

const moduleLink = computed(() => `https://www.npmjs.com/package/${$cwa.currentModulePackageInfo.name}/v/${$cwa.currentModulePackageInfo.version}`)

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
  apiVersion.value = matches ? (matches[1] || version) : version
}

function truncateVersion(version: string) {
  return version.length > 9
    ? `${version.substring(0, 3)}..${version.substring(version.length - 4)}`
    : version
}

const displayApiVersion = computed(() => {
  if (!apiVersion.value) {
    return ''
  }
  const unstablePostfix = apiVersion.value.substring(0, 3) === 'dev' ? ' (unstable)' : ''
  return truncateVersion(apiVersion.value) + unstablePostfix
})

const apiPackagistLink = computed(() => `https://packagist.org/packages/components-web-app/api-components-bundle#${apiVersion.value.split('@')[0]}`)

const displayAppVersion = computed(() => {
  const { name, version } = $cwa.currentModulePackageInfo
  return truncateVersion(version) + (name.endsWith('edge') ? ' (unstable)' : '')
})

const url = useRequestURL()
const currentHostDomain = computed(() => url.origin)

const canonicalMismatch = computed(() => {
  const canonical = $cwa.siteConfig.config?.canonicalUrl
  return !!canonical && canonical !== currentHostDomain.value
})

function announce(text: string) {
  group.value?.announce(text)
}

const pageCacheEnabled = resolvePageCacheOptions(options.pageCache).enabled
const purgingPageCache = ref(false)
const purgePageCacheResult = ref<{ success: true } | { success: false, message: string }>()

function statusOf(error: unknown) {
  return (error as { statusCode?: number } | undefined)?.statusCode
}

function purgePageCacheFailureMessage(error: unknown) {
  const statusCode = statusOf(error)
  if (statusCode === 401 || statusCode === 403) {
    return 'The page cache could not be purged: your account does not have permission to do this.'
  }
  return `The page cache could not be purged (${statusCode || 'network error'}). Please try again.`
}

async function purgePageCache() {
  if (purgingPageCache.value || !await confirm({
    title: 'Purge the page cache?',
    description: 'Every cached page will be dropped at once and rebuilt on its next visit, so the site may be slower for a short while. No content will be lost.',
    keep: 'Don\'t purge',
    go: 'Purge page cache',
  })) {
    return
  }
  purgePageCacheResult.value = undefined
  purgingPageCache.value = true
  try {
    await $cwa.siteConfig.purgePageCache()
    purgePageCacheResult.value = { success: true }
    announce('The page cache has been purged.')
  }
  catch (error) {
    const message = purgePageCacheFailureMessage(error)
    purgePageCacheResult.value = { success: false, message }
    announce(message)
  }
  finally {
    purgingPageCache.value = false
  }
}

const purgingHttpCache = ref(false)
const purgeHttpCacheResult = ref<{ success: true } | { success: false, message: string }>()

function purgeHttpCacheFailureMessage(error: unknown) {
  const statusCode = statusOf(error)
  if (statusCode === 501) {
    return 'Nothing was purged. This deployment\'s cache cannot be flushed.'
  }
  if (statusCode === 401 || statusCode === 403) {
    return 'The cache could not be purged: your account does not have permission to do this.'
  }
  return `The cache could not be purged (${statusCode || 'network error'}). Please try again.`
}

async function purgeHttpCache() {
  if (purgingHttpCache.value || !await confirm({
    title: 'Purge all cached data?',
    lines: [
      { text: 'Everything the API has cached will be dropped at once, along with every cached page, and every page will be slow until it has been rendered again.', emphasis: 'strong' },
      { text: 'To refresh one page, use Purge this page\'s cache in that page\'s settings instead. Ordinary edits are purged for you, and no content will be lost.', emphasis: 'muted' },
    ],
    keep: 'Don\'t purge',
    go: 'Purge all cached data',
  })) {
    return
  }
  purgeHttpCacheResult.value = undefined
  purgingHttpCache.value = true
  try {
    await $cwa.siteConfig.purgeHttpCache()
    purgeHttpCacheResult.value = { success: true }
    announce('All cached data has been purged.')
  }
  catch (error) {
    const message = purgeHttpCacheFailureMessage(error)
    purgeHttpCacheResult.value = { success: false, message }
    announce(message)
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
  const statusCode = statusOf(error)
  if (statusCode === 401 || statusCode === 403) {
    return 'The page cache could not be warmed: your account does not have permission to do this.'
  }
  if (statusCode === 409) {
    return 'The page cache is already being warmed on this server. Please wait for it to finish.'
  }
  return `The page cache could not be warmed (${statusCode || 'network error'}). Please try again.`
}

async function warmPageCache() {
  if (warmingPageCache.value || !await confirm({
    title: 'Warm the page cache?',
    description: 'Every public page will be loaded and stored in the page cache, so visitors get fast responses straight away. Pages are loaded a few at a time, which can take a few minutes on a large site. Keep this page open until it finishes.',
    keep: 'Don\'t warm',
    go: 'Warm page cache',
    tone: 'accent',
  })) {
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
    warmPageCacheResult.value && announce(warmPageCacheResult.value.message)
  }
}

onMounted(() => {
  setApiVersion()
  loadOrphanReport()
  loadFileReport()
  load()
})
</script>
