import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import './styles.css';
import Play from './views/Play';

const Screen = lazy(() => import('./views/Screen'));
const Host = lazy(() => import('./views/Host'));
const Admin = lazy(() => import('./views/Admin'));

const p = location.pathname.replace(/\/+$/, '') || '/';
const View = p.startsWith('/screen') ? Screen : p.startsWith('/host') || p.startsWith('/stats') ? Host : p.startsWith('/admin') ? Admin : Play;
document.body.className = p.startsWith('/screen') ? 'is-screen' : p.startsWith('/host') || p.startsWith('/stats') ? 'is-host' : p.startsWith('/admin') ? 'is-admin' : 'is-play';
createRoot(document.getElementById('root')!).render(<Suspense fallback={<div className="center"><div className="spinner" /></div>}><View /></Suspense>);
