import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import cds from '@sap/cds'

type Annotated = Record<string, unknown>
const path = (value: unknown) => (value as { '=': string })['=']

describe('list report annotations', () => {
  let model: cds.csn.CSN
  let spacefarers: Annotated

  before(async () => {
    model = await cds.load('*')
    spacefarers = cds.linked(model).definitions['SpacefarerService.Spacefarers'] as unknown as Annotated
  })

  it('shows the spacefarer columns, with the stardust status colour-coded', () => {
    const columns = spacefarers['@UI.LineItem'] as { Value: unknown; Criticality?: unknown }[]
    assert.deepEqual(
      columns.map(column => path(column.Value)),
      [
        'name',
        'stardustCollection',
        'stardustStatus',
        'spacesuitColor_code',
        'originPlanet_code',
        'wormholeNavigationSkill',
        'department_ID',
        'position_ID',
      ],
    )
    const status = columns.find(column => path(column.Value) === 'stardustStatus')
    assert.equal(path(status?.Criticality), 'stardustStatusCriticality')
  })

  it('never hides name, stardust and spacesuit color on narrow screens', () => {
    const columns = spacefarers['@UI.LineItem'] as { Value: unknown; '@UI.Importance'?: { '#': string } }[]
    const important = columns
      .filter(column => column['@UI.Importance']?.['#'] === 'High')
      .map(column => path(column.Value))
    assert.deepEqual(important, ['name', 'stardustCollection', 'stardustStatus', 'spacesuitColor_code'])
  })

  it('offers planet, spacesuit color, department and position as filters', () => {
    const filters = spacefarers['@UI.SelectionFields'] as unknown[]
    assert.deepEqual(filters.map(path), ['originPlanet_code', 'spacesuitColor_code', 'department_ID', 'position_ID'])
  })

  it('sorts by name by default', () => {
    const [sortOrder] = spacefarers['@UI.PresentationVariant.SortOrder'] as {
      Property: unknown
      Descending?: boolean
    }[]
    assert.equal(path(sortOrder.Property), 'name')
    assert.notEqual(sortOrder.Descending, true)
  })

  it('names the entity for the page title', () => {
    assert.equal(spacefarers['@UI.HeaderInfo.TypeName'], '{i18n>Spacefarer}')
    assert.equal(spacefarers['@UI.HeaderInfo.TypeNamePlural'], '{i18n>Spacefarers}')
  })

  it('shows names instead of codes and offers dropdowns for the references', () => {
    const elements = (spacefarers as { elements: Record<string, Annotated> }).elements
    const texts = {
      originPlanet: 'originPlanet.name',
      spacesuitColor: 'spacesuitColor.name',
      department: 'department.name',
      position: 'position.title',
    }
    for (const [element, text] of Object.entries(texts)) {
      assert.equal(path(elements[element]['@Common.Text']), text)
      assert.equal(elements[element]['@Common.ValueListWithFixedValues'], true)
    }
  })

  it('labels every visible field', () => {
    const elements = (spacefarers as { elements: Record<string, Annotated> }).elements
    const labelled = [
      'name',
      'email',
      'stardustCollection',
      'stardustStatus',
      'wormholeNavigationSkill',
      'originPlanet',
      'spacesuitColor',
      'department',
      'position',
    ]
    for (const element of labelled) {
      assert.match(String(elements[element]['@title']), /^\{i18n>\w+\}$/, `${element} has no label`)
    }
  })

  it('has a text for every i18n key it uses', () => {
    const read = (file: string) => readFileSync(import.meta.dirname + '/../' + file, 'utf8')
    const used = new Set(
      [...read('app/spacefarers/annotations.cds').matchAll(/\{i18n>(\w+)\}/g)].map(match => match[1]),
    )
    const defined = new Set([...read('_i18n/i18n.properties').matchAll(/^(\w+)=/gm)].map(match => match[1]))

    assert.ok(used.size > 0)
    assert.deepEqual(
      [...used].filter(key => !defined.has(key)),
      [],
    )
  })
})

