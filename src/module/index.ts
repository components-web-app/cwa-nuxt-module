import { resolve, join } from 'path'
// import { Configuration as WebpackConfig, Entry as WebpackEntry } from 'webpack'
import { Module } from '@nuxt/types'
import { CwaOptions } from '../index'

function extendRoutesFn ({ pagesDepth }) {
  function createRouteObject (component, depth:number, currentDepth:number = 0) {
    if (currentDepth > depth) {
      return null
    }
    const routeObject = {
      name: 'page' + currentDepth,
      path: ':page' + currentDepth + '?',
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
  return (routes) => {
    const newRoutes = createRouteObject('@cwamodules/core/templates/page.vue', pagesDepth)
    routes.push(newRoutes)
  }
}

const cwaModule = <Module> async function () {
  const options: CwaOptions = {
    ...{
      vuex: {
        namespace: 'cwa'
      },
      fetchConcurrency: 10,
      pagesDepth: 3,
      allowUnauthorizedTls: false
    },
    ...this.options.cwa
  }

  this.addLayout({
    src: resolve(__dirname, '../core/templates/cwa-layout.vue'),
    fileName: join('cwa', 'cwa-layout.vue')
  })

  this.addLayout({
    src: resolve(__dirname, '../core/templates/cwa-error.vue'),
    fileName: join('cwa', 'cwa-error.vue')
  }, 'error')

  this.extendRoutes(extendRoutesFn({ pagesDepth: options.pagesDepth }))

  // Add plugin
  const { dst } = this.addTemplate({
    src: resolve(__dirname, '../../templates/plugin.js'),
    fileName: join('cwa', 'cwa.js'),
    options: {
      options
    }
  })

  this.nuxt.options.plugins.push(resolve(this.nuxt.options.buildDir, dst))

  const assetsDir = resolve(__dirname, '../core/assets')
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

// @ts-ignore
cwaModule.meta = { name: '@cwamodules/cwa' }

export default cwaModule
