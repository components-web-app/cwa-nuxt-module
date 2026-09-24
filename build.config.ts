import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  clean: false,
  hooks: {
    'build:before'(ctx) {
      for (const entry of ctx.options.entries) {
        if ('pattern' in entry && Array.isArray(entry.pattern)) {
          entry.pattern.push('!**/*.{spec,test}.*.snap')
        }
      }
    },
  },
})
