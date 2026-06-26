export type ComponentType = 'basic' | 'image' | 'collection'

export interface ApiCommandOpts {
  timestamped?: boolean
  publishable?: boolean
  uploadable?: boolean
}

export function generateFilePath(name: string): string {
  return `app/cwa/components/${name}/${name}.vue`
}

export function generateComponentTemplate(type: ComponentType): string {
  const scriptLines: string[] = [
    `import type { IriProp } from '#cwa/composables/cwa-resource'`,
    ``,
    `const props = defineProps<IriProp>()`,
  ]

  if (type === 'basic') {
    scriptLines.push(`const { resource, exposeMeta } = useCwaComponent(props)`)
  }
  else if (type === 'image') {
    scriptLines.push(
      `const { resource, exposeMeta, contentUrl, displayMedia, handleLoad, loaded } = useCwaComponent(props, [withImage()])`,
    )
  }
  else if (type === 'collection') {
    scriptLines.push(
      `const { resource, exposeMeta, collectionItems, pageModel, totalPages, goToNextPage, goToPreviousPage, changePage, resolveResourceLink } = useCwaComponent(props, [withCollection()])`,
    )
  }

  scriptLines.push(`defineExpose(exposeMeta)`)

  return [
    `<template>`,
    `  <!-- TODO: add your template -->`,
    `</template>`,
    ``,
    `<script setup lang="ts">`,
    ...scriptLines.map(l => l ? `${l}` : ``),
    `</script>`,
    ``,
  ].join('\n')
}

export function generateApiCommand(name: string, opts: ApiCommandOpts): string {
  const flags = [
    opts.timestamped ? '--timestamped' : null,
    opts.publishable ? '--publishable' : null,
    opts.uploadable ? '--uploadable' : null,
  ].filter(Boolean)

  return [`php bin/console make:api-component`, name, ...flags].join(' ')
}
