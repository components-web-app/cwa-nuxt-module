import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import AddComponentLead from './AddComponentLead.vue'

describe('AddComponentLead', () => {
  test('a dynamic slot leads with the round Dynamic dot the page type select and lists use', () => {
    const lead = mount(AddComponentLead, { props: { name: 'Anything', dynamic: true } }).get('[data-lead="dynamic"]')
    expect(lead.classes()).toEqual(expect.arrayContaining(['cwa:rounded-full', 'cwa:bg-type-dynamic']))
  })
})
