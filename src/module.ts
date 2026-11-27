import { join } from 'path'
import path from 'node:path'
import { statSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { defu } from 'defu'
import {
  addComponent,
  addImports,
  addImportsDir,
  addPlugin,
  addRouteMiddleware,
  addServerHandler,
  addServerTemplate,
  addTemplate,
  addTypeTemplate,
  addVitePlugin,
  createResolver,
  defineNuxtModule,
  extendPages,
  resolveAlias,
  updateTemplates,
  useLogger,
  extendRouteRules,
  addServerPlugin,
  hasNuxtModule,
  tryResolveModule,
} from '@nuxt/kit'
import type { Component, ModuleDependencies, Nuxt, NuxtPage, ViteConfig } from '@nuxt/schema'
import { READINESS_DEFAULTS } from './runtime/server/readiness'
import { defaultSiteConfig } from './runtime/composables/useCwaSiteConfig'
import { unknownTopBarIds } from './runtime/admin/top-bar'
import { scanComponentGroupDeclarations } from './component-group-declarations'
import { scanCwaConfigDeclarations } from './cwa-config-declarations'
import { adminResourcesTemplate, lucideIconSvg, lucideNamesTypeTemplate } from './admin-resources'
import type { LucideIconSet } from './admin-resources'
import { addExtensionAdminPages, adminShellRoles, checkExtensions, extensionAdminRoles, extensionAreas, extensionPageDataTemplate, extensionPageRoles, extensionRouteRules } from './extensions'
import type { CwaExtension, ExtensionNames } from './extensions'
import type { CwaModuleOptions, CwaResourcesConfig, CwaResourcesMeta, CwaStyleClasses, CwaStyles, CwaUiVariantConfig, GlobalComponentNames } from './runtime/types'

export type { CwaExtension, CwaExtensionAdminPage, CwaExtensionPageDataList, CwaExtensionPageDataTab } from './extensions'
export type { CwaFieldDescriptor } from './runtime/templates/components/core/ui/field-descriptors'

declare module 'nuxt/schema' {
  interface NuxtHooks {
    'cwa:extend': (register: (extension: CwaExtension) => void) => void | Promise<void>
  }
  interface PublicRuntimeConfig {
    cwa: {
      apiUrl: string
      apiUrlBrowser: string
    }
  }
  interface RuntimeConfig {
    cwa: {
      apiUrl: string
      pageCacheWarm: {
        concurrency: number
        timeout: number
        origin: string
      }
      readiness: {
        path: string
        timeout: number
      }
    }
  }
}

const CWA_PAGE_ROUTE_KEY = 'cwa-page'

function createDefaultCwaPages(
  pages: NuxtPage[],
  pageComponentFilePath: string,
  maxDepth: number,
  layout?: string | undefined,
) {
  const segments: string[] = []
  for (let depth = 0; depth <= maxDepth; depth++) {
    if (depth > 0) {
      segments.push(`:cwaPage${depth}`)
    }
    pages.push({
      name: `cwaPage${depth}`,
      path: `/${segments.join('/')}`,
      file: pageComponentFilePath,
      meta: {
        cwa: {
          disabled: false,
        },
        layout: layout || 'cwa-root-layout',
        key: CWA_PAGE_ROUTE_KEY,
      },
    })
  }
}

export const NAME = '@cwa/nuxt' as const

const BUILT_IN_RESOURCES_CONFIG: CwaResourcesConfig = {
  ComponentPosition: {
    name: 'Position',
    description: 'Dynamic components can be used on dynamic pages to specify what component should be displayed from a data page in any given location.\n\nYou must select the reference from the data page to load into this position below.',
    instantAdd: true,
  },
  ComponentGroup: {
    name: 'Group',
  },
  Form: {
    name: 'Form',
    description: 'A form from the API, shown as a list of its text fields unless a UI variant lays it out.',
  },
}

const BUILT_IN_RENDERERS = {
  Form: './runtime/templates/components/resources/Form/Form.vue',
} as const

const OG_IMAGE_RENDERER_PACKAGES = ['satori', '@resvg/resvg-js'] as const

const ogImageModuleDependency: ModuleDependencies = {
  'nuxt-og-image': {
    version: '^7.0',
  },
}

const baseModuleDependencies: ModuleDependencies = {
  '@pinia/nuxt': {
    version: '^1.0.2',
    optional: false,
  },
  '@nuxtjs/robots': {
    version: '^7.0',
  },
  '@nuxtjs/sitemap': {
    version: '^9.0.1',
    optional: false,
    defaults: {
      cacheMaxAgeSeconds: 0,
      sitemaps: {
        cwa: {
          sources: ['/__sitemap__/cwa-urls'],
          chunks: true,
        },
      },
    },
  },
  'nuxt-link-checker': {
    version: '^6.0',
  },
  'nuxt-schema-org': {
    version: '^7.0',
  },
  'nuxt-seo-utils': {
    version: '^9.0',
  },
  'nuxt-site-config': {
    version: '^5.0.1',
  },
}

async function hasOgImageRenderer(nuxt: Nuxt): Promise<boolean> {
  const resolved = await Promise.all(
    OG_IMAGE_RENDERER_PACKAGES.map(id => tryResolveModule(id, nuxt.options.modulesDir)),
  )
  return resolved.every(Boolean)
}

export default defineNuxtModule<CwaModuleOptions>({
  moduleDependencies: async (nuxt: Nuxt): Promise<ModuleDependencies> => (
    await hasOgImageRenderer(nuxt)
      ? { ...baseModuleDependencies, ...ogImageModuleDependency }
      : baseModuleDependencies
  ),
  meta: {
    name: NAME,
    configKey: 'cwa',
    compatibility: {
      nuxt: '>=4.6.0',
    },
  },
  defaults: {
    storeName: 'cwa',
    siteConfig: defaultSiteConfig,
  },
  async setup(options, nuxt) {
    const logger = useLogger(NAME)
    const { resolve } = createResolver(import.meta.url)

    const { version, name } = JSON.parse(
      readFileSync(resolve('../package.json'), 'utf8'),
    )
    logger.info(`Adding ${NAME} module (${name}@${version})...`)

    if (!await hasOgImageRenderer(nuxt)) {
      logger.warn(`${NAME}: open graph image generation is disabled. Install ${OG_IMAGE_RENDERER_PACKAGES.join(' and ')} to enable it.`)
    }

    nuxt.options.runtimeConfig.public.cwa = defu(nuxt.options.runtimeConfig.public.cwa, {
      apiUrl: '',
      apiUrlBrowser: '',
    })

    // common alias due to releasing different package names
    nuxt.options.alias['#cwa'] = resolve('./runtime')
    nuxt.options.alias['#cwa-layer'] = resolve('./layer')
    const appDir = resolve(`${nuxt.options.dir.app}`)

    // do not server-side render internal routes. Use with client-side auth values
    extendRouteRules('/_cwa/**', { ssr: false, robots: false })

    // transpile runtime
    const runtimeDir = resolve('./runtime')
    nuxt.options.build.transpile.push(runtimeDir)

    logger.info(`Configuring auto-imports for CWA composables...`)
    addImportsDir(resolve('./runtime/composables'))
    addImportsDir(resolve('./runtime/composables/component'))
    addImports({ name: 'useCwaAdminItem', from: resolve('./layer/_composables/useCwaAdminItem') })
    for (const [name, file] of [['CwaAdminListRow', 'ListRow'], ['CwaAdminListCell', 'ListCell'], ['CwaAdminResourceId', 'ResourceIdDetail']]) {
      addComponent({ name: name!, filePath: resolve(`./runtime/templates/components/core/admin/${file}.vue`) })
    }

    logger.info(`Configuring CWA default pages and components...`)
    const vueTemplatesDir = resolve('./runtime/templates')

    extendPages((pages: NuxtPage[]) => {
      const pageComponent = resolve(vueTemplatesDir, 'cwa-page.vue')
      createDefaultCwaPages(pages, pageComponent, options.pagesDepth || 4, options.layoutName)
    })

    const extensions: CwaExtension[] = []
    addRouteMiddleware({ name: 'cwa-extension-area', path: resolve('./runtime/extension-area-middleware') })
    extendPages((pages: NuxtPage[]) => {
      addExtensionAdminPages(pages, extensions, resolve(vueTemplatesDir, 'extension-area.vue'), { types: resolve(vueTemplatesDir, 'extension-page-data-types.vue'), list: resolve(vueTemplatesDir, 'extension-page-data-list.vue'), item: resolve(vueTemplatesDir, 'extension-page-data-item.vue') })
    })

    nuxt.hook('pages:routerOptions', ({ files }) => {
      files.splice(1, 0, { path: resolve('./runtime/router.options') })
    })

    const defaultLayoutName = options.layoutName || 'cwa-root-layout'
    extendPages((pages: NuxtPage[]) => {
      function applyDefaultLayout(page: NuxtPage) {
        if (page.meta?.layout === undefined) {
          page.meta = page.meta || {}
          page.meta.layout = defaultLayoutName
        }
        page.children?.forEach(applyDefaultLayout)
      }
      pages.forEach(applyDefaultLayout)
    })

    const cwaVueComponentsDir = join(vueTemplatesDir, 'components')

    const adminSourceDirs = [
      join(cwaVueComponentsDir, 'main', 'admin'),
      join(cwaVueComponentsDir, 'core', 'admin'),
    ].map(dir => `${path.relative(nuxt.options.srcDir, dir)}/`)
    const isAdminSource = (id: string) => adminSourceDirs.some(dir => id.startsWith(dir))
    nuxt.hook('build:manifest', (manifest) => {
      for (const chunk of Object.values(manifest)) {
        if (chunk.src && isAdminSource(chunk.src)) {
          continue
        }
        chunk.dynamicImports = chunk.dynamicImports?.filter(id => !isAdminSource(id))
      }
    })

    logger.info(`Registering user components for CWA...`)
    const cwaAppDir = join(appDir, 'cwa')
    const userComponentsPath = join(cwaAppDir, 'components')
    nuxt.options.alias['#cwaComponents'] = userComponentsPath

    function cwaRoots() {
      return [cwaAppDir, ...extensions.flatMap(extension => extension.dir ? [extension.dir] : [])]
    }

    function rootOf(filePath: string, kind: 'components' | 'layouts' | 'pages') {
      return cwaRoots().map(root => join(root, kind)).find(dir => filePath.startsWith(`${dir}/`))
    }

    function userComponentPath(filePath: string) {
      const [name, ...rest] = path.relative(rootOf(filePath, 'components') ?? userComponentsPath, filePath).split('/')
      return { name, rest }
    }

    function isPrimaryComponent(filePath: string) {
      const { name, rest } = userComponentPath(filePath)
      return rest.length === 1 && rest[0] === `${name}.vue`
    }

    function isUiVariant(filePath: string) {
      const { rest } = userComponentPath(filePath)
      return rest.length === 2 && rest[0] === 'ui'
    }

    function resolveUserComponents(components: Component[]) {
      const allUserComponents = components.filter(({ filePath }) => rootOf(filePath, 'components'))
      return {
        allUserComponents,
        userComponents: allUserComponents.filter(({ filePath }) => isPrimaryComponent(filePath)),
      }
    }

    function isCwaTemplate({ filePath }: Component) {
      if (rootOf(filePath, 'layouts')) {
        return true
      }
      if (rootOf(filePath, 'pages')) {
        return !filePath.includes('/admin/')
      }
      if (!rootOf(filePath, 'components')) {
        return false
      }
      return isPrimaryComponent(filePath) || isUiVariant(filePath)
    }

    function isDirectory(dirPath: string) {
      try {
        return statSync(dirPath).isDirectory()
      }
      catch {
        return false
      }
    }

    function readCwaNames(root: string): ExtensionNames {
      const entries = (dir: string) => {
        try {
          return readdirSync(join(root, dir), { withFileTypes: true })
        }
        catch {
          return []
        }
      }
      const vueFiles = (dir: string) => entries(dir).filter(entry => entry.isFile() && entry.name.endsWith('.vue')).map(entry => entry.name.slice(0, -4))
      return {
        components: entries('components').filter(entry => entry.isDirectory() && readComponentFile(join(root, 'components', entry.name, `${entry.name}.vue`)) !== undefined).map(entry => entry.name),
        layouts: vueFiles('layouts'),
        pages: vueFiles('pages'),
      }
    }

    function builtInAdminPaths() {
      return [...new Set(readdirSync(resolve('./layer/pages/_cwa/index')).filter(name => !name.includes('.spec.')).map(name => name.replace(/\.vue$/, '')))]
    }

    async function collectExtensions() {
      await nuxt.callHook('cwa:extend', (extension) => {
        extensions.push(extension)
      })
      const { overrides } = checkExtensions({
        extensions,
        namesOf: extension => extension.dir ? readCwaNames(extension.dir) : { components: [], layouts: [], pages: [] },
        appNames: readCwaNames(cwaAppDir),
        builtInAdminPaths: builtInAdminPaths(),
      })
      for (const override of overrides) {
        logger.info(`${NAME}: ${override}`)
      }
      extensionRouteRules((nuxt.options.routeRules ??= {}) as Record<string, Record<string, unknown>>, extensions)
    }

    function resolveComponentImport(source: string, importer: string) {
      const aliased = resolveAlias(source, nuxt.options.alias)
      if (path.isAbsolute(aliased)) {
        return aliased
      }
      if (aliased.startsWith('.')) {
        return path.resolve(path.dirname(importer), aliased)
      }
    }

    function readSource(filePath: string) {
      try {
        return readFileSync(filePath, 'utf8')
      }
      catch {
        return undefined
      }
    }

    function toResourceType(component: Component) {
      return component.pascalName.replace(/^CwaComponent/, '')
    }

    function uiShortName(resourceType: string, ui: string) {
      const prefix = `CwaComponent${resourceType}Ui`
      return ui.startsWith(prefix) ? ui.slice(prefix.length) : ui
    }

    const reportedConfigUncheckable = new Set<string>()
    function warnConfigOnce(key: string, message: string) {
      if (reportedConfigUncheckable.has(key)) {
        return
      }
      reportedConfigUncheckable.add(key)
      logger.warn(message)
    }

    function scanCwaConfig(components: Component[]) {
      return scanCwaConfigDeclarations({
        templates: components.filter(isCwaTemplate),
        readFile: readSource,
        onUncheckable: (filePath, reason) => {
          warnConfigOnce(`${filePath}\0${reason}`, `${NAME}: the defineCwaConfig in ${filePath} is ignored, because it ${reason}. Pass a single object literal.`)
        },
        onIgnoredKeys: (filePath, keys) => {
          warnConfigOnce(`${filePath}\0keys\0${keys.join(',')}`, `${NAME}: ${keys.join(', ')} in the defineCwaConfig in ${filePath} ${keys.length > 1 ? 'are' : 'is'} ignored, because this kind of file cannot declare ${keys.length > 1 ? 'them' : 'it'}. A component may declare name, description, instantAdd, defaultData, styles, allowMultiple, icon, group and image; a UI variant name, styles and allowMultiple; a layout or page name and styles.`)
        },
      })
    }

    const reportedConfigCallSites = new Set<string>()
    addVitePlugin({
      name: 'cwa:define-cwa-config-call-sites',
      enforce: 'pre',
      transform(code: string, id: string) {
        const filePath = id.split('?')[0]!
        if (id.startsWith('\0') || filePath.includes('/node_modules/') || !/\bdefineCwaConfig\s*\(/.test(code)) {
          return
        }
        if (isCwaTemplate({ filePath } as Component) || reportedConfigCallSites.has(filePath)) {
          return
        }
        reportedConfigCallSites.add(filePath)
        logger.warn(`${NAME}: the defineCwaConfig in ${filePath} has no effect, because the module only reads it in app/cwa/components/<Type>/<Type>.vue, app/cwa/components/<Type>/ui/*.vue, app/cwa/layouts/*.vue and app/cwa/pages/*.vue.`)
      },
    })

    function resolveCwaConfig(components: Component[]) {
      const declarations = scanCwaConfig(components)
      const resourcesConfig: CwaResourcesConfig = { ...BUILT_IN_RESOURCES_CONFIG }
      const uiConfig: Record<string, CwaUiVariantConfig> = {}

      const { allUserComponents, userComponents } = resolveUserComponents(components)
      const componentsByPath: { [key: string]: Component } = allUserComponents.reduce((obj, value) => ({ ...obj, [value.filePath]: value }), {})
      const resourceTypes = userComponents.map(component => ({ resourceType: toResourceType(component), primaryDir: path.dirname(component.filePath), declared: true }))
      for (const resourceType of Object.keys(BUILT_IN_RENDERERS)) {
        if (!resourceTypes.some(type => type.resourceType === resourceType)) {
          resourceTypes.push({ resourceType, primaryDir: join(userComponentsPath, resourceType), declared: false })
        }
      }
      for (const { resourceType, primaryDir, declared } of resourceTypes) {
        const isDirectory = (p: string) => {
          try {
            return statSync(p).isDirectory()
          }
          catch (_e) {
            return false
          }
        }

        const resolveComponentNames = (dirPath: string) => {
          const componentNames: GlobalComponentNames[] = []
          if (isDirectory(dirPath)) {
            const componentFilePaths = Object.keys(componentsByPath).filter(path => path.startsWith(dirPath))
            componentFilePaths.forEach((filePath) => {
              if (componentsByPath[filePath]) {
                // @ts-expect-error: Unable to resolve that pascalName exists in keyof type
                componentsByPath[filePath].global && componentNames.push(componentsByPath[filePath].pascalName)
              }
            })
          }
          return componentNames
        }

        const tabsDir = resolveAlias(resolve(primaryDir, 'admin'))
        const managerTabs: GlobalComponentNames[] = resolveComponentNames(tabsDir)

        const ui = allUserComponents
          .filter(({ filePath, global }) => global && path.dirname(path.dirname(filePath)) === primaryDir && isUiVariant(filePath))
          .filter(({ filePath, pascalName }) => {
            if (uiShortName(resourceType, pascalName).toLowerCase() !== 'default') {
              return true
            }
            warnConfigOnce(`${filePath}\0default`, `${NAME}: ${filePath} is not one of ${resourceType}'s UIs, because default is the name of the component itself (${resourceType}/${resourceType}.vue) in allowedComponents. Rename the file.`)
            return false
          })
          .map(({ pascalName }) => pascalName as GlobalComponentNames)

        const primary = declared ? declarations.components[resourceType] ?? {} : {}
        resourcesConfig[resourceType] = declared
          ? { name: resourceType.replace(/(?!^)([A-Z])/g, ' $1'), managerTabs, ui, ...primary }
          : { ...BUILT_IN_RESOURCES_CONFIG[resourceType], managerTabs, ui }
        for (const name of ui) {
          const own = declarations.ui[name] ?? {}
          uiConfig[name] = own.styles
            ? own
            : { ...own, allowMultiple: own.allowMultiple ?? primary.allowMultiple, styles: primary.styles }
        }
      }
      return {
        resourcesConfig,
        uiConfig,
        layoutsConfig: declarations.layouts,
        pagesConfig: declarations.pages,
      }
    }

    function resolveStyleClasses(components: Component[]): CwaStyleClasses {
      const { resourcesConfig, uiConfig, layoutsConfig, pagesConfig } = resolveCwaConfig(components)
      const byComponent: [string, CwaStyles | undefined][] = [
        ...Object.entries(resourcesConfig).map(([type, config]): [string, CwaStyles | undefined] => [`CwaComponent${type}`, config.styles]),
        ...Object.entries(uiConfig).map(([name, config]): [string, CwaStyles | undefined] => [name, config.styles]),
        ...Object.entries(layoutsConfig).map(([name, config]): [string, CwaStyles | undefined] => [`CwaLayout${name}`, config.styles]),
        ...Object.entries(pagesConfig).map(([name, config]): [string, CwaStyles | undefined] => [`CwaPage${name}`, config.styles]),
      ]
      return Object.fromEntries(byComponent
        .filter(([, styles]) => styles && Object.keys(styles).length)
        .map(([name, styles]) => [name, Object.fromEntries(Object.entries(styles!).map(([key, style]) => [key, style.classes]))]))
    }

    function extendCwaOptions() {
      return { ...options, staticRender: options.staticRender ?? hasStaticRouteRules() }
    }

    const ADMIN_RESOURCE_KEYS = ['description', 'icon', 'group', 'image'] as const

    function withoutAdminResourceKeys(resources: CwaResourcesConfig): CwaResourcesMeta {
      return Object.fromEntries(Object.entries(resources).map(([name, meta]) => {
        const { description: _description, icon: _icon, group: _group, image: _image, ...rest } = meta
        return [name, rest]
      }))
    }

    function resolveComponentDirs(components: Component[]): Record<string, string> {
      return Object.fromEntries(resolveUserComponents(components).userComponents.map(component => [toResourceType(component), path.dirname(component.filePath)]))
    }

    function readComponentFile(file: string): string | undefined {
      try {
        return statSync(file).isFile() ? readFileSync(file, 'utf8') : undefined
      }
      catch {
        return undefined
      }
    }

    function resolvePreviews(components: Component[]): Record<string, string> {
      const previews: Record<string, string> = {}
      for (const component of resolveUserComponents(components).userComponents) {
        const preview = join(path.dirname(component.filePath), 'preview.webp')
        try {
          statSync(preview).isFile() && (previews[toResourceType(component)] = preview)
        }
        catch {
          continue
        }
      }
      return previews
    }

    let lucideIcons: LucideIconSet | undefined
    function readLucideIcons(): LucideIconSet {
      lucideIcons ??= JSON.parse(readFileSync(createRequire(import.meta.url).resolve('@iconify-json/lucide/icons.json'), 'utf8')) as LucideIconSet
      return lucideIcons
    }

    function resolveSessionEndCaches(): string[] {
      if (!hasNuxtModule('@vite-pwa/nuxt', nuxt)) {
        return []
      }
      if ((nuxt.options as { pwa?: { disable?: boolean } }).pwa?.disable) {
        return []
      }
      return options.auth?.clearCachesOnSessionEnd ?? ['cwa-api']
    }

    function resolveTopBarDefault(topBar: unknown) {
      if (topBar === undefined) {
        return undefined
      }
      if (!Array.isArray(topBar) || !topBar.every(id => typeof id === 'string')) {
        logger.warn(`${NAME}: cwa.admin.topBar must be a list of top bar ids, so it is ignored and the built-in default applies.`)
        return undefined
      }
      const unknown = unknownTopBarIds(topBar, extensionAreas(extensions, icon => lucideIconSvg(readLucideIcons(), icon)))
      if (unknown.length) {
        logger.warn(`${NAME}: cwa.admin.topBar names ${unknown.map(id => JSON.stringify(id)).join(', ')}, which no built-in area or extension with an icon and admin pages has, so the top bar leaves them out.`)
      }
      return topBar as string[]
    }

    function hasStaticRouteRules(): boolean {
      const routeRules = { ...nuxt.options.routeRules, ...nuxt.options.nitro?.routeRules }
      return Object.values(routeRules).some(rule => !!(rule?.isr || rule?.swr || rule?.prerender))
    }

    nuxt.hook('modules:done', async () => {
      await collectExtensions()
      logger.info(`Configuring template to propagate module options and adding plugin for ${NAME} module...`)
      // clear options no longer needed and add plugin
      delete options.pagesDepth
      const topBarDefault = resolveTopBarDefault(options.admin?.topBar)
      delete options.admin

      const sessionEndCaches = resolveSessionEndCaches()
      if (sessionEndCaches.length) {
        options.auth = { ...options.auth, clearCachesOnSessionEnd: sessionEndCaches }
        addPlugin({
          src: resolve('./runtime/plugin-session-caches.client'),
          mode: 'client',
        })
      }
      else {
        delete options.auth
      }

      addTemplate({
        filename: 'cwa-component-names.ts',
        write: true,
        getContents: ({ app }) => {
          const names = resolveUserComponents(app.components).userComponents.map(toResourceType)
          const constant = JSON.stringify(Object.fromEntries(names.map(name => [name, name])), undefined, 2)
          const { resourcesConfig, uiConfig } = resolveCwaConfig(app.components)
          const uiOf = (name: string) => (resourcesConfig[name]?.ui ?? []) as string[]
          const constants = (valuesOf: (name: string) => string[]) => JSON.stringify(Object.fromEntries(names.map(name => [name, Object.fromEntries(valuesOf(name).map(value => [value, value]))])), undefined, 2)
          const uis = constants(name => ['default', ...uiOf(name).map(ui => uiShortName(name, ui))])
          const styles = constants(name => [resourcesConfig[name]?.styles, ...uiOf(name).map(ui => uiConfig[ui]?.styles)].flatMap(styles => Object.keys(styles ?? {})))
          return `export const CwaComponentNames = ${constant} as const
export type CwaComponentName = typeof CwaComponentNames[keyof typeof CwaComponentNames]
export const CwaComponentUis = ${uis} as const
export type CwaComponentUis = { [Name in CwaComponentName]: typeof CwaComponentUis[Name][keyof typeof CwaComponentUis[Name]] }
export const CwaComponentStyles = ${styles} as const
export type CwaComponentStyles = { [Name in CwaComponentName]: typeof CwaComponentStyles[Name][keyof typeof CwaComponentStyles[Name]] }
`
        },
      })
      addTemplate({
        filename: 'cwa-extension-menu.ts',
        write: true,
        getContents: () => `export const extensionPageRoles: string[] = ${JSON.stringify(extensionPageRoles(extensions))}
export const adminShellRoles: string[] = ${JSON.stringify(adminShellRoles(extensions))}
`,
      })
      addTemplate({
        filename: 'cwa-admin-top-bar.ts',
        write: true,
        getContents: () => `export const topBarDefault: string[] | undefined = ${topBarDefault ? JSON.stringify(topBarDefault) : 'undefined'}\n`,
      })
      addTemplate({
        filename: 'cwa-extension-areas.ts',
        write: true,
        getContents: () => `import type { CwaExtensionArea } from '#cwa/admin/extension-areas'
export const extensionAreas: CwaExtensionArea[] = ${JSON.stringify(extensionAreas(extensions, (icon) => {
  const svg = lucideIconSvg(readLucideIcons(), icon)
  if (!svg) {
    logger.warn(`${NAME}: the extension icon "${icon}" is not a lucide icon, so it is left out`)
  }
  return svg
}), undefined, 2)}
export const extensionAdminRoles: { role: string, label: string }[] = ${JSON.stringify(extensionAdminRoles(extensions), undefined, 2)}
`,
      })
      addTemplate({
        filename: 'cwa-extension-page-data.ts',
        write: true,
        getContents: () => extensionPageDataTemplate(extensions),
      })

      addImports([
        { name: 'CwaComponentNames', from: '#build/cwa-component-names' },
        { name: 'CwaComponentName', from: '#build/cwa-component-names', type: true },
        { name: 'CwaComponentUis', from: '#build/cwa-component-names' },
        { name: 'CwaComponentStyles', from: '#build/cwa-component-names' },
      ])

      const reportedUncheckable = new Set<string>()
      addTemplate({
        filename: 'cwa-component-group-declarations.ts',
        write: true,
        getContents: ({ app }) => {
          const declarations = scanComponentGroupDeclarations({
            templates: app.components.filter(isCwaTemplate),
            components: app.components,
            componentGroupFile: resolve('./runtime/templates/components/main/ComponentGroup.vue'),
            readFile: readSource,
            resolveImport: resolveComponentImport,
            onUncheckable: (filePath, reason) => {
              const key = `${filePath}\0${reason}`
              if (reportedUncheckable.has(key)) {
                return
              }
              reportedUncheckable.add(key)
              logger.warn(`${NAME}: stranded component group warnings are off for the whole site, because ${filePath} ${reason}, so it could declare any group. Pass a literal reference, or a location the module recognises (the template's iri or publishedIri, the layout IRI, or a literal location-reference).`)
            },
          })
          return `import type { ComponentGroupDeclarations } from '#cwa/admin/stranded-component-groups'
export const componentGroupDeclarations: ComponentGroupDeclarations = ${JSON.stringify(declarations, undefined, 2)}
`
        },
      })

      const reportedIcons = new Set<string>()
      addTemplate({
        filename: 'cwa-admin-resources.ts',
        write: true,
        getContents: ({ app }) => {
          const resources = resolveCwaConfig(app.components).resourcesConfig
          return adminResourcesTemplate({
            resources: Object.fromEntries(Object.entries(resources).map(([name, meta]) => [name, Object.fromEntries(ADMIN_RESOURCE_KEYS.filter(key => meta[key]).map(key => [key, meta[key]]))])),
            previews: resolvePreviews(app.components),
            componentDirs: resolveComponentDirs(app.components),
            readFile: readComponentFile,
            lucide: readLucideIcons(),
            warn: (message) => {
              if (!reportedIcons.has(message)) {
                reportedIcons.add(message)
                logger.warn(`${NAME}: ${message}`)
              }
            },
          })
        },
      })

      addTypeTemplate({
        filename: 'types/cwa-lucide-icons.d.ts',
        write: true,
        getContents: () => lucideNamesTypeTemplate(readLucideIcons()),
      }, { nuxt: true, node: true })

      addTemplate({
        filename: 'cwa-config.ts',
        write: true,
        getContents: ({ app }) => {
          const { resourcesConfig, uiConfig, layoutsConfig, pagesConfig } = resolveCwaConfig(app.components)
          return `import type { CwaResourcesMeta, CwaTemplateConfig, CwaUiVariantConfig } from '#cwa/types'
export const resourcesConfig: CwaResourcesMeta = ${JSON.stringify(withoutAdminResourceKeys(resourcesConfig), undefined, 2)}
export const uiConfig: Record<string, CwaUiVariantConfig> = ${JSON.stringify(uiConfig, undefined, 2)}
export const layoutsConfig: Record<string, CwaTemplateConfig> = ${JSON.stringify(layoutsConfig, undefined, 2)}
export const pagesConfig: Record<string, CwaTemplateConfig> = ${JSON.stringify(pagesConfig, undefined, 2)}
`
        },
      })

      addTemplate({
        filename: 'cwa-styles.ts',
        write: true,
        getContents: ({ app }) => {
          return `import type { CwaStyleClasses } from '#cwa/types'
export const styleClasses: CwaStyleClasses = ${JSON.stringify(resolveStyleClasses(app.components), undefined, 2)}
`
        },
      })

      addTemplate({
        filename: 'cwa-options.ts',
        getContents: () => {
          return `import type { CwaModuleOptions } from '#cwa/types';
export const options:CwaModuleOptions = ${JSON.stringify(extendCwaOptions(), undefined, 2)}
export const currentModulePackageInfo:{ version: string, name: string } = ${JSON.stringify({ version, name }, undefined, 2)}
`
        },
      })

      if (hasNuxtModule('nuxt-og-image', nuxt)) {
        addTypeTemplate({
          filename: 'types/cwa-og-image.d.ts',
          write: true,
          getContents: () => /* ts */`import type CwaDefaultSatori from '${resolve('./layer/components/og-image/CwaDefault.satori.vue')}'
declare module '#og-image/components' {
  interface OgImageComponents {
    CwaDefault: typeof CwaDefaultSatori
    'CwaDefault.satori': typeof CwaDefaultSatori
    CwaDefaultSatori: typeof CwaDefaultSatori
  }
}`,
        })
      }
      else {
        addImports({
          name: 'defineOgImage',
          as: 'defineOgImage',
          from: resolve('./runtime/og-image-fallback'),
        })
      }

      addTypeTemplate({
        filename: 'types/cwa.d.ts',
        write: true,
        getContents: () => /* ts */`interface CwaRouteMeta {
  admin?: boolean
  disabled?: boolean
  layout?: string
  fetch?: {
    iri: string
    manifestPath?: string
  }
}
export * from 'vue-router'
declare module 'vue-router' {
  interface RouteMeta {
    cwa?: CwaRouteMeta
    cwaAdminRole?: string
  }
}
declare module '#app' {
  interface RuntimeNuxtHooks {
    'cwa:auth:signed-in': (payload: { user: import('#cwa/storage/stores/auth/state').CwaUser }) => void | Promise<void>
    'cwa:auth:signed-out': () => void | Promise<void>
  }
}`,
      })

      addPlugin({
        src: resolve('./runtime/plugin'),
      })

      addPlugin({
        src: resolve('./runtime/plugin-page-loading.client'),
        mode: 'client',
      })

      nuxt.options.runtimeConfig.cwa = defu(nuxt.options.runtimeConfig.cwa, {
        apiUrl: '',
        readiness: { ...READINESS_DEFAULTS },
      })

      if (options.pageCache?.enabled ?? true) {
        if (options.staticRender ?? hasStaticRouteRules()) {
          logger.warn(`${NAME}: pageCache is enabled alongside isr/swr/prerender route rules. Nitro's own cache is not purged by the API, so edits will not appear until the route rule window lapses.`)
        }
        addPlugin({
          src: resolve('./runtime/plugin-page-cache.server'),
          mode: 'server',
        })
        addServerPlugin(resolve('./runtime/server/page-cache-plugin'))
        nuxt.options.runtimeConfig.cwa = defu(nuxt.options.runtimeConfig.cwa, {
          pageCacheWarm: { concurrency: 3, timeout: 30000, origin: '' },
        })
        addServerHandler({
          route: '/_cwa/page-cache/warm',
          method: 'post',
          handler: resolve('./runtime/server/cwa-page-cache-warm.post'),
        })
      }

      addServerTemplate({
        filename: '#cwa/server-options.ts',
        getContents: () => {
          const serverOps = {
            siteConfig: options.siteConfig,
            sitemapCache: options.sitemapCache,
          }
          return `export const options = ${JSON.stringify(serverOps, undefined, 2)}
`
        },
      })
      addServerHandler({
        handler: resolve('./runtime/server/server-middleware'),
      })
      addServerPlugin(resolve('./runtime/server/server-plugin'))
      addServerHandler({
        route: '/__sitemap__/cwa-urls',
        handler: resolve('./runtime/server/cwa-urls.get'),
      })
      addServerHandler({
        route: '/__sitemap__/cwa-custom.xml',
        handler: resolve('./runtime/server/cwa-custom-sitemap.get'),
      })
      addServerPlugin(resolve('./runtime/server/sitemap-cache-plugin'))
      addServerHandler({
        route: '/_cwa/healthcheck',
        handler: resolve('./runtime/server/cwa-healthcheck.get'),
      })
      addServerHandler({
        route: '/_cwa/readiness',
        handler: resolve('./runtime/server/cwa-readiness.get'),
      })
    })

    nuxt.hook('components:extend', (components) => {
      for (const [resourceType, filePath] of Object.entries(BUILT_IN_RENDERERS)) {
        const pascalName = `CwaComponent${resourceType}`
        if (components.some(component => component.pascalName === pascalName)) {
          continue
        }
        const kebabName = `cwa-component-${resourceType.replace(/(?!^)([A-Z])/g, '-$1').toLowerCase()}`
        const resolved = resolve(filePath)
        components.push({
          pascalName,
          kebabName,
          export: 'default',
          filePath: resolved,
          shortPath: resolved,
          chunkName: `components/${kebabName}`,
          prefetch: false,
          preload: false,
          global: true,
          mode: 'all',
          priority: 0,
          meta: {},
        })
      }
    })

    nuxt.hook('components:dirs', (dirs) => {
      logger.info(`Configuring component directories for ${NAME} module...`)
      // component dirs from module
      dirs.unshift({
        path: join(cwaVueComponentsDir, 'main'),
        prefix: 'Cwa',
        ignore: ['**/_*/*', '**/*.spec.{cts,mts,ts}'],
      })
      dirs.unshift({
        path: join(cwaVueComponentsDir, 'ui'),
        prefix: 'CwaUi',
        ignore: ['**/*.spec.{cts,mts,ts}'],
      })

      // todo: https://github.com/nuxt/nuxt/issues/14036#issuecomment-2110180751
      // todo: components do not need to be global and can be imported using import.meta.glob("~/components/modal/*.vue"); to reduce bundle size
      // component dirs to be configured by application - global, so they are split and can be loaded dynamically
      dirs.unshift({
        path: join(appDir, 'cwa', 'layouts'),
        prefix: 'CwaLayout',
        global: true,
        ignore: ['**/*.spec.{cts,mts,ts}'],
      })

      dirs.unshift({
        path: join(appDir, 'cwa', 'pages'),
        prefix: 'CwaPage',
        global: true,
        ignore: ['**/admin/*', '**/*.spec.{cts,mts,ts}'],
      })

      dirs.unshift({
        path: userComponentsPath,
        prefix: 'CwaComponent',
        global: true,
        ignore: ['**/*.spec.{cts,mts,ts}'],
      })

      for (const { dir } of extensions) {
        if (!dir) {
          continue
        }
        dirs.push(...[
          { path: join(dir, 'components'), prefix: 'CwaComponent', global: true, priority: 0, ignore: ['**/*.spec.{cts,mts,ts}'] },
          { path: join(dir, 'layouts'), prefix: 'CwaLayout', global: true, priority: 0, ignore: ['**/*.spec.{cts,mts,ts}'] },
          { path: join(dir, 'pages'), prefix: 'CwaPage', global: true, priority: 0, ignore: ['**/admin/*', '**/*.spec.{cts,mts,ts}'] },
        ].filter(({ path }) => isDirectory(path)))
      }
    })

    // todo: test - this will rebuild the options template when cwa files are added or deleted so that we auto-detect tabs to change in dev
    nuxt.hook('builder:watch', async (event, relativePath) => {
      const filenames: string[] = []
      const path = resolve(appDir, relativePath)
      const cwaDirs = cwaRoots().map(root => join(root, 'components'))
      if (['add', 'unlink'].includes(event) && cwaDirs.some(dir => dir === path || path.startsWith(dir + '/'))) {
        logger.info(`File added or removed - updating options for ${NAME} module...`)
        filenames.push('cwa-options.ts', 'cwa-component-names.ts', 'cwa-admin-resources.ts', '#cwa/server-options.ts')
      }
      if (event === 'change' && relativePath.endsWith('.svg') && rootOf(path, 'components')) {
        filenames.push('cwa-admin-resources.ts')
      }
      if (['add', 'change', 'unlink'].includes(event) && relativePath.endsWith('.vue')) {
        filenames.push('cwa-component-group-declarations.ts')
        if (cwaRoots().some(root => path.startsWith(root + '/'))) {
          filenames.push('cwa-config.ts', 'cwa-styles.ts', 'cwa-admin-resources.ts', 'cwa-component-names.ts')
        }
      }
      if (filenames.length) {
        await updateTemplates({
          filter: template => filenames.includes(template.filename),
        })
      }
    })

    nuxt.hook('vite:extendConfig', (config: Readonly<ViteConfig>) => {
      logger.info(`Extending Vite optimizeDeps config for ${NAME} module dependencies...`)
      // @ts-expect-error optimizeDeps is readonly but it can also be undefined. The config reading in is Readonly which is why... not sure how else to extend
      config.optimizeDeps = config.optimizeDeps || {}
      config.optimizeDeps.include = config.optimizeDeps.include || []
      config.optimizeDeps.exclude = config.optimizeDeps.exclude || []

      const optimizeDepPackages = ['slugify', 'dayjs', 'cookie', 'set-cookie-parser']

      for (const opPkg of optimizeDepPackages) {
        // does it exist in excludes? remove
        const pkgIndex = config.optimizeDeps.exclude.indexOf(opPkg)
        if (pkgIndex > -1) {
          config.optimizeDeps.exclude.splice(pkgIndex, 1)
        }

        // if not already in the includes for optimising, add it
        if (!config.optimizeDeps.include.includes(opPkg)) {
          config.optimizeDeps.include.push(opPkg)
        }
      }
    })

    logger.success(`Added ${NAME} module successfully.`)
  },
})
