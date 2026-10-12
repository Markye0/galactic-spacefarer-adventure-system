import cds from '@sap/cds'

type Test = ReturnType<typeof cds.test>
type Data = Record<string, unknown>

export const as = (username: string) => ({ auth: { username, password: 'pass' } })

/**
 * Spacefarers are draft-enabled, so they are created and edited the way the Fiori UI does it:
 * through a draft that is activated at the end. Each helper returns the response of the first
 * step that fails, or of the activation.
 */
export function spacefarerDrafts({ POST, PATCH, DELETE }: Test) {
  const draft = (id: string) => `/Spacefarers(ID=${id},IsActiveEntity=false)`
  const active = (id: string) => `/Spacefarers(ID=${id},IsActiveEntity=true)`
  const ok = (response: { status: number }) => response.status >= 200 && response.status < 300

  const newDraft = (data: Data, username: string) => POST('/Spacefarers', data, as(username))
  const editDraft = (id: string, username: string) =>
    POST(`${active(id)}/SpacefarerService.draftEdit`, { PreserveChanges: true }, as(username))
  const change = (id: string, changes: Data, username: string) => PATCH(draft(id), changes, as(username))
  const activate = (id: string, username: string) =>
    POST(`${draft(id)}/SpacefarerService.draftActivate`, {}, as(username))
  const discard = (id: string, username: string) => DELETE(draft(id), as(username))

  /** New draft, then save. */
  const create = async (data: Data, username: string) => {
    const created = await newDraft(data, username)
    return ok(created) ? activate(created.data.ID, username) : created
  }

  /** Edit, change fields, then save. */
  const update = async (id: string, changes: Data, username: string) => {
    const edited = await editDraft(id, username)
    if (!ok(edited)) return edited
    const changed = await change(id, changes, username)
    return ok(changed) ? activate(id, username) : changed
  }

  return { newDraft, editDraft, change, activate, discard, create, update }
}
