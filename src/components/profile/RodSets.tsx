/**
 * The rod sets a save file carries: up to eight prepared rigs, each with its
 * rod, reel, line, hook and whatever bait sits on it.
 */
import { useI18n } from '../../i18n'
import type { Key } from '../../i18n'
import { itemLabel } from '../../lib/gear'
import type { RodSet } from '../../lib/savegame'

export function RodSets({ sets }: { sets: RodSet[] }) {
  const { t, lang } = useI18n()
  if (!sets.length) return null
  return (
    <div className="ufs-setgrid">
      {sets.map((s) => (
        <div key={s.n} className="ufs-setcard">
          <div className="hd">{t('gear.set', { n: s.n })}</div>
          <div className="rows">
            {s.parts.map((p) => (
              <div key={p.slot}>
                <span>{t(p.slot as Key)}</span>
                <em>{itemLabel(p.id, lang)}</em>
              </div>
            ))}
            {s.baits.length ? (
              <div>
                <span>{t('fish.baits')}</span>
                <em>{s.baits.map((b) => itemLabel(b, lang)).join(', ')}</em>
              </div>
            ) : null}
          </div>
          <div className="ft">
            {typeof s.hookSize === 'number' ? (
              <span>
                {t('gear.hookStep')} <b>{s.hookSize}</b>
              </span>
            ) : null}
            {typeof s.depth === 'number' ? (
              <span>
                {t('gear.depth')} <b>{s.depth}</b>
              </span>
            ) : null}
            {typeof s.weight === 'number' ? (
              <span>
                {t('gear.shot')} <b>{s.weight}</b>
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
