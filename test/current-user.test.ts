import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import cds from '@sap/cds'
import { as } from './support.js'

const test = cds.test(import.meta.dirname + '/..')
const { GET, PATCH, axios } = test

axios.defaults.validateStatus = () => true
axios.defaults.path = '/odata/v4/spacefarer'

describe('CurrentUser', () => {
  const expected = {
    alice: { canManageSpacefarers: true, canChoosePlanet: true },
    xavier: { canManageSpacefarers: true, canChoosePlanet: false },
    xena: { canManageSpacefarers: false, canChoosePlanet: false },
    nobody: { canManageSpacefarers: false, canChoosePlanet: false },
  }

  for (const [username, permissions] of Object.entries(expected)) {
    it(`tells the UI what ${username} may do`, async () => {
      const response = await GET('/CurrentUser', as(username))
      assert.equal(response.status, 200)
      assert.equal(response.data.id, username)
      assert.equal(response.data.canManageSpacefarers, permissions.canManageSpacefarers)
      assert.equal(response.data.canChoosePlanet, permissions.canChoosePlanet)
    })
  }

  it('requires authentication', async () => {
    const response = await GET('/CurrentUser')
    assert.equal(response.status, 401)
  })

  it('cannot be changed', async () => {
    const response = await PATCH('/CurrentUser', { canManageSpacefarers: true }, as('xena'))
    assert.equal(response.status, 405)
  })
})
