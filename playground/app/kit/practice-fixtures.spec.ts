import { describe, expect, test } from 'vitest'
import { componentGroupCapacity } from '../../../src/runtime/resources/component-group-capacity'
import { PRACTICE, practiceNewResource, practiceResources, practiceSelection, practiceStates } from './practice-fixtures'

function byId(state: Parameters<typeof practiceResources>[0]) {
  return Object.fromEntries(practiceResources(state).map(resource => [resource['@id'], resource]))
}

describe('the In practice page\'s fake site', () => {
  test('Draft and Live differ only in whether the selected title is published', () => {
    expect(byId('draft')[PRACTICE.title]!._metadata.publishable?.published).toBe(false)
    expect(byId('live')[PRACTICE.title]!._metadata.publishable?.published).toBe(true)
  })

  test('the title sits in two positions, so selecting one shows the other as a shared instance', () => {
    const resources = byId('draft')
    expect(resources[PRACTICE.title]!.componentPositions).toEqual([PRACTICE.heading, PRACTICE.repeat])
    expect([PRACTICE.heading, PRACTICE.repeat].map(iri => resources[iri]!.component)).toEqual([PRACTICE.title, PRACTICE.title])
  })

  test('Draft in a full group is full by the module\'s own capacity rule, and Draft is not', () => {
    expect(componentGroupCapacity(byId('full')[PRACTICE.group] as never)).toMatchObject({ full: true })
    expect(componentGroupCapacity(byId('draft')[PRACTICE.group] as never)).toMatchObject({ full: false })
  })

  test('the empty group has no positions, and each state selects what its name says', () => {
    expect(byId('empty')[PRACTICE.empty]!.componentPositions).toEqual([])
    expect(practiceSelection('group')).toBe(PRACTICE.group)
    expect(practiceSelection('empty')).toBe(PRACTICE.empty)
    expect(practiceSelection('live')).toBe(PRACTICE.title)
  })

  test('only the two New states add a resource, publishable or not', () => {
    expect(practiceStates.filter(state => practiceNewResource(state.value)).map(state => state.value)).toEqual(['new-publishable', 'new-plain'])
    expect(practiceNewResource('new-publishable')?.isPublishable).toBe(true)
    expect(practiceNewResource('new-plain')?.isPublishable).toBe(false)
  })
})
