# Getting Started

Welcome to your new CAP project.

It contains these folders and files, following our recommended project layout:

File or Folder | Purpose
---------|----------
`app/` | content for UI frontends goes here
`db/` | your domain models and data go here
`srv/` | your service models and code go here
`readme.md` | this getting started guide

## Next Steps

- Open a new terminal and run `cds watch`
- (in VS Code simply choose _**Terminal** > Run Task > cds watch_)
- Start with your domain model, in a CDS file in `db/`

## Learn More

Learn more at <https://cap.cloud.sap>.

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

For a local inbox, run [Mailpit](https://mailpit.axllent.org/) and open
http://localhost:8025:

```sh
docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit
SMTP_HOST=localhost npm run watch
```

### Production: transactional outbox

Sending after commit leaves one gap: if the server stops or the SMTP server
is unavailable right after the commit, the email is lost. For production I
would close this gap with the transactional outbox pattern, which CAP
supports out of the box:

1. The mailer becomes a CAP service of its own.
2. The handler calls it through `cds.queued(mailer)`. CAP then stores the
   message in an outbox table in the same transaction that creates the
   spacefarer, so both are saved or neither is.
3. After the commit, CAP dispatches the message and retries on failure.

Delivery becomes at-least-once, so an email can occasionally be sent twice.
I left this out here to keep the solution small.
