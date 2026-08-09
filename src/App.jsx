import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Backoffice = lazy(() => import('./pages/Backoffice'))
const Supervisor = lazy(() => import('./pages/Supervisor'))
const Validacion = lazy(() => import('./pages/Validacion'))
const Seguimiento = lazy(() => import('./pages/Seguimiento'))
const Grabaciones = lazy(() => import('./pages/Grabaciones'))
const SupGrabaciones = lazy(() => import('./pages/SupGrabaciones'))
const Programacion = lazy(() => import('./pages/Programacion'))
const Jefatura = lazy(() => import('./pages/Jefatura'))
const Usuarios = lazy(() => import('./pages/Usuarios'))
const Backdatareclutamiento = lazy(() => import('./pages/Backdatareclutamiento'))
const DashboardReclutamiento = lazy(() => import('./pages/dashboardreclutamiento'))

function RouteLoader() {
  return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#f5f6fa', color:'#64748b', fontFamily:'Inter, sans-serif' }}>
      Cargando módulo…
    </div>
  )
}

function PrivateRoute({ children }) {
  const { sesion } = useAuth()
  return sesion ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/dashboard"     element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/backoffice"    element={<PrivateRoute><Backoffice /></PrivateRoute>} />
      <Route path="/supervisor"    element={<PrivateRoute><Supervisor /></PrivateRoute>} />
      <Route path="/validacion"    element={<PrivateRoute><Validacion /></PrivateRoute>} />
      <Route path="/seguimiento"   element={<PrivateRoute><Seguimiento /></PrivateRoute>} />
      <Route path="/grabaciones"   element={<PrivateRoute><Grabaciones /></PrivateRoute>} />
      <Route path="/sup-grabaciones" element={<PrivateRoute><SupGrabaciones /></PrivateRoute>} />
      <Route path="/programacion"  element={<PrivateRoute><Programacion /></PrivateRoute>} />
      <Route path="/jefatura"      element={<PrivateRoute><Jefatura /></PrivateRoute>} />
      <Route path="/usuarios"      element={<PrivateRoute><Usuarios /></PrivateRoute>} />
      <Route path="/backdata-reclutamiento" element={<PrivateRoute><Backdatareclutamiento /></PrivateRoute>} />
      <Route path="/reclutamiento"          element={<PrivateRoute><DashboardReclutamiento /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
