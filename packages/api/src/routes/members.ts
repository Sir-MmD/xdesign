// The site's members (docs/plan/05 section 1): the site owner's Members page and the member
// search of the Share dialog. USER-01b (18 section 3.4): the site owner adds members, sets their
// passwords and changes their usernames; there are no invite or password reset links.
import { z } from 'zod'

import { id, newPassword, ok, personName, time, username } from '../common.ts'
import { defineRoute } from '../route.ts'

export const member = z.object({
  id,
  username: z.string(),
  name: z.string(),
  color: z.string(),
  isSiteOwner: z.boolean(),
  disabledAt: time.nullable(),
  createdAt: time,
  lastSeenAt: time.nullable(),
  // The designs they own: "Remove" needs them moved first.
  designCount: z.number().int(),
  // TFA-01: two-factor sign-in is on ("Turn off two-factor authentication" in their menu).
  twoFactor: z.boolean(),
})

const userParams = z.object({ userId: id })

export const memberRoutes = {
  members: defineRoute({
    key: 'members',
    method: 'GET',
    path: '/api/members',
    response: z.object({ members: z.array(member) }),
    auth: 'siteOwner',
  }),
  // USER-01b "Add member", after "Confirm it's you": the account works at once and never expires
  // (Q-57); the site owner gives them the username and password. A username in use answers 409.
  addMember: defineRoute({
    key: 'addMember',
    method: 'POST',
    path: '/api/members',
    body: z.object({ username, name: personName, password: newPassword }),
    response: z.object({ member }),
    auth: 'siteOwner',
  }),
  // "Add people" in the Share dialog: members by name or username.
  searchMembers: defineRoute({
    key: 'searchMembers',
    method: 'GET',
    path: '/api/members/search',
    query: z.object({ q: z.string().trim().max(100) }),
    response: z.object({ members: z.array(z.object({ id, name: z.string(), username: z.string() })) }),
    auth: 'member',
  }),
  // "Disable" ends their sessions and live connections at once; "Enable" restores access.
  updateMember: defineRoute({
    key: 'updateMember',
    method: 'PATCH',
    path: '/api/members/:userId',
    params: userParams,
    body: z.object({ disabled: z.boolean() }),
    response: z.object({ member }),
    auth: 'siteOwner',
  }),
  // "Remove": once they own no designs, or with "Move their designs to: <member>".
  removeMember: defineRoute({
    key: 'removeMember',
    method: 'DELETE',
    path: '/api/members/:userId',
    params: userParams,
    body: z.object({ moveDesignsTo: id.optional() }),
    response: ok,
    auth: 'siteOwner',
  }),
  // TFA-01 "Turn off two-factor authentication" for a member who lost their phone, after
  // "Confirm it's you": every session of theirs ends. Not for the site owner's own.
  resetTwoFactor: defineRoute({
    key: 'resetTwoFactor',
    method: 'DELETE',
    path: '/api/members/:userId/two-factor',
    params: userParams,
    response: z.object({ member }),
    auth: 'siteOwner',
  }),
  // USER-01b "Set password", after "Confirm it's you": they keep it (Q-56) and are signed out
  // everywhere, as "Disable" does; their API keys and connected apps stay. Not the site owner's
  // own (the Account page's "Change password").
  setMemberPassword: defineRoute({
    key: 'setMemberPassword',
    method: 'PUT',
    path: '/api/members/:userId/password',
    params: userParams,
    body: z.object({ password: newPassword }),
    response: ok,
    auth: 'siteOwner',
  }),
  // USER-01b "Change username" (Q-71): their password stays and nobody is signed out. A username
  // in use answers 409.
  changeUsername: defineRoute({
    key: 'changeUsername',
    method: 'PUT',
    path: '/api/members/:userId/username',
    params: userParams,
    body: z.object({ username }),
    response: z.object({ member }),
    auth: 'siteOwner',
  }),
}
