import type { Key } from '../../i18n'
import type { Visibility } from './types'

/**
 * The three visibilities and where their wording lives. Nothing but keys here,
 * so a new language is a new dictionary file and nothing else.
 */
export const VISIBILITIES: Visibility[] = ['public', 'unlisted', 'private']

export const VIS_TITLE: Record<Visibility, Key> = {
  public: 'group.public',
  unlisted: 'group.unlisted',
  private: 'group.private',
}

export const VIS_HINT: Record<Visibility, Key> = {
  public: 'group.publicHint',
  unlisted: 'group.unlistedHint',
  private: 'group.privateHint',
}
