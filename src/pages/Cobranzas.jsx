import { useCallback, useEffect, useMemo, useState } from 'react'
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
    } catch (error) {
      setMensaje(error.message || 'Error conectando con el servidor')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return clientes.filter(cliente => {
      const fecha = fechaISO(cliente.fecha_instalacion)
      if (desde && fecha < desde) return false
      if (hasta && fecha > hasta) return false
      if (!texto) return true
      return [cliente.nombre, cliente.dni, cliente.sot, cliente.telefono1, cliente.telefono2, cliente.paquete]
        .some(valor => String(valor || '').toLowerCase().includes(texto))
    })
  }, [clientes, busqueda, desde, hasta])

  useEffect(() => { setPagina(1) }, [busqueda, desde, hasta])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const visibles = filtrados.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  const instaladosHoy = clientes.filter(c => fechaISO(c.fecha_instalacion) === hoy).length
  const paquetes = new Set(clientes.map(c => String(c.paquete || '').trim()).filter(Boolean)).size

  function salir() { logout(); navigate('/login') }
  function limpiar() { setBusqueda(''); setDesde(''); setHasta('') }

  async function guardarCalidad(cliente, campo, valor) {
    const propiedad = `calidad_${campo}`
    const anterior = cliente[propiedad] || 'PENDIENTE'
    const clave = `${cliente.id}-${campo}`
    setMensaje('')
    setGuardando(clave)
    setClientes(actuales => actuales.map(c => c.id === cliente.id ? { ...c, [propiedad]: valor } : c))
    try {
      const res = await fetch(`${API}/ventas/calidad/${cliente.id}`, {
        method: 'PATCH', headers: ncHeaders(), body: JSON.stringify({ campo, valor }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.mensaje || 'No se pudo guardar la tipificación')
    } catch (error) {
      setClientes(actuales => actuales.map(c => c.id === cliente.id ? { ...c, [propiedad]: anterior } : c))
      setMensaje(error.message || 'Error conectando con el servidor')
    } finally {
      setGuardando('')
    }
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
              <thead><tr><th>#</th><th>NOMBRE DEL CLIENTE</th><th>DOCUMENTO</th><th>SOT</th><th>N1</th><th>N2</th><th>FECHA DE INSTALACIÓN</th><th>PAQUETE CONTRATADO</th>{esCalidad && <><th>LLAMADA</th><th>WTSP</th><th>SERVICIO DE INTERNET</th><th>SERVICIO DE INSTALACIÓN</th><th>SE LE OFRECIERON ADICIONALES</th><th>QUÉ ADICIONAL</th><th>ESTADO DE CLIENTE</th></>}</tr></thead>
              <tbody>
                {!cargando && visibles.map((cliente, index) => (
                  <tr key={cliente.id}>
                    <td>{(paginaSegura - 1) * PAGE_SIZE + index + 1}</td>
                    <td className="cobranzas-name">{cliente.nombre || '—'}</td>
                    <td>{cliente.dni || '—'}</td><td>{cliente.sot || '—'}</td>
                    <td>{cliente.telefono1 || '—'}</td><td>{cliente.telefono2 || '—'}</td>
                    <td className="cobranzas-date">{fechaVisible(cliente.fecha_instalacion)}</td>
                    <td>{cliente.paquete || '—'}</td>
                    {esCalidad && Object.entries(TIPIFICACIONES_CALIDAD).map(([campo, opciones]) => (
                      <td className="calidad-tipif-cell" key={campo}>
                        <select
                          value={cliente[`calidad_${campo}`] || 'PENDIENTE'}
                          disabled={!puedeEditarCalidad || guardando === `${cliente.id}-${campo}`}
                          onChange={e => guardarCalidad(cliente, campo, e.target.value)}
                          title={puedeEditarCalidad ? 'Seleccionar tipificación' : 'Vista de supervisión en tiempo real'}
                          aria-label={`${campo.replaceAll('_', ' ')} de ${cliente.nombre || 'cliente'}`}
                          className={`${(cliente[`calidad_${campo}`] || 'PENDIENTE') === 'PENDIENTE' ? 'pendiente' : ''}${!puedeEditarCalidad ? ' solo-lectura' : ''}`}
                        >
                          {opciones.map(opcion => <option value={opcion} key={opcion}>{opcion}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
                {!cargando && !visibles.length && <tr><td colSpan={esCalidad ? 15 : 8} className="cobranzas-empty">No hay clientes instalados para los filtros seleccionados.</td></tr>}
                {cargando && <tr><td colSpan={esCalidad ? 15 : 8} className="cobranzas-empty">Cargando clientes instalados…</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="cobranzas-pagination">
            <span>Mostrando {visibles.length ? (paginaSegura - 1) * PAGE_SIZE + 1 : 0}–{(paginaSegura - 1) * PAGE_SIZE + visibles.length} de {filtrados.length}</span>
            <div><button disabled={paginaSegura <= 1} onClick={() => setPagina(p => p - 1)}>‹</button><b>Página {paginaSegura} de {totalPaginas}</b><button disabled={paginaSegura >= totalPaginas} onClick={() => setPagina(p => p + 1)}>›</button></div>
          </footer>
        </section>
      </main>
    </div>
  )
}
