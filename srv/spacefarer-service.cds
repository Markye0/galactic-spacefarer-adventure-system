using { sap.galaxy.spacefarers as db } from '../db/schema';

service SpacefarerService @(requires: 'authenticated-user') {

  entity Spacefarers @(restrict: [
    { grant: 'READ', to: 'SpacefarerViewer',  where: (originPlanet.code = $user.planet) },
    { grant: '*',    to: 'SpacefarerManager', where: (originPlanet.code = $user.planet) },
    { grant: '*',    to: 'GalacticAdmin' }
  ]) as projection on db.Spacefarers;

  // The backlinks to spacefarers are left out: $expand does not apply the planet restriction
  @readonly entity Departments     as projection on db.Departments excluding { spacefarers };
  @readonly entity Positions       as projection on db.Positions   excluding { spacefarers };
  @readonly entity Planets         as projection on db.Planets;
  @readonly entity SpacesuitColors as projection on db.SpacesuitColors;
}
