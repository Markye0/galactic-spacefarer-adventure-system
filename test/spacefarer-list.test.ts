import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import cds from '@sap/cds'

const test = cds.test(import.meta.dirname + '/..')
const { GET, PATCH, axios } = test

axios.defaults.validateStatus = () => true
axios.defaults.path = '/odata/v4/spacefarer'

const as = (username: string) => ({ auth: { username, password: 'pass' } })

const SPACEFARER = 'a0000000-0000-4000-8000-000000000001'

interface Row {
  name: string
  stardustCollection: number
  stardustStatus: string
  originPlanet_code: string
}
const list = async (query: string, username: string): Promise<Row[]> => {
  const response = await GET(`/Spacefarers?${query}`, as(username))
  assert.equal(response.status, 200, JSON.stringify(response.data))
  return response.data.value
}

describe('spacefarer list', () => {
  beforeEach(() => test.data.reset())

  describe('stardust status', () => {
    const cases = [
      { stardust: 0, status: 'Novice', criticality: 0 },
      { stardust: 499, status: 'Novice', criticality: 0 },
      { stardust: 500, status: 'Collector', criticality: 5 },
      { stardust: 999, status: 'Collector', criticality: 5 },
      { stardust: 1000, status: 'Master', criticality: 3 },
    ]
    for (const { stardust, status, criticality } of cases) {
      it(`is ${status} at ${stardust} units`, async () => {
        await PATCH(`/Spacefarers(${SPACEFARER})`, { stardustCollection: stardust }, as('alice'))
        const { data } = await GET(`/Spacefarers(${SPACEFARER})`, as('alice'))
        assert.equal(data.stardustStatus, status)
        assert.equal(data.stardustStatusCriticality, criticality)
      })
    }

    it('cannot be set by a client', async () => {
      const response = await PATCH(`/Spacefarers(${SPACEFARER})`, { stardustStatus: 'Novice' }, as('alice'))
      assert.equal(response.status, 200) // the derived field is ignored, not stored

      const { data } = await GET(`/Spacefarers(${SPACEFARER})`, as('alice'))
      assert.equal(data.stardustStatus, 'Master') // Nova Kepler has 1250 units
    })
  })

  describe('sorting', () => {
    it('sorts by stardust collection in descending order', async () => {
      const amounts = (await list('$orderby=stardustCollection desc', 'alice')).map(s => s.stardustCollection)
      assert.deepEqual(
        amounts,
        [...amounts].sort((a, b) => b - a),
      )
      assert.equal(amounts[0], Math.max(...amounts))
    })

    it('sorts by name within the planet of the user', async () => {
      const spacefarers = await list('$orderby=name', 'xena')
      const names = spacefarers.map(s => s.name)
      assert.deepEqual(names, [...names].sort())
      assert.ok(spacefarers.every(s => s.originPlanet_code === 'X'))
    })
  })

  describe('filtering', () => {
    it('filters by stardust status', async () => {
      const masters = await list("$filter=stardustStatus eq 'Master'", 'alice')
      assert.ok(masters.length > 0)
      assert.ok(masters.every(s => s.stardustCollection >= 1000))
    })

    it('filters by spacesuit color within the planet of the user', async () => {
      const spacefarers = await list("$filter=spacesuitColor_code eq 'NEBULA_BLUE'", 'yuri')
      assert.ok(spacefarers.length > 0)
      assert.ok(spacefarers.every(s => s.originPlanet_code === 'Y'))
    })

    it('searches by name', async () => {
      const found = await list('$search=kepler', 'alice')
      assert.deepEqual(
        found.map(s => s.name),
        ['Nova Kepler'],
      )
    })

    it('searches by email', async () => {
      const found = await list('$search=orion.vega@', 'alice')
      assert.deepEqual(
        found.map(s => s.name),
        ['Orion Vega'],
      )
    })

    it('does not find spacefarers of another planet', async () => {
      assert.deepEqual(await list('$search=kepler', 'yuri'), [])
    })
  })

  describe('paging', () => {
    it('has more spacefarers per planet than one page of 30', async () => {
      const response = await GET('/Spacefarers/$count', as('xena'))
      assert.equal(response.data, 40)
    })

    it('returns consecutive pages without overlap', async () => {
      const page = (skip: number) => list(`$orderby=name&$top=30&$skip=${skip}`, 'xena')
      const [first, second] = [await page(0), await page(30)]

      assert.equal(first.length, 30)
      assert.equal(second.length, 10)
      const names = [...first, ...second].map(s => s.name)
      assert.equal(new Set(names).size, 40)
      assert.deepEqual(names, [...names].sort())
    })

    it('reports the total count along with a page', async () => {
      const response = await GET('/Spacefarers?$top=30&$count=true', as('alice'))
      assert.equal(response.data['@odata.count'], 80)
      assert.equal(response.data.value.length, 30)
    })
  })
})
