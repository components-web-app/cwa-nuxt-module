<script setup lang="ts">
import { computed, nextTick, reactive, ref, useTemplateRef } from 'vue'
import type { Component } from 'vue'
import Menu from './Menu.vue'
import type { MenuEntry } from '../core/ui/menu-entries'

export interface TreeNode {
  key: string
  label: string
  children?: TreeNode[]
}

export interface TreeAction {
  label: string
  icon?: Component
  danger?: boolean
  delete?: boolean
  run?: (node: TreeNode) => void
  menu?: MenuEntry[]
}

interface TreeRow {
  node: TreeNode
  parent?: TreeNode
  level: number
  setSize: number
  posInSet: number
  last: boolean
  guides: boolean[]
}

const { label, nodes, actions, empty, mono = true } = defineProps<{
  label: string
  nodes: TreeNode[]
  actions?: (node: TreeNode, parent?: TreeNode) => TreeAction[]
  empty?: string
  mono?: boolean
}>()

defineSlots<{
  label?: (props: { node: TreeNode, parent?: TreeNode }) => any
  badge?: (props: { node: TreeNode, parent?: TreeNode }) => any
}>()

const INDENT = 1.5

const collapsed = reactive(new Set<string>())
const activeKey = ref<string>()
const grid = useTemplateRef<HTMLElement>('grid')

function flatten(list: TreeNode[], level: number, guides: boolean[], parent?: TreeNode): TreeRow[] {
  return list.flatMap((node, index) => {
    const last = index === list.length - 1
    const row: TreeRow = { node, parent, level, setSize: list.length, posInSet: index + 1, last, guides }
    const open = !!node.children?.length && !collapsed.has(node.key)
    return [row, ...(open ? flatten(node.children!, level + 1, level > 1 ? [...guides, !last] : guides, node) : [])]
  })
}

const rows = computed(() => flatten(nodes, 1, []))
const tabStop = computed(() => rows.value.find(row => row.node.key === activeKey.value)?.node.key ?? rows.value[0]?.node.key)
const rowActions = computed(() => new Map(rows.value.map(row => [row.node.key, actions?.(row.node, row.parent) ?? []])))

function hasChildren(row: TreeRow) {
  return !!row.node.children?.length
}

function rowElement(key: string) {
  return grid.value?.querySelector<HTMLElement>(`[data-tree-key="${CSS.escape(key)}"]`) ?? null
}

async function focusRow(key: string) {
  activeKey.value = key
  await nextTick()
  rowElement(key)?.focus()
}

function toggle(row: TreeRow, open?: boolean) {
  const next = open ?? collapsed.has(row.node.key)
  next ? collapsed.delete(row.node.key) : collapsed.add(row.node.key)
}

function actionElements(key: string) {
  return [...rowElement(key)?.querySelectorAll<HTMLElement>('[data-testid="tree-action"]') ?? []]
}

function runAction(row: TreeRow, action: TreeAction | undefined, index: number) {
  if (!action) {
    return
  }
  if (action.menu) {
    actionElements(row.node.key)[index]?.click()
    return
  }
  action.run?.(row.node)
}

function onRowKeydown(event: KeyboardEvent, row: TreeRow) {
  if (event.target !== event.currentTarget) {
    return
  }
  const list = rows.value
  const index = list.indexOf(row)
  const moves: Record<string, number | undefined> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 }
  if (event.key in moves) {
    event.preventDefault()
    const target = list[moves[event.key]!]
    target && focusRow(target.node.key)
    return
  }
  const own = rowActions.value.get(row.node.key) ?? []
  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault()
      if (hasChildren(row) && collapsed.has(row.node.key)) {
        toggle(row, true)
      }
      else {
        actionElements(row.node.key)[0]?.focus()
      }
      return
    case 'ArrowLeft':
      event.preventDefault()
      if (hasChildren(row) && !collapsed.has(row.node.key)) {
        toggle(row, false)
      }
      else if (row.parent) {
        focusRow(row.parent.key)
      }
      return
    case 'Enter':
      if (own[0] && !own[0].delete) {
        event.preventDefault()
        runAction(row, own[0], 0)
      }
      return
    case 'Delete':
    case 'Backspace': {
      const index = own.findIndex(action => action.delete)
      if (index !== -1) {
        event.preventDefault()
        runAction(row, own[index], index)
      }
    }
  }
}

function onActionKeydown(event: KeyboardEvent, row: TreeRow, index: number) {
  if (event.key === 'ArrowLeft' || event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'ArrowLeft' && index > 0) {
      actionElements(row.node.key)[index - 1]?.focus()
      return
    }
    focusRow(row.node.key)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    event.stopPropagation()
    actionElements(row.node.key)[index + 1]?.focus()
  }
}

function guideStyle(depth: number) {
  return { insetInlineStart: `${depth * INDENT + INDENT / 2}rem` }
}

function elbowStyle(level: number) {
  return { insetInlineStart: `${(level - 2) * INDENT + INDENT / 2}rem`, width: `${INDENT}rem` }
}

const actionClasses = 'cwa:grid cwa:size-10 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:text-fg-muted cwa:outline-1 cwa:outline-transparent cwa:transition-colors cwa:duration-(--cwa-duration-fast) cwa:hover:bg-step-hover cwa:focus-visible:bg-step-hover cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:size-hit'
</script>

