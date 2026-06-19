import { HashRouter, Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { AppProvider } from './state/store'
import Layout from './components/Layout'
import Modal from './components/Modal'
import Loadout from './screens/Loadout'
import Settings from './screens/Settings'
import PieceDetail from './screens/PieceDetail'
import Dashboard from './screens/Dashboard'
import Materials from './screens/Materials'
import Compare from './screens/Compare'
import Forecast from './screens/Forecast'
import History from './screens/History'

/**
 * Routes with the "background location" modal pattern: links into item-detail
 * and compare stash the current location as `state.background` (see
 * OverlayLink). When present, the main tree renders against that background so
 * the originating page stays visible, and the target renders in a Modal on top.
 * Without a background (direct visit / refresh), the routes render full-page.
 */
function AppRoutes() {
  const location = useLocation()
  const background = (location.state as { background?: Location } | null)?.background

  return (
    <>
      <Routes location={background ?? location}>
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

      {background && (
        <Routes>
          <Route
            path="/compare/:slotKey"
            element={
              <Modal label="Compare candidates">
                <Compare inModal />
              </Modal>
            }
          />
          <Route
            path="/piece/:id"
            element={
              <Modal label="Item details">
                <PieceDetail inModal />
              </Modal>
            }
          />
        </Routes>
      )}
    </>
  )
}

// HashRouter so deep links work on GitHub Pages static hosting (no server
// rewrites needed).
export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </AppProvider>
  )
}
