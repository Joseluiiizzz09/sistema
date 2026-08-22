import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import JefaturaViewControls from '../components/JefaturaViewControls'
import CambiarAreaMenu from '../components/CambiarAreaMenu'
import { API, ncHeaders } from '../services/api'
import '../styles/cobranzas.css'

const PAGE_SIZE = 25

const TIPIFICACIONES_CALIDAD = {
  llamada: ['PENDIENTE', 'CONTESTA', 'NO CONTESTA', 'APAGADO', 'CORTA LLAMADA'],
  whatsapp: ['PENDIENTE', 'SE ENVIA', 'TIENE', 'NO TIENE'],
  servicio_internet: ['PENDIENTE', 'TODO CORRECTO', 'INTERMITENCIAS CON EL SERVICIO', 'NO RECONOCE LA TITULARIDAD', 'NO ES LA MISMA VELOCIDAD CONTRATADA', 'PROBLEMA SOLUCIONADO', 'OTROS'],
  servicio_instalacion: ['PENDIENTE', 'TODO CORRECTO', 'INTERMITENCIAS CON EL SERVICIO', 'NO RECONOCE LA TITULARIDAD', 'NO ES LA MISMA VELOCIDAD CONTRATADA', 'PROBLEMA SOLUCIONADO', 'OTROS'],
  ofrecieron_adicionales: ['PENDIENTE', 'NO', 'SI', 'SI, PERO NO SE BRINDO'],
  adicional: ['PENDIENTE', 'IPTV', 'NETFLIX', 'STAR+', 'DISNEY+', 'OTROS', 'CRUNCHYROLL', 'REPETIDOR'],
  estado_cliente: ['PENDIENTE', 'SATISFECHO', 'REGULAR', 'INSATISFECHO', 'OBSERVADO', 'NO RECONOCE EL SERVICIO', 'BAJA'],
}

function fechaISO(valor) {
  if (!valor) return ''
  return String(valor).slice(0, 10)
}

