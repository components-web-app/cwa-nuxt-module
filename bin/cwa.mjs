#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

// ── template helpers ────────────────────────────────────────────────────────

function generateFilePath(name) {
  return `app/cwa/components/${name}/${name}.vue`
}

function generateComponentTemplate(type) {
  const lines = [
    `import type { IriProp } from '#cwa/composables/cwa-resource'`,
    ``,
    `const props = defineProps<IriProp>()`,
  ]

  if (type === 'file') {
    lines.push(
      `const { resource, exposeMeta, files } = useCwaComponent(props, [withFile()])`,
    )
  }
  else if (type === 'collection') {
    lines.push(
      `const { resource, exposeMeta, collectionItems, pageModel, totalPages, goToNextPage, goToPreviousPage, changePage, resolveResourceLink } = useCwaComponent(props, [withCollection()])`,
    )
  }
  else {
    lines.push(`const { resource, exposeMeta } = useCwaComponent(props)`)
  }

  lines.push(`defineExpose(exposeMeta)`)

  return [
    `<template>`,
    `  <!-- TODO: add your template -->`,
    `</template>`,
    ``,
    `<script setup lang="ts">`,
    ...lines,
    `</script>`,
    ``,
  ].join('\n')
}

function generateApiCommand(name, opts) {
  const flags = [
    opts.timestamped ? '--timestamped' : null,
    opts.publishable ? '--publishable' : null,
    opts.uploadable ? '--uploadable' : null,
  ].filter(Boolean)
  return [`php bin/console make:api-component`, name, ...flags].join(' ')
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const BOLD = '\x1b[1m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'
const DIM = '\x1b[2m'

function log(msg = '') {
  process.stdout.write(msg + '\n')
}
function success(msg) {
  log(`${GREEN}✓${RESET} ${msg}`)
}
function warn(msg) {
  log(`${YELLOW}${msg}${RESET}`)
}

const [,, command] = process.argv

if (command !== 'make:component') {
  log(`${BOLD}cwa${RESET} — CWA Nuxt module CLI\n`)
  log(`Usage: cwa <command>\n`)
  log(`Commands:`)
  log(`  make:component    Scaffold a new CWA component`)
  process.exit(command ? 1 : 0)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })

async function ask(question) {
  return (await rl.question(question)).trim()
}

async function askChoice(question, choices) {
  log(question)
  choices.forEach((c, i) => log(`  ${DIM}${i + 1}.${RESET} ${c.label}  ${DIM}${c.description}${RESET}`))
  while (true) {
    const answer = await ask(`Enter 1–${choices.length}: `)
    const idx = parseInt(answer) - 1
    if (idx >= 0 && idx < choices.length) return choices[idx].value
    warn(`Please enter a number between 1 and ${choices.length}.`)
  }
}

async function askYesNo(question, defaultYes = false) {
  const hint = defaultYes ? 'Y/n' : 'y/N'
  const answer = await ask(`${question} ${DIM}(${hint})${RESET} `)
  if (!answer) return defaultYes
  return answer.toLowerCase().startsWith('y')
}

log(`\n${BOLD}cwa make:component${RESET}\n`)

let name
while (true) {
  name = await ask(`Component name ${DIM}(PascalCase, e.g. BlogPost)${RESET}: `)
  if (/^[A-Z][A-Za-z0-9]+$/.test(name)) break
  warn(`Name must be PascalCase and start with a capital letter (e.g. BlogPost).`)
}

const type = await askChoice(`\nComponent type:`, [
  { value: 'basic', label: 'Basic', description: 'Standard resource component' },
  { value: 'file', label: 'File', description: 'Includes withFile() plugin (uploadable file fields, files map)' },
  { value: 'collection', label: 'Collection', description: 'Includes withCollection() plugin (pagination, filters)' },
])

log('')
const timestamped = await askYesNo(`Add --timestamped behaviour (createdAt / updatedAt)?`)
const publishable = await askYesNo(`Add --publishable behaviour (draft / published lifecycle)?`)
const uploadable = await askYesNo(
  `Add --uploadable behaviour (file upload)?`,
  type === 'file',
)

rl.close()

const filePath = generateFilePath(name)
const absPath = join(process.cwd(), filePath)

if (existsSync(absPath)) {
  warn(`\nFile already exists: ${filePath}`)
  process.exit(1)
}

await mkdir(dirname(absPath), { recursive: true })
await writeFile(absPath, generateComponentTemplate(type), 'utf8')

log('')
success(`Created ${BOLD}${filePath}${RESET}`)
log(`\n${BOLD}Next: create the API component${RESET}`)
log(`Run in your API project:\n`)
log(`  ${CYAN}${generateApiCommand(name, { timestamped, publishable, uploadable })}${RESET}`)
log(`\n${DIM}Then register the component type in nuxt.config.ts under cwa.resources.${RESET}\n`)
