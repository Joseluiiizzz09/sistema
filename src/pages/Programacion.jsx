import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { API, ncHeaders } from '../services/api'
import '../styles/programacion.css'

const BADGE_CLS = {
  APROBADO:         'b-aprobado',
  PROGRAMADO:       'b-programado',
  BLOQUEADO:        'b-bloqueado',
  SIN_AGENDA:       'b-sinagenda',
  CARACTER_ESPECIAL:'b-caracter',
  FRAUDE:           'b-fraude',
  ZONA_RESTRINGIDA: 'b-zona',
  INSTALADO:        'b-instalado',
  PENDIENTE:        'b-pendiente',
  CAIDA:            'b-caida',
  VALIDADO:         'b-validado',
}

const ESTADO_LABELS = {
  APROBADO:         'Aprobado',
  PROGRAMADO:       'Programado',
  BLOQUEADO:        'Bloqueado',
  SIN_AGENDA:       'Sin agenda',
  CARACTER_ESPECIAL:'Carácter especial',
  FRAUDE:           'Fraude',
  ZONA_RESTRINGIDA: 'Zona restringida',
  INSTALADO:        'Instalado',
  PENDIENTE:        'Pendiente',
  CAIDA:            'Caída',
  VALIDADO:         'Validado',
}

const ESTADO_BTNS = [
  { id: 'PROGRAMADO',        label: 'Programado',        cls: 'be-programado' },
  { id: 'BLOQUEADO',         label: 'Bloqueado',         cls: 'be-bloqueado'  },
  { id: 'SIN_AGENDA',        label: 'Sin agenda',        cls: 'be-sinagenda'  },
  { id: 'CARACTER_ESPECIAL', label: 'Carácter especial', cls: 'be-caracter'   },
  { id: 'FRAUDE',            label: 'Fraude',            cls: 'be-fraude'     },
  { id: 'ZONA_RESTRINGIDA',  label: 'Zona restringida',  cls: 'be-zona'       },
]

const ESTADOS_PROGRAMACION = [
  'APROBADO','PROGRAMADO','BLOQUEADO','SIN_AGENDA','CARACTER_ESPECIAL',
  'FRAUDE','ZONA_RESTRINGIDA','INSTALADO','PENDIENTE','CAIDA'
]

function formatF(f) {
  if (!f) return '—'
  const d = f.split('T')[0] || f
  const p = d.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : f
}

function DetCampo({ label, val }) {
  return <div className="det-campo"><label>{label}</label><span>{val || '—'}</span></div>
}

