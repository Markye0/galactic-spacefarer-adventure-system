import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import cds from '@sap/cds'

const NS = 'sap.galaxy.spacefarers'

describe('data model', () => {
  let entities

  before(async () => {
    const model = cds.linked(await cds.load('db'))
    entities = model.entities(NS)
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
    assert.equal(elements.stardustCollection.default.val, 0)
    assert.equal(elements.wormholeNavigationSkill.default.val, 1)
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
