import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import cds from '@sap/cds'

const NS = 'sap.galaxy.spacefarers'

// cds.deploy is not covered by @cap-js/cds-types yet
type Deploy = (model: string) => { to(url: string): Promise<cds.DatabaseService> }
const { deploy } = cds as unknown as { deploy: Deploy }

// The parts of the reflected model these tests look at
interface Element {
  type: string
  length?: number
  default?: { val: unknown }
  target?: string
  is2many?: boolean
  '@mandatory'?: boolean
}
interface Entity {
  elements: Record<string, Element>
  keys: Record<string, Element>
}

type Row = Record<string, unknown>
interface SpacefarerRow {
  name: string
  email: string
  stardustCollection: number
  wormholeNavigationSkill: number
  originPlanet_code: string
  spacesuitColor_code: string
  department_ID: string
  position_ID: string
}

describe('data model', () => {
  let entities: Record<string, Entity>

  before(async () => {
    const model = cds.linked(await cds.load('db'))
    entities = model.entities(NS) as unknown as Record<string, Entity>
  })

  it('defines the five entities', () => {
    for (const name of ['Spacefarers', 'Departments', 'Positions', 'Planets', 'SpacesuitColors']) {
      assert.ok(entities[name], `entity ${name} is missing`)
    }
  })

  it('gives Spacefarers its cosmic attributes', () => {
    const { elements } = entities.Spacefarers
    assert.equal(elements.name.type, 'cds.String')
    assert.equal(elements.name.length, 100)
    assert.equal(elements.email.type, 'cds.String')
    assert.equal(elements.email.length, 255)
    assert.equal(elements.stardustCollection.type, 'cds.Integer')
    assert.equal(elements.wormholeNavigationSkill.type, 'cds.Integer')
  })

  it('defaults stardust collection to 0 and wormhole navigation skill to 1', () => {
    const { elements } = entities.Spacefarers
    assert.equal(elements.stardustCollection.default?.val, 0)
    assert.equal(elements.wormholeNavigationSkill.default?.val, 1)
  })

  it('makes name, email and origin planet mandatory', () => {
    const { elements } = entities.Spacefarers
    for (const name of ['name', 'email', 'originPlanet']) {
      assert.equal(elements[name]['@mandatory'], true, `${name} is not mandatory`)
    }
  })

  it('gives Spacefarers a UUID key and managed fields', () => {
    const { elements, keys } = entities.Spacefarers
    assert.deepEqual(Object.keys(keys), ['ID'])
    assert.equal(elements.ID.type, 'cds.UUID')
    for (const name of ['createdAt', 'createdBy', 'modifiedAt', 'modifiedBy']) {
      assert.ok(elements[name], `managed field ${name} is missing`)
    }
  })

  it('links Spacefarers to planet, spacesuit color, department and position', () => {
    const { elements } = entities.Spacefarers
    const targets = {
      originPlanet: 'Planets',
      spacesuitColor: 'SpacesuitColors',
      department: 'Departments',
      position: 'Positions',
    }
    for (const [name, target] of Object.entries(targets)) {
      assert.equal(elements[name].type, 'cds.Association')
      assert.equal(elements[name].target, `${NS}.${target}`)
    }
  })

  it('lets departments and positions navigate back to their spacefarers', () => {
    for (const name of ['Departments', 'Positions']) {
      const { spacefarers } = entities[name].elements
      assert.equal(spacefarers.target, `${NS}.Spacefarers`)
      assert.equal(spacefarers.is2many, true)
    }
  })

  it('keys planets and spacesuit colors by code', () => {
    for (const name of ['Planets', 'SpacesuitColors']) {
      assert.deepEqual(Object.keys(entities[name].keys), ['code'])
      assert.ok(entities[name].elements.name, `${name} has no name`)
    }
  })
})

describe('initial data', () => {
  const { SELECT } = cds.ql
  let db: cds.DatabaseService
  let spacefarers: SpacefarerRow[]

  const read = (entity: string): Promise<Row[]> => db.run(SELECT.from(`${NS}.${entity}`))

  before(async () => {
    db = await deploy('db').to('sqlite::memory:')
    spacefarers = (await read('Spacefarers')) as unknown as SpacefarerRow[]
  })

  it('seeds every entity', async () => {
    const expected = { Planets: 2, SpacesuitColors: 5, Departments: 4, Positions: 4, Spacefarers: 80 }
    for (const [entity, count] of Object.entries(expected)) {
      assert.equal((await read(entity)).length, count, `unexpected number of ${entity}`)
    }
  })

  it('places forty spacefarers on each planet', () => {
    for (const planet of ['X', 'Y']) {
      assert.equal(spacefarers.filter(s => s.originPlanet_code === planet).length, 40)
    }
  })

  it('references only existing master data', async () => {
    const references: Partial<Record<keyof SpacefarerRow, [string, string]>> = {
      originPlanet_code: ['Planets', 'code'],
      spacesuitColor_code: ['SpacesuitColors', 'code'],
      department_ID: ['Departments', 'ID'],
      position_ID: ['Positions', 'ID'],
    }
    for (const [foreignKey, [entity, key]] of Object.entries(references) as [keyof SpacefarerRow, [string, string]][]) {
      const known = new Set((await read(entity)).map(row => row[key]))
      for (const spacefarer of spacefarers) {
        assert.ok(known.has(spacefarer[foreignKey]), `${spacefarer.name}: unknown ${foreignKey} '${spacefarer[foreignKey]}'`)
      }
    }
  })

  it('gives every spacefarer a name and a unique email', () => {
    for (const spacefarer of spacefarers) {
      assert.ok(spacefarer.name)
      assert.match(spacefarer.email, /^[^@\s]+@[^@\s]+$/)
    }
    assert.equal(new Set(spacefarers.map(s => s.email)).size, spacefarers.length)
  })

  it('keeps stardust non-negative and wormhole skill between 1 and 10', () => {
    for (const { name, stardustCollection, wormholeNavigationSkill } of spacefarers) {
      assert.ok(stardustCollection >= 0, `${name}: stardust ${stardustCollection}`)
      assert.ok(wormholeNavigationSkill >= 1 && wormholeNavigationSkill <= 10, `${name}: skill ${wormholeNavigationSkill}`)
    }
  })
})
