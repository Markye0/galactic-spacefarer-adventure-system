namespace sap.galaxy.spacefarers;

using {
  cuid,
  managed,
  sap
} from '@sap/cds/common';

entity Spacefarers : cuid, managed {
  name                    : String(100)                    @mandatory;
  email                   : String(255)                    @mandatory;
  stardustCollection      : Integer default 0;
  wormholeNavigationSkill : Integer default 1;
  originPlanet            : Association to Planets         @mandatory  @assert.target;
  spacesuitColor          : Association to SpacesuitColors @assert.target;
  department              : Association to Departments     @assert.target;
  position                : Association to Positions       @assert.target;
}

entity Departments : cuid {
  name        : String(100);
  description : String(500);
  spacefarers : Association to many Spacefarers
                  on spacefarers.department = $self;
}

entity Positions : cuid {
  title       : String(100);
  description : String(500);
  spacefarers : Association to many Spacefarers
                  on spacefarers.position = $self;
}

entity Planets : sap.common.CodeList {
  key code : String(10);
}

entity SpacesuitColors : sap.common.CodeList {
  key code : String(20);
}
