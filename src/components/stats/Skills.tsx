/**
 * The skill tree as the save file has it: one row per skill with the step the
 * player has reached.
 *
 * The names come from the game's own localisation, so they read the way they do
 * in the skill window. A skill the game never hands out stays at step 0 and
 * sits at the bottom - that is what the save file says, and guessing which ones
 * are reachable would be worse than showing them.
 */
import { GAME } from '../../data'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/format'
import type { SkillState } from '../../lib/savegame'

/** Skill key -> name and description, in both languages. */
const NAMES = new Map((GAME.skills ?? []).map((s) => [s.key, s]))

export interface SkillsProps {
  skills: SkillState[]
  /** Points not spent yet; hidden when there are none. */
  points?: number
}

export function Skills({ skills, points = 0 }: SkillsProps) {
  const { t, lang } = useI18n()
  if (!skills.length) return null

  const unlocked = skills.filter((s) => s.level > 0).length

  return (
    <div className="ufs-spotcard" style={{ marginTop: '.9rem' }}>
      <div
        className="ufs-row"
        style={{ justifyContent: 'space-between', marginBottom: '.6rem' }}
      >
        <h3 style={{ margin: 0 }}>{t('skills.title')}</h3>
        <div className="ufs-row" style={{ gap: '.4rem' }}>
          <span className="ufs-chip">
            {t('skills.unlocked', { done: unlocked, total: skills.length })}
          </span>
          {points > 0 ? (
            <span className="ufs-chip ufs-chip-on">{t('skills.points', { n: points })}</span>
          ) : null}
        </div>
      </div>

      <div className="ufs-splist">
        {skills.map((s) => {
          const meta = NAMES.get(s.key)
          const name = meta ? (lang === 'en' ? meta.en : meta.de) || meta.en : s.key
          const desc = meta ? (lang === 'en' ? meta.descEn : meta.descDe) : ''
          return (
            <div key={s.key} className={cn('ufs-spline ufs-skill', s.level > 0 && 'has')}>
              <span className={cn('n', s.level > 0 && 'done')}>
                {name}
                {desc ? <span className="hint">{desc}</span> : null}
              </span>
              {/* One pip per step, filled up to the level reached. */}
              <span className="pips" aria-hidden>
                {Array.from({ length: s.steps }, (_, i) => (
                  <span key={i} className={cn(i < s.level && 'on')} />
                ))}
              </span>
              <span className="d">
                {s.steps > 1
                  ? t('skills.step', { level: s.level, steps: s.steps })
                  : s.level > 0
                    ? t('skills.have')
                    : t('skills.open')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Skills
