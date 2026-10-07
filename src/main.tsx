import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { reportUncaughtErrors } from '@/lib/reportError'

reportUncaughtErrors()

// A tab opened before a deploy asks for chunks the new build no longer has (LED-317). Reload once
// to pick up the new version; offline, or after one reload, the page's error boundary explains.
window.addEventListener('vite:preloadError', (event) => {
  if (!navigator.onLine) return
  const key = 'ledger:chunk-reload'
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
