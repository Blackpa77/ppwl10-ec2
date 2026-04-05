import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// 1. Kita panggil (import) langsung kedua filenya di atas
import App2 from './App2'
import App3 from './App3'

// 2. Cek path URL-nya
const path = window.location.pathname

// 3. Tentukan aplikasi mana yang mau dijalankan
const App = path === '/classroom' ? App3 : App2

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)