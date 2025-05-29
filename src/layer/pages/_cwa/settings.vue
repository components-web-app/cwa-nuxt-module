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
      <div>
        <h2 class="cwa:text-xl cwa:mb-4">
          General
        </h2>
        <div class="cwa:flex cwa:flex-col cwa:gap-y-4">
          <div>
            <ModalInput
              v-model="allSettings.defaultTitle"
              label="Default page title"
              type="text"
            />
            <div
              v-if="!allSettings.concatTitle"
              class="cwa:text-sm cwa:font-normal cwa:mt-2.5 cwa:text-stone-300"
            >
              <p>If you do not specify a page title, your default page title will be used instead</p>
            </div>
          </div>
          <div>
            <CwaUiFormToggle
              v-model="allSettings.concatTitle"
              label="Extend page titles with the default title"
            />
            <div
              v-if="allSettings.concatTitle"
              class="cwa:text-sm cwa:font-normal cwa:mt-2.5 cwa:text-stone-300"
            >
              <p><span>Page titles will be formatted as</span> <b class="cwa:border cwa:bg-dark/90 cwa:border-stone-700 cwa:rounded-lg cwa:px-1.5 cwa:py-1.5">[Page title]: [Default title]</b></p>
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
            v-model="allSettings.robotsAllowSearchEngineCrawlers"
            label="Allow Search Engine Crawlers"
          />
          <CwaUiFormToggle
            v-model="allSettings.robotsAllowAiBots"
            label="Allow Artificial Intelligence Bots"
          />
          <CwaUiFormToggle
            v-model="allSettings.robotsRemoveSitemap"
            label="Remove sitemap.xml from robots.txt"
          />
          <ModalInput
            v-model="allSettings.robotsText"
            label="Custom robots.txt"
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
            <MenuLink :to="apiPackagistLink">
              API: <span class="cwa:text-xs">{{ displayApiVersion }}</span>
            </MenuLink>
          </div>
        </div>
      </div>
      <hr class="cwa:my-8 cwa:text-stone-600">
      <div class="flex">
        <CwaUiFormButton
          color="blue"
          :disabled="!isDataChanged || isLoading"
        >
          Save Changes
        </CwaUiFormButton>
      </div>
    </div>
  </ListContainer>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useHead } from '#app'
import ListHeading from '#cwa/runtime/templates/components/core/admin/ListHeading.vue'
import { definePageMeta, useCwa } from '#imports'
import ListContainer from '#cwa/runtime/templates/components/core/admin/ListContainer.vue'
import Spinner from '#cwa/runtime/templates/components/utils/Spinner.vue'
import ModalInput from '#cwa/runtime/templates/components/core/admin/form/ModalInput.vue'
import MenuLink from '#cwa/runtime/templates/components/main/admin/header/_parts/MenuLink.vue'

const $cwa = useCwa()
const isLoading = ref(false)
const apiVersion = ref('')

useHead({
  title: 'Site Settings',
})

definePageMeta({
  name: '_cwa-settings',
  pageTransition: false,
})

type SiteConfigParams = {
  robotsAllowSearchEngineCrawlers: boolean
  robotsAllowAiBots: boolean
  robotsText: string
  robotsRemoveSitemap: boolean
  sitemapEnabled: boolean
  defaultTitle: string
  concatTitle: boolean
  maintenanceModeEnabled: boolean
}

const defaultSettings: SiteConfigParams = {
  robotsAllowSearchEngineCrawlers: true,
  robotsAllowAiBots: true,
  robotsText: '',
  robotsRemoveSitemap: false,
  sitemapEnabled: true,
  defaultTitle: '',
  concatTitle: true,
  maintenanceModeEnabled: false,
}

const allSettings = ref<SiteConfigParams>({ ...defaultSettings })
const cachedSettings = ref<SiteConfigParams>({ ...allSettings.value })
const loadedSettings = ref<Partial<SiteConfigParams>>({})

async function loadSettings() {
  isLoading.value = true
  try {
    const { response } = $cwa.fetch({ path: '/_/site_config_parameters' })
    const { _data: data } = await response
    if (data) {
      if (data['hydra:member'] && Array.isArray(data['hydra:member'])) {
        const loadedConfig: Partial<SiteConfigParams> = {}
        for (const configParam of data['hydra:member']) {
          loadedConfig[configParam.key as keyof SiteConfigParams] = configParam.value
        }
        loadedSettings.value = { ...loadedConfig }
        allSettings.value = Object.assign({}, defaultSettings, loadedConfig)
      }
    }
  }
  catch (e) {
    console.error(e)
  }
  isLoading.value = false
}

const isDataChanged = computed(() => {
  return JSON.stringify(allSettings.value) !== JSON.stringify(loadedSettings.value)
})

function updateSettingKeys(keys: (keyof SiteConfigParams)[]) {
  for (const changedKey of keys) {
    console.log('update', changedKey, allSettings.value[changedKey])
  }
}

const moduleLink = computed(() => {
  return `https://www.npmjs.com/package/${$cwa.currentModulePackageInfo.name}/v/${$cwa.currentModulePackageInfo.version}`
})

async function setApiVersion() {
  const docs = await $cwa.getApiDocumentation()
  const version = docs?.docs?.info.version
  console.log('version', version)
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

watch(allSettings, (newSettings) => {
  const oldSettings = cachedSettings.value
  const changedKeys: (keyof SiteConfigParams)[] = []
  for (const [newKey, newValue] of Object.entries(newSettings) as [keyof SiteConfigParams, any][]) {
    if (oldSettings[newKey] === undefined || newValue !== oldSettings[newKey]) {
      changedKeys.push(newKey)
    }
  }
  updateSettingKeys(changedKeys)
  cachedSettings.value = { ...newSettings }
}, {
  deep: true,
})

onMounted(() => {
  loadSettings()
  setApiVersion()
})
</script>
