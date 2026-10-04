import { babelParse, parse } from 'vue/compiler-sfc'
import type { ComponentGroupDeclaration, ComponentGroupDeclarations } from './runtime/admin/stranded-component-groups'

interface RegisteredComponent {
  pascalName: string
  filePath: string
}

export interface ScanComponentGroupDeclarationsOptions {
  templates: RegisteredComponent[]
  components: RegisteredComponent[]
  componentGroupFile: string
  readFile: (filePath: string) => string | undefined
  resolveImport: (source: string, importer: string) => string | undefined
  onUncheckable?: (filePath: string, reason: string) => void
}

interface FileScan {
  declarations: ComponentGroupDeclaration[]
  children: string[]
}

interface AstNode {
  type: number
  tag?: string
  props?: AstNode[]
  children?: AstNode[]
  name?: string
  value?: { content: string }
  arg?: { content: string, isStatic: boolean }
  exp?: { content: string }
}

const NODE_ELEMENT = 1
const NODE_ATTRIBUTE = 6
const NODE_DIRECTIVE = 7

const ANY_REFERENCE: ComponentGroupDeclaration = { reference: null, location: 'unknown' }
const V_BIND_OBJECT = Symbol('v-bind object')
const SELF_EXPRESSIONS = ['iri', 'publishedIri']
const LAYOUT_EXPRESSIONS = ['$cwa.resources.layoutIri', 'layoutIri']

function toPascalCase(tag: string) {
  return tag
    .replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())
    .replace(/^\w/, letter => letter.toUpperCase())
}

function camelize(name: string) {
  return name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())
}

