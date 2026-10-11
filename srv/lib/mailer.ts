import cds from '@sap/cds'
import nodemailer, { type Transporter } from 'nodemailer'

const LOG = cds.log('mailer')

export interface Mail {
  to: string
  subject: string
  text: string
}

let transporter: Transporter | undefined

/** SMTP when SMTP_HOST is set; otherwise emails are only written to the log. */
function createTransporter(): Transporter {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST) return nodemailer.createTransport({ jsonTransport: true })

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 1025),
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  })
}

// An object rather than a bare function, so that tests can replace `send`
export const mailer = {
  async send(mail: Mail): Promise<void> {
    transporter ??= createTransporter()
    const from = process.env.MAIL_FROM ?? 'mission-control@spacefarers.example'
    await transporter.sendMail({ from, ...mail })

    if (process.env.SMTP_HOST) LOG.info(`Email sent to ${mail.to}: ${mail.subject}`)
    else LOG.info(`SMTP_HOST is not set, email to ${mail.to} was only logged:\n${mail.subject}\n\n${mail.text}`)
  },
}
