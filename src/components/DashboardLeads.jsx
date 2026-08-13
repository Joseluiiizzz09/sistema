import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Chart from 'chart.js/auto'
import { API, ncHeaders } from '../services/api'
import '../styles/dashboard-leads.css'

function fechaLocal(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function inicioMes() {
  const now = new Date()
  return fechaLocal(new Date(now.getFullYear(), now.getMonth(), 1))
}

function formatoNumero(value) {
  return new Intl.NumberFormat('es-PE').format(Number(value) || 0)
}

function formatoFecha(value) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export default function DashboardLeads() {
  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState(() => fechaLocal())
  const [datos, setDatos] = useState([])
  const [diarios, setDiarios] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const campanasCanvas = useRef(null)
  const diariosCanvas = useRef(null)
  const charts = useRef({})

  const cargar = useCallback(async (inicio = desde, fin = hasta) => {
    if (!inicio || !fin) { setError('Selecciona ambas fechas.'); return }
    if (inicio > fin) { setError('La fecha inicial no puede ser posterior a la final.'); return }
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams({ desde: inicio, hasta: fin })
      const response = await fetch(`${API}/leads/metricas-campanas?${params}`, { headers: ncHeaders() })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload.ok) throw new Error(payload.mensaje || 'No fue posible cargar las métricas.')
      setDatos(Array.isArray(payload.data) ? payload.data : [])
      setDiarios(Array.isArray(payload.diarios) ? payload.diarios : [])
      setResumen(payload.totales || null)
    } catch (e) {
      setDatos([])
      setDiarios([])
      setResumen(null)
      setError(e.message || 'No fue posible conectar con la API.')
    } finally {
      setCargando(false)
    }
  }, [desde, hasta])

  useEffect(() => { cargar() }, []) // carga inicial deliberada con el mes actual

  const totales = useMemo(() => {
    if (resumen) return resumen
    const numeros = datos.reduce((sum, row) => sum + row.numeros, 0)
    const tipificados = datos.reduce((sum, row) => sum + row.tipificados, 0)
    const ventas = datos.reduce((sum, row) => sum + row.ventas, 0)
    return {
      campanas: datos.length,
      numeros,
      tipificados,
      ventas,
      conversion: numeros ? ((ventas / numeros) * 100).toFixed(2) : '0.00',
    }
  }, [datos, resumen])

  useEffect(() => {
    charts.current.campanas?.destroy()
    if (!campanasCanvas.current || !datos.length) return
    charts.current.campanas = new Chart(campanasCanvas.current, {
      type: 'bar',
      data: {
        labels: datos.map(row => row.campana),
        datasets: [
          { label:'Números únicos', data:datos.map(row => row.numeros), backgroundColor:'#2563eb', borderRadius:5 },
          { label:'Tipificados', data:datos.map(row => row.tipificados), backgroundColor:'#f59e0b', borderRadius:5 },
          { label:'Ventas', data:datos.map(row => row.ventas), backgroundColor:'#16a34a', borderRadius:5 },
        ],
      },
      options: {
        indexAxis: 'y', responsive:true, maintainAspectRatio:false,
        interaction:{ mode:'index', intersect:false },
        plugins:{ legend:{ position:'top' }, tooltip:{ callbacks:{ afterBody(items) { const row = datos[items[0]?.dataIndex]; return row ? `Conversión: ${row.conversion}%` : '' } } } },
        scales:{ x:{ beginAtZero:true, ticks:{ precision:0 } }, y:{ grid:{ display:false } } },
      },
    })
    return () => charts.current.campanas?.destroy()
  }, [datos])

  useEffect(() => {
    charts.current.diarios?.destroy()
    if (!diariosCanvas.current || !diarios.length) return
    charts.current.diarios = new Chart(diariosCanvas.current, {
      type:'bar',
      data:{
        labels:diarios.map(row => formatoFecha(row.fecha)),
        datasets:[
          { label:'Números únicos', data:diarios.map(row => row.numeros), backgroundColor:'#93c5fd', borderColor:'#2563eb', borderWidth:1, borderRadius:4 },
          { label:'Ventas', data:diarios.map(row => row.ventas), backgroundColor:'#86efac', borderColor:'#16a34a', borderWidth:1, borderRadius:4 },
        ],
      },
      options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:{position:'top'}}, scales:{y:{beginAtZero:true,ticks:{precision:0}},x:{grid:{display:false}}} },
    })
    return () => charts.current.diarios?.destroy()
  }, [diarios])

  function aplicarHoy() {
    const hoy = fechaLocal()
    setDesde(hoy)
    setHasta(hoy)
    cargar(hoy, hoy)
  }

  return (
    <div className="dl-shell">
      <div className="sec-header dl-header">
        <div><h2>Dashboard leads</h2><p>Rendimiento de números cargados desde Back Data por campaña</p></div>
      </div>

      <form className="dl-filtros" onSubmit={e => { e.preventDefault(); cargar() }}>
        <label>Desde<input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} /></label>
        <label>Hasta<input type="date" value={hasta} min={desde} max={fechaLocal()} onChange={e => setHasta(e.target.value)} /></label>
        <button type="button" className="dl-btn-sec" onClick={aplicarHoy}>Hoy</button>
        <button type="submit" className="dl-btn-primary" disabled={cargando}>{cargando ? 'Consultando…' : 'Aplicar rango'}</button>
      </form>

      {error && <div className="dl-error" role="alert">{error} <button type="button" onClick={() => cargar()}>Reintentar</button></div>}

      <div className="dl-kpis" aria-label="Resumen de campañas">
        <article><span>Campañas</span><strong>{formatoNumero(totales.campanas)}</strong><small>con números en el rango</small></article>
        <article><span>Números únicos</span><strong>{formatoNumero(totales.numeros)}</strong><small>cargados desde Back Data</small></article>
        <article><span>Tipificados</span><strong>{formatoNumero(totales.tipificados)}</strong><small>con gestión registrada</small></article>
        <article><span>Ventas</span><strong>{formatoNumero(totales.ventas)}</strong><small>confirmadas en ventas</small></article>
        <article className="dl-kpi-conversion"><span>Conversión</span><strong>{totales.conversion}%</strong><small>ventas ÷ números</small></article>
      </div>

      {cargando && !datos.length ? (
        <div className="dl-empty" role="status">Calculando métricas de campañas…</div>
      ) : !datos.length ? (
        <div className="dl-empty">No existen números cargados en el rango seleccionado.</div>
      ) : (
        <>
          <div className="dl-chart-grid">
            <article className="dl-panel"><div className="dl-panel-title"><h3>Cantidad por campaña</h3><span>{formatoFecha(desde)} – {formatoFecha(hasta)}</span></div><div className="dl-chart dl-chart-campaign" style={{height:`${Math.max(330, datos.length * 42)}px`}}><canvas ref={campanasCanvas} aria-label="Gráfico de barras de números, tipificaciones y ventas por campaña" /></div></article>
            <article className="dl-panel"><div className="dl-panel-title"><h3>Evolución diaria</h3><span>Números y ventas por día</span></div><div className="dl-chart"><canvas ref={diariosCanvas} aria-label="Gráfico de barras diario de números y ventas" /></div></article>
          </div>

          <article className="dl-panel dl-table-panel">
            <div className="dl-panel-title"><h3>Desglose por campaña</h3><span>{datos.length} campañas</span></div>
            <div className="dl-table-wrap"><table><thead><tr><th>Campaña</th><th>Registros</th><th>Números únicos</th><th>Tipificados</th><th>Ventas</th><th>Conversión</th></tr></thead><tbody>{datos.map(row => <tr key={row.campana}><td><strong>{row.campana}</strong></td><td>{formatoNumero(row.registros)}</td><td>{formatoNumero(row.numeros)}</td><td>{formatoNumero(row.tipificados)}</td><td>{formatoNumero(row.ventas)}</td><td><span className="dl-conversion">{row.conversion}%</span></td></tr>)}</tbody></table></div>
          </article>
        </>
      )}
      <p className="dl-note">La campaña y fecha provienen de Back Data. Cada teléfono se cuenta una sola vez dentro de su campaña; una venta se confirma al encontrar el mismo número en Ventas.</p>
    </div>
  )
}
