import type { CwaResource } from '../../../src/runtime/resources/resource-utils'

export type PracticeState = 'draft' | 'full' | 'live' | 'new-publishable' | 'new-plain' | 'group' | 'empty'

export const practiceStates: { value: PracticeState, label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'full', label: 'Draft in a full group' },
  { value: 'live', label: 'Live' },
  { value: 'new-publishable', label: 'New, publishable' },
  { value: 'new-plain', label: 'New, not publishable' },
  { value: 'group', label: 'Group' },
  { value: 'empty', label: 'Empty group' },
]

export const PRACTICE = {
  page: '/_/pages/kit-practice',
  group: '/_/component_groups/kit-practice-main',
  empty: '/_/component_groups/kit-practice-empty',
  heading: '/_/component_positions/kit-practice-1',
  body: '/_/component_positions/kit-practice-2',
  repeat: '/_/component_positions/kit-practice-3',
  title: '/component/titles/kit-practice-title',
  html: '/component/html_contents/kit-practice-html',
} as const

export const PRACTICE_GROUP_CAPACITY = 3

const meta = { persisted: true }

export function practiceResources(state: PracticeState): CwaResource[] {
  const published = state === 'live'
  return [
    { '@id': PRACTICE.page, '@type': 'Page', 'reference': 'Kit practice', 'title': 'Kitchens', 'isTemplate': false, 'componentGroups': [PRACTICE.group, PRACTICE.empty], '_metadata': meta },
    { '@id': PRACTICE.group, '@type': 'ComponentGroup', 'reference': `main_${PRACTICE.page}`, 'location': PRACTICE.page, 'componentPositions': [PRACTICE.heading, PRACTICE.body, PRACTICE.repeat], ...(state === 'full' && { maxComponents: PRACTICE_GROUP_CAPACITY }), '_metadata': meta },
    { '@id': PRACTICE.empty, '@type': 'ComponentGroup', 'reference': `empty_${PRACTICE.page}`, 'location': PRACTICE.page, 'componentPositions': [], '_metadata': meta },
    { '@id': PRACTICE.heading, '@type': 'ComponentPosition', 'componentGroup': PRACTICE.group, 'component': PRACTICE.title, 'sortValue': 1, '_metadata': meta },
    { '@id': PRACTICE.body, '@type': 'ComponentPosition', 'componentGroup': PRACTICE.group, 'component': PRACTICE.html, 'sortValue': 2, '_metadata': meta },
    { '@id': PRACTICE.repeat, '@type': 'ComponentPosition', 'componentGroup': PRACTICE.group, 'component': PRACTICE.title, 'sortValue': 3, '_metadata': meta },
    { '@id': PRACTICE.title, '@type': 'Title', 'title': 'Shaker kitchens, built by hand', 'componentPositions': [PRACTICE.heading, PRACTICE.repeat], '_metadata': { ...meta, publishable: { published, publishedAt: published ? '2026-11-01T09:00:00.000Z' : null } } },
    { '@id': PRACTICE.html, '@type': 'HtmlContent', 'html': '<p>Every kitchen is made to measure in our Kent workshop, from solid timber, and fitted by the people who built it.</p>', 'componentPositions': [PRACTICE.body], '_metadata': meta },
  ] as unknown as CwaResource[]
}

export function practiceSelection(state: PracticeState): string {
  if (state === 'group') {
    return PRACTICE.group
  }
  if (state === 'empty') {
    return PRACTICE.empty
  }
  return PRACTICE.title
}

export function practiceNewResource(state: PracticeState) {
  if (state !== 'new-publishable' && state !== 'new-plain') {
    return undefined
  }
  return {
    event: { addAfter: true, targetIri: PRACTICE.body, closest: { group: PRACTICE.group, position: PRACTICE.body } },
    type: state === 'new-publishable' ? 'Title' : 'HtmlContent',
    endpoint: state === 'new-publishable' ? '/component/titles' : '/component/html_contents',
    isPublishable: state === 'new-publishable',
  }
}
