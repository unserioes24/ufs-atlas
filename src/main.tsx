import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from './i18n'
import LegacyApp from './legacy/app.js'
import './styles/base.css'
import './styles/ui.css'

const root = document.getElementById('root')
if (!root) throw new Error('Mount point #root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <LegacyApp />
    </I18nProvider>
  </StrictMode>,
)
