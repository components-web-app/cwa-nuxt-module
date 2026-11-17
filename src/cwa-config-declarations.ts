import path from 'node:path'
import { babelParse, MagicString, parse } from 'vue/compiler-sfc'
import type { CwaComponentConfig, CwaTemplateConfig, CwaUiVariantConfig } from './runtime/types'

interface RegisteredComponent {
  pascalName: string
  filePath: string
}

export interface ScanCwaConfigDeclarationsOptions {
  templates: RegisteredComponent[]
  readFile: (filePath: string) => string | undefined
  onUncheckable?: (filePath: string, reason: string) => void
}

export interface CwaConfigDeclarations {
  components: Record<string, CwaComponentConfig>
  ui: Record<string, CwaUiVariantConfig>
  layouts: Record<string, CwaTemplateConfig>
  pages: Record<string, CwaTemplateConfig>
}

const MACRO = 'defineCwaConfig'

const COMPONENT_KEYS = ['name', 'description', 'instantAdd', 'defaultData', 'styles', 'multipleStyles'] as const
const UI_KEYS = ['styles', 'multipleStyles'] as const
const TEMPLATE_KEYS = ['name', 'styles'] as const

interface Node {
  type: string
  start?: number | null
  end?: number | null
  [key: string]: any
}

class NotLiteral extends Error {}

function babelPlugins(lang: string | undefined): ('typescript' | 'jsx')[] {
  if (lang === 'ts') {
    return ['typescript']
  }
  if (lang === 'tsx') {
    return ['typescript', 'jsx']
  }
  if (lang === 'jsx') {
    return ['jsx']
  }
  return []
}

function isMacroCall(statement: Node): boolean {
  return statement.type === 'ExpressionStatement'
    && statement.expression.type === 'CallExpression'
    && statement.expression.callee.type === 'Identifier'
    && statement.expression.callee.name === MACRO
}

function propertyKey(property: Node): string {
  if (property.computed) {
    throw new NotLiteral('uses a computed key in defineCwaConfig')
  }
  if (property.key.type === 'Identifier') {
    return property.key.name
  }
  if (property.key.type === 'StringLiteral' || property.key.type === 'NumericLiteral') {
    return String(property.key.value)
  }
  throw new NotLiteral('uses a computed key in defineCwaConfig')
}

function literalValue(node: Node): unknown {
  switch (node.type) {
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      return literalValue(node.expression)
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value
    case 'NullLiteral':
      return null
    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') {
        return -node.argument.value
      }
      break
    case 'TemplateLiteral':
      if (node.expressions.length) {
        throw new NotLiteral('interpolates a template literal in defineCwaConfig')
      }
      return node.quasis.map((quasi: Node) => quasi.value.cooked).join('')
    case 'ArrayExpression':
      return node.elements.map((element: Node | null) => {
        if (!element) {
          throw new NotLiteral('passes defineCwaConfig something that is not a literal')
        }
        if (element.type === 'SpreadElement') {
          throw new NotLiteral('uses a spread in defineCwaConfig')
        }
        return literalValue(element)
      })
    case 'ObjectExpression': {
      const value: Record<string, unknown> = {}
      for (const property of node.properties) {
        if (property.type === 'SpreadElement') {
          throw new NotLiteral('uses a spread in defineCwaConfig')
        }
        if (property.type !== 'ObjectProperty') {
          throw new NotLiteral('passes defineCwaConfig something that is not a literal')
        }
        value[propertyKey(property)] = literalValue(property.value)
      }
      return value
    }
    case 'Identifier':
      throw new NotLiteral('passes defineCwaConfig a variable, not a literal')
    case 'CallExpression':
    case 'NewExpression':
      throw new NotLiteral('calls a function in defineCwaConfig')
  }
  throw new NotLiteral('passes defineCwaConfig something that is not a literal')
}

function readConfig(filePath: string, source: string | undefined): Record<string, unknown> | string | undefined {
  if (source === undefined) {
    return 'could not be read'
  }
  const { descriptor, errors } = parse(source, { filename: filePath })
  if (errors.length) {
    return 'could not be parsed'
  }
  const calls: Node[] = []
  for (const script of [descriptor.script, descriptor.scriptSetup]) {
    if (!script) {
      continue
    }
    let program
    try {
      program = babelParse(script.content, { sourceType: 'module', plugins: babelPlugins(script.lang) }).program
    }
    catch {
      return 'could not be parsed'
    }
    calls.push(...(program.body as Node[]).filter(isMacroCall).map(statement => statement.expression))
  }
  if (!calls.length) {
    return undefined
  }
  if (calls.length > 1) {
    return 'calls defineCwaConfig more than once'
  }
  const [argument] = calls[0]!.arguments as Node[]
  if (!argument) {
    return 'passes defineCwaConfig something that is not a literal'
  }
  try {
    const value = literalValue(argument)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return 'passes defineCwaConfig something that is not a literal'
    }
    return value as Record<string, unknown>
  }
  catch (error) {
    if (error instanceof NotLiteral) {
      return error.message
    }
    throw error
  }
}

function pick<K extends string>(config: Record<string, unknown>, keys: readonly K[]) {
  return Object.fromEntries(keys.filter(key => key in config).map(key => [key, config[key]]))
}

export function scanCwaConfigDeclarations(options: ScanCwaConfigDeclarationsOptions): CwaConfigDeclarations {
  const result: CwaConfigDeclarations = { components: {}, ui: {}, layouts: {}, pages: {} }
  for (const { pascalName, filePath } of options.templates) {
    const config = readConfig(filePath, options.readFile(filePath))
    if (config === undefined) {
      continue
    }
    if (typeof config === 'string') {
      options.onUncheckable?.(filePath, config)
      continue
    }
    if (pascalName.startsWith('CwaLayout')) {
      result.layouts[pascalName.replace(/^CwaLayout/, '')] = pick(config, TEMPLATE_KEYS)
    }
    else if (pascalName.startsWith('CwaPage')) {
      result.pages[pascalName.replace(/^CwaPage/, '')] = pick(config, TEMPLATE_KEYS)
    }
    else if (path.basename(path.dirname(filePath)) === 'ui') {
      result.ui[pascalName] = pick(config, UI_KEYS)
    }
    else {
      result.components[pascalName.replace(/^CwaComponent/, '')] = pick(config, COMPONENT_KEYS)
    }
  }
  return result
}

export function stripDefineCwaConfig(code: string, id: string): { code: string, map: ReturnType<MagicString['generateMap']> } | undefined {
  if (!id.endsWith('.vue') || !code.includes(MACRO)) {
    return
  }
  const { descriptor, errors } = parse(code, { filename: id })
  if (errors.length) {
    return
  }
  const output = new MagicString(code)
  for (const script of [descriptor.script, descriptor.scriptSetup]) {
    if (!script) {
      continue
    }
    let program
    try {
      program = babelParse(script.content, { sourceType: 'module', plugins: babelPlugins(script.lang) }).program
    }
    catch {
      return
    }
    for (const statement of (program.body as Node[]).filter(isMacroCall)) {
      output.remove(script.loc.start.offset + statement.start!, script.loc.start.offset + statement.end!)
    }
  }
  if (!output.hasChanged()) {
    return
  }
  return { code: output.toString(), map: output.generateMap({ hires: true, source: id, includeContent: true }) }
}
