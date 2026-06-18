import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './state/store'
import Layout from './components/Layout'
import Loadout from './screens/Loadout'
import Settings from './screens/Settings'
import PieceDetail from './screens/PieceDetail'

// HashRouter so deep links work on GitHub Pages static hosting (no server
// rewrites needed).
export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/loadout" replace />} />
            <Route path="/loadout" element={<Loadout />} />
            <Route path="/piece/:id" element={<PieceDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/loadout" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
