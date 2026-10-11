import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import cds from '@sap/cds'
import { as, spacefarerDrafts } from './support.js'

const test = cds.test(import.meta.dirname + '/..')
const { GET, POST, PATCH, DELETE, axios } = test

// Resolve on every status code, so tests can assert on rejections
axios.defaults.validateStatus = () => true
axios.defaults.path = '/odata/v4/spacefarer'

const { create, update, editDraft } = spacefarerDrafts(test)

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
      assert.equal(response.data.value.length, 40)
      assert.deepEqual(planetsOf(response), ['X'])
    })

    it('counts only the spacefarers of Planet X', async () => {
      const response = await GET('/Spacefarers/$count', as('xena'))
      assert.equal(response.data, 40)
    })

    it('cannot read a spacefarer of Planet Y', async () => {
      const response = await GET(`/Spacefarers(${PLANET_Y_SPACEFARER})`, as('xena'))
      assert.equal(response.status, 404)
    })

    it('cannot create a spacefarer', async () => {
      const response = await create(recruit('X'), 'xena')
      assert.equal(response.status, 403)
    })

    it('cannot update a spacefarer', async () => {
      const response = await update(PLANET_X_SPACEFARER, { spacesuitColor_code: 'COMET_WHITE' }, 'xena')
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
      assert.equal(response.data.value.length, 40)
      assert.deepEqual(planetsOf(response), ['Y'])
    })
  })

  describe('manager of Planet X', () => {
    it('creates a spacefarer on Planet X', async () => {
      const response = await create(recruit('X'), 'xavier')
      assert.equal(response.status, 201)
      assert.equal(response.data.originPlanet_code, 'X')
    })

    it('updates a spacefarer of Planet X', async () => {
      const response = await update(PLANET_X_SPACEFARER, { spacesuitColor_code: 'COMET_WHITE' }, 'xavier')
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
      const response = await update(PLANET_Y_SPACEFARER, { spacesuitColor_code: 'COMET_WHITE' }, 'xavier')
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

    it('cannot create a spacefarer on Planet Y', async () => {
      const response = await create(recruit('Y'), 'xavier')
      assert.equal(response.status, 403)

      const all = await GET('/Spacefarers/$count', as('alice'))
      assert.equal(all.data, 80)
    })

    it('cannot create a spacefarer on Planet Y using a nested planet reference', async () => {
      const response = await create(recruit('X', { originPlanet_code: undefined, originPlanet: { code: 'Y' } }), 'xavier')
      assert.equal(response.status, 403)
    })

    it('cannot move a spacefarer to Planet Y', async () => {
      const response = await update(PLANET_X_SPACEFARER, { originPlanet_code: 'Y' }, 'xavier')
      assert.equal(response.status, 403)

      const unchanged = await GET(`/Spacefarers(${PLANET_X_SPACEFARER})`, as('alice'))
      assert.equal(unchanged.data.originPlanet_code, 'X')
    })
  })

  // The Fiori UI always goes through a draft. An API client can write to the active record
  // directly, and has to meet the same rules.
  describe('manager of Planet X writing without a draft', () => {
    const active = (id: string) => `/Spacefarers(ID=${id},IsActiveEntity=true)`

    it('creates a spacefarer on Planet X', async () => {
      const response = await POST('/Spacefarers', { ...recruit('X'), IsActiveEntity: true }, as('xavier'))
      assert.equal(response.status, 201)
      assert.equal(response.data.IsActiveEntity, true)
    })

    it('cannot create a spacefarer on Planet Y', async () => {
      const response = await POST('/Spacefarers', { ...recruit('Y'), IsActiveEntity: true }, as('xavier'))
      assert.equal(response.status, 403)
    })

    it('cannot move a spacefarer to Planet Y', async () => {
      const response = await PATCH(active(PLANET_X_SPACEFARER), { originPlanet_code: 'Y' }, as('xavier'))
      assert.equal(response.status, 403)
    })

    it('cannot update a spacefarer of Planet Y', async () => {
      const response = await PATCH(active(PLANET_Y_SPACEFARER), { spacesuitColor_code: 'COMET_WHITE' }, as('xavier'))
      assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`)

      const unchanged = await GET(active(PLANET_Y_SPACEFARER), as('alice'))
      assert.equal(unchanged.data.spacesuitColor_code, 'SOLAR_ORANGE')
    })

    it('cannot delete a spacefarer of Planet Y', async () => {
      const response = await DELETE(active(PLANET_Y_SPACEFARER), as('xavier'))
      assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`)

      const stillThere = await GET(active(PLANET_Y_SPACEFARER), as('alice'))
      assert.equal(stillThere.status, 200)
    })
  })

  describe('viewer of Planet X writing without a draft', () => {
    it('cannot create, update or delete a spacefarer', async () => {
      const id = `/Spacefarers(ID=${PLANET_X_SPACEFARER},IsActiveEntity=true)`
      assert.equal((await POST('/Spacefarers', { ...recruit('X'), IsActiveEntity: true }, as('xena'))).status, 403)
      assert.equal((await PATCH(id, { spacesuitColor_code: 'COMET_WHITE' }, as('xena'))).status, 403)
      assert.equal((await DELETE(id, as('xena'))).status, 403)
    })
  })

  describe('galactic admin', () => {
    it('sees the spacefarers of every planet', async () => {
      const response = await GET('/Spacefarers', as('alice'))
      assert.equal(response.data.value.length, 80)
      assert.deepEqual(planetsOf(response).sort(), ['X', 'Y'])
    })

    it('creates a spacefarer on any planet', async () => {
      const response = await create(recruit('Y'), 'alice')
      assert.equal(response.status, 201)
    })

    it('moves a spacefarer to another planet', async () => {
      const response = await update(PLANET_X_SPACEFARER, { originPlanet_code: 'Y' }, 'alice')
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

  describe('navigation from master data', () => {
    const IDS = {
      Departments: 'd0000000-0000-4000-8000-000000000001',
      Positions: 'b0000000-0000-4000-8000-000000000001',
    }

    for (const [entity, id] of Object.entries(IDS)) {
      it(`does not expand spacefarers from ${entity}`, async () => {
        const response = await GET(`/${entity}?$expand=spacefarers`, as('alice'))
        assert.equal(response.status, 400)
      })

      it(`does not navigate to spacefarers from ${entity}`, async () => {
        const response = await GET(`/${entity}(${id})/spacefarers`, as('alice'))
        assert.ok(response.status >= 400, `unexpected status ${response.status}`)
      })
    }

    it('still expands master data from a spacefarer', async () => {
      const response = await GET(`/Spacefarers(${PLANET_X_SPACEFARER})?$expand=department,position,originPlanet,spacesuitColor`, as('xena'))
      assert.equal(response.status, 200)
      assert.equal(response.data.department.name, 'Wormhole Navigation')
      assert.equal(response.data.originPlanet.name, 'Planet X')
    })
  })

  describe('navigation from a spacefarer', () => {
    const MASTER_DATA = ['originPlanet', 'spacesuitColor', 'department', 'position']
    const spacefarer = (id: string) => `/Spacefarers(ID=${id},IsActiveEntity=true)`

    for (const username of ['nobody', 'xena', 'xavier']) {
      for (const association of MASTER_DATA) {
        it(`does not reveal the ${association} of a Planet Y spacefarer to ${username}`, async () => {
          const response = await GET(`${spacefarer(PLANET_Y_SPACEFARER)}/${association}`, as(username))
          assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`)
        })
      }
    }

    it('does not reveal a property of the master data either', async () => {
      const response = await GET(`${spacefarer(PLANET_Y_SPACEFARER)}/department/name`, as('xena'))
      assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`)
    })

    it('does not reveal master data through the short key form', async () => {
      const response = await GET(`/Spacefarers(${PLANET_Y_SPACEFARER})/department`, as('xena'))
      assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`)
    })

    for (const association of MASTER_DATA) {
      it(`still reaches the ${association} of a spacefarer the user may read`, async () => {
        const response = await GET(`${spacefarer(PLANET_X_SPACEFARER)}/${association}`, as('xena'))
        assert.equal(response.status, 200)
      })
    }

    it('reaches master data of any spacefarer for the galactic admin', async () => {
      const response = await GET(`${spacefarer(PLANET_Y_SPACEFARER)}/department`, as('alice'))
      assert.equal(response.status, 200)
    })

    // Code lists carry generated translation entities, which are reachable from a spacefarer too
    describe('to the translations of a code list', () => {
      const translate = () =>
        cds.db.run(
          INSERT.into('sap.galaxy.spacefarers.SpacesuitColors.texts').entries({ locale: 'de', code: 'SOLAR_ORANGE', name: 'Sonnenorange' }),
        )

      for (const path of ['spacesuitColor/texts', 'spacesuitColor/texts/$count', "spacesuitColor/texts(locale='de',code='SOLAR_ORANGE')"]) {
        it(`does not reveal ${path} of a Planet Y spacefarer`, async () => {
          await translate()
          for (const username of ['nobody', 'xena']) {
            const response = await GET(`${spacefarer(PLANET_Y_SPACEFARER)}/${path}`, as(username))
            assert.ok([403, 404].includes(response.status), `${username}: unexpected status ${response.status}`)
          }
        })
      }

      it('does not reveal the localized name of the color of a Planet Y spacefarer', async () => {
        await translate()
        const response = await GET(`${spacefarer(PLANET_Y_SPACEFARER)}/spacesuitColor/localized`, {
          ...as('xena'),
          headers: { 'Accept-Language': 'de' },
        })
        assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`)
      })

      it('is still readable for a spacefarer the user may read', async () => {
        await translate()
        const response = await GET(`${spacefarer(PLANET_Y_SPACEFARER)}/spacesuitColor/texts`, as('yuri'))
        assert.equal(response.status, 200)
        assert.equal(response.data.value[0].name, 'Sonnenorange')
      })
    })

    describe('of a draft', () => {
      const draft = (id: string) => `/Spacefarers(ID=${id},IsActiveEntity=false)`

      for (const path of ['DraftAdministrativeData', 'department']) {
        it(`does not reveal ${path} to another user`, async () => {
          await editDraft(PLANET_Y_SPACEFARER, 'yara')
          const response = await GET(`${draft(PLANET_Y_SPACEFARER)}/${path}`, as('xena'))
          assert.ok([403, 404].includes(response.status), `unexpected status ${response.status}`)
        })

        it(`shows ${path} to the owner of the draft`, async () => {
          await editDraft(PLANET_Y_SPACEFARER, 'yara')
          const response = await GET(`${draft(PLANET_Y_SPACEFARER)}/${path}`, as('yara'))
          assert.equal(response.status, 200)
        })
      }
    })
  })

  describe('mandatory fields', () => {
    for (const field of ['name', 'email', 'originPlanet_code']) {
      it(`rejects a spacefarer without ${field}`, async () => {
        const response = await create(recruit('X', { [field]: undefined }), 'alice')
        assert.equal(response.status, 400)
      })
    }
  })
})
