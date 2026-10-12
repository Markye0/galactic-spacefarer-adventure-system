# Galactic Spacefarer Adventure System

A list report and object page SAP Fiori elements application on top of an
SAP CAP (Node.js, TypeScript) service, for managing spacefarers across the
SAP galaxy. The project was created as a takeaway exercise for an SAP BTP
full stack technical assessment.

## Getting started

Requires Node.js 22 or later; the project is developed with the version in
[`.nvmrc`](.nvmrc).

Install the dependencies:

```sh
npm install
```

Start the server:

```sh
npm run watch
```

Then open http://localhost:4004/sap.galaxy.spacefarers/index.html in a
regular browser and sign in with one of the users below. The database is an
in-memory SQLite database that is recreated with the initial data on every
start.

### Users

All passwords are `pass`. To switch users, use a private window, because the
browser remembers the sign-in.

| User     | Role                | Planet |
|----------|---------------------|--------|
| `alice`  | `GalacticAdmin`     | –      |
| `xavier` | `SpacefarerManager` | X      |
| `xena`   | `SpacefarerViewer`  | X      |
| `yara`   | `SpacefarerManager` | Y      |
| `yuri`   | `SpacefarerViewer`  | Y      |
| `nobody` | –                   | –      |

These are mocked users for local development only. They are not active in
the production profile.

### Scripts

| Command             | Purpose                                 |
|---------------------|-----------------------------------------|
| `npm run watch`     | start the server with live reload       |
| `npm start`         | start the server without live reload    |
| `npm test`          | run all tests                           |
| `npm run typecheck` | generate the model types and type-check |
| `npm run lint`      | lint the TypeScript sources             |
| `npm run format`    | format the TypeScript and CDS sources   |

## Roles and permissions

| | `SpacefarerViewer` | `SpacefarerManager` | `GalacticAdmin` |
|---|---|---|---|
| Read spacefarers | own planet | own planet | all planets |
| Create, edit and delete spacefarers | – | own planet | all planets |
| Choose the origin planet of a spacefarer | – | – (always their own) | yes |
| Read departments, positions, planets and spacesuit colors | yes | yes | yes |

Every request requires an authenticated user. A user without any of the
three roles can sign in, but has no access to spacefarers.

## How it works

### Data model

`Spacefarers` carry the stardust collection, wormhole navigation skill,
origin planet and spacesuit color, and reference a department and a
position. Departments and positions are master data entities, while planets
and spacesuit colors are code lists. Code lists get value helps in the UI
automatically, and the planet code gives the authorization a stable value to
rely on.

### Service and authorization

`SpacefarerService` exposes spacefarers with full CRUD and the master data
read-only. It is protected on three levels:

- **Authentication** – the whole service requires an authenticated user.
- **Roles** – viewers may read, managers and admins may also write.
- **Planet isolation** – viewers and managers only reach spacefarers whose
  origin planet equals the `planet` attribute of the user. The condition
  becomes part of every database query, so counts and paging stay correct.

Planet isolation also holds on the less obvious paths: a manager cannot
create a spacefarer on another planet or move one there, spacefarers of
other planets cannot be reached through departments or positions, and
nothing can be read by navigating from a spacefarer of another planet.

### Event handlers

- **Before create** – validates the stardust collection (0 to
  1,000,000,000), the wormhole navigation skill (1 to 10) and the email
  address, and reports all errors at once. A valid candidate is then
  enhanced: everyone gets a 100-unit stardust starter pack, as far as the
  maximum allows, and candidates arriving with 1000 units or more get one
  extra skill level.
- **Before update** – the same validation, without the bonuses.
- **After create** – tells the user which bonuses were granted and sends
  the welcome email, see [Email notifications](#email-notifications).

The rules are plain functions in
[`srv/lib/candidate.ts`](srv/lib/candidate.ts), so they are unit-tested
without starting a server.

### User interface

- **List report** – spacefarers with stardust collection, a colour-coded
  stardust status and spacesuit color; search, filters with value helps,
  sorting and paging.
- **Stardust status** – Novice (below 500), Collector (500 to 999) and
  Master (1000 and above). It is calculated in the service projection, not
  stored, so it cannot drift from the stardust collection and can still be
  sorted and filtered in the database.
- **Object page** – details in four sections, with draft-based create and
  edit.
- **Role-aware UI** – a `CurrentUser` singleton tells the UI what the
  signed-in user may do. Create, edit and delete are hidden for viewers,
  and the origin planet is prefilled and locked for managers bound to a
  planet.

The UI consists of annotations only, with no custom UI5 code.

## Email notifications

When a spacefarer is created, the service sends them a welcome email. The
email is sent after the database transaction has committed, so no email goes
out for a creation that was rolled back. If sending fails, the error is
logged and the spacefarer is kept.

By default no mail server is needed: the email is written to the server log.
To send real emails, point the service to an SMTP server:

| Variable                 | Purpose                       | Default                               |
|--------------------------|-------------------------------|---------------------------------------|
| `SMTP_HOST`              | SMTP server; unset = log only | –                                     |
| `SMTP_PORT`              | SMTP port                     | `1025`                                |
| `SMTP_USER`, `SMTP_PASS` | credentials, if required      | –                                     |
| `MAIL_FROM`              | sender address                | `mission-control@spacefarers.example` |

For a local inbox, run [Mailpit](https://mailpit.axllent.org/):

```sh
docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit
```

In a second terminal, start the server with the SMTP host set:

```sh
SMTP_HOST=localhost npm run watch
```

The emails then appear at http://localhost:8025.

### Production: transactional outbox

Sending after commit leaves one gap: if the server stops or the SMTP server
is unavailable right after the commit, the email is lost. For production it
is recommended to close this gap with the transactional outbox pattern, which
CAP supports out of the box:

1. The mailer becomes a CAP service of its own.
2. The handler calls it through `cds.queued(mailer)`. CAP then stores the
   message in an outbox table in the same transaction that creates the
   spacefarer, so both are saved or neither is.
3. After the commit, CAP dispatches the message and retries on failure.

Delivery then becomes at-least-once, so an email can occasionally be sent
twice. The outbox is not part of this solution, to keep it small.

## Tests

`npm test` runs the suite with the Node.js test runner:

- unit tests for the validation and enhancement rules and the email text,
- model tests for the entities and the initial data,
- service tests over HTTP for authentication, roles, planet isolation,
  the draft workflow, the handlers and the OData query options,
- annotation tests for the list report and object page.

A GitHub Actions workflow runs the linter, the type check, the formatting
check and the tests on every push, with Node.js 22 and 26.

## Project structure

```
app/spacefarers/   Fiori elements app (generated) and its annotations
db/                domain model and initial data
srv/               service definition, handlers and business rules
test/              tests
_i18n/             labels used by the annotations
```

## Towards production

This project runs locally only. For a deployment to SAP BTP, the following
should be added:

- **SAP HANA Cloud** instead of SQLite.
- **XSUAA or IAS** for authentication, with the three roles as role
  templates and `planet` as a user attribute. The service definition and
  the restrictions stay as they are.
- **An application router** in front of the app, which redirects
  unauthenticated users to the sign-in page.
- **The transactional outbox** for the welcome email, as described above.
- **An MTA descriptor** to build and deploy the modules together.