function stringLiteral(expression: string): string | undefined {
  const match = expression.trim().match(/^(['"`])([^'"`\\$]*)\1$/)
  return match?.[2]
}

function normaliseExpression(expression: string) {
  return expression
    .replace(/\s+/g, '')
    .replace(/\?\./g, '.')
    .replace(/^\$?props\./, '')
    .replace(/\.value$/, '')
}

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

function findDynamicVueImport(node: unknown): string | undefined {
  if (!node || typeof node !== 'object') {
    return
  }
  const candidate = node as { type?: string, callee?: { type?: string }, arguments?: { type?: string, value?: unknown }[], source?: { type?: string, value?: unknown } }
  if (candidate.type === 'CallExpression' && candidate.callee?.type === 'Import') {
    const [source] = candidate.arguments ?? []
    if (source?.type === 'StringLiteral' && typeof source.value === 'string') {
      return source.value
    }
  }
  if (candidate.type === 'ImportExpression' && candidate.source?.type === 'StringLiteral' && typeof candidate.source.value === 'string') {
    return candidate.source.value
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') {
      continue
    }
    const children = Array.isArray(value) ? value : [value]
    for (const child of children) {
      const found = findDynamicVueImport(child)
      if (found) {
        return found
      }
    }
  }
}

export function scanComponentGroupDeclarations(options: ScanComponentGroupDeclarationsOptions): ComponentGroupDeclarations {
  const templateFiles = new Set(options.templates.map(({ filePath }) => filePath))
  const registry = new Map<string, string[]>()
  for (const { pascalName, filePath } of options.components) {
    registry.set(pascalName, [...(registry.get(pascalName) ?? []), filePath])
  }
  const scans = new Map<string, FileScan>()

  function localBindings(filePath: string, scripts: { content: string, lang?: string }[]): Map<string, string[]> | undefined {
    const bindings = new Map<string, string[]>()
    for (const script of scripts) {
      let program
      try {
        program = babelParse(script.content, { sourceType: 'module', plugins: babelPlugins(script.lang) }).program
      }
      catch {
        return undefined
      }
      for (const statement of program.body) {
        if (statement.type === 'ImportDeclaration') {
          const source = statement.source.value
          for (const specifier of statement.specifiers) {
            if (source === '#components' && specifier.type === 'ImportSpecifier') {
              const imported = specifier.imported.type === 'Identifier' ? specifier.imported.name : specifier.imported.value
              bindings.set(specifier.local.name, registry.get(imported) ?? [])
              continue
            }
            if (specifier.type === 'ImportDefaultSpecifier') {
              const resolved = options.resolveImport(source, filePath)
              resolved && bindings.set(specifier.local.name, [resolved])
            }
          }
          continue
        }
        if (statement.type === 'VariableDeclaration') {
          for (const declarator of statement.declarations) {
            if (declarator.id.type !== 'Identifier') {
              continue
            }
            const source = findDynamicVueImport(declarator.init)
            const resolved = source && options.resolveImport(source, filePath)
            resolved && bindings.set(declarator.id.name, [resolved])
          }
        }
      }
    }
    return bindings
  }

  function resolveTag(tag: string, bindings: Map<string, string[]>): string[] {
    const pascal = toPascalCase(tag)
    const local = bindings.get(tag) ?? bindings.get(pascal)
    if (local) {
      return local
    }
    return registry.get(pascal) ?? registry.get(pascal.replace(/^Lazy/, '')) ?? []
  }

  function isComponentGroup(tag: string, files: string[]) {
    return toPascalCase(tag).replace(/^Lazy/, '') === 'CwaComponentGroup' || files.includes(options.componentGroupFile)
  }

  function declarationFor(element: AstNode, inTemplate: boolean): ComponentGroupDeclaration | typeof V_BIND_OBJECT {
    const statics = new Map<string, string>()
    const bound = new Map<string, string>()
    for (const prop of element.props ?? []) {
      if (prop.type === NODE_ATTRIBUTE && prop.name) {
        statics.set(camelize(prop.name), prop.value?.content ?? '')
        continue
      }
      if (prop.type !== NODE_DIRECTIVE || prop.name !== 'bind') {
        continue
      }
      if (!prop.arg) {
        return V_BIND_OBJECT
      }
      if (prop.arg.isStatic) {
        bound.set(camelize(prop.arg.content), prop.exp?.content ?? '')
      }
    }
    const literal = (name: string) => statics.has(name) ? statics.get(name) : stringLiteral(bound.get(name) ?? '')
    const reference = literal('reference') ?? null
    const locationReference = literal('locationReference')
    if (locationReference) {
      return { reference, location: 'fixed', locationReference }
    }
    if (bound.has('locationReference')) {
      return { reference, location: 'unknown' }
    }
    const location = bound.get('location')
    const expression = location === undefined ? undefined : normaliseExpression(location)
    if (expression && LAYOUT_EXPRESSIONS.includes(expression)) {
      return { reference, location: 'layout' }
    }
    if (inTemplate && expression && SELF_EXPRESSIONS.includes(expression)) {
      return { reference, location: 'self' }
    }
    return { reference, location: 'unknown' }
  }

  function scanFile(filePath: string): FileScan {
    const cached = scans.get(filePath)
    if (cached) {
      return cached
    }
    const result: FileScan = { declarations: [], children: [] }
    scans.set(filePath, result)

    const uncheckable = (reason: string) => {
      if (!result.declarations.includes(ANY_REFERENCE)) {
        result.declarations.push(ANY_REFERENCE)
      }
      options.onUncheckable?.(filePath, reason)
    }

    const source = options.readFile(filePath)
    if (source === undefined) {
      uncheckable('could not be read')
      return result
    }
    const { descriptor, errors } = parse(source, { filename: filePath })
    const scripts = [descriptor.script, descriptor.scriptSetup].filter(script => !!script)
    const bindings = errors.length ? undefined : localBindings(filePath, scripts)
    const ast = descriptor.template?.ast as AstNode | undefined
    if (!bindings || (descriptor.template && !ast)) {
      uncheckable('could not be parsed')
      return result
    }
    if (descriptor.template && (descriptor.template.lang ?? 'html') !== 'html') {
      uncheckable('has a template that is not HTML')
      return result
    }
    const inTemplate = templateFiles.has(filePath)

    const visit = (node: AstNode) => {
      if (node.type === NODE_ELEMENT && node.tag) {
        const files = resolveTag(node.tag, bindings)
        if (isComponentGroup(node.tag, files)) {
          const declaration = declarationFor(node, inTemplate)
          if (declaration === V_BIND_OBJECT) {
            uncheckable('binds its props with a v-bind object')
          }
          else if (declaration.reference === null && declaration.location === 'unknown') {
            uncheckable('binds reference at a location that cannot be classified')
          }
          else {
            result.declarations.push(declaration)
          }
        }
        else {
          for (const file of files) {
            if (file.endsWith('.vue') && !templateFiles.has(file) && !result.children.includes(file)) {
              result.children.push(file)
            }
          }
        }
      }
      node.children?.forEach(visit)
    }
    if (ast) {
      visit(ast)
    }
    return result
  }

  function reachableDeclarations(templateFile: string) {
    const declarations: ComponentGroupDeclaration[] = []
    const seenDeclarations = new Set<string>()
    const visited = new Set<string>()
    const walk = (filePath: string) => {
      if (visited.has(filePath)) {
        return
      }
      visited.add(filePath)
      const { declarations: own, children } = scanFile(filePath)
      for (const declaration of own) {
        const key = JSON.stringify(declaration)
        if (!seenDeclarations.has(key)) {
          seenDeclarations.add(key)
          declarations.push(declaration)
        }
      }
      children.forEach(walk)
    }
    walk(templateFile)
    return declarations
  }

  const result: ComponentGroupDeclarations = {}
  for (const { pascalName, filePath } of options.templates) {
    const declarations = reachableDeclarations(filePath)
    const existing = result[pascalName]
    result[pascalName] = existing
      ? [...existing, ...declarations.filter(declaration => !existing.some(other => JSON.stringify(other) === JSON.stringify(declaration)))]
      : declarations
  }
  return result
}
