import { resolve, join } from 'path'
import merge from 'lodash/merge'
import defaults from './defaults'

function extendRoutes ({ pagesDepth }) {
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
  this.extendRoutes((routes) => {
    const newRoutes = createRouteObject('~cwa/core/templates/page.vue', pagesDepth)
    routes.push(newRoutes)
  })
}

export default function (moduleOptions) {
  // Merge all option sources
  const options = merge({}, defaults, moduleOptions, this.options.cwa, this.options.auth)

  // Add plugin
  const { dst } = this.addTemplate({
    src: resolve(__dirname, '../../templates/plugin.js'),
    fileName: join('cwa.js'),
    options: {
      options
    }
  })
  this.options.plugins.push(resolve(this.options.buildDir, dst))

  this.addLayout({
    src: resolve(__dirname, '../core/templates/cwa-layout.vue'),
    fileName: join('cwa-layout.vue')
  })

  this.addLayout({
    src: resolve(__dirname, '../core/templates/cwa-error.vue'),
    fileName: join('cwa-error.vue')
  }, 'error')

  extendRoutes.call(this, { pagesDepth: options.pagesDepth })

  // Transpile and alias auth src
  const srcDir = resolve(__dirname, '..')
  this.options.alias['~cwa'] = srcDir
  this.options.build.transpile.push(srcDir)
}
