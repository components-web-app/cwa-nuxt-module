import { resolve, join, basename } from 'path'
import fs from 'fs'
import consola from 'consola'
import { Component } from '@nuxt/components/dist/scan'
import { Module } from '@nuxt/types'
import { CwaOptions } from '../index'

function extendRoutesFn ({ pagesDepth }) {
  // recursive function
  function createRouteObject (component, depth:number, currentDepth:number = 0) {
    if (currentDepth > depth) {
      return null
    }
    const routeObject = {
      name: 'page' + currentDepth,
      path: ':page' + currentDepth + '*',
      component,
      children: null
    }
    if (currentDepth === 0) {
      routeObject.path = '/' + routeObject.path
    }
    const child = createRouteObject(component, depth, currentDepth + 1)
    if (child) {
      routeObject.children = [child]
    }
    return routeObject
  }

  // transpile
  this.nuxt.options.build!.transpile!.push(resolve(__dirname, '../core/templates/page'))

  // return the function
  return (routes) => {
    routes.push(createRouteObject(resolve(__dirname, '../core/templates/page'), pagesDepth))
  }
}

function applyCss () {
  const assetsDir = resolve(__dirname, '../core/assets/sass')
  this.options.css.push(join(assetsDir, 'style.sass'))

  this.extendBuild((config, _) => {
    const sassRuleIdx = config.module.rules.findIndex((e) => {
      return e.test.toString().match(/sass/)
    })

    const sassResourcesLoader = {
      loader: 'sass-resources-loader',
      options: {
        resources: [join(assetsDir, 'vars/*.sass'), join(assetsDir, '_mixins.sass')]
      }
    }

    if (sassRuleIdx === -1) {
      config.module.rules.push({
        test: /sass/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader',
          'sass-loader',
          sassResourcesLoader
        ]
      })
    } else {
      config.module.rules[sassRuleIdx].oneOf.forEach(rule => (rule.use as unknown as any[]).push(sassResourcesLoader))
    }
  })
}

function loadComponents () {
  // auto-configure components module
  if (!this.options.buildModules.includes('@nuxt/components')) {
    this.options.buildModules.push('@nuxt/components')
  }

  if (!this.options.components) {
    this.options.components = []
  } else if (this.options.components === true) {
    this.options.components = ['~/components']
  }

  // auto-configure components module for our cwa components
  const extensions = ['vue', 'js', 'ts', 'tsx']
  const pattern = `**/*.{${extensions.join(',')},}`
  const componentImports = {
    pages: [],
    components: []
  }
  const types = Object.keys(componentImports)

  for (const componentType of types) {
    this.options.components.push({
      path: `~/components/cwa/${componentType}`,
      extensions,
      pattern,
      prefix: `cwa-${componentType}`
    })
  }

  // with all the auto-imported components, we will filter out our cwa ones and provide files that can be included
  // which will define all the components by type so that they can be lazy/dynamically loaded
  this.nuxt.hook('components:extend', (components: Component[]) => {
    const findType = (component: Component) => {
      for (const componentType of types) {
        if (component.kebabName.startsWith(`lazy-cwa-${componentType}`)) {
          return componentType
        }
      }
    }

    for (const component of components) {
      const foundType = findType(component)
      if (!foundType) {
        continue
      }
      componentImports[foundType].push(component)
    }

    for (const [componentType, components] of Object.entries(componentImports)) {
      const { dst } = this.addTemplate({
        src: resolve(__dirname, '../../templates/components.js'),
        fileName: join('cwa', `${componentType}.js`),
        options: {
          components,
          prefix: componentType.charAt(0).toUpperCase() + componentType.slice(1)
        }
      })
      this.nuxt.options.plugins.push(resolve(this.nuxt.options.buildDir, dst))
    }
  })

  this.nuxt.options.build!.transpile!.push('@cwa/nuxt-module/core/templates/component-load-error.vue')
  this.nuxt.options.build!.transpile!.push('@cwa/nuxt-module/core/mixins/ResourceMixin.js')
  this.nuxt.options.build!.transpile!.push('@cwa/nuxt-module/core/templates/component-collection.vue')
  this.nuxt.options.build!.transpile!.push('@cwa/nuxt-module/core/templates/component-position.vue')
}

const cwaModule = <Module> function () {
  const { version, name } = JSON.parse(
    fs.readFileSync(
      join(__dirname, '../../package.json'),
      'utf8'
    )
  )
  const options: CwaOptions = {
    vuex: {
      namespace: 'cwa'
    },
    fetchConcurrency: 10,
    pagesDepth: 3,
    allowUnauthorizedTls: false,
    websiteName: 'Unnamed CWA Site',
    package: {
      name,
      version
    },
    ...this.options.cwa
  }

  this.addLayout({
    src: resolve(__dirname, '../core/templates/layouts/cwa-error.vue'),
    fileName: join('cwa', 'layouts', 'cwa-error.vue')
  }, 'error')

  this.addLayout({
    src: resolve(__dirname, '../core/templates/layouts/cwa-default.vue'),
    fileName: join('cwa', 'layouts', 'cwa-default.vue')
  }, 'cwa-default')

  this.addLayout({
    src: resolve(__dirname, '../core/templates/layouts/cwa-empty.vue'),
    fileName: join('cwa', 'layouts', 'cwa-empty.vue')
  }, 'cwa-empty')

  this.extendRoutes((routes: any[]) => {
    function getRouteObjects (baseDir: string, pathParts: string[] = ['_cwa']) {
      const newRoutes = []
      const files = fs.readdirSync(baseDir)
      files.forEach((filename: string) => {
        const filePath = join(baseDir, filename)
        const stat = fs.lstatSync(filePath)
        if (stat.isDirectory()) {
          pathParts.push(filename)
          return newRoutes.push(...getRouteObjects(filePath), pathParts)
        }
        const name = basename(filename, '.vue')
        newRoutes.push({
          name,
          path: `/${pathParts.join('/')}/${name}`,
          component: resolve(filePath),
          children: null
        })
      })
      return newRoutes
    }
    routes.push(...getRouteObjects(resolve(__dirname, '../core/templates/pages/_cwa')))
  })

  this.extendRoutes(extendRoutesFn.call(this, { pagesDepth: options.pagesDepth }))

  // Add plugin
  const { dst } = this.addTemplate({
    src: resolve(__dirname, '../../templates/plugin.js'),
    fileName: join('cwa', 'cwa.js'),
    options: {
      options
    }
  })
  this.nuxt.options.plugins.push(resolve(this.nuxt.options.buildDir, dst))

  applyCss.call(this)

  loadComponents.call(this)
}

// @ts-ignore
cwaModule.meta = { name: '@cwa/nuxt-module' }

export default cwaModule