describe('object page annotations', () => {
  let spacefarers: Annotated

  before(async () => {
    spacefarers = cds.linked(await cds.load('*')).definitions['SpacefarerService.Spacefarers'] as unknown as Annotated
  })

  const fields = (group: string) =>
    (spacefarers[`@UI.FieldGroup#${group}.Data`] as { Value: unknown }[]).map(field => path(field.Value))

  it('is organised into four sections', () => {
    const facets = spacefarers['@UI.Facets'] as { Label: string; Target: string }[]
    assert.deepEqual(
      facets.map(({ Label, Target }) => [Label, Target]),
      [
        ['{i18n>GeneralInformation}', '@UI.FieldGroup#GeneralInformation'],
        ['{i18n>CosmicDetails}', '@UI.FieldGroup#CosmicDetails'],
        ['{i18n>Assignment}', '@UI.FieldGroup#Assignment'],
        ['{i18n>AdministrativeData}', '@UI.FieldGroup#AdministrativeData'],
      ],
    )
  })

  it('shows the cosmic details, including stardust collection and spacesuit color', () => {
    assert.deepEqual(fields('CosmicDetails'), [
      'stardustCollection',
      'stardustStatus',
      'wormholeNavigationSkill',
      'spacesuitColor_code',
    ])
  })

  it('shows general information, assignment and administrative data', () => {
    assert.deepEqual(fields('GeneralInformation'), ['name', 'email'])
    assert.deepEqual(fields('Assignment'), ['originPlanet_code', 'department_ID', 'position_ID'])
    assert.deepEqual(fields('AdministrativeData'), ['createdBy', 'createdAt', 'modifiedBy', 'modifiedAt'])
  })

  it('highlights status, stardust and skill in the header', () => {
    const header = spacefarers['@UI.HeaderFacets'] as { Target: string }[]
    assert.deepEqual(
      header.map(facet => facet.Target),
      ['@UI.DataPoint#StardustStatus', '@UI.DataPoint#StardustCollection', '@UI.DataPoint#WormholeNavigationSkill'],
    )
    assert.equal(path(spacefarers['@UI.DataPoint#StardustStatus.Criticality']), 'stardustStatusCriticality')
    assert.equal(spacefarers['@UI.DataPoint#WormholeNavigationSkill.TargetValue'], 10)
  })

  it('offers create, edit and delete only to users who can manage spacefarers', () => {
    // hidden = not canManageSpacefarers
    for (const annotation of ['@UI.CreateHidden', '@UI.UpdateHidden', '@UI.DeleteHidden']) {
      assert.equal(spacefarers[`${annotation}.$edmJson.$Not.$Path`], '/CurrentUser/canManageSpacefarers')
    }
  })

  it('lets only users without a planet of their own choose the origin planet', () => {
    const elements = (spacefarers as { elements: Record<string, Annotated> }).elements
    const MANDATORY = 7
    const READ_ONLY = 1
    const [condition, whenTrue, whenFalse] = elements.originPlanet['@Common.FieldControl.$edmJson.$If'] as [
      { $Path: string },
      number,
      number,
    ]
    assert.equal(condition.$Path, '/CurrentUser/canChoosePlanet')
    assert.equal(whenTrue, MANDATORY)
    assert.equal(whenFalse, READ_ONLY)
  })

  it('refreshes the stardust status when the stardust collection is edited', () => {
    const sideEffects = '@Common.SideEffects#StardustCollectionChanged'
    const paths = (key: string) =>
      (spacefarers[`${sideEffects}.${key}`] as unknown[]).map(entry =>
        typeof entry === 'string' ? entry : path(entry),
      )

    assert.deepEqual(paths('SourceProperties'), ['stardustCollection'])
    assert.deepEqual(paths('TargetProperties'), ['stardustStatus', 'stardustStatusCriticality'])
  })

  it('does not let the derived stardust status be edited', () => {
    const elements = (spacefarers as { elements: Record<string, Annotated> }).elements
    assert.equal(elements.stardustStatus['@Core.Computed'], true)
  })
})
