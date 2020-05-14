import { resolve, join } from 'path'
import merge from 'lodash/merge'
import defaults from './defaults'

export default function (moduleOptions) {
  // Merge all option sources
  const options = merge({}, defaults, moduleOptions, this.options.auth)

  // Add plugin
  const { dst } = this.addTemplate({
    src: resolve(__dirname, '../../templates/plugin.js'),
    fileName: join('auth.js'),
    options: {
      options
    }
  })

  this.options.plugins.push(resolve(this.options.buildDir, dst))

  // Transpile and alias auth src
  const srcDir = resolve(__dirname, '..')
  this.options.alias['~cwa'] = srcDir
  this.options.build.transpile.push(srcDir)
}