<template>
  <p
    v-if="!nodes.length"
    data-testid="tree-empty"
    class="cwa:m-0 cwa:text-control cwa:text-fg-muted"
  >
    {{ empty }}
  </p>
  <div
    v-else
    ref="grid"
    role="treegrid"
    :aria-label="label"
    data-testid="tree"
    class="cwa:flex cwa:flex-col"
  >
    <div
      v-for="row in rows"
      :key="row.node.key"
      role="row"
      :aria-level="row.level"
      :aria-setsize="row.setSize"
      :aria-posinset="row.posInSet"
      :aria-expanded="hasChildren(row) ? !collapsed.has(row.node.key) : undefined"
      :tabindex="tabStop === row.node.key ? 0 : -1"
      :data-tree-key="row.node.key"
      class="cwa:relative cwa:flex cwa:min-h-hit cwa:items-center cwa:border-b cwa:border-line cwa:text-control cwa:text-fg cwa:outline-1 cwa:outline-transparent cwa:focus-visible:outline-2 cwa:focus-visible:-outline-offset-2 cwa:focus-visible:outline-accent-fg cwa:pointer-coarse:min-h-12"
      @keydown="onRowKeydown($event, row)"
      @click="activeKey = row.node.key"
    >
      <div
        role="gridcell"
        class="cwa:relative cwa:flex cwa:min-w-0 cwa:flex-1 cwa:items-center cwa:gap-2 cwa:self-stretch"
      >
        <template
          v-for="(guide, depth) in row.guides"
          :key="depth"
        >
          <span
            v-if="guide"
            aria-hidden="true"
            data-testid="tree-guide"
            class="cwa:absolute cwa:inset-y-0 cwa:w-px cwa:bg-tree-line"
            :style="guideStyle(depth)"
          />
        </template>
        <template v-if="row.level > 1">
          <span
            aria-hidden="true"
            data-testid="tree-elbow"
            :data-last="String(row.last)"
            class="cwa:absolute cwa:top-0 cwa:w-px cwa:bg-tree-line"
            :class="row.last ? 'cwa:h-1/2' : 'cwa:h-full'"
            :style="{ insetInlineStart: elbowStyle(row.level).insetInlineStart }"
          />
          <span
            aria-hidden="true"
            class="cwa:absolute cwa:top-1/2 cwa:h-px cwa:bg-tree-line"
            :style="elbowStyle(row.level)"
          />
        </template>
        <span
          aria-hidden="true"
          data-testid="tree-indent"
          class="cwa:shrink-0"
          :style="{ width: `${(row.level - 1) * INDENT}rem` }"
        />
        <span
          v-if="hasChildren(row)"
          aria-hidden="true"
          data-testid="tree-chevron"
          class="cwa:relative cwa:grid cwa:w-6 cwa:shrink-0 cwa:cursor-pointer cwa:place-items-center cwa:self-stretch cwa:text-fg-muted cwa:before:absolute cwa:before:inset-y-0 cwa:before:-inset-x-2 cwa:before:content-[''] cwa:hover:text-fg"
          @click.stop="toggle(row)"
        >
          <svg
            viewBox="0 0 10 10"
            class="cwa:size-3 cwa:fill-current cwa:transition-transform cwa:duration-(--cwa-duration-fast) cwa:motion-reduce:transition-none"
            :class="{ 'cwa:rotate-90': !collapsed.has(row.node.key) }"
          ><path d="M3 1v8l5-4z" /></svg>
        </span>
        <span
          v-else
          aria-hidden="true"
          data-testid="tree-spacer"
          class="cwa:w-6 cwa:shrink-0"
        />
        <span
          data-testid="tree-label"
          class="cwa:min-w-0 cwa:truncate cwa:py-2"
          :class="{ 'cwa:font-mono': mono && !$slots.label }"
        >
          <slot
            name="label"
            :node="row.node"
            :parent="row.parent"
          >{{ row.node.label }}</slot>
        </span>
        <span
          v-if="$slots.badge"
          class="cwa:shrink-0"
        >
          <slot
            name="badge"
            :node="row.node"
            :parent="row.parent"
          />
        </span>
      </div>
      <div
        v-if="rowActions.get(row.node.key)?.length"
        role="gridcell"
        class="cwa:flex cwa:shrink-0 cwa:items-center"
      >
        <template
          v-for="(action, index) in rowActions.get(row.node.key)"
          :key="action.label"
        >
          <Menu
            v-if="action.menu"
            :items="action.menu"
            :label="action.label"
            side="bottom"
          >
            <button
              type="button"
              tabindex="-1"
              :aria-label="action.label"
              data-testid="tree-action"
              :class="[actionClasses, 'cwa:hover:text-fg']"
              @keydown="onActionKeydown($event, row, index)"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden="true"
                fill="currentColor"
                class="cwa:size-4"
              ><circle
                cx="8"
                cy="3"
                r="1.6"
              /><circle
                cx="8"
                cy="8"
                r="1.6"
              /><circle
                cx="8"
                cy="13"
                r="1.6"
              /></svg>
            </button>
          </Menu>
          <button
            v-else
            type="button"
            tabindex="-1"
            :aria-label="action.label"
            data-testid="tree-action"
            :class="[actionClasses, action.danger ? 'cwa:hover:text-danger-fg cwa:focus-visible:text-danger-fg' : 'cwa:hover:text-fg cwa:focus-visible:text-fg']"
            @click="action.run?.(row.node)"
            @keydown="onActionKeydown($event, row, index)"
          >
            <component
              :is="action.icon"
              v-if="action.icon"
              aria-hidden="true"
              class="cwa:size-4"
            />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
