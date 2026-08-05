import React from 'react'
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import { AppProviders } from './context/AppContext'
import './index.css'

// Routing is kept in memory rather than in the address bar, so the URL stays
// `/app` on every screen and internal route names are never exposed.
//
// Incoming deep links still have to work — the landing page footer points at
// /app/privacy, and the Vercel rewrite serves the SPA for any /app/* path. So
// we read the entry path ONCE to seed the router, then blank it out of the
// address bar. Without the seed, someone clicking "Privacy Policy" would land
// on the welcome screen instead.
//
// Deliberate trade-off: with no history entries, browser back/forward and
// per-screen bookmarking stop working. In-app navigation is unaffected.
function entryRoute(): string {
  if (!import.meta.env.PROD) return window.location.pathname
  const path = window.location.pathname.replace(/^\/app/, '') || '/'
  if (window.location.pathname !== '/app') {
    window.history.replaceState(null, '', '/app')
  }
  return path
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MemoryRouter initialEntries={[entryRoute()]}>
      <AppProviders>
        <App />
      </AppProviders>
    </MemoryRouter>
  </React.StrictMode>,
)
