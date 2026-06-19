import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './state/store'
import Layout from './components/Layout'
import Loadout from './screens/Loadout'
import Settings from './screens/Settings'
import PieceDetail from './screens/PieceDetail'
import Dashboard from './screens/Dashboard'
import Materials from './screens/Materials'
import Compare from './screens/Compare'
import Forecast from './screens/Forecast'
import History from './screens/History'

// HashRouter so deep links work on GitHub Pages static hosting (no server
// rewrites needed).
export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/loadout" element={<Loadout />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/history" element={<History />} />
            <Route path="/compare/:slotKey" element={<Compare />} />
            <Route path="/piece/:id" element={<PieceDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </AppProvider>
  )
}