export default function Programacion() {
  const navigate = useNavigate()
  const { sesion, logout } = useAuth()

  const [ventas, setVentas]       = useState([])
  const [fEstado, setFEstado]     = useState('')
  const [fAsesor, setFAsesor]     = useState('')
  const [fDesde, setFDesde]       = useState('')
  const [fHasta, setFHasta]       = useState('')
  const [busqueda, setBusqueda]   = useState('')

  const [modalDet, setModalDet]       = useState(null)
  const [estadoModal, setEstadoModal] = useState('')
  const [obsProg, setObsProg]         = useState('')

  const [toastMsg, setToastMsg] = useState('')
  const toastRef = useRef(null)

  function mostrarToast(msg) {
    setToastMsg(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToastMsg(''), 3200)
  }

  const cargarVentas = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/ventas?programacion=1`, { headers: ncHeaders() })
      const data = await res.json()
      if (!data.ok) { mostrarToast('Error cargando ventas'); return }
      setVentas(data.data.filter(v => {
        const e = (v.estado || '').toUpperCase()
        return ESTADOS_PROGRAMACION.includes(e)
      }))
    } catch (e) { mostrarToast('Error conectando al servidor') }
  }, [])

  useEffect(() => {
    cargarVentas()
    const t = setInterval(cargarVentas, 15000)
    return () => clearInterval(t)
  }, [cargarVentas])

  const ventasFiltradas = useMemo(() => ventas.filter(v => {
    const est   = (v.estado || '').toUpperCase()
    const fecha = (v.created_at || '').split('T')[0].split(' ')[0]
    if (fEstado  && est !== fEstado.toUpperCase()) return false
    if (fAsesor  && !(v.asesor_nombre || '').toLowerCase().includes(fAsesor.toLowerCase())) return false
    if (fDesde   && fecha < fDesde) return false
    if (fHasta   && fecha > fHasta) return false
    if (busqueda) {
      const b = busqueda.toLowerCase()
      if (![(v.dni || ''), (v.nombre || ''), (v.asesor_nombre || '')].join(' ').toLowerCase().includes(b)) return false
    }
    return true
  }), [ventas, fEstado, fAsesor, fDesde, fHasta, busqueda])

  const kpis = useMemo(() => ({
    total:      ventas.length,
    programado: ventas.filter(v => (v.estado || '').toUpperCase() === 'PROGRAMADO').length,
    pendiente:  ventas.filter(v => (v.estado || '').toUpperCase() === 'PENDIENTE').length,
  }), [ventas])

  function limpiarFiltros() {
    setFEstado(''); setFAsesor(''); setFDesde(''); setFHasta(''); setBusqueda('')
  }

  function abrirDetalle(v) {
    setModalDet(v)
    setEstadoModal(v.estado || '')
    setObsProg(v.obs_programacion || '')
  }

  function cerrarModal() {
    setModalDet(null)
    setEstadoModal('')
    setObsProg('')
  }

  async function guardarCambios() {
    if (!modalDet) return
    try {
      const res  = await fetch(`${API}/ventas/${modalDet.id}`, {
        method: 'PATCH', headers: ncHeaders(),
        body: JSON.stringify({ estado: estadoModal, obs_programacion: obsProg }),
      })
      const data = await res.json()
      if (!data.ok) { mostrarToast('Error actualizando'); return }
      setVentas(list => list.map(x =>
        x.id === modalDet.id ? { ...x, estado: estadoModal, obs_programacion: obsProg } : x
      ))
      cerrarModal()
      mostrarToast('✅ Venta actualizada')
    } catch (e) { mostrarToast('Error conectando al servidor') }
  }

  function salir() { logout(); navigate('/login') }

  return (
    <div>
      {/* Inline styles replicating the original <style> block */}
      <style>{`
        .be-bloqueado  { background:#fee2e2;color:#991b1b;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer; }
        .be-sinagenda  { background:#fef9c3;color:#854d0e;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer; }
        .be-caracter   { background:#ede9fe;color:#5b21b6;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer; }
        .be-fraude     { background:#1f2937;color:#fff;   border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer; }
        .be-zona       { background:#ffedd5;color:#9a3412;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer; }
        .be-programado { background:#dcfce7;color:#15803d;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer; }
        .btn-estado:hover { opacity:.85;transform:scale(1.04); }
        .b-aprobado   { background:#d1fae5;color:#065f46;border:1px solid #86efac; }
        .b-bloqueado  { background:#fee2e2;color:#991b1b; }
        .b-sinagenda  { background:#fef9c3;color:#854d0e; }
        .b-caracter   { background:#ede9fe;color:#5b21b6; }
        .b-fraude     { background:#1f2937;color:#fff; }
        .b-zona       { background:#ffedd5;color:#9a3412; }
        .tabla .badge { display:inline-flex;align-items:center;justify-content:center;min-width:86px;padding:5px 10px;border-radius:8px;font-size:10px;font-weight:800;letter-spacing:.2px;text-transform:uppercase;box-shadow:none; }
      `}</style>

      <div className="topbar">
        <div className="brand">
          <div className="logo-circle">
            <img src="/assets/logo3.png" alt="" onError={e => { e.target.parentNode.textContent = '' }} />
          </div>
          <div className="brand-text">
            <h1>NET<span className="dot"></span><span className="red">CONTACT</span></h1>
            <span className="brand-sub">Programación</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="topbar-badge" style={{ background: '#7c3aed' }}>PROGRAMACIÓN</span>
          <span className="topbar-user">{sesion?.nombre || '—'}</span>
          <button className="topbar-salir" onClick={salir}>Salir</button>
        </div>
      </div>

      <div className="main-content">
        <div className="page-header">
          <div className="page-header-left">
            <h2>Ventas para Programar</h2>
            <p>Ventas aprobadas por Grabaciones — gestiona el estado de instalación</p>
          </div>
          <button className="btn-filtrar" onClick={cargarVentas}>Actualizar</button>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card k-purple"><div className="kpi-num">{kpis.total}</div><div className="kpi-label">Total</div></div>
          <div className="kpi-card k-blue">  <div className="kpi-num">{kpis.programado}</div><div className="kpi-label">Programadas</div></div>
          <div className="kpi-card k-orange"><div className="kpi-num">{kpis.pendiente}</div><div className="kpi-label">Pendientes</div></div>
        </div>

        <div className="filtros-panel">
          <div className="filtros-row">
            <div className="filtro-group">
              <label>Estado</label>
              <select className="filtro-select" value={fEstado} onChange={e => setFEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="PROGRAMADO">Programado</option>
                <option value="BLOQUEADO">Bloqueado</option>
                <option value="SIN_AGENDA">Sin agenda</option>
                <option value="CARACTER_ESPECIAL">Carácter especial</option>
                <option value="FRAUDE">Fraude</option>
                <option value="ZONA_RESTRINGIDA">Zona restringida</option>
              </select>
            </div>
            <div className="filtro-group">
              <label>Asesor</label>
              <input type="text" className="filtro-input" value={fAsesor}
                onChange={e => setFAsesor(e.target.value)} placeholder="Nombre asesor..." />
            </div>
            <div className="filtro-group">
              <label>Desde</label>
              <input type="date" className="filtro-input" value={fDesde} onChange={e => setFDesde(e.target.value)} />
            </div>
            <div className="filtro-group">
              <label>Hasta</label>
              <input type="date" className="filtro-input" value={fHasta} onChange={e => setFHasta(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
              <button className="btn-limpiar" onClick={limpiarFiltros}>Limpiar</button>
            </div>
          </div>
        </div>

        <div className="tabla-wrap">
          <div className="tabla-header">
            <div className="tabla-header-left">
              <span className="tabla-title">Lista de ventas programadas</span>
              <span className="tabla-count">{ventasFiltradas.length} registros</span>
            </div>
            <input type="text" className="tabla-search" value={busqueda}
              onChange={e => setBusqueda(e.target.value)} placeholder="Buscar DNI, nombre, asesor..." />
          </div>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>#</th><th>Fecha</th><th>Nombre</th><th>DNI</th>
                  <th>Asesor</th><th>Sala</th><th>Distrito</th>
                  <th>Paquete</th><th>Estado</th><th>Obs. Programación</th><th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.length === 0 ? (
                  <tr className="tabla-empty"><td colSpan="11">Sin registros con esos filtros.</td></tr>
                ) : ventasFiltradas.map((v, i) => {
                  const fecha = formatF((v.created_at || '').split(' ')[0])
                  const cls   = BADGE_CLS[(v.estado || '').toUpperCase()] || 'b-venta'
                  return (
                    <tr key={v.id}>
                      <td style={{ color: '#9ca3af', fontSize: '10px' }}>{i + 1}</td>
                      <td style={{ fontSize: '11px', color: '#374151', whiteSpace: 'nowrap' }}>{fecha}</td>
                      <td style={{ fontWeight: 700, fontSize: '12px' }}>{v.nombre || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{v.dni || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{v.asesor_nombre || '—'}</td>
                      <td style={{ fontSize: '11px', color: '#9ca3af' }}>{v.sala || '—'}</td>
                      <td style={{ fontSize: '11px' }}>{v.distrito || '—'}</td>
                      <td style={{ fontSize: '11px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.paquete || ''}>{v.paquete || '—'}</td>
                      <td><span className={`badge ${cls}`}>{v.estado || '—'}</span></td>
                      <td style={{ fontSize: '11px', color: '#6b7280', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.obs_programacion || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button className="btn-accion btn-ver-det" onClick={() => abrirDetalle(v)}>Ver / Editar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DETALLE */}
      {modalDet && (
        <div className="modal-bg open" onClick={e => { if (e.target === e.currentTarget) cerrarModal() }}>
          <div className="modal-box" style={{ maxWidth: '640px' }}>
            <div className="modal-head">
              <span className="modal-head-title">Detalle de Venta</span>
              <button className="modal-close" onClick={cerrarModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="det-grid">
                <DetCampo label="Nombre"       val={modalDet.nombre} />
                <DetCampo label="DNI / Doc."   val={`${modalDet.tipo_doc || 'DNI'}: ${modalDet.dni || '—'}`} />
                <DetCampo label="Teléfono 1"   val={modalDet.telefono1} />
                <DetCampo label="Teléfono 2"   val={modalDet.telefono2} />
                <DetCampo label="Asesor"       val={modalDet.asesor_nombre} />
                <DetCampo label="Sala"         val={modalDet.sala} />
                <DetCampo label="Departamento" val={modalDet.departamento} />
                <DetCampo label="Distrito"     val={modalDet.distrito} />
                <DetCampo label="Claro Hogar"  val={modalDet.claro_hogar} />
                <DetCampo label="Tecnología"   val={modalDet.tecnologia} />
                <div className="det-campo det-full"><label>Paquete Real</label><span>{modalDet.paquete || '—'}</span></div>
                <DetCampo label="Decos"        val={modalDet.cant_decos} />
                <DetCampo label="Mesh"         val={modalDet.cant_mesh} />
                <DetCampo label="Plano"        val={modalDet.plano} />
                <DetCampo label="Cuota Inst."  val={modalDet.cuota_inst} />
                <DetCampo label="Full Claro"   val={modalDet.full_claro} />
                <div className="det-campo det-full"><label>Dirección</label><span>{modalDet.direccion || '—'}</span></div>
                <DetCampo label="Coordenadas"  val={modalDet.coordenadas} />
                <DetCampo label="Fecha ingreso" val={formatF((modalDet.created_at || '').split(' ')[0])} />
              </div>

              <div className="cambiar-estado-wrap">
                <label>Cambiar estado de programación</label>
                <div className="estado-btns">
                  {ESTADO_BTNS.map(btn => (
                    <button
                      key={btn.id}
                      className={`btn-estado ${btn.cls}`}
                      style={{ outline: estadoModal === btn.id ? '3px solid #7c3aed' : 'none' }}
                      onClick={() => setEstadoModal(btn.id)}
                    >{btn.label}</button>
                  ))}
                </div>
                {estadoModal && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>
                    {estadoModal === modalDet.estado ? 'Estado actual: ' : 'Nuevo estado: '}
                    {ESTADO_LABELS[estadoModal] || estadoModal}
                  </div>
                )}
              </div>

              <div className="obs-wrap">
                <label>Observación de Programación</label>
                <textarea value={obsProg} onChange={e => setObsProg(e.target.value)}
                  placeholder="Ingresa observaciones sobre la instalación..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancelar-m" onClick={cerrarModal}>Cancelar</button>
              <button className="btn-guardar-m" onClick={guardarCambios}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toastMsg ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  )
}
