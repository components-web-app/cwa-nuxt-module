import { join } from 'path'
import { mock } from 'mock-json-schema'
import VueRouter from 'vue-router'
import $axios from 'axios'
import { routeOption } from '../../../src/utils'
import routeLoaderMiddleware from '../../../src/core/middleware'

jest.mock('axios')
jest.mock('vue-router')
jest.mock('../../../src/utils')

test('should be disabled when route option cwa is false', () => {
  const { route } = new VueRouter()
  routeOption.mockReturnValue(false)

  const schema = require(join(__dirname, '../../schema/collection.schema.json'))
  const mockResponse = mock(schema.definitions['Collection:jsonld'])
  $axios.get.mockResolvedValue(mockResponse)

  routeLoaderMiddleware({
    route,
    $axios
  })

  const routeOptionCalls = routeOption.mock.calls

  expect(routeOptionCalls.length).toBe(1)
  expect(routeOptionCalls[0][0]).toBe(route)
  expect(routeOptionCalls[0][1]).toBe('cwa')
  expect(routeOptionCalls[0][2]).toBe(false)

  expect($axios.get.mock.calls.length).toBe(0)
  // expect($axios.get.mock.calls[0][0]).toBe('/any-path')
})
