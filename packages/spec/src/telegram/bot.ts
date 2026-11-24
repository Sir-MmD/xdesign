// Bot setup (docs/plan/08 sections 1 and 7 item 6): the methods that set the bot's name, texts,
// photo, commands and menu button, with their limits, the command scopes and the menu button
// types. Changes of name and texts may take a few minutes to show.
import type { LimitId } from './limits.ts'
import { apiDoc, BOT_API, type Sourced } from './version.ts'

export type BotMethodRow = Sourced & {
  /** The Bot API method. */
  readonly id: string
  /** What it sets, in plain words. */
  readonly sets: string
  /** The parameters xDesign passes. */
  readonly params: readonly string[]
  /** Called once per language (language_code; empty for the default). */
  readonly perLanguage: boolean
  readonly limits: readonly LimitId[]
  readonly since?: string
}

export const BOT_METHODS = [
  {
    id: 'setMyName',
    sets: 'The bot name',
    params: ['name', 'language_code'],
    perLanguage: true,
    limits: ['botName'],
    source: apiDoc('setmyname'),
    botApi: BOT_API,
    verified: true,
    note: 'An empty name removes the name of that language.',
  },
  {
    id: 'setMyShortDescription',
    sets: 'The "about" text on the profile page and in shared links',
    params: ['short_description', 'language_code'],
    perLanguage: true,
    limits: ['botAbout'],
    source: apiDoc('setmyshortdescription'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'setMyDescription',
    sets: 'The description shown in an empty chat with the bot',
    params: ['description', 'language_code'],
    perLanguage: true,
    limits: ['botDescription'],
    source: apiDoc('setmydescription'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'setMyProfilePhoto',
    sets: 'The profile photo',
    params: ['photo'],
    perLanguage: false,
    limits: [],
    since: '9.4',
    source: apiDoc('setmyprofilephoto'),
    botApi: BOT_API,
    verified: true,
    note: 'InputProfilePhotoStatic (.JPG) or InputProfilePhotoAnimated (MPEG4); upload only, never a file_id.',
  },
  {
    id: 'removeMyProfilePhoto',
    sets: 'Removes the profile photo',
    params: [],
    perLanguage: false,
    limits: [],
    since: '9.4',
    source: apiDoc('removemyprofilephoto'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'setMyCommands',
    sets: 'The commands menu',
    params: ['commands', 'scope', 'language_code'],
    perLanguage: true,
    limits: ['command', 'commandDescription', 'commands'],
    source: apiDoc('setmycommands'),
    botApi: BOT_API,
    verified: true,
    note: 'xDesign uses the scope all_private_chats.',
  },
  {
    id: 'setChatMenuButton',
    sets: 'The menu button next to the input field',
    params: ['menu_button'],
    perLanguage: false,
    limits: [],
    source: apiDoc('setchatmenubutton'),
    botApi: BOT_API,
    verified: true,
    note: 'Without chat_id it sets the default menu button of every private chat.',
  },
] as const satisfies readonly BotMethodRow[]

export type CommandScopeRow = Sourced & {
  /** The type field of the BotCommandScope object. */
  readonly id: string
  readonly object: string
  /** xDesign sets commands in this scope. */
  readonly used: boolean
}

export const COMMAND_SCOPES = [
  {
    id: 'default',
    object: 'BotCommandScopeDefault',
    used: false,
    source: apiDoc('botcommandscopedefault'),
    botApi: BOT_API,
    verified: true,
    note: 'Used when no other scope has commands.',
  },
  {
    id: 'all_private_chats',
    object: 'BotCommandScopeAllPrivateChats',
    used: true,
    source: apiDoc('botcommandscopeallprivatechats'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'all_group_chats',
    object: 'BotCommandScopeAllGroupChats',
    used: false,
    source: apiDoc('botcommandscopeallgroupchats'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'all_chat_administrators',
    object: 'BotCommandScopeAllChatAdministrators',
    used: false,
    source: apiDoc('botcommandscopeallchatadministrators'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'chat',
    object: 'BotCommandScopeChat',
    used: false,
    source: apiDoc('botcommandscopechat'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'chat_administrators',
    object: 'BotCommandScopeChatAdministrators',
    used: false,
    source: apiDoc('botcommandscopechatadministrators'),
    botApi: BOT_API,
    verified: true,
  },
  {
    id: 'chat_member',
    object: 'BotCommandScopeChatMember',
    used: false,
    source: apiDoc('botcommandscopechatmember'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly CommandScopeRow[]

export type MenuButtonTypeRow = Sourced & {
  /** The type field of the MenuButton object. */
  readonly id: string
  readonly object: string
  /** False for the Web App button (excluded, D-11). */
  readonly used: boolean
}

export const MENU_BUTTON_TYPES = [
  {
    id: 'commands',
    object: 'MenuButtonCommands',
    used: true,
    source: apiDoc('menubuttoncommands'),
    botApi: BOT_API,
    verified: true,
    note: 'Opens the list of commands.',
  },
  {
    id: 'default',
    object: 'MenuButtonDefault',
    used: true,
    source: apiDoc('menubuttondefault'),
    botApi: BOT_API,
    verified: true,
    note: 'No value set; by default the menu button opens the list of commands.',
  },
  {
    id: 'web_app',
    object: 'MenuButtonWebApp',
    used: false,
    source: apiDoc('menubuttonwebapp'),
    botApi: BOT_API,
    verified: true,
  },
] as const satisfies readonly MenuButtonTypeRow[]
