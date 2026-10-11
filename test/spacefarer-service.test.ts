import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import cds from '@sap/cds'

const test = cds.test(import.meta.dirname + '/..')
const { GET, POST, PATCH, DELETE, axios } = test

// Resolve on every status code, so tests can assert on rejections
axios.defaults.validateStatus = () => true
axios.defaults.path = '/odata/v4/spacefarer'

const as = (username: string) => ({ auth: { username, password: 'pass' } })

const PLANET_X_SPACEFARER = 'a0000000-0000-4000-8000-000000000001' // Nova Kepler
const PLANET_Y_SPACEFARER = 'a0000000-0000-4000-8000-000000000007' // Vela Andromeda

const recruit = (planet: string, overrides: Record<string, unknown> = {}) => ({
  name: 'Ada Starling',
  email: 'ada.starling@spacefarers.example',
  originPlanet_code: planet,
  ...overrides,
})

const planetsOf = (response: { data: { value: { originPlanet_code: string }[] } }) => [
  ...new Set(response.data.value.map(spacefarer => spacefarer.originPlanet_code)),
]

describe('SpacefarerService', () => {
  beforeEach(() => test.data.reset())

  describe('cosmic invaders', () => {
    it('rejects requests without credentials', async () => {
      const response = await GET('/Spacefarers')
      assert.equal(response.status, 401)
    })

    it('rejects requests with a wrong password', async () => {
      const response = await GET('/Spacefarers', { auth: { username: 'xena', password: 'wrong' } })
      assert.equal(response.status, 401)
    })

    it('rejects unknown users', async () => {
      const response = await GET('/Spacefarers', as('zorg'))
      assert.equal(response.status, 401)
    })

    it('denies spacefarer data to users without a role', async () => {
      const response = await GET('/Spacefarers', as('nobody'))
      assert.equal(response.status, 403)
    })
  })

  describe('viewer of Planet X', () => {
    it('sees only the spacefarers of Planet X', async () => {
      const response = await GET('/Spacefarers', as('xena'))
      assert.equal(response.status, 200)
      assert.equal(response.data.value.length, 6)
      assert.deepEqual(planetsOf(response), ['X'])
    })

    it('counts only the spacefarers of Planet X', async () => {
      const response = await GET('/Spacefarers/$count', as('xena'))
      assert.equal(response.data, 6)
    })

    it('cannot read a spacefarer of Planet Y', async () => {
      const response = await GET(`/Spacefarers(${PLANET_Y_SPACEFARER})`, as('xena'))
      assert.equal(response.status, 404)
    })

    it('cannot create a spacefarer', async () => {
      const response = await POST('/Spacefarers', recruit('X'), as('xena'))
      assert.equal(response.status, 403)
    })

    it('cannot update a spacefarer', async () => {
      const response = await PATCH(`/Spacefarers(${PLANET_X_SPACEFARER})`, { spacesuitColor_code: 'COMET_WHITE' }, as('xena'))
      assert.equal(response.status, 403)
    })

    it('cannot delete a spacefarer', async () => {
      const response = await DELETE(`/Spacefarers(${PLANET_X_SPACEFARER})`, as('xena'))
      assert.equal(response.status, 403)
    })
  })

  describe('viewer of Planet Y', () => {
    it('sees only the spacefarers of Planet Y', async () => {
      const response = await GET('/Spacefarers', as('yuri'))
      assert.equal(response.data.value.length, 6)
      assert.deepEqual(planetsOf(response), ['Y'])
    })
  })

  describe('manager of Planet X', () => {
    it('creates a spacefarer on Planet X', async () => {
      const response = await POST('/Spacefarers', recruit('X'), as('xavier'))
      assert.equal(response.status, 201)
      assert.equal(response.data.originPlanet_code, 'X')
    })

    it('updates a spacefarer of Planet X', async () => {
      const response = await PATCH(`/Spacefarers(${PLANET_X_SPACEFARER})`, { spacesuitColor_code: 'COMET_WHITE' }, as('xavier'))
      assert.equal(response.status, 200)
      assert.equal(response.data.spacesuitColor_code, 'COMET_WHITE')
    })

    it('deletes a spacefarer of Planet X', async () => {
      const response = await DELETE(`/Spacefarers(${PLANET_X_SPACEFARER})`, as('xavier'))
      assert.equal(response.status, 204)
    })

    it('cannot read a spacefarer of Planet Y', async () => {
      const response = await GET(`/Spacefarers(${PLANET_Y_SPACEFARER})`, as('xavier'))
      assert.equal(response.status, 404)
    })

    it('cannot update a spacefarer of Planet Y', async () => {
      const response = await PATCH(`/Spacefarers(${PLANET_Y_SPACEFARER})`, { spacesuitColor_code: 'COMET_WHITE' }, as('xavier'))
      assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`)

      const unchanged = await GET(`/Spacefarers(${PLANET_Y_SPACEFARER})`, as('alice'))
      assert.equal(unchanged.data.spacesuitColor_code, 'SOLAR_ORANGE')
    })

    it('cannot delete a spacefarer of Planet Y', async () => {
      const response = await DELETE(`/Spacefarers(${PLANET_Y_SPACEFARER})`, as('xavier'))
      assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`)

      const stillThere = await GET(`/Spacefarers(${PLANET_Y_SPACEFARER})`, as('alice'))
      assert.equal(stillThere.status, 200)
    })
  })

  describe('galactic admin', () => {
    it('sees the spacefarers of every planet', async () => {
      const response = await GET('/Spacefarers', as('alice'))
      assert.equal(response.data.value.length, 12)
      assert.deepEqual(planetsOf(response).sort(), ['X', 'Y'])
    })

    it('creates a spacefarer on any planet', async () => {
      const response = await POST('/Spacefarers', recruit('Y'), as('alice'))
      assert.equal(response.status, 201)
    })

    it('moves a spacefarer to another planet', async () => {
      const response = await PATCH(`/Spacefarers(${PLANET_X_SPACEFARER})`, { originPlanet_code: 'Y' }, as('alice'))
      assert.equal(response.status, 200)
      assert.equal(response.data.originPlanet_code, 'Y')
    })
  })

  describe('master data', () => {
    for (const entity of ['Departments', 'Positions', 'Planets', 'SpacesuitColors']) {
      it(`lets any authenticated user read ${entity}`, async () => {
        const response = await GET(`/${entity}`, as('nobody'))
        assert.equal(response.status, 200)
        assert.ok(response.data.value.length > 0)
      })
    }

    it('is read-only, even for the galactic admin', async () => {
      const response = await POST('/Planets', { code: 'Z', name: 'Planet Z' }, as('alice'))
      assert.equal(response.status, 405)
    })
  })

  describe('mandatory fields', () => {
    for (const field of ['name', 'email', 'originPlanet_code']) {
      it(`rejects a spacefarer without ${field}`, async () => {
        const response = await POST('/Spacefarers', recruit('X', { [field]: undefined }), as('alice'))
        assert.equal(response.status, 400)
      })
    }
  })
})
