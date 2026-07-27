/**
 * The species page as a large overlay.
 *
 * Opened from a fishery you want the detail without losing your place in the
 * list, so it comes over the page rather than replacing it. The address changes
 * with it, so the same view is still linkable and Escape or a click outside
 * puts you back where you were.
 */
import { useEffect } from 'react'
import { speciesName } from '../../data'
import { useI18n } from '../../i18n'
import type { BestCatch } from '../../types'
import { Icon } from '../primitives'
import { SpeciesDetail } from './SpeciesDetail'

export interface SpeciesModalProps {
  speciesKey: string
  caught: Record<string, boolean>
  bests: Record<string, BestCatch>
  onClose: () => void
  onToggleCatch: (key: string) => void
  onOpenMap: (id: string) => void
}

export function SpeciesModal({
  speciesKey,
  caught,
  bests,
  onClose,
  onToggleCatch,
  onOpenMap,
}: SpeciesModalProps) {
  const { t, lang } = useI18n()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // The page behind must not scroll along.
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = before
    }
  }, [onClose])

  return (
    <div
      className="ufs-sheet-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="ufs-sheet" role="dialog" aria-label={speciesName(speciesKey, lang)}>
        <div className="ufs-sheet-head">
          <span>{speciesName(speciesKey, lang)}</span>
          <button className="ufs-btn" onClick={onClose} title={t('app.close')}>
            <Icon name="close" />
            <span className="lbl">{t('app.close')}</span>
          </button>
        </div>
        <div className="ufs-sheet-body">
          <SpeciesDetail
            speciesKey={speciesKey}
            caught={caught}
            bests={bests}
            onBack={onClose}
            showBack={false}
            onToggleCatch={onToggleCatch}
            onOpenMap={(id) => {
              onClose()
              onOpenMap(id)
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default SpeciesModal
