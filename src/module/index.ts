import { resolve, join } from 'path'
// import { Configuration as WebpackConfig, Entry as WebpackEntry } from 'webpack'
import { Module } from '@nuxt/types'
import { CwaOptions } from "../index"

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
    const newRoutes = createRouteObject('@cwa/core/templates/page.vue', pagesDepth)
    routes.push(newRoutes)
  }
}

const cwaModule = <Module> async function () {
  const { nuxt, extendRoutes, addLayout, addTemplate } = this

  const options: CwaOptions = {
    ...{
      vuex: {
        namespace: 'cwa'
      },
      fetchConcurrency: 10,
      pagesDepth: 3,
      allowUnauthorizedTls: false
    },
    ...nuxt.options.cwa,
    // Todo Check if we need the auth module options options and implement properly if we do
    // ...nuxt.options.auth
  }

  addLayout.call(this, {
    src: resolve(__dirname, '../core/templates/cwa-layout.vue'),
    fileName: join('cwa', 'cwa-layout.vue')
  })

  addLayout.call(this, {
    src: resolve(__dirname, '../core/templates/cwa-error.vue'),
    fileName: join('cwa', 'cwa-error.vue')
  }, 'error')

  extendRoutes.call(this, extendRoutesFn({ pagesDepth: options.pagesDepth }))

  // Add plugin
  const { dst } = addTemplate.call(this, {
    src: resolve(__dirname, '../../templates/plugin.js'),
    fileName: join('cwa', 'cwa.js'),
    options: {
      options
    }
  })

  nuxt.options.plugins.push(resolve(nuxt.options.buildDir, dst))

  // Transpile and alias auth src
  const srcDir = resolve(__dirname, '..')
  this.options.build.transpile.push(srcDir)

  // Add Webpack entry for runtime installComponents function
  // nuxt.hook('webpack:config', (configs: WebpackConfig[]) => {
  //   //console.log(configs)
  //   const filteredConfigs = configs.filter(c => ['client', 'modern', 'server'].includes(c.name!))
  //   for (const config of filteredConfigs) {
  //     config.resolve.alias['~cwa'] = srcDir
  //     console.log(config)
  //   }
  // })

  await nuxt.hook('components:dirs', (dirs) => {
    console.log('components dirs hook', dirs)
  })
}

// @ts-ignore
cwaModule.meta = { name: '@cwa' }

export default cwaModule
