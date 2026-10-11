using SpacefarerService as service from '../../srv/spacefarer-service';

// Labels, and names instead of codes for the references
annotate service.Spacefarers with {
  ID                        @UI.Hidden;
  name                      @title: '{i18n>Name}';
  email                     @title: '{i18n>Email}';
  stardustCollection        @title: '{i18n>StardustCollection}';
  stardustStatus            @title: '{i18n>StardustStatus}';
  stardustStatusCriticality @UI.Hidden;
  wormholeNavigationSkill   @title: '{i18n>WormholeNavigationSkill}';
  originPlanet              @title: '{i18n>OriginPlanet}'
                            @Common: { Text: originPlanet.name, TextArrangement: #TextOnly, ValueListWithFixedValues };
  spacesuitColor            @title: '{i18n>SpacesuitColor}'
                            @Common: { Text: spacesuitColor.name, TextArrangement: #TextOnly, ValueListWithFixedValues };
  department                @title: '{i18n>Department}'
                            @Common: { Text: department.name, TextArrangement: #TextOnly, ValueListWithFixedValues };
  position                  @title: '{i18n>Position}'
                            @Common: { Text: position.title, TextArrangement: #TextOnly, ValueListWithFixedValues };
};

// Value helps: planets and spacesuit colors are code lists and get theirs automatically
annotate service.Departments with @cds.odata.valuelist {
  ID @Common: { Text: name, TextArrangement: #TextOnly };
};

annotate service.Positions with @cds.odata.valuelist {
  ID @Common: { Text: title, TextArrangement: #TextOnly };
};

// List report
annotate service.Spacefarers with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>Spacefarer}',
    TypeNamePlural: '{i18n>Spacefarers}',
    Title         : { Value: name },
    Description   : { Value: email },
  },
  UI.SelectionFields    : [ originPlanet_code, spacesuitColor_code, department_ID, position_ID ],
  UI.PresentationVariant: {
    SortOrder     : [{ Property: name, Descending: false }],
    Visualizations: [ '@UI.LineItem' ],
  },
  // High importance keeps a column visible when the responsive table runs out of space
  UI.LineItem           : [
    { Value: name,                    ![@UI.Importance]: #High },
    { Value: stardustCollection,      ![@UI.Importance]: #High },
    { Value: stardustStatus,          ![@UI.Importance]: #High, Criticality: stardustStatusCriticality },
    { Value: spacesuitColor_code,     ![@UI.Importance]: #High },
    { Value: originPlanet_code },
    { Value: wormholeNavigationSkill },
    { Value: department_ID },
    { Value: position_ID },
  ],
);

// Object page
annotate service.Spacefarers with @(
  UI.HeaderFacets                         : [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#StardustStatus' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#StardustCollection' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#WormholeNavigationSkill' },
  ],
  UI.DataPoint #StardustStatus            : {
    Title      : '{i18n>StardustStatus}',
    Value      : stardustStatus,
    Criticality: stardustStatusCriticality,
  },
  UI.DataPoint #StardustCollection        : {
    Title: '{i18n>StardustCollection}',
    Value: stardustCollection,
  },
  UI.DataPoint #WormholeNavigationSkill   : {
    Title        : '{i18n>WormholeNavigationSkill}',
    Value        : wormholeNavigationSkill,
    TargetValue  : 10,
    Visualization: #Progress,
  },
  UI.Facets                               : [
    { $Type: 'UI.ReferenceFacet', ID: 'GeneralInformation', Label: '{i18n>GeneralInformation}', Target: '@UI.FieldGroup#GeneralInformation' },
    { $Type: 'UI.ReferenceFacet', ID: 'CosmicDetails',      Label: '{i18n>CosmicDetails}',      Target: '@UI.FieldGroup#CosmicDetails' },
    { $Type: 'UI.ReferenceFacet', ID: 'Assignment',         Label: '{i18n>Assignment}',         Target: '@UI.FieldGroup#Assignment' },
    { $Type: 'UI.ReferenceFacet', ID: 'AdministrativeData', Label: '{i18n>AdministrativeData}', Target: '@UI.FieldGroup#AdministrativeData' },
  ],
  UI.FieldGroup #GeneralInformation       : { Data: [
    { Value: name },
    { Value: email },
  ] },
  UI.FieldGroup #CosmicDetails            : { Data: [
    { Value: stardustCollection },
    { Value: stardustStatus, Criticality: stardustStatusCriticality },
    { Value: wormholeNavigationSkill },
    { Value: spacesuitColor_code },
  ] },
  UI.FieldGroup #Assignment               : { Data: [
    { Value: originPlanet_code },
    { Value: department_ID },
    { Value: position_ID },
  ] },
  UI.FieldGroup #AdministrativeData       : { Data: [
    { Value: createdBy },
    { Value: createdAt },
    { Value: modifiedBy },
    { Value: modifiedAt },
  ] },
);

annotate service.Spacefarers with {
  stardustStatus @Core.Computed;
};

// Create, edit and delete are offered only to users who can manage spacefarers. This is a
// convenience for the UI; the service enforces the authorization on its own.
annotate service.Spacefarers with @(
  UI.CreateHidden: { $edmJson: { $Not: { $Path: '/CurrentUser/canManageSpacefarers' } } },
  UI.UpdateHidden: { $edmJson: { $Not: { $Path: '/CurrentUser/canManageSpacefarers' } } },
  UI.DeleteHidden: { $edmJson: { $Not: { $Path: '/CurrentUser/canManageSpacefarers' } } },
);

// Only users who are not bound to a planet choose the planet of a spacefarer (7 = mandatory,
// 1 = read-only). Everyone else gets their own planet prefilled by the service.
annotate service.Spacefarers with {
  originPlanet @Common.FieldControl: { $edmJson: { $If: [ { $Path: '/CurrentUser/canChoosePlanet' }, 7, 1 ] } };
};

// The stardust status is derived from the stardust collection, so the UI reads it again
// whenever the collection is changed in a draft.
annotate service.Spacefarers with @(
  Common.SideEffects #StardustCollectionChanged: {
    SourceProperties: [ stardustCollection ],
    TargetProperties: [ 'stardustStatus', 'stardustStatusCriticality' ],
  }
);
