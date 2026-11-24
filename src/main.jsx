import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/index.css'

// The public clinic website lives at the root; the EMR portal lives under /portal.
// Each is loaded on demand so website visitors never download the portal code.
const isPortal = window.location.pathname === '/portal' || window.location.pathname.startsWith('/portal/')

const root = ReactDOM.createRoot(document.getElementById('root'))
const load = isPortal ? import('@/App.jsx') : import('@/site/Site.jsx')

load.then(({ default: Root }) => root.render(<Root />))
