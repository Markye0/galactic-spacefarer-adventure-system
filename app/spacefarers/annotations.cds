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
