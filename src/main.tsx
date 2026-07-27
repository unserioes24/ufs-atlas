import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from './i18n'
import App from './App'
import './styles/base.css'
import './styles/ui.css'

const root = document.getElementById('root')
if (!root) throw new Error('Mount point #root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
