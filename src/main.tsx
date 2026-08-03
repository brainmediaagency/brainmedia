import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { initAppCheck } from '@/lib/firebase/appCheck'
import '@/styles/globals.css'

initAppCheck()

/** If a cached HTML shell points at an older deploy, reload once onto the live build. */
void (async () => {
  try {
    const res = await fetch(`/?brain_build_check=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return
    const html = await res.text()
    const live = html.match(/name="brain-build"\s+content="([^"]+)"/)?.[1]
    const current = document
      .querySelector('meta[name="brain-build"]')
      ?.getAttribute('content')
    if (!live || live === current) {
      sessionStorage.removeItem('brain-build-reload')
      return
    }
    if (sessionStorage.getItem('brain-build-reload') === live) return
    sessionStorage.setItem('brain-build-reload', live)
    window.location.reload()
  } catch {
    /* ignore — offline / blocked */
  }
})()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
