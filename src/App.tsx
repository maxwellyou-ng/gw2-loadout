import { HashRouter, Navigate, Route, Routes, useLocation, type Location } from 'react-router-dom'
import { AppProvider } from './state/store'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Modal from './components/Modal'
import Today from './screens/Today'
import Goals from './screens/Goals'
import Catalog from './screens/Catalog'
import Materials from './screens/Materials'
import Settings from './screens/Settings'
import PieceDetail from './screens/PieceDetail'
import Compare from './screens/Compare'

/**
 * Routes with the "background location" modal pattern: links into item-detail
 * and compare stash the current location as `state.background` (see
 * OverlayLink). When present, the main tree renders against that background so
 * the originating page stays visible, and the target renders in a Modal on top.
 * Without a background (direct visit / refresh), the routes render full-page.
 *
 * Four tabs (docs/REDESIGN.md §2): Today · Goals · Materials · Settings.
 * Legacy routes redirect to their new homes so old bookmarks keep working.
 */
function AppRoutes() {
  const location = useLocation()
  const background = (location.state as { background?: Location } | null)?.background

  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<Today />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/piece/:id" element={<PieceDetail />} />
          <Route path="/settings" element={<Settings />} />
          {/* Legacy screens, consolidated (docs/REDESIGN.md §2). */}
          <Route path="/dashboard" element={<Navigate to="/today" replace />} />
          <Route path="/loadout" element={<Navigate to="/goals" replace />} />
          <Route path="/forecast" element={<Navigate to="/materials" replace />} />
          <Route path="/history" element={<Navigate to="/goals" replace />} />
          <Route path="/compare/:slotKey" element={<Navigate to="/goals" replace />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>

      {background && (
        <Routes>
          <Route
            path="/compare"
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
    <ErrorBoundary>
      <AppProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  )
}
