import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { cargosDeUsuario } from './utils/roles'
import { RUTAS } from './utils/rutas'

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

function rutaInicialAutorizada(sesion) {
  return cargosDeUsuario(sesion).map(cargo => RUTAS[cargo]).find(Boolean) || '/login'
}

function PrivateRoute({ children, cargo }) {
  const { sesion } = useAuth()
  if (!sesion) return <Navigate to="/login" replace />
  if (cargo && !cargosDeUsuario(sesion).includes(cargo)) {
    return <Navigate to={rutaInicialAutorizada(sesion)} replace />
  }
  return children
}

function InicioAutorizado() {
  const { sesion } = useAuth()
  return <Navigate to={sesion ? rutaInicialAutorizada(sesion) : '/login'} replace />
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<InicioAutorizado />} />

      <Route path="/dashboard"     element={<PrivateRoute cargo="asesor"><Dashboard /></PrivateRoute>} />
      <Route path="/backoffice"    element={<PrivateRoute cargo="backoffice"><Backoffice /></PrivateRoute>} />
      <Route path="/supervisor"    element={<PrivateRoute cargo="supervisor"><Supervisor /></PrivateRoute>} />
      <Route path="/validacion"    element={<PrivateRoute cargo="validacion"><Validacion /></PrivateRoute>} />
      <Route path="/seguimiento"   element={<PrivateRoute cargo="seguimiento"><Seguimiento /></PrivateRoute>} />
      <Route path="/grabaciones"   element={<PrivateRoute cargo="grabaciones"><Grabaciones /></PrivateRoute>} />
      <Route path="/sup-grabaciones" element={<PrivateRoute cargo="supgrabaciones"><SupGrabaciones /></PrivateRoute>} />
      <Route path="/programacion"  element={<PrivateRoute cargo="programacion"><Programacion /></PrivateRoute>} />
      <Route path="/jefatura"      element={<PrivateRoute cargo="jefatura"><Jefatura /></PrivateRoute>} />
      <Route path="/usuarios"      element={<PrivateRoute cargo="usuarios"><Usuarios /></PrivateRoute>} />
      <Route path="/backdata-reclutamiento" element={<PrivateRoute cargo="backreclutamiento"><Backdatareclutamiento /></PrivateRoute>} />
      <Route path="/reclutamiento"          element={<PrivateRoute cargo="asesorreclutamiento"><DashboardReclutamiento /></PrivateRoute>} />

      <Route path="*" element={<InicioAutorizado />} />
      </Routes>
    </Suspense>
  )
}
