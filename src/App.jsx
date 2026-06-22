import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

import Login        from './pages/Login'
import Dashboard    from './pages/Dashboard'
import Backoffice   from './pages/Backoffice'
import Supervisor   from './pages/Supervisor'
import Validacion   from './pages/Validacion'
import Seguimiento  from './pages/Seguimiento'
import Grabaciones  from './pages/Grabaciones'
import SupGrabaciones from './pages/SupGrabaciones'
import Programacion from './pages/Programacion'
import Jefatura     from './pages/Jefatura'
import Usuarios     from './pages/Usuarios'

function PrivateRoute({ children }) {
  const { sesion } = useAuth()
  return sesion ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
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

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