function fechaVisible(valor) {
  const iso = fechaISO(valor)
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fechaHoraVisible(valor) {
  if (!valor) return '—'
  const fecha = new Date(String(valor).replace(' ', 'T'))
  if (Number.isNaN(fecha.getTime())) return fechaVisible(valor)
  return fecha.toLocaleString('es-PE', { timeZone: 'America/Lima', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function claseCalidad(valor) {
  const texto = String(valor || 'PENDIENTE').toUpperCase()
  if (texto === 'PENDIENTE') return 'pendiente'
  if (['CONTESTA','SE ENVIA','TIENE','TODO CORRECTO','PROBLEMA SOLUCIONADO','SI','SATISFECHO'].includes(texto)) return 'positivo'
  if (['NO CONTESTA','APAGADO','CORTA LLAMADA','NO TIENE','INSATISFECHO','NO RECONOCE EL SERVICIO','BAJA','NO RECONOCE LA TITULARIDAD'].includes(texto)) return 'negativo'
  if (texto.includes('INTERMITENCIA') || texto.includes('NO ES LA MISMA') || texto === 'REGULAR' || texto === 'OBSERVADO' || texto.includes('NO SE BRINDO')) return 'alerta'
  return 'informativo'
}

function FiltroColumna({ titulo, opciones, seleccionados, onChange, buscable = false }) {
  const [abierto, setAbierto] = useState(false)
  const [buscar, setBuscar] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return undefined
    const cerrar = evento => { if (!ref.current?.contains(evento.target)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])
  const visibles = opciones.filter(opcion => !buscar || opcion.toLowerCase().includes(buscar.toLowerCase()))
  const alternar = opcion => onChange(seleccionados.includes(opcion)
    ? seleccionados.filter(valor => valor !== opcion)
    : [...seleccionados, opcion])
  return (
    <div className="calidad-filtro-columna" ref={ref}>
      <button type="button" className={seleccionados.length ? 'activo' : ''} onClick={() => setAbierto(valor => !valor)}>
        {titulo}<span>▼</span>
      </button>
      {abierto && <div className="calidad-filtro-menu">
        {buscable && <input autoFocus value={buscar} onChange={e => setBuscar(e.target.value)} placeholder={`Buscar ${titulo.toLowerCase()}…`} />}
        <label className="calidad-filtro-todos"><input type="checkbox" checked={!seleccionados.length} onChange={() => onChange([])} /> Todos</label>
        <div className="calidad-filtro-opciones">
          {visibles.map(opcion => <label key={opcion}><input type="checkbox" checked={seleccionados.includes(opcion)} onChange={() => alternar(opcion)} /> {opcion}</label>)}
          {!visibles.length && <small>Sin resultados</small>}
        </div>
      </div>}
    </div>
  )
}

export default function Cobranzas({ areaNombre = 'Cobranzas' }) {
  const navigate = useNavigate()
  const { sesion, logout } = useAuth()
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState('')
  const [usuariosCalidad, setUsuariosCalidad] = useState([])
  const [clienteCalidad, setClienteCalidad] = useState(null)
  const [comentarioCalidad, setComentarioCalidad] = useState('')
  const [historialCalidad, setHistorialCalidad] = useState(null)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [filtroVendedores, setFiltroVendedores] = useState([])
  const [filtroEstados, setFiltroEstados] = useState([])
  // Jefatura las supervisa al entrar por Accesos directos, pero solo Calidad edita.
  const esCalidad = areaNombre.toLowerCase() === 'calidad' && sesion?.cargo === 'calidad'
  const puedeEditarCalidad = esCalidad && !sesion?._actorJefatura

  const cargar = useCallback(async () => {
    setCargando(true)
    setMensaje('')
    try {
      const res = await fetch(`${API}/ventas/cobranzas-listado`, { headers: ncHeaders() })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.mensaje || 'No se pudo cargar Cobranzas')
      setClientes(Array.isArray(json.data) ? json.data : [])
      setUsuariosCalidad(Array.isArray(json.usuariosCalidad) ? json.usuariosCalidad : [])
    } catch (error) {
      setMensaje(error.message || 'Error conectando con el servidor')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    if (!clienteCalidad) return undefined
    const cerrar = evento => { if (evento.key === 'Escape') setClienteCalidad(null) }
    window.addEventListener('keydown', cerrar)
    return () => window.removeEventListener('keydown', cerrar)
  }, [clienteCalidad])

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return clientes.filter(cliente => {
      const fecha = fechaISO(cliente.fecha_instalacion)
      if (desde && fecha < desde) return false
      if (hasta && fecha > hasta) return false
      if (filtroVendedores.length && !filtroVendedores.includes(String(cliente.vendedor_nombre || 'SIN VENDEDOR').trim())) return false
      if (filtroEstados.length && !filtroEstados.includes(String(cliente.calidad_estado_cliente || 'PENDIENTE').trim().toUpperCase())) return false
      if (!texto) return true
      return [cliente.nombre, cliente.dni, cliente.sot, cliente.telefono1, cliente.telefono2, cliente.vendedor_nombre, cliente.paquete]
        .some(valor => String(valor || '').toLowerCase().includes(texto))
    })
  }, [clientes, busqueda, desde, hasta, filtroVendedores, filtroEstados])

  useEffect(() => { setPagina(1) }, [busqueda, desde, hasta, filtroVendedores, filtroEstados])

  const vendedoresFiltro = useMemo(() => [...new Set(clientes.map(cliente => String(cliente.vendedor_nombre || 'SIN VENDEDOR').trim()))].sort((a, b) => a.localeCompare(b, 'es')), [clientes])
  const estadosFiltro = useMemo(() => [...new Set([
    ...TIPIFICACIONES_CALIDAD.estado_cliente,
    ...clientes.map(cliente => String(cliente.calidad_estado_cliente || 'PENDIENTE').trim().toUpperCase()),
  ])].sort((a, b) => a.localeCompare(b, 'es')), [clientes])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const visibles = filtrados.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  const instaladosHoy = clientes.filter(c => fechaISO(c.fecha_instalacion) === hoy).length
  const paquetes = new Set(clientes.map(c => String(c.paquete || '').trim()).filter(Boolean)).size

  function salir() { logout(); navigate('/login') }
  function limpiar() { setBusqueda(''); setDesde(''); setHasta(''); setFiltroVendedores([]); setFiltroEstados([]) }

  async function guardarCalidad(cliente, campo, valor) {
    const propiedad = `calidad_${campo}`
    const anterior = cliente[propiedad] || 'PENDIENTE'
    const clave = `${cliente.id}-${campo}`
    setMensaje('')
    setGuardando(clave)
    setClientes(actuales => actuales.map(c => c.id === cliente.id ? { ...c, [propiedad]: valor } : c))
    setClienteCalidad(actual => actual?.id === cliente.id ? { ...actual, [propiedad]: valor } : actual)
    try {
      const res = await fetch(`${API}/ventas/calidad/${cliente.id}`, {
        method: 'PATCH', headers: ncHeaders(), body: JSON.stringify({ campo, valor }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.mensaje || 'No se pudo guardar la tipificación')
    } catch (error) {
      setClientes(actuales => actuales.map(c => c.id === cliente.id ? { ...c, [propiedad]: anterior } : c))
      setClienteCalidad(actual => actual?.id === cliente.id ? { ...actual, [propiedad]: anterior } : actual)
      setMensaje(error.message || 'Error conectando con el servidor')
    } finally {
      setGuardando('')
    }
  }

  async function asignarCalidad(cliente, usuarioId) {
    const responsable = usuariosCalidad.find(usuario => String(usuario.id) === String(usuarioId))
    if (!responsable) return
    const anteriorId = cliente.calidad_asignado_a_id
    const anteriorNombre = cliente.calidad_asignado_a_nombre
    const clave = `${cliente.id}-responsable`
    const aplicar = actual => actual?.id === cliente.id
      ? { ...actual, calidad_asignado_a_id: responsable.id, calidad_asignado_a_nombre: responsable.nombre }
      : actual
    setMensaje('')
    setGuardando(clave)
    setClientes(actuales => actuales.map(aplicar))
    setClienteCalidad(aplicar)
    try {
      const res = await fetch(`${API}/ventas/calidad/${cliente.id}/asignar`, {
        method: 'PATCH', headers: ncHeaders(), body: JSON.stringify({ usuario_id: responsable.id }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.mensaje || 'No se pudo asignar el responsable')
    } catch (error) {
      const revertir = actual => actual?.id === cliente.id
        ? { ...actual, calidad_asignado_a_id: anteriorId, calidad_asignado_a_nombre: anteriorNombre }
        : actual
      setClientes(actuales => actuales.map(revertir))
      setClienteCalidad(revertir)
      setMensaje(error.message || 'Error conectando con el servidor')
    } finally {
      setGuardando('')
    }
  }

  function resumenCalidad(cliente) {
    const pendientes = Object.keys(TIPIFICACIONES_CALIDAD)
      .filter(campo => (cliente[`calidad_${campo}`] || 'PENDIENTE') === 'PENDIENTE').length
    return pendientes ? `${pendientes} PENDIENTES` : 'COMPLETADO'
  }

  function abrirCalidad(cliente) {
    setClienteCalidad(cliente)
    setComentarioCalidad(cliente.calidad_comentario || '')
  }

  async function guardarComentario(cliente) {
    const anterior = cliente.calidad_comentario || ''
    const comentario = comentarioCalidad.trim()
    const clave = `${cliente.id}-comentario`
    setGuardando(clave)
    const aplicar = actual => actual?.id === cliente.id ? { ...actual, calidad_comentario: comentario } : actual
    setClientes(actuales => actuales.map(aplicar)); setClienteCalidad(aplicar)
    try {
      const res = await fetch(`${API}/ventas/calidad/${cliente.id}/comentario`, {
        method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ comentario }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.mensaje || 'No se pudo guardar el comentario')
    } catch (error) {
      const revertir = actual => actual?.id === cliente.id ? { ...actual, calidad_comentario: anterior } : actual
      setClientes(actuales => actuales.map(revertir)); setClienteCalidad(revertir)
      setMensaje(error.message || 'Error conectando con el servidor')
    } finally { setGuardando('') }
  }

  async function abrirHistorial(cliente) {
    setCargandoHistorial(true)
    setHistorialCalidad({ cliente, entradas:[] })
    try {
      const res = await fetch(`${API}/ventas/calidad/${cliente.id}/historial`, { headers:ncHeaders() })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.mensaje || 'No se pudo cargar el historial')
      setHistorialCalidad({ cliente, entradas:Array.isArray(json.data) ? json.data : [] })
    } catch (error) {
      setMensaje(error.message || 'Error conectando con el servidor'); setHistorialCalidad(null)
    } finally { setCargandoHistorial(false) }
  }

  return (
    <div className="cobranzas-shell">
      <header className="cobranzas-topbar">
        <div className="cobranzas-brand">
          <img className="cobranzas-logo" src="/assets/logo3.png" alt="" />
          <div>
            <img className="cobranzas-wordmark" src="/assets/krono-wordmark.png" alt="KRONO" />
            <span>{areaNombre.toUpperCase()}</span>
          </div>
        </div>
        <div className="cobranzas-top-actions">
          <JefaturaViewControls>
            <span className="cobranzas-area-badge">{areaNombre.toUpperCase()}</span>
            <span className="cobranzas-user">{sesion?.nombre || '—'}</span>
          </JefaturaViewControls>
          <CambiarAreaMenu />
          <button className="cobranzas-exit" onClick={salir}>Salir</button>
        </div>
      </header>

      <main className="cobranzas-main">
        <section className="cobranzas-heading">
          <div><h1>Clientes instalados</h1><p>Información contractual consolidada para el área de {areaNombre}.</p></div>
          <button onClick={cargar} disabled={cargando}>{cargando ? 'Cargando…' : 'Actualizar'}</button>
        </section>

        <section className="cobranzas-kpis">
          <article><strong>{clientes.length}</strong><span>TOTAL INSTALADOS</span></article>
          <article><strong>{instaladosHoy}</strong><span>INSTALADOS HOY</span></article>
          <article><strong>{paquetes}</strong><span>PAQUETES CONTRATADOS</span></article>
        </section>

        <section className="cobranzas-filtros">
          <label className="cobranzas-search"><span>BUSCAR CLIENTE</span><input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Nombre, documento, SOT, número o paquete…" /></label>
          <label><span>DESDE</span><input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
          <label><span>HASTA</span><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
          <button onClick={limpiar}>Limpiar</button>
        </section>

        <section className="cobranzas-table-card">
          <div className="cobranzas-table-title"><strong>Listado de clientes</strong><span>{filtrados.length} registros</span></div>
          {mensaje && <div className="cobranzas-error">{mensaje}</div>}
          <div className="cobranzas-table-scroll">
            <table>
              <thead><tr><th>#</th><th>NOMBRE DEL CLIENTE</th><th>DOCUMENTO</th><th>SOT</th><th>N1</th><th>N2</th><th>{esCalidad ? <FiltroColumna titulo="VENDEDOR" opciones={vendedoresFiltro} seleccionados={filtroVendedores} onChange={setFiltroVendedores} buscable /> : 'VENDEDOR'}</th><th>FECHA DE INSTALACIÓN</th><th>PAQUETE CONTRATADO</th>{esCalidad && <><th>RESPONSABLE CALIDAD</th><th><FiltroColumna titulo="ESTADO FINAL" opciones={estadosFiltro} seleccionados={filtroEstados} onChange={setFiltroEstados} /></th><th>FECHA DE TRATAMIENTO</th><th>GESTIÓN DE CALIDAD</th><th>HISTORIAL</th><th>COMENTARIO</th></>}</tr></thead>
              <tbody>
                {!cargando && visibles.map((cliente, index) => (
                  <tr key={cliente.id}>
                    <td>{(paginaSegura - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="cobranzas-name">{cliente.nombre || '—'}</td>
                    <td>{cliente.dni || '—'}</td><td>{cliente.sot || '—'}</td>
                    <td>{cliente.telefono1 || '—'}</td><td>{cliente.telefono2 || '—'}</td><td className="cobranzas-vendedor">{cliente.vendedor_nombre || '—'}</td>
                    <td className="cobranzas-date">{fechaVisible(cliente.fecha_instalacion)}</td>
                    <td>{cliente.paquete || '—'}</td>
                    {esCalidad && <>
                      <td className="calidad-responsable">{cliente.calidad_asignado_a_nombre || 'SIN ASIGNAR'}</td>
                      <td><span className={`calidad-estado-final ${claseCalidad(cliente.calidad_estado_cliente)}`}>{cliente.calidad_estado_cliente || 'PENDIENTE'}</span></td>
                      <td className="calidad-fecha">{fechaHoraVisible(cliente.calidad_tratamiento_at)}</td>
                      <td className="calidad-gestion-cell">
                        <button className={`calidad-gestion-btn ${resumenCalidad(cliente) === 'COMPLETADO' ? 'completo' : ''}`} onClick={() => abrirCalidad(cliente)}>
                          <span>Gestionar calidad</span><small>{resumenCalidad(cliente)}</small>
                        </button>
                      </td>
                      <td><button className="calidad-historial-btn" onClick={() => abrirHistorial(cliente)}>Historial</button></td>
                      <td className="calidad-comentario-col" title={cliente.calidad_comentario || ''}>{cliente.calidad_comentario || '—'}</td>
                    </>}
                  </tr>
                ))}
                {!cargando && !visibles.length && <tr><td colSpan={esCalidad ? 15 : 9} className="cobranzas-empty">No hay clientes instalados para los filtros seleccionados.</td></tr>}
                {cargando && <tr><td colSpan={esCalidad ? 15 : 9} className="cobranzas-empty">Cargando clientes instalados…</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="cobranzas-pagination">
            <span>Mostrando {visibles.length ? (paginaSegura - 1) * PAGE_SIZE + 1 : 0}–{(paginaSegura - 1) * PAGE_SIZE + visibles.length} de {filtrados.length}</span>
            <div><button disabled={paginaSegura <= 1} onClick={() => setPagina(p => p - 1)}>‹</button><b>Página {paginaSegura} de {totalPaginas}</b><button disabled={paginaSegura >= totalPaginas} onClick={() => setPagina(p => p + 1)}>›</button></div>
          </footer>
        </section>
      </main>

      {esCalidad && clienteCalidad && (
        <div className="calidad-modal-overlay" onMouseDown={evento => { if (evento.target === evento.currentTarget) setClienteCalidad(null) }}>
          <section className="calidad-modal" role="dialog" aria-modal="true" aria-label={`Gestión de calidad de ${clienteCalidad.nombre || 'cliente'}`}>
            <header>
              <div><span>GESTIÓN DE CALIDAD</span><h2>{clienteCalidad.nombre || 'Cliente'}</h2><p>Documento: {clienteCalidad.dni || '—'} · SOT: {clienteCalidad.sot || '—'}</p></div>
              <button onClick={() => setClienteCalidad(null)} aria-label="Cerrar">×</button>
            </header>
            <div className="calidad-responsable-box">
              <label><span>RESPONSABLE DE LA LLAMADA DE CALIDAD</span>
                <select value={clienteCalidad.calidad_asignado_a_id || ''} disabled={!puedeEditarCalidad || guardando === `${clienteCalidad.id}-responsable`} onChange={e => asignarCalidad(clienteCalidad, e.target.value)}>
                  <option value="">— Seleccionar personal de Calidad —</option>
                  {usuariosCalidad.map(usuario => <option value={usuario.id} key={usuario.id}>{usuario.nombre}</option>)}
                </select>
              </label>
            </div>
            <div className="calidad-modal-grid">
              {Object.entries(TIPIFICACIONES_CALIDAD).map(([campo, opciones]) => (
                <label key={campo}><span>{campo.replaceAll('_', ' ')}</span>
                  <select
                    value={clienteCalidad[`calidad_${campo}`] || 'PENDIENTE'}
                    disabled={!puedeEditarCalidad || guardando === `${clienteCalidad.id}-${campo}`}
                    onChange={e => guardarCalidad(clienteCalidad, campo, e.target.value)}
                    className={claseCalidad(clienteCalidad[`calidad_${campo}`])}
                  >
                    {opciones.map(opcion => <option value={opcion} key={opcion}>{opcion}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="calidad-comentario-box">
              <label><span>COMENTARIO DE CALIDAD (OPCIONAL)</span><textarea maxLength="1500" value={comentarioCalidad} disabled={!puedeEditarCalidad} onChange={e => setComentarioCalidad(e.target.value)} placeholder="Escribe aquí una observación de la gestión…" /></label>
              {puedeEditarCalidad && <button disabled={guardando === `${clienteCalidad.id}-comentario`} onClick={() => guardarComentario(clienteCalidad)}>{guardando === `${clienteCalidad.id}-comentario` ? 'Guardando…' : 'Guardar comentario'}</button>}
            </div>
            <footer><span>{clienteCalidad.calidad_asignado_a_nombre ? `Asignado a ${clienteCalidad.calidad_asignado_a_nombre}` : 'Selecciona quién realizará la llamada'}</span><button onClick={() => setClienteCalidad(null)}>Cerrar ficha</button></footer>
          </section>
        </div>
      )}

      {esCalidad && historialCalidad && (
        <div className="calidad-modal-overlay" onMouseDown={evento => { if (evento.target === evento.currentTarget) setHistorialCalidad(null) }}>
          <section className="calidad-modal calidad-historial-modal" role="dialog" aria-modal="true">
            <header><div><span>HISTORIAL DE CALIDAD</span><h2>{historialCalidad.cliente.nombre || 'Cliente'}</h2><p>Registro completo de responsables, tipificaciones y comentarios</p></div><button onClick={() => setHistorialCalidad(null)}>×</button></header>
            <div className="calidad-historial-lista">
              {cargandoHistorial && <p>Cargando historial…</p>}
              {!cargandoHistorial && !historialCalidad.entradas.length && <p>Este cliente todavía no tiene movimientos de Calidad.</p>}
              {historialCalidad.entradas.map(entrada => <article key={entrada.id}><div><strong>{entrada.campo.replaceAll('_',' ').toUpperCase()}</strong><time>{fechaHoraVisible(entrada.created_at)}</time></div><p><span>{entrada.valor_anterior || '—'}</span><b>→</b><span>{entrada.valor_nuevo || '—'}</span></p><small>Gestionado por {entrada.usuario_nombre || 'Calidad'}</small></article>)}
            </div>
            <footer><span>{historialCalidad.entradas.length} movimientos registrados</span><button onClick={() => setHistorialCalidad(null)}>Cerrar historial</button></footer>
          </section>
        </div>
      )}
    </div>
  )
}
