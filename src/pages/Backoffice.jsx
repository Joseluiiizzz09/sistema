import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import JefaturaViewControls from '../components/JefaturaViewControls'
import CambiarAreaMenu from '../components/CambiarAreaMenu'
import { API, ncHeaders } from '../services/api'
import { UBIGEO } from '../services/ubigeo'
import { usuarioTieneCargo } from '../utils/roles'
import { CAMPANAS } from '../utils/campanas'
import '../styles/backoffice.css'

// ── Selector de campaña (lista + opción "Otro" para escribir a mano) ───────
function CampanaSelect({ value, onChange, plain }) {
  const [manual, setManual] = useState(() => Boolean(value) && !CAMPANAS.includes(value))
  if (manual) {
    return (
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <input className={plain?undefined:'form-control'} value={value} autoFocus placeholder="Escribe la campaña"
          onChange={e=>onChange(e.target.value)} style={{flex:1,minWidth:0}} />
        <button type="button" title="Volver a la lista" onClick={()=>{ setManual(false); onChange('') }}
          style={{border:'none',background:'transparent',cursor:'pointer',color:'#6b7280',fontSize:12,whiteSpace:'nowrap'}}>↩ lista</button>
      </div>
    )
  }
  return (
    <select className={plain?undefined:'form-control'} value={CAMPANAS.includes(value)?value:''}
      onChange={e=>{ const v=e.target.value; if(v==='__OTRO__'){ setManual(true); onChange('') } else onChange(v) }}>
      <option value="">— Selecciona —</option>
      {CAMPANAS.map(c=>(<option key={c} value={c}>{c}</option>))}
      <option value="__OTRO__">Otro (escribir a mano)…</option>
    </select>
  )
}

// ── Utilities ────────────────────────────────────────────────────────────
const COLORES_AV = ['#3b82f6','#8b5cf6','#22c55e','#f97316','#ef4444','#06b6d4','#ec4899']
const DOT_COLORS  = ['#185FA5','#0F6E56','#854F0B','#7C3AED','#DC2626']
const BO_SECCIONES = ['base', 'carga-masiva', 'rendimiento', 'avance']

const PERU_TIME_ZONE = 'America/Lima'
const PERU_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: PERU_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const PERU_TIME_FORMATTER = new Intl.DateTimeFormat('es-PE', {
  timeZone: PERU_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function partesFechaHora(formatter) {
  return Object.fromEntries(
    formatter.formatToParts(new Date()).map(({ type, value }) => [type, value]),
  )
}

function fechaHoy() {
  const { year, month, day } = partesFechaHora(PERU_DATE_FORMATTER)
  return `${year}-${month}-${day}`
}
function horaAhora() {
  const { hour, minute } = partesFechaHora(PERU_TIME_FORMATTER)
  return `${hour}:${minute}`
}
function normalizarFecha(f) {
  if (!f) return ''
  const texto = String(f)
  const match = texto.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : texto
}
function formatFecha(f) {
  const fecha = normalizarFecha(f)
  if (!fecha) return ''
  const [y,m,d] = fecha.split('-')
  if (!y || !m || !d) return fecha
  return `${d}/${m}/${y}`
}
function colorAv(n)   { let s=0; for (const c of n) s+=c.charCodeAt(0); return COLORES_AV[s % COLORES_AV.length] }
function iniciales(n) { return n.trim().split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase() }
function horaAMinutos(hora) {
  const m = String(hora || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return -1
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function tipifBadgeClass(t) {
  if (!t) return 'b-default'
  const u = t.toUpperCase()
  if (u.includes('VENTA'))       return 'b-venta'
  if (u.includes('BUZON'))       return 'b-buzon'
  if (u.includes('NO CONTESTA')) return 'b-nocontesta'
  if (u.includes('DER'))         return 'b-derivado'
  return 'b-default'
}

const TIPIF_BACK_OPTIONS = ['BUZON DE VOZ','NO CONTESTA','CORTA LLAMADA','DERIVADO']
const TIPIF_VEND_OPCIONES = ['VENTA CERRADA','PREVENTA','AGENDADO','EN EJECUCION','CONTESTA','NO CONTESTA','BUZON DE VOZ','CORTA LLAMADA','NO DESEA','NO CALIFICA','SIN COBERTURA','CONTACTO CON TERCEROS','EDIFICIO NO LIBERADO','DESEA MOVIL','SERVICIO ACTIVO','DERIVADO','NC','NO TOCAR','FRAUDE','INSTALADO']
const TIPIF_PROHIBIDAS_ROTACION = new Set(['NO TOCAR','FRAUDE'])
const TIPIF_EXCLUIDAS_ROTACION  = new Set(['VENTA CERRADA','SIN COBERTURA','NO TOCAR','FRAUDE','INSTALADO'])
const TIPIF_ROTABLES_ROTACION   = new Set(['','NUEVO','NO CONTESTA','BUZON DE VOZ'])
function esLeadProhibido(reg) {
  const tipif = String(reg?._tipifVend || reg?.tipif_vend || '').trim().toUpperCase()
  return TIPIF_PROHIBIDAS_ROTACION.has(tipif)
}
const TIPIF_VEND_STYLES = {
  'VENTA CERRADA':['#d1fae5','#065f46'],'PREVENTA':['#dbeafe','#1e40af'],'AGENDADO':['#fef3c7','#78350f'],
  'NO CONTESTA':['#fefce8','#854d0e'],'BUZON DE VOZ':['#e0f2fe','#0c4a6e'],'CORTA LLAMADA':['#f8fafc','#334155'],
  'EN EJECUCION':['#dcfce7','#14532d'],'SIN COBERTURA':['#ffe4e6','#881337'],'NO CALIFICA':['#fefce8','#713f12'],
  'NO DESEA':['#ffe4e6','#7f1d1d'],'CONTACTO CON TERCEROS':['#ccfbf1','#134e4a'],'EDIFICIO NO LIBERADO':['#f5f3ff','#4c1d95'],
  'DESEA MOVIL':['#f8fafc','#1e293b'],'SERVICIO ACTIVO':['#f1f5f9','#1e293b'],'CONTESTA':['#d1fae5','#065f46'],
  'NC':['#fefce8','#854d0e'],'DERIVADO':['#ede9fe','#5b21b6'],'NO TOCAR':['#fef2f2','#dc2626'],'FRAUDE':['#fee2e2','#991b1b'],
  'INSTALADO':['#dcfce7','#14532d'],
}
const BL_TIPIF_COLORS = {
  'VENTA CERRADA':'#16a34a','PREVENTA':'#2563eb','AGENDADO':'#7c3aed','NO CONTESTA':'#9ca3af',
  'CORTA LLAMADA':'#f97316','NO DESEA':'#ef4444','BUZON DE VOZ':'#6b7280','SERVICIO ACTIVO':'#0891b2',
  'SIN COBERTURA':'#dc2626','NO CALIFICA':'#d97706','NO TOCAR':'#dc2626','FRAUDE':'#991b1b','INSTALADO':'#15803d',
}

// Colores fuertes/vistosos para el selector de Tipif. Vendedor (texto blanco encima)
const TIPIF_VEND_FUERTE = {
  'VENTA CERRADA':'#16a34a', 'INSTALADO':'#15803d', 'CONTESTA':'#22c55e',
  'CONTACTO CON TERCEROS':'#0d9488', 'SERVICIO ACTIVO':'#1d4ed8', 'PREVENTA':'#2563eb',
  'CORTA LLAMADA':'#0284c7', 'AGENDADO':'#ea580c', 'BUZON DE VOZ':'#f97316',
  'NO DESEA':'#d97706', 'NO CONTESTA':'#ca8a04', 'NC':'#ca8a04',
  'EN EJECUCION':'#92400e', 'DESEA MOVIL':'#b45309', 'DERIVADO':'#7c3aed',
  'NO CALIFICA':'#f43f5e', 'SIN COBERTURA':'#dc2626', 'EDIFICIO NO LIBERADO':'#b91c1c',
  'NO TOCAR':'#dc2626', 'FRAUDE':'#991b1b',
}
function estiloTipifVend(v) {
  const c = TIPIF_VEND_FUERTE[v]
  return c
    ? { flex:1, minWidth:0, background:c, color:'#fff', fontWeight:700, border:`1px solid ${c}`, borderRadius:6 }
    : { flex:1, minWidth:0, background:'#fff', color:'inherit', fontWeight:'inherit', border:'1px solid #e5e7eb' }
}

// Selector de asesor con búsqueda integrada (escribe para filtrar la lista)
function AsesorBuscador({ value, asesores, disabled, onChange, title, plain }) {
  const [val, setVal] = useState(value || '')
  useEffect(() => { setVal(value || '') }, [value])
  function commit(raw) {
    const t = (raw || '').trim()
    if (t === '') { onChange(''); return }
    const m = asesores.find(a => (a.nombre || '').toLowerCase() === t.toLowerCase())
    if (m) { onChange(m.nombre); setVal(m.nombre) }
    else setVal(value || '')
  }
  return (
    <input list="asesores-datalist" value={val} disabled={disabled} title={title}
      className={plain ? undefined : 'bo-sel-compact sel-asesor-tabla'}
      placeholder="Buscar asesor…"
      onChange={e => { setVal(e.target.value); const m = asesores.find(a => a.nombre === e.target.value); if (m) onChange(m.nombre) }}
      onBlur={e => commit(e.target.value)} />
  )
}

function TipifVendBadge({ tipif, hora }) {
  if (!tipif) return <span className="tipif-empty">— Pendiente —</span>
  const [bg, color] = TIPIF_VEND_STYLES[tipif] || ['#f3f4f6','#374151']
  return (
    <div style={{display:'flex',flexDirection:'column',gap:2}}>
      <span style={{display:'inline-flex',padding:'3px 8px',borderRadius:6,fontSize:10,fontWeight:700,background:bg,color,whiteSpace:'nowrap'}}>{tipif}</span>
      {hora && <span style={{fontSize:9,color:'#9ca3af'}}>vendedor · {hora}</span>}
    </div>
  )
}

function BlBadge({ tipif }) {
  const raw = (tipif || '').trim()
  const color = BL_TIPIF_COLORS[raw.toUpperCase()] || '#9ca3af'
  if (!raw) return <span style={{color:'#d1d5db',fontStyle:'italic',fontSize:11}}>Sin tipif.</span>
  return <span style={{background:`${color}22`,color,border:`1px solid ${color}44`,padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700}}>{raw}</span>
}

function BoNavIcon({ tipo }) {
  if (tipo === 'base') return (
    <svg className="bo-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M9 21v-7h6v7"/></svg>
  )
  if (tipo === 'carga') return (
    <svg className="bo-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 16V8m0 0-3 3m3-3 3 3"/></svg>
  )
  if (tipo === 'rendimiento') return (
    <svg className="bo-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/></svg>
  )
  return (
    <svg className="bo-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m0-5a5 5 0 0 1 6 5"/></svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" strokeWidth="1.8"/>
    </svg>
  )
}

function NotebookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/>
    </svg>
  )
}

function SortIcon({ active, direction }) {
  const up   = active && direction === 'up'   ? '#fff' : 'rgba(255,255,255,0.32)'
  const down = active && direction === 'down' ? '#fff' : 'rgba(255,255,255,0.32)'
  return (
    <svg width="9" height="13" viewBox="0 0 9 13" fill="none" aria-hidden="true" style={{flexShrink:0,marginLeft:3}}>
      <path d="M4.5 1L1.5 5h6L4.5 1z" fill={up}/>
      <path d="M4.5 12L1.5 8h6L4.5 12z" fill={down}/>
    </svg>
  )
}

// Extrae número de teléfono válido del campo N2 (elimina GPS, texto, etc.)
function limpiarN2Legacy(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  if (!s) return ''
  const primary = s.includes('///') ? s.split('///')[0].trim() : s
  const digits = primary.replace(/[^0-9]/g, '')
  if (digits.length >= 7 && digits.length <= 9) return digits
  const m1 = s.match(/\b9\d{8}\b/)
  if (m1) return m1[0]
  const m2 = s.match(/\b\d{7,9}\b/)
  if (m2) return m2[0]
  return ''
}

// Extrae DNI de 8 dígitos de obs_asesor (ej: "DNI: 60975222", "DNI 60975222")
function extraerDni(obs) {
  if (!obs) return null
  const s = String(obs).trim()
  const m = s.match(/\bDNI[:\s]+(\d{6,12})\b/i)
  if (m) return m[1]
  const m2 = s.match(/^(\d{6,12})$/)   // comentario que es solo el número de documento
  return m2 ? m2[1] : null
}

// ── Component ─────────────────────────────────────────────────────────────
export default function Backoffice() {
  const navigate    = useNavigate()
  const { sesion, logout } = useAuth()
  const idCntRef      = useRef(1)
  const toastTimer    = useRef(null)
  const archivoInputRef   = useRef(null)
  const legacyInputRef    = useRef(null)
  const fechaSistemaRef   = useRef(fechaHoy())
  // ── Section ──
  const [seccion, setSeccion] = useState(() => {
    const guardada = sessionStorage.getItem('nc_backoffice_apartado')
    return BO_SECCIONES.includes(guardada) ? guardada : 'base'
  })
  const [sidebarAbierto, setSidebarAbierto] = useState(() => sessionStorage.getItem('nc_backoffice_sidebar') !== 'cerrado')

  // ── Data ──
  const [asesores,      setAsesores]      = useState([])
  const [baseData,      setBaseData]      = useState({})
  const [fechaPestanas, setFechaPestanas] = useState([fechaHoy()])
  const [fechaActiva,   setFechaActiva]   = useState(fechaHoy())

  // ── Form (agregar registro) ──
  const [form,     setForm]     = useState({ campana:'', dpto:'', prov:'', distrito:'', n1:'', n2:'', tipoContacto:'LLAMADA', direccion:'', coordenadas:'', obsBack:'', tipifBack:'', asesor:'' })
  const [n1Error,  setN1Error]  = useState(false)
  const [calPicker,   setCalPicker]   = useState('')
  const [cmCalPicker, setCmCalPicker] = useState('')

  // ── Ubigeo cascada ──
  const dptos     = Object.keys(UBIGEO).sort()
  const provs     = form.dpto ? Object.keys(UBIGEO[form.dpto] || {}).sort() : []
  const distritos = (form.dpto && form.prov) ? (UBIGEO[form.dpto]?.[form.prov] || []) : []

  // ── Filtros base ──
  const [filtros, setFiltros] = useState({ tip:'', tipVend:'', asesor:'', numero:'', verTipVend:true })
  const [tableSort, setTableSort] = useState({ col: null, dir: null })
  function cycleSort(col) {
    setTableSort(prev => {
      const firstDir = { tipif:'az', hora:'desc', rots:'asc' }[col]
      if (prev.col !== col) return { col, dir: firstDir }
      const seq = { tipif:['az','za',null], hora:['desc','asc',null], rots:['asc','desc',null] }[col]
      const next = seq[(seq.indexOf(prev.dir) + 1) % seq.length]
      return next ? { col, dir: next } : { col: null, dir: null }
    })
  }

  // ── Historial / Detalles expandibles ──
  const [histOpen, setHistOpen] = useState({})
  const [detOpen,  setDetOpen]  = useState({})
  const [dniModal, setDniModal] = useState(null) // { id, bid, dni, top, left, editing, editVal }

  // Guardar (editar) el DNI/comentario de una venta cerrada desde el popover del libro verde
  async function guardarDni() {
    const id  = dniModal?.id
    const bid = dniModal?.bid
    const val = String(dniModal?.editVal || '').replace(/\D/g, '')
    if (!id) return
    setBaseData(prev => {
      const next = { ...prev }
      for (const f in next) next[f] = (next[f] || []).map(r => r.id === id ? { ...r, obsAsesor: val } : r)
      return next
    })
    if (bid) { try { await fetch(`${API}/leads/${bid}/obs`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ obs: val }) }) } catch(e) {} }
    setDniModal(p => p ? { ...p, dni: val, editing: false } : null)
    mostrarToast('DNI actualizado')
  }

  // ── Rotación panel ──
  const [rotPanelOpen,  setRotPanelOpen]  = useState(false)
  const [rotAsesor,     setRotAsesor]     = useState('')
  const [rotCant,       setRotCant]       = useState(4)
  const [rotSel,        setRotSel]        = useState({})
  const [rotFiltroFecha,setRotFiltroFecha]= useState('')
  const [rotFiltroTipif,setRotFiltroTipif]= useState('')
  const [rotProgress,   setRotProgress]   = useState(0)
  const [rotResultado,  setRotResultado]  = useState([])
  const [rotRotados,    setRotRotados]    = useState(0)

  // ── Modal rotación manual ──
  const [modalRotar,    setModalRotar]    = useState({ open:false, regId:null, desc:'', asesorActual:'' })
  const [rotModalAsesor,setRotModalAsesor]= useState('')
  const [rotModalMotivo,setRotModalMotivo]= useState('')
  const [rotandoManual, setRotandoManual] = useState(false)

  // ── Carga masiva ──
  const [cargaTab,     setCargaTab]     = useState(() => sessionStorage.getItem('nc_backoffice_carga_tab') || 'pegar')
  const [masivaNums,   setMasivaNums]   = useState('')
  const [masivaCamp,   setMasivaCamp]   = useState('')
  const [masivaAsesor, setMasivaAsesor] = useState('')
  const [masivaLote,   setMasivaLote]   = useState('10')
  const [masivaFilas,  setMasivaFilas]  = useState([])
  const [inclDup,      setInclDup]      = useState(false)
  const [archivoRows,  setArchivoRows]  = useState([])
  const [archivoStatus,setArchivoStatus]= useState('')
  const [archivoInfo,  setArchivoInfo]  = useState('')
  const [legacyRows,   setLegacyRows]   = useState([])
  const [legacyStatus, setLegacyStatus] = useState('')
  const [legacyInfo,   setLegacyInfo]   = useState('')
  const [legacyFecha,  setLegacyFecha]  = useState(fechaHoy())
  const [legacyUsarFecha, setLegacyUsarFecha] = useState('no')
  const [legacyDesde,  setLegacyDesde]  = useState('')
  const [legacyHasta,  setLegacyHasta]  = useState(fechaHoy())
  const [dragOver,     setDragOver]     = useState(false)
  const [legacyDragOver, setLegacyDragOver] = useState(false)
  const [cargandoMasiva, setCargandoMasiva] = useState(false)
  const [cargandoLegacy, setCargandoLegacy] = useState(false)
  const [importResult,   setImportResult]   = useState(null)
  const [legacyError,    setLegacyError]    = useState('')

  // ── Rendimiento ──
  const [rendFiltroTipo,  setRendFiltroTipo]  = useState('mes')
  const [rendFiltroFecha, setRendFiltroFecha] = useState(fechaHoy())
  const [rendDesde,       setRendDesde]       = useState('')
  const [rendHasta,       setRendHasta]       = useState('')
  const [rendOrden,       setRendOrden]       = useState('ventas_desc')

  // ── Avance ──
  const [avanceBuscar, setAvanceBuscar] = useState('')
  const [blModal,  setBlModal]  = useState({ open:false, nombre:'', asesorId:null })
  const [blLeads,  setBlLeads]  = useState([])
  const [blFecha,  setBlFecha]  = useState(fechaHoy())
  const [blCargando, setBlCargando] = useState(false)

  // ── Toast ──
  const [toast, setToast] = useState('')

  // Mantiene el panel alineado con el calendario de Lima aunque quede abierto
  // durante el cambio de día. Conserva una fecha histórica elegida a mano.
  useEffect(() => {
    function sincronizarFechaPeru() {
      const hoy = fechaHoy()
      const fechaAnterior = fechaSistemaRef.current

      setFechaPestanas(prev => prev.includes(hoy) ? prev : [...prev, hoy].sort().reverse())

      if (hoy === fechaAnterior) return

      setFechaActiva(prev => prev === fechaAnterior ? hoy : prev)
      setLegacyFecha(prev => prev === fechaAnterior ? hoy : prev)
      setRendFiltroFecha(prev => prev === fechaAnterior ? hoy : prev)
      setBlFecha(prev => prev === fechaAnterior ? hoy : prev)
      fechaSistemaRef.current = hoy
    }

    sincronizarFechaPeru()
    const timer = setInterval(sincronizarFechaPeru, 30000)
    return () => clearInterval(timer)
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────
  function mostrarToast(msg) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 3200)
  }

  async function copiarNumero(numero) {
    const texto = String(numero || '').trim()
    if (!texto) return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto)
      } else {
        const area = document.createElement('textarea')
        area.value = texto
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        area.remove()
      }
    } catch(e) {
      mostrarToast('No se pudo copiar el número')
    }
  }

  async function guardarDatosBack(id, cambios) {
    const found = findReg(id)
    if (!found) return
    updateReg(id, cambios)
    if (!found.reg._backendId) return
    try {
      const res = await fetch(`${API}/leads/${found.reg._backendId}/datos-back`, {
        method:'PATCH', headers:ncHeaders(), body:JSON.stringify(cambios)
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.mensaje || 'Error al guardar')
    } catch(e) {
      mostrarToast(e.message || 'No se pudieron guardar los datos')
      cargarLeads()
    }
  }

  function findReg(id) {
    for (const f in baseData) {
      const reg = baseData[f].find(r => r.id === id)
      if (reg) return { reg, fecha: f }
    }
    return null
  }

  // Cambios locales recientes por lead: el polling los respeta hasta que el
  // backend los confirme (o pasen 8s), evitando el parpadeo al valor viejo.
  const pendingRef = useRef({})
  function marcarPendiente(id, campos) {
    if (!campos || typeof campos !== 'object' || Array.isArray(campos)) return
    const prev = pendingRef.current[id]?.campos || {}
    pendingRef.current[id] = { campos: { ...prev, ...campos }, ts: Date.now() }
  }

  function updateReg(id, updater) {
    if (updater && typeof updater === 'object' && !Array.isArray(updater)) marcarPendiente(id, updater)
    setBaseData(prev => {
      const next = {}
      for (const f in prev) {
        const idx = prev[f].findIndex(r => r.id === id)
        if (idx >= 0) {
          const arr = [...prev[f]]
          arr[idx] = typeof updater === 'function' ? updater(arr[idx]) : { ...arr[idx], ...updater }
          next[f] = arr
        } else {
          next[f] = prev[f]
        }
      }
      return next
    })
  }

  // ── Cargar datos ─────────────────────────────────────────────────────────
  const cargarAsesores = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/usuarios`, { headers: ncHeaders() })
      const data = await res.json()
      if (data.ok) setAsesores(data.data.filter(u => usuarioTieneCargo(u, 'asesor') && u.activo).map(u => ({ id:u.id, nombre:u.nombre, usuario:u.usuario, sala:u.sala })))
    } catch(e) { console.error('Error cargando asesores:', e) }
  }, [])

const cargarLeads = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/leads`, { headers: ncHeaders() })
      const data = await res.json()
      if (!data.ok) return
      const nuevoBase = {}
      const nuevasFechas = []
      data.data.forEach(l => {
        const fecha = normalizarFecha(l.fecha) || fechaHoy()
        if (!nuevoBase[fecha]) nuevoBase[fecha] = []
        if (!nuevasFechas.includes(fecha)) nuevasFechas.push(fecha)
        const reg = {
          id:         l.id,
          _backendId: l.id,
          campana:    l.campana || '—',
          distrito:   l.distrito || '—',
          n1:         l.n1,
          n2:         l.n2 || '',
          tipo_contacto: l.tipo_contacto || 'LLAMADA',
          direccion:   l.direccion || '',
          coordenadas: l.coordenadas || '',
          obs_back:    l.obs_back || '',
          tipifBack:  l.tipif_back || '',
          derivadoPor: l.derivado_por_nombre || '',
          asesor:     l.asesor_nombre || '',
          horaAsig:   l.hora_asig || '',
          sinAsignar: !!l.sin_asignar,
          rotaciones: l.rotaciones || 0,
          _tipifVend: l.tipif_vend || '',
          _tipifHora: l.tipif_hora || '',
          obsAsesor:  l.obs_asesor || '',
          historial:  Array.isArray(l.historial) ? l.historial : [],
        }
        // Reconciliar con cambios locales recientes (evita parpadeo al valor viejo)
        const pend = pendingRef.current[l.id]
        if (pend) {
          const edad = Date.now() - pend.ts
          let quedan = 0
          for (const k in pend.campos) {
            const exp = pend.campos[k]
            if (exp && typeof exp === 'object') continue
            if (reg[k] !== exp) { if (edad < 8000) { reg[k] = exp; quedan++ } }
          }
          if (quedan === 0 || edad >= 8000) delete pendingRef.current[l.id]
        }
        nuevoBase[fecha].push(reg)
      })
      const hoy = fechaHoy()
      if (!nuevasFechas.includes(hoy)) nuevasFechas.push(hoy)

      // Conserva pestañas de fecha agregadas manualmente por el usuario que aún
      // no tienen leads en el backend (p.ej. mientras prepara una carga masiva),
      // en vez de que el polling las borre al no encontrar registros ahí.
      setFechaPestanas(prevFechas => {
        const combinado = Array.from(new Set([...prevFechas, ...nuevasFechas]))
        return combinado.sort().reverse()
      })
      setBaseData(prevBase => {
        const merged = { ...nuevoBase }
        for (const f in prevBase) {
          if (!merged[f]) merged[f] = prevBase[f]
        }
        return merged
      })
      // fechaActiva ya no se resetea agresivamente: solo cambia si la fecha
      // activa actual ya no existe en ningún lado (ni en backend ni manual).
      setFechaActiva(prev => {
        const todasLasFechas = Array.from(new Set([...nuevasFechas, prev]))
        return todasLasFechas.includes(prev) ? prev : (nuevasFechas[0] || hoy)
      })
    } catch(e) { console.error('Error cargando leads:', e) }
  }, [])

  useEffect(() => {
    cargarAsesores()
    cargarLeads()
    const t = setInterval(cargarLeads, 1000)
    return () => clearInterval(t)
  }, [cargarAsesores, cargarLeads])

  // BL modal reload on fecha change
  useEffect(() => {
    if (!blModal.open || blModal.asesorId == null) return
    setBlCargando(true)
    setBlLeads([])
    let url = `${API}/leads?asesor_id=${blModal.asesorId}`
    if (blFecha) url += `&fecha=${blFecha}`
    fetch(url, { headers: ncHeaders() })
      .then(r => r.json())
      .then(data => { setBlLeads(data.ok ? data.data : null); setBlCargando(false) })
      .catch(() => { setBlLeads(null); setBlCargando(false) })
  }, [blFecha, blModal.open, blModal.asesorId])

  // ── Section navigation ───────────────────────────────────────────────────
  function irSeccion(id) {
    sessionStorage.setItem('nc_backoffice_apartado', id)
    setSeccion(id)
    if (id === 'carga-masiva') setLegacyFecha(fechaActiva)
  }

  // ── Date navigation ──────────────────────────────────────────────────────
  function navegarFecha(dir) {
    setFechaActiva(prev => {
      const idx = fechaPestanas.indexOf(prev)
      const ni  = idx - dir
      if (ni < 0 || ni >= fechaPestanas.length) return prev
      return fechaPestanas[ni]
    })
  }

  function agregarFechaCalendario() {
    const f = calPicker
    if (!f) { mostrarToast('Selecciona una fecha primero'); return }
    if (fechaPestanas.includes(f)) { mostrarToast('Esa fecha ya existe'); return }
    setFechaPestanas(prev => [...prev, f].sort().reverse())
    setBaseData(prev => prev[f] ? prev : { ...prev, [f]: [] })
    setFechaActiva(f)
    setCalPicker('')
  }

  function agregarFechaCargaMasiva() {
    const f = cmCalPicker
    if (!f) { mostrarToast('Selecciona una fecha primero'); return }
    if (fechaPestanas.includes(f)) { mostrarToast('Esa fecha ya existe'); return }
    setFechaPestanas(prev => [...prev, f].sort().reverse())
    setBaseData(prev => prev[f] ? prev : { ...prev, [f]: [] })
    setFechaActiva(f)
    setLegacyFecha(f)
    setCmCalPicker('')
  }

  // ── Form (agregar registro individual) ───────────────────────────────────
  async function agregarRegistro() {
    const n1 = form.n1.replace(/\D/g, '')   // formato único: solo dígitos (999999999)
    if (!n1) { setN1Error(true); mostrarToast('El campo N1 es obligatorio'); return }
    setN1Error(false)
    const campana  = form.campana.trim() || '—'
    const distrito = form.distrito || '—'
    const n2       = form.n2.replace(/\D/g, '')
    const tipo_contacto = form.tipoContacto || 'LLAMADA'
    const direccion = form.direccion.trim()
    const coordenadas = form.coordenadas.trim()
    const obs_back = form.obsBack.trim()
    const tipifBack = form.tipifBack
    const asesor   = form.asesor
    const hora     = asesor ? horaAhora() : ''
    const fecha    = fechaActiva
    const reg = {
      id:-idCntRef.current++, _backendId:null, campana, distrito, n1, n2, tipo_contacto, direccion, coordenadas, obs_back, tipifBack, derivadoPor:tipifBack==='DERIVADO'&&asesor?(sesion?.nombre||''):'', asesor, horaAsig:hora,
      sinAsignar:!asesor, rotaciones:0, _tipifVend:'', _tipifHora:'',
      historial: asesor ? [{asesor, hora, fecha, motivo:'Asignacion inicial'}] : [],
    }
    setBaseData(prev => ({ ...prev, [fecha]: [reg, ...(prev[fecha] || [])] }))
    setFechaPestanas(prev => prev.includes(fecha) ? prev : [...prev, fecha].sort().reverse())
    try {
      const res  = await fetch(`${API}/leads`, { method:'POST', headers:ncHeaders(), body:JSON.stringify({ campana, distrito, n1, n2, tipo_contacto, direccion, coordenadas, obs_back, tipif_back:tipifBack, asesor_nombre:asesor, fecha, hora_asig:hora }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.mensaje || 'Error al guardar el registro')
      const bid  = data.ids?.[0] || data.id
      if (bid) {
        setBaseData(prev => {
          const next = { ...prev }
          const arr  = [...(next[fecha] || [])]
          const idx  = arr.findIndex(r => r.id === reg.id)
          if (idx >= 0) { arr[idx] = { ...arr[idx], id: bid, _backendId: bid }; next[fecha] = arr }
          return next
        })
      }
      setForm({ campana:'', dpto:'', prov:'', distrito:'', n1:'', n2:'', tipoContacto:'LLAMADA', direccion:'', coordenadas:'', obsBack:'', tipifBack:'', asesor:'' })
    } catch(e) {
      // Elimina el registro local fantasma inmediatamente — no espera al polling
      setBaseData(prev => { const n={...prev}; n[fecha]=(n[fecha]||[]).filter(r=>r.id!==reg.id); return n })
      mostrarToast(e.message || 'No se pudo guardar el registro. Intenta nuevamente.')
    }
  }

  // ── Reasignar ────────────────────────────────────────────────────────────
  async function reasignarReg(id, nuevoAsesor) {
    const found = findReg(id)
    if (!found) return
    const { reg } = found
    const hora = horaAhora()
    if (nuevoAsesor && esLeadProhibido(reg)) {
      mostrarToast(`N1 ${reg.n1} bloqueado: ${reg._tipifVend}`)
      return
    }
    if (!nuevoAsesor) {
      updateReg(id, { asesor:'', horaAsig:'', sinAsignar:true })
      if (reg._backendId) fetch(`${API}/leads/${reg._backendId}`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ asesor_nombre:'', hora_asig:'' }) }).catch(()=>{})
      return
    }
    const newHist = [...reg.historial, { asesor:nuevoAsesor, asesorAnterior:reg.asesor||'', hora, fecha:fechaHoy(), motivo:'Reasignacion directa' }]
    updateReg(id, { asesor:nuevoAsesor, horaAsig:hora, sinAsignar:false, historial:newHist, _tipifVend:'', _tipifHora:'', tipifBack:'', ...(reg.tipifBack==='DERIVADO'?{derivadoPor:sesion?.nombre||''}:{}) })
    if (reg._backendId) fetch(`${API}/leads/${reg._backendId}`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ asesor_nombre:nuevoAsesor, hora_asig:hora, historial:newHist }) }).catch(()=>{})
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  async function eliminarReg(id) {
    const found = findReg(id)
    if (found?.reg._backendId) fetch(`${API}/leads/${found.reg._backendId}`, { method:'DELETE', headers:ncHeaders() }).catch(()=>{})
    setBaseData(prev => { const n={}; for(const f in prev) n[f]=prev[f].filter(r=>r.id!==id); return n })
    setHistOpen(prev => { const n={...prev}; delete n[id]; return n })
  }

  // ── Tipif vendedor ────────────────────────────────────────────────────────
  async function guardarTipif(id, valor) {
    const found = findReg(id)
    if (!found) return
    const { reg } = found
    const hora = horaAhora()
    updateReg(id, { _tipifVend:valor, _tipifHora:hora })
    if (reg._backendId) fetch(`${API}/leads/${reg._backendId}/tipif`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ tipif_vend:valor }) }).catch(()=>{})
  }

  // ── Tipif back ────────────────────────────────────────────────────────────
  async function guardarTipifBack(id, nuevoValor) {
    const found = findReg(id)
    if (!found) return
    const { reg } = found
    const hora = horaAhora()
    const tipifAntes = reg.tipifBack || ''
    const esDer = nuevoValor === 'DERIVADO'
    const entrada = {
      tipo: esDer ? 'DERIVADO' : 'TIPIF_BACK',
      asesor: reg.asesor || '',
      hora, fecha: fechaHoy(),
      motivo: esDer ? 'Marcado DERIVADO' : 'Cambio tipif. back',
      tipifBackAntes: tipifAntes, tipifBackNueva: nuevoValor,
    }
    const newHist = [...reg.historial, entrada]
    const derivadoPor = esDer ? (sesion?.nombre || '') : ''
    updateReg(id, { tipifBack: nuevoValor, historial: newHist, derivadoPor })
    if (reg._backendId) fetch(`${API}/leads/${reg._backendId}`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ tipif_back:nuevoValor, historial:newHist }) }).catch(()=>{})
  }

  // ── Modal rotación manual ─────────────────────────────────────────────────
  function abrirModalRotar(id) {
    const found = findReg(id)
    if (!found) return
    const { reg } = found
    if (esLeadProhibido(reg)) {
      mostrarToast(`N1 ${reg.n1} no se puede rotar: ${reg._tipifVend}`)
      return
    }
    setModalRotar({ open:true, regId:id, desc:`N1: ${reg.n1} — Asesor actual: ${reg.asesor||'Sin asignar'}`, asesorActual:reg.asesor })
    setRotModalAsesor('')
    setRotModalMotivo('')
  }

  async function confirmarRotacion() {
    if (!rotModalAsesor || rotandoManual) return
    const found = findReg(modalRotar.regId)
    if (!found) {
      mostrarToast('El registro cambió. Abre nuevamente la opción Rotar.')
      return
    }
    const { reg } = found
    if (esLeadProhibido(reg)) {
      mostrarToast(`Rotación bloqueada: ${reg._tipifVend}`)
      setModalRotar({ open:false, regId:null, desc:'', asesorActual:'' })
      return
    }
    const motivo  = rotModalMotivo.trim() || 'Rotacion manual'
    if (!reg._backendId) {
      mostrarToast('Espera a que el registro termine de guardarse antes de rotarlo.')
      return
    }
    setRotandoManual(true)
    try {
      const res = await fetch(`${API}/leads/${reg._backendId}/rotar`, { method:'POST', headers:ncHeaders(), body:JSON.stringify({ asesor_nombre:rotModalAsesor, motivo }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo rotar el registro')
      // Actualización optimista: el backend ahora UPDATE (mismo ID), no crea duplicado.
      // histOpen[regId] se preserva; el polling sincronizará en ≤3s.
      updateReg(modalRotar.regId, {
        asesor:     rotModalAsesor,
        horaAsig:   horaAhora(),
        sinAsignar: false,
        tipifBack:  '',
        derivadoPor:'',
        historial:  data.historial || reg.historial,
        rotaciones: (reg.rotaciones || 0) + 1,
        _tipifVend: '',
        _tipifHora: '',
      })
      setModalRotar({ open:false, regId:null, desc:'', asesorActual:'' })
      mostrarToast(data.mensaje || `Registro rotado a ${rotModalAsesor}`)
    } catch (error) {
      mostrarToast(error.message || 'Error de conexión al rotar')
    } finally {
      setRotandoManual(false)
    }
  }

  // ── Rotation panel ────────────────────────────────────────────────────────
  function buildRotLeads() {
    const ahora = new Date()
    const list  = []
    const fechas = rotFiltroFecha ? [rotFiltroFecha] : Object.keys(baseData).sort().reverse()
    fechas.forEach(fecha => {
      (baseData[fecha]||[]).forEach(reg => {
        let ultimaAsig = new Date(fecha+'T'+(reg.horaAsig||'00:00')+':00')
        if (isNaN(ultimaAsig)) ultimaAsig = new Date(ahora.getTime() - 24*3600000)
        const histAsesores = reg.historial.filter(h=>!h.tipo||h.tipo==='ASIGNACION'||h.tipo==='ROTACION').map(h=>h.asesor)
        const tipifActual = (reg._tipifVend || '').trim().toUpperCase()
        if (TIPIF_EXCLUIDAS_ROTACION.has(tipifActual)) return
        list.push({ id:reg.id, tel:reg.n1, campana:reg.campana, n2:reg.n2||'', estado:reg._tipifVend||'NUEVO', tipifVend:reg._tipifVend||'', asesor:reg.asesor||'', ultimaAsig, fecha, histAsesores, _reg:reg })
      })
    })
    return list
  }

  function rotApto(lead, asesor) {
    const ahora = new Date()
    if (!asesor) return { apto:false, prohibido:false }
    const sinRepetir = !lead.histAsesores.includes(asesor)
    const mins = Math.floor((ahora - lead.ultimaAsig)/60000)
    const tiempo = mins >= 120
    const estadoOk = TIPIF_ROTABLES_ROTACION.has((lead.tipifVend||'').trim().toUpperCase())
    if (!lead.asesor) return { apto:sinRepetir, prohibido:false, sinRepetir, tiempo:true, estadoOk:true }
    return { apto:sinRepetir&&tiempo&&estadoOk, prohibido:false, sinRepetir, tiempo, estadoOk }
  }

  function rotMins(f) { return Math.floor((new Date() - f)/60000) }
  function rotTxt(f) { const m=rotMins(f); if(m<60) return m+' min'; const h=Math.floor(m/60),r=m%60; return h+'h'+(r>0?' '+r+'min':'') }
  function rotFaltanTxt(mins) { const r=120-mins; if(r<=0) return ''; const h=Math.floor(r/60),m=r%60; return h>0?`Faltan ${h}h${m>0?' '+m+' min':''}`:`Faltan ${r} min` }

  async function rotFinalizarWith(selToUse, asesorActual) {
    const hora     = horaAhora()
    const allLeads = buildRotLeads()
    // Se valida otra vez al ejecutar para impedir selecciones antiguas o cambios
    // de tipificación ocurridos mientras el panel estaba abierto.
    const rotados  = allLeads.filter(l => selToUse[l.id] && rotApto(l, asesorActual).apto)
    const res = []
    for (const l of rotados) {
      const reg = l._reg
      if (!reg._backendId) continue
      try {
        const respuesta = await fetch(`${API}/leads/${reg._backendId}/rotar`, { method:'POST', headers:ncHeaders(), body:JSON.stringify({ asesor_nombre:asesorActual, motivo:'Rotacion masiva' }) })
        const data = await respuesta.json().catch(() => ({}))
        if (respuesta.ok && data.ok) res.push({ tel:reg.n1, asesor:asesorActual, hora })
      } catch {}
    }
    await cargarLeads()
    setRotRotados(prev => prev + res.length)
    setRotResultado(res)
    setRotSel({})
  }

  async function rotEjecutar() {
    if (!rotAsesor) return
    const asesorActual = rotAsesor
    let selToUse = { ...rotSel }
    if (Object.keys(selToUse).length === 0) {
      const aptos = buildRotLeads().filter(l => rotApto(l, asesorActual).apto).slice(0, rotCant)
      if (!aptos.length) { mostrarToast('No hay leads aptos para ' + asesorActual); return }
      const newSel = {}
      aptos.forEach(l => { newSel[l.id] = true })
      setRotSel(newSel)
      selToUse = newSel
    }
    setRotProgress(25)
    setTimeout(() => setRotProgress(50), 200)
    setTimeout(() => setRotProgress(75), 400)
    setTimeout(async () => {
      await rotFinalizarWith(selToUse, asesorActual)
      setRotProgress(100)
      setTimeout(() => setRotProgress(0), 1000)
    }, 600)
  }

  function rotToggleSel(id, checked) {
    const selCount = Object.values(rotSel).filter(Boolean).length
    if (checked) {
      if (selCount >= rotCant) { mostrarToast('Maximo '+rotCant+' leads'); return }
      setRotSel(prev => ({ ...prev, [id]:true }))
    } else {
      setRotSel(prev => { const n={...prev}; delete n[id]; return n })
    }
  }

  // ── Carga masiva ──────────────────────────────────────────────────────────
  function obtenerN1Existentes() {
    const set = new Set()
    for (const f in baseData) (baseData[f]||[]).forEach(r => { if(r.n1) set.add(String(r.n1).replace(/\s+/g,'')) })
    return set
  }

  function previsualizarMasiva() {
    const raw = masivaNums.trim()
    if (!raw) { mostrarToast('Pega numeros primero'); return }
    const numsRaw = raw.split(/[\n,;]+/).map(n=>n.trim().replace(/\s+/g,'')).filter(n=>n.length>=7)
    if (!numsRaw.length) { mostrarToast('No se encontraron numeros validos'); return }
    const lote = masivaLote === '0' ? numsRaw.length : (parseInt(masivaLote) || 10)
    const numsLote   = numsRaw.slice(0, lote)
    const existentes = obtenerN1Existentes()
    const vistos = new Set()
    const filas  = []
    numsLote.forEach(n => {
      let dup=false, motivo=''
      if (vistos.has(n)) { dup=true; motivo='Repetido en la lista' }
      else if (existentes.has(n)) { dup=true; motivo='Ya esta en el sistema' }
      vistos.add(n)
      filas.push({ n1:n, dup, motivo })
    })
    setMasivaFilas(filas)
    setInclDup(false)
  }

  async function enviarLeadsEnLotes(leads) {
    const LOTE = 499
    let creados = 0
    const ids = []
    for (let i = 0; i < leads.length; i += LOTE) {
      const batch = leads.slice(i, i + LOTE)
      let data
      try {
        const res = await fetch(`${API}/leads`, { method:'POST', headers:ncHeaders(), body:JSON.stringify(batch) })
        data = await res.json()
      } catch(e) {
        throw new Error(`Error de red al enviar lote ${Math.floor(i/LOTE)+1}: ${e.message}`)
      }
      if (!data.ok) throw new Error(data.mensaje || 'El servidor rechazó el lote de leads')
      creados += data.creados || 0
      if (data.ids) ids.push(...data.ids)
    }
    return { creados, ids }
  }

  async function ejecutarCargaMasiva() {
    if (cargandoMasiva) return
    const lista = (inclDup ? masivaFilas : masivaFilas.filter(f=>!f.dup)).map(f=>f.n1)
    if (!lista.length) { mostrarToast('No hay numeros para cargar'); return }
    setCargandoMasiva(true)
    setImportResult(null)
    const campana = masivaCamp.trim() || '—'
    const asesor  = masivaAsesor
    const hora    = asesor ? horaAhora() : ''
    const fecha   = fechaActiva
    const leadsParaBackend = []
    const nuevosRegs = []
    const filaResult = []
    lista.forEach(n1 => {
      if ((baseData[fecha]||[]).find(r=>r.n1===n1)) {
        filaResult.push({ n1, campana, resultado:'DUPLICADO', motivo:'Ya existe en la fecha destino' })
        return
      }
      const reg = { id:-idCntRef.current++, _backendId:null, campana, distrito:'—', n1, n2:'', tipifBack:'', asesor, horaAsig:hora, sinAsignar:!asesor, rotaciones:0, _tipifVend:'', _tipifHora:'', historial:asesor?[{asesor,hora,fecha,motivo:'Carga masiva'}]:[] }
      nuevosRegs.push(reg)
      leadsParaBackend.push({ campana, distrito:'—', n1, n2:'', tipif_back:'', asesor_nombre:asesor, fecha, hora_asig:hora })
      filaResult.push({ n1, campana, resultado:'IMPORTADO', motivo:'' })
    })
    if (nuevosRegs.length) {
      setBaseData(prev => ({ ...prev, [fecha]:[...(prev[fecha]||[]), ...nuevosRegs] }))
      setFechaPestanas(prev => prev.includes(fecha) ? prev : [...prev, fecha].sort().reverse())
      try {
        const { ids } = await enviarLeadsEnLotes(leadsParaBackend)
        if (ids.length) {
          setBaseData(prev => {
            const next = { ...prev }
            const arr  = [...(next[fecha]||[])]
            const off  = arr.length - nuevosRegs.length
            ids.forEach((bid,i) => { if(arr[off+i]) arr[off+i]={...arr[off+i],_backendId:bid} })
            next[fecha] = arr
            return next
          })
        }
      } catch(e) { mostrarToast(`Advertencia: ${e.message}`) }
    }
    const importados = filaResult.filter(f=>f.resultado==='IMPORTADO').length
    const duplicados = filaResult.filter(f=>f.resultado==='DUPLICADO').length
    setImportResult({ metodo:'pegar', fecha, total:lista.length, importados, duplicados, errores:0, filas:filaResult })
    setMasivaNums(''); setMasivaFilas([]); setInclDup(false)
    setCargandoMasiva(false)
  }

  async function leerArchivoComoTexto(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (ext === 'xlsx' || ext === 'xls') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = e => {
          try {
            const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array', cellDates:true })
            const ws = wb.Sheets[wb.SheetNames[0]]
            resolve(XLSX.utils.sheet_to_csv(ws))
          } catch(err) { reject(err) }
        }
        reader.onerror = reject
        reader.readAsArrayBuffer(file)
      })
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target.result)
      reader.onerror = reject
      reader.readAsText(file, 'UTF-8')
    })
  }

  async function procesarArchivo(file) {
    setArchivoStatus(`Leyendo ${file.name}...`)
    let text
    try { text = await leerArchivoComoTexto(file) }
    catch(e) { setArchivoStatus('Error leyendo el archivo'); return }
    const lineas = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0)
    if (!lineas.length) { setArchivoStatus('Archivo vacio'); return }
    const sep  = lineas[0].includes('\t')?'\t':lineas[0].includes(';')?';':','
    const p0   = lineas[0].split(sep)[0].trim()
    const cab  = (isNaN(p0.replace(/\s/g,''))&&p0.length>0&&!/^\d{7,}$/.test(p0)) ? lineas[0].split(sep).map(c=>c.trim().toLowerCase()) : null
    const datos= cab ? lineas.slice(1) : lineas
    const iN1  = cab ? (cab.findIndex(c=>c.includes('n1')||c.includes('numero')||c.includes('telefono'))) : 0
    const iN2  = cab ? cab.findIndex(c=>c.includes('n2')) : -1
    const iCamp= cab ? cab.findIndex(c=>c.includes('camp')||c.includes('zona')) : -1
    const iDist= cab ? cab.findIndex(c=>c.includes('dist')) : -1
    const iTip = cab ? cab.findIndex(c=>c.includes('tipif')||c.includes('estado')) : -1
    const rows = datos.map(linea => {
      const cols = linea.split(sep).map(c=>c.trim().replace(/^["']|["']$/g,''))
      const n1   = cols[iN1>=0?iN1:0]||''
      if (!n1||n1.length<6) return null
      return { n1, n2:iN2>=0?(cols[iN2]||''):'', camp:iCamp>=0?(cols[iCamp]||'—'):'—', dist:iDist>=0?(cols[iDist]||'—'):'—', tipif:iTip>=0?(cols[iTip]||''):'' }
    }).filter(Boolean)
    if (!rows.length) { setArchivoStatus('No se encontraron registros validos'); return }
    setArchivoRows(rows); setArchivoInfo(`${rows.length} registros en "${file.name}"`); setArchivoStatus('')
  }

  async function ejecutarCargaArchivo() {
    if (!archivoRows.length || cargandoMasiva) { if(!archivoRows.length) mostrarToast('No hay datos'); return }
    setCargandoMasiva(true)
    setImportResult(null)
    const fecha = fechaActiva
    const nuevos = []; const leadsBackend = []; const filaResult = []
    archivoRows.forEach(r => {
      if ((baseData[fecha]||[]).find(x=>x.n1===r.n1)) {
        filaResult.push({ n1:r.n1, campana:r.camp, resultado:'DUPLICADO', motivo:'Ya existe en la fecha destino' })
        return
      }
      nuevos.push({ id:-idCntRef.current++, _backendId:null, campana:r.camp, distrito:r.dist, n1:r.n1, n2:r.n2, tipifBack:r.tipif, asesor:'', horaAsig:'', sinAsignar:true, rotaciones:0, _tipifVend:'', _tipifHora:'', historial:[] })
      leadsBackend.push({ campana:r.camp, distrito:r.dist, n1:r.n1, n2:r.n2, tipif_back:r.tipif, asesor_nombre:'', fecha, hora_asig:'' })
      filaResult.push({ n1:r.n1, campana:r.camp, resultado:'IMPORTADO', motivo:'' })
    })
    if (nuevos.length) {
      setBaseData(prev => ({ ...prev, [fecha]:[...(prev[fecha]||[]), ...nuevos] }))
      setFechaPestanas(prev => prev.includes(fecha) ? prev : [...prev, fecha].sort().reverse())
      try { await enviarLeadsEnLotes(leadsBackend) }
      catch(e) { mostrarToast(`Advertencia: ${e.message}`) }
    }
    const importados = filaResult.filter(f=>f.resultado==='IMPORTADO').length
    const duplicados = filaResult.filter(f=>f.resultado==='DUPLICADO').length
    setImportResult({ metodo:'archivo', fecha, total:archivoRows.length, importados, duplicados, errores:0, filas:filaResult })
    setArchivoRows([]); setArchivoInfo(''); setArchivoStatus('')
    if (archivoInputRef.current) archivoInputRef.current.value = ''
    setCargandoMasiva(false)
  }

  async function procesarLegacy(file) {
    setLegacyStatus(`Leyendo ${file.name}...`)
    setLegacyError('')
    setImportResult(null)
    let text
    try { text = await leerArchivoComoTexto(file) }
    catch(e) { setLegacyStatus('Error leyendo el archivo'); return }
    const lineas = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0)
    if (!lineas.length) { setLegacyStatus('Archivo vacío'); return }
    const sep = lineas[0].includes('\t')?'\t':lineas[0].includes(';')?';':','
    const prim = lineas[0].split(sep).map(x=>x.trim().replace(/^["']|["']$/g,''))
    const usarFF = legacyUsarFecha === 'si'
    // Column positions: 'si' = new format (FECHA first, N1 at c[4]); 'no' = old format (N1 at c[3])
    const N1_COL = usarFF ? 4 : 3
    const p = (prim[N1_COL]||'').replace(/\D/g,'')
    const cab = isNaN(p) || p.length < 6
    const datos = cab ? lineas.slice(1) : lineas

    function parseFechaFila(raw) {
      if (!raw) return { fecha:'', error:true, msg:'Sin fecha' }
      const s = String(raw).trim()
      const mDMY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (mDMY) return { fecha:`${mDMY[3]}-${mDMY[2].padStart(2,'0')}-${mDMY[1].padStart(2,'0')}`, error:false, msg:'' }
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { fecha:s, error:false, msg:'' }
      const mDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
      if (mDash) return { fecha:`${mDash[3]}-${mDash[2].padStart(2,'0')}-${mDash[1].padStart(2,'0')}`, error:false, msg:'' }
      // Número serial de Excel (p.ej. 46034 = 01/08/2026)
      const n = Number(s)
      if (!isNaN(n) && n > 40000 && n < 60000) {
        const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000)
        return { fecha:`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`, error:false, msg:'' }
      }
      return { fecha:'', error:true, msg:`Formato no reconocido: "${s.slice(0,20)}"` }
    }

    const rows = []
    datos.forEach(linea => {
      const c = linea.split(sep).map(x=>x.trim().replace(/^["']|["']$/g,''))
      let n1, campana, distrito, n2, tipifBack, tipifVend, hora, comentario, asesoresHist
      if (usarFF) {
        // Nuevo formato: FECHA(0) CAMPAÑA(1) DISTRITO(2) N2(3) N1(4) TIPIFB(5) COM(6) TIPIFV(7) HORA(8) ASE(9-14)
        n1=(c[4]||'').replace(/[^0-9]/g,''); campana=c[1]||'—'; distrito=c[2]||'—'
        n2=limpiarN2Legacy(c[3]||'')
        tipifBack=c[5]||''; comentario=c[6]||''; tipifVend=c[7]||''; hora=c[8]||''
        asesoresHist=[]; for(let i=9;i<=14;i++){const a=(c[i]||'').trim();if(a&&a.length>1)asesoresHist.push(a)}
      } else {
        // Formato original: CAMPAÑA(0) DISTRITO(1) N2(2) N1(3) TIPIFB(4) COM(5) TIPIFV(6) HORA(7) ASE(8-13)
        n1=(c[3]||'').replace(/[^0-9]/g,''); campana=c[0]||'—'; distrito=c[1]||'—'
        n2=limpiarN2Legacy(c[2]||'')
        tipifBack=c[4]||''; comentario=c[5]||''; tipifVend=c[6]||''; hora=c[7]||''
        asesoresHist=[]; for(let i=8;i<=13;i++){const a=(c[i]||'').trim();if(a&&a.length>1)asesoresHist.push(a)}
      }
      // Normalizar tipifVend: alias del sistema antiguo
      const tipNorm=(tipifVend||'').trim().toUpperCase()
      if(tipNorm==='SH NO ROTAR') tipifVend='NO TOCAR'
      else if(tipNorm==='SH INSTALADO') tipifVend='INSTALADO'
      if (!n1||n1.length<6) return
      let fechaFila=legacyFecha, fechaError=false, fechaErrorMsg=''
      if (usarFF) {
        const r = parseFechaFila(c[0])
        fechaFila=r.fecha; fechaError=r.error; fechaErrorMsg=r.msg
        if (!fechaError) {
          if (legacyDesde && fechaFila < legacyDesde) { fechaError=true; fechaErrorMsg=`Antes del rango (${formatFecha(legacyDesde)})` }
          else if (legacyHasta && fechaFila > legacyHasta) { fechaError=true; fechaErrorMsg=`Después del rango (${formatFecha(legacyHasta)})` }
        }
      }
      rows.push({ fecha:fechaFila, _fechaError:fechaError, _fechaErrorMsg:fechaErrorMsg, campana, distrito, n2, n1, tipifBack, tipifVend, hora, comentario, asesores:asesoresHist })
    })
    if (!rows.length) { setLegacyStatus('No se encontraron filas válidas'); return }
    setLegacyRows(rows); setLegacyInfo(`${rows.length} registros desde "${file.name}"`); setLegacyStatus('')
  }

  async function importarLegadoEnLotes(registros) {
    const LOTE = 200
    let creados=0, actualizados=0, existentes=0, errores=0
    const erroresDetalle = []
    for (let i=0; i<registros.length; i+=LOTE) {
      const batch = registros.slice(i, i+LOTE)
      let data
      try {
        const res = await fetch(`${API}/leads/import-legacy`, { method:'POST', headers:ncHeaders(), body:JSON.stringify({ registros: batch, permitirDuplicados: true }) })
        data = await res.json()
      } catch(e) {
        throw new Error(`Error de red (lote ${Math.floor(i/LOTE)+1}): ${e.message}`)
      }
      if (!data.ok) throw new Error(data.detalle || data.mensaje || 'El servidor rechazó el lote')
      creados    += data.creados    || 0
      actualizados += data.actualizados || 0
      existentes += data.existentes || 0
      errores    += data.errores    || 0
      if (data.erroresDetalle) erroresDetalle.push(...data.erroresDetalle)
    }
    return { creados, actualizados, existentes, errores, erroresDetalle }
  }

  async function ejecutarCargaLegacy() {
    if (!legacyRows.length || cargandoLegacy) { if(!legacyRows.length) mostrarToast('No hay datos'); return }
    if (legacyUsarFecha === 'no' && legacyFecha > fechaHoy()) {
      setLegacyError('No se permiten fechas futuras. Selecciona una fecha igual o anterior a hoy.')
      return
    }
    setCargandoLegacy(true)
    setImportResult(null)
    setLegacyError('')
    const leadsBackend = []
    const distribFechas = {}
    let erroresFecha = 0
    legacyRows.forEach(r => {
      if (r._fechaError) { erroresFecha++; return }
      const f = r.fecha
      leadsBackend.push({
        campana:    r.campana,
        distrito:   r.distrito,
        n1:         r.n1,
        n2:         r.n2,
        tipif_back: r.tipifBack,
        tipif_vend: r.tipifVend,
        asesores:   r.asesores,
        fecha:      f,
        hora:       r.hora,
        comentario: r.comentario || '',
      })
      distribFechas[f] = (distribFechas[f]||0) + 1
    })
    const fechasImportadas = Object.keys(distribFechas).sort()
    const fechaNav = fechasImportadas[0] || legacyFecha
    try {
      let resultado = { creados:0, actualizados:0, existentes:0, errores:erroresFecha, erroresDetalle:[] }
      if (leadsBackend.length) {
        const r = await importarLegadoEnLotes(leadsBackend)
        resultado = { ...r, errores: r.errores + erroresFecha }
      }
      await cargarLeads()
      if (fechasImportadas.length) setFechaActiva(fechaNav)
      setImportResult({
        metodo:'legacy',
        fecha:fechaNav,
        fechas:fechasImportadas,
        distribucion:distribFechas,
        total:legacyRows.length,
        importados: resultado.creados + resultado.actualizados,
        creados: resultado.creados,
        actualizados: resultado.actualizados,
        existentes: resultado.existentes,
        duplicados: resultado.existentes,
        errores: resultado.errores,
        erroresDetalle: resultado.erroresDetalle,
        filas:[],
      })
      setLegacyRows([]); setLegacyInfo(''); setLegacyStatus('')
      if (legacyInputRef.current) legacyInputRef.current.value = ''
    } catch(e) {
      setLegacyError(e.message || 'Error al importar. Intente de nuevo.')
    } finally {
      setCargandoLegacy(false)
    }
  }

  function descargarFormato() {
    const wb = XLSX.utils.book_new()
    const HDR = ['FECHA','CAMPAÑA','DISTRITO','N2','N1','TIPIF. BACK','COMENTARIO','TIPIFICACIÓN','HORA','ASESOR 1','ASESOR 2','ASESOR 3','ASESOR 4','ASESOR 5','ASESOR 6']
    const COLS = HDR.map((_,i)=>({ wch: i===0?13 : i===4||i===3?15 : i>=9?13 : i===8?10 : 18 }))
    // Hoja 1: plantilla vacía — solo encabezados
    const ws1 = XLSX.utils.aoa_to_sheet([HDR])
    ws1['!cols'] = COLS
    ws1['!freeze'] = { xSplit: 0, ySplit: 1 }
    ws1['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(HDR.length-1)}1` }
    XLSX.utils.book_append_sheet(wb, ws1, 'CARGA SISTEMA ANTIGUO')
    // Hoja 2: datos de ejemplo ficticios con 4 fechas distintas
    const ws2 = XLSX.utils.aoa_to_sheet([
      HDR,
      ['01/08/2026','CAMP ADMI','SAN BORJA','987654320','987654321','NC','Llamó y cortó','CONTESTA','17:11','DERWIN PEREZ','LUCAS GOMEZ','','','',''],
      ['02/08/2026','CAMP ADMI','MIRAFLORES','','912345678','NO CONTESTA','','NO CONTESTA','09:30','MARIA RIOS','','','','',''],
      ['03/08/2026','NKT FIBRA','SURCO','976543211','976543210','BUZON DE VOZ','Sin respuesta','NO CONTESTA','11:45','CARLOS VEGA','PEDRO LUNA','','','',''],
      ['04/08/2026','NKT FIBRA','LA MOLINA','','945612378','NC','','CONTESTA','14:00','ANA TORRES','','','','',''],
    ])
    ws2['!cols'] = COLS
    ws2['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, ws2, 'EJEMPLO')
    // Hoja 3: instrucciones
    const INSTR = [
      ['INSTRUCCIONES — CARGA SISTEMA ANTIGUO'],
      [''],
      ['IMPORTANTE: No modifique el nombre ni el orden de las columnas.'],
      [''],
      ['Columna','Descripción','Obligatorio','Notas'],
      ['FECHA','Fecha del registro','SÍ (modo histórico)','Formato recomendado: DD/MM/YYYY — ej: 01/08/2026. También acepta YYYY-MM-DD.'],
      ['CAMPAÑA','Nombre de campaña','No','Texto libre'],
      ['DISTRITO','Distrito del contacto','No','Texto libre'],
      ['N2','Número secundario','No','Guardar como texto para conservar ceros iniciales'],
      ['N1','Número principal (teléfono)','SÍ','Guardar como texto para conservar ceros iniciales'],
      ['TIPIF. BACK','Tipificación del área Back Data','No','NC · BUZON DE VOZ · NO CONTESTA · DERIVADO'],
      ['COMENTARIO','Comentario libre','No','No se importa al sistema, solo referencia'],
      ['TIPIFICACIÓN','Tipificación del asesor/vendedor','No','CONTESTA · VENTA CERRADA · NC · etc.'],
      ['HORA','Hora de la última gestión','No','Formato HH:MM — ejemplo: 17:11'],
      ['ASESOR 1 … ASESOR 6','Historial de asesores','No','Nombre completo tal como aparece en el sistema'],
      [''],
      ['NOTAS ADICIONALES'],
      ['— FECHA es obligatoria cuando se usa el modo "Usar fecha del archivo" (modo predeterminado).'],
      ['— En modo "Usar una sola fecha para todo el archivo", la columna FECHA es ignorada.'],
      ['— Use la hoja "CARGA SISTEMA ANTIGUO" para pegar sus datos.'],
      ['— Use la hoja "EJEMPLO" como referencia: 4 registros en 4 fechas distintas.'],
      ['— N1 es el campo de teléfono principal y es siempre obligatorio.'],
      ['— Si un N1 ya existe en la misma fecha, la fila se omite como duplicado.'],
      ['— Un mismo N1 puede aparecer en fechas diferentes (no se considera duplicado).'],
      ['— Formatos de archivo aceptados: .xlsx · .csv (comas o punto y coma) · .txt'],
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(INSTR)
    ws3['!cols'] = [{ wch:26 },{ wch:36 },{ wch:20 },{ wch:60 }]
    ws3['!rows'] = [{ hpt:18 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'INSTRUCCIONES')
    XLSX.writeFile(wb, 'FORMATO_CARGA_SISTEMA_ANTIGUO.xlsx')
  }

  // ── BL Modal ──────────────────────────────────────────────────────────────
  function abrirBlModal(nombre, asesorId) {
    setBlModal({ open:true, nombre, asesorId })
    setBlFecha(fechaHoy())
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const registrosActivos = baseData[fechaActiva] || []
  const registrosFiltrados = (() => {
    const filtered = registrosActivos.filter(r => {
      if (filtros.tip    && !(r.tipifBack||'').toUpperCase().includes(filtros.tip.toUpperCase())) return false
      if (filtros.tipVend) {
        if (filtros.tipVend === '__pendiente__') {
          if ((r._tipifVend||'').trim() !== '') return false
        } else {
          if ((r._tipifVend||'').toUpperCase() !== filtros.tipVend.toUpperCase()) return false
        }
      }
      if (filtros.asesor && !(r.asesor||'').toUpperCase().includes(filtros.asesor.toUpperCase())) return false
      if (filtros.numero && !r.n1.includes(filtros.numero) && !(r.n2||'').includes(filtros.numero)) return false
      return true
    })
    if (!tableSort.col) return filtered
    return [...filtered].sort((a, b) => {
      if (tableSort.col === 'tipif') {
        const ta = (a._tipifVend || '').trim()
        const tb = (b._tipifVend || '').trim()
        if (!ta && !tb) return 0
        if (!ta) return 1
        if (!tb) return -1
        const cmp = ta.localeCompare(tb, 'es')
        return tableSort.dir === 'za' ? -cmp : cmp
      }
      if (tableSort.col === 'hora') {
        const ma = horaAMinutos(a.horaAsig)
        const mb = horaAMinutos(b.horaAsig)
        if (ma === -1 && mb === -1) return 0
        if (ma === -1) return 1
        if (mb === -1) return -1
        return tableSort.dir === 'desc' ? mb - ma : ma - mb
      }
      if (tableSort.col === 'rots') {
        const ra = parseInt(String(a.rotaciones ?? 0).replace(/x/gi, ''), 10) || 0
        const rb = parseInt(String(b.rotaciones ?? 0).replace(/x/gi, ''), 10) || 0
        return tableSort.dir === 'asc' ? ra - rb : rb - ra
      }
      return 0
    })
  })()

  const statsBase = {
    total:      registrosActivos.length,
    ventas:     registrosActivos.filter(r=>(r.tipifBack||'').toUpperCase().includes('VENTA')).length,
    asignados:  registrosActivos.filter(r=>r.asesor&&r.asesor!=='').length,
    sinAsignar: registrosActivos.filter(r=>r.sinAsignar).length,
    rotaciones: registrosActivos.reduce((s,r)=>s+r.rotaciones,0),
  }

  const rendData = useMemo(() => {
    const mesActual = fechaHoy().slice(0,7)
    let todosReg = []
    for (const f in baseData) {
      if (rendFiltroTipo==='mes'   && !f.startsWith(mesActual))           continue
      if (rendFiltroTipo==='dia'   && f!==rendFiltroFecha)                continue
      if (rendFiltroTipo==='rango' && rendDesde && f < rendDesde)         continue
      if (rendFiltroTipo==='rango' && rendHasta && f > rendHasta)         continue
      todosReg = todosReg.concat(baseData[f])
    }
    const data = asesores.map(a => {
      const regs    = todosReg.filter(r=>(r.asesor||'').trim().toLowerCase()===(a.nombre||'').trim().toLowerCase())
      const leads   = regs.length
      const contesta= regs.filter(r=>['CONTESTA','VENTA CERRADA','PREVENTA','AGENDADO'].includes((r._tipifVend||'').toUpperCase())).length
      const nc      = regs.filter(r=>['NC','NO CONTESTA','BUZON DE VOZ'].includes((r._tipifVend||'').toUpperCase())).length
      const ventas  = regs.filter(r=>(r._tipifVend||'').toUpperCase()==='VENTA CERRADA').length
      const conv    = leads ? Math.round(ventas/leads*100) : 0
      return { nombre:a.nombre, usuario:a.usuario||'', leads, contesta, nc, ventas, conv }
    })
    const sortMap = { 'ventas_desc':(a,b)=>b.ventas-a.ventas,'ventas_asc':(a,b)=>a.ventas-b.ventas,'conv_desc':(a,b)=>b.conv-a.conv,'leads_desc':(a,b)=>b.leads-a.leads,'contesta_desc':(a,b)=>b.contesta-a.contesta,'nc_desc':(a,b)=>b.nc-a.nc }
    data.sort(sortMap[rendOrden] || sortMap['ventas_desc'])
    return data
  }, [baseData, asesores, rendFiltroTipo, rendFiltroFecha, rendDesde, rendHasta, rendOrden])

  const rendTotLeads  = rendData.reduce((s,r)=>s+r.leads,0)
  const rendTotVentas = rendData.reduce((s,r)=>s+r.ventas,0)
  const rendTotConv   = rendTotLeads ? Math.round(rendTotVentas/rendTotLeads*100) : 0
  const rendMaxVentas = Math.max(...rendData.map(r=>r.ventas), 1)

  const allRotLeadsRaw = rotPanelOpen ? buildRotLeads() : []
  const rotTipifsDisp  = [...new Set(allRotLeadsRaw.map(l=>l.estado||'NUEVO'))].sort()
  const allRotLeads    = rotFiltroTipif ? allRotLeadsRaw.filter(l=>(l.estado||'NUEVO')===rotFiltroTipif) : allRotLeadsRaw
  const rotStatAptos   = allRotLeads.filter(l=>rotApto(l,rotAsesor).apto).length
  const rotStatNoAptos = allRotLeads.length - rotStatAptos
  const rotAptos       = allRotLeads.filter(l=>rotApto(l,rotAsesor).apto)
  const allAptosSelected = rotAptos.length > 0 && rotAptos.every(l=>rotSel[l.id])
  const rotFechasDisp  = Object.keys(baseData).filter(f=>(baseData[f]||[]).length>0).sort().reverse()
  const rotAsesoresDisp= asesores.map(a=>({ nombre:a.nombre, cnt:Object.values(baseData).flat().filter(r=>r.asesor===a.nombre).length }))
  const masivaFilasParaCargar = inclDup ? masivaFilas : masivaFilas.filter(f=>!f.dup)
  const masivaNDup    = masivaFilas.filter(f=>f.dup).length
  const masivaFilasCnt= masivaFilas.length
  const avanceFiltrado= asesores.filter(a => !avanceBuscar || a.nombre.toLowerCase().includes(avanceBuscar.toLowerCase()) || (a.usuario||'').toLowerCase().includes(avanceBuscar.toLowerCase()))

  const idx      = fechaPestanas.indexOf(fechaActiva)
  const prevDis  = idx >= fechaPestanas.length - 1
  const nextDis  = idx <= 0

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="bo-root">
      {/* TOPBAR */}
      <div className="topbar module-topbar-standard">
        <div className="bo-topbar-left">
          <div className="brand">
            <div className="logo-circle"><img src="/assets/logo3.png" alt="KRONO" /></div>
            <div className="brand-text">
              <img src="/assets/krono-wordmark.png" alt="KRONO" style={{height:22,width:"auto",display:"block"}} />
              <span className="brand-sub">Back Data</span>
            </div>
          </div>
          <button
            type="button"
            className={`bo-sidebar-toggle${sidebarAbierto ? ' abierto' : ''}`}
            aria-label={sidebarAbierto ? 'Ocultar menú' : 'Mostrar menú'}
            title={sidebarAbierto ? 'Ocultar menú' : 'Mostrar menú'}
            onClick={() => setSidebarAbierto(valor => {
              const nuevo = !valor
              sessionStorage.setItem('nc_backoffice_sidebar', nuevo ? 'abierto' : 'cerrado')
              return nuevo
            })}
          >
            <svg viewBox="0 0 18 18" aria-hidden="true"><rect x="2.5" y="2.5" width="13" height="13" rx="2.5"/><path d="M7 3v12"/></svg>
          </button>
        </div>
        <div className="topbar-right">
          <JefaturaViewControls><span className="bo-usuario">{sesion?.nombre || 'Back Data'}</span></JefaturaViewControls>
          <CambiarAreaMenu />
          <a href="#" className="bo-salir" onClick={e=>{ e.preventDefault(); logout(); navigate('/') }}>Salir</a>
        </div>
      </div>

      <div className={`bo-layout${sidebarAbierto ? '' : ' sidebar-cerrado'}`}>
        {/* SIDEBAR */}
        <aside className={`bo-sidebar${sidebarAbierto ? '' : ' cerrado'}`} aria-hidden={!sidebarAbierto}>
          <div className="sidebar-sep">Principal</div>
          <button className={`bo-nav${seccion==='base'?' active':''}`} onClick={()=>irSeccion('base')}><BoNavIcon tipo="base" /> <span>Base</span></button>
          <button className={`bo-nav${seccion==='carga-masiva'?' active':''}`} onClick={()=>irSeccion('carga-masiva')}><BoNavIcon tipo="carga" /> <span>Carga Masiva</span></button>
          <div className="sidebar-sep">Reportes</div>
          <button className={`bo-nav${seccion==='rendimiento'?' active':''}`} onClick={()=>irSeccion('rendimiento')}><BoNavIcon tipo="rendimiento" /> <span>Rendimiento</span></button>
          <button className={`bo-nav${seccion==='avance'?' active':''}`} onClick={()=>irSeccion('avance')}><BoNavIcon tipo="avance" /> <span>Avance Asesores</span></button>
        </aside>

        <main className="bo-main">

          {/* ══ SECCIÓN: BASE ══════════════════════════════════════════════════ */}
          <section className={`bo-seccion${seccion==='base'?'':' hidden'}`}>
            <div className="bo-seccion-header">
              <div>
                <h2>Base de Llamadas</h2>
                <p className="bo-sub">Gestiona y asigna contactos. La tipificación del vendedor se actualiza automáticamente.</p>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <span style={{fontSize:12,color:'#9ca3af',fontWeight:600}}>{statsBase.total} registros</span>
                <button className={`btn-rot-toggle${rotPanelOpen?' abierto':''}`} onClick={()=>setRotPanelOpen(v=>!v)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  Rotación inteligente
                </button>
              </div>
            </div>

            {/* PANEL ROTACIÓN */}
            {rotPanelOpen && (
              <div style={{marginBottom:14}}>
                <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:14,overflow:'hidden',boxShadow:'0 1px 6px rgba(0,0,0,.05)'}}>
                  <div style={{background:'#111827',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{color:'#fff',fontSize:13,fontWeight:600}}>Rotación Inteligente de Leads</span>
                    <button onClick={()=>setRotPanelOpen(false)} style={{background:'rgba(255,255,255,.15)',border:'none',color:'#fff',padding:'3px 10px',borderRadius:6,cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>Cerrar ✕</button>
                  </div>
                  <div style={{padding:'14px 16px'}}>
                    <div className="rot-header-stats" style={{marginBottom:14}}>
                      <div className="rot-stat"><div className="rot-stat-num">{allRotLeads.length}</div><div className="rot-stat-label">Leads totales</div></div>
                      <div className="rot-stat"><div className="rot-stat-num green">{rotStatAptos}</div><div className="rot-stat-label">Aptos para rotar</div></div>
                      <div className="rot-stat"><div className="rot-stat-num red">{rotStatNoAptos}</div><div className="rot-stat-label">No aptos</div></div>
                      <div className="rot-stat"><div className="rot-stat-num purple">{rotRotados}</div><div className="rot-stat-label">Rotados hoy</div></div>
                    </div>
                    <div className="rot-grid" style={{marginBottom:14}}>
                      <div className="bo-panel" style={{padding:'14px 16px'}}>
                        <div className="bo-panel-title">Reglas de rotación</div>
                        <div className="rot-regla"><div className="rot-regla-icon r-red">✕</div><div><strong>Sin repetir:</strong> el lead no puede ir a un asesor que ya lo tuvo</div></div>
                        <div className="rot-regla"><div className="rot-regla-icon r-blue">T</div><div><strong>Mínimo 2h</strong> sin ser contactado para rotar</div></div>
                        <div className="rot-regla"><div className="rot-regla-icon r-green">✓</div><div><strong>Estado válido:</strong> Buzón, No contesta o Nuevo</div></div>
                        <div className="rot-regla"><div className="rot-regla-icon r-red">!</div><div><strong>Números prohibidos:</strong> NO TOCAR y FRAUDE nunca se asignan ni rotan</div></div>
                        <div className="rot-regla"><div className="rot-regla-icon r-purple">#</div><div><strong>Máximo 4 leads</strong> por rotación a un mismo asesor</div></div>
                      </div>
                      <div className="bo-panel rot-asesor-panel">
                        <div className="bo-panel-title">Disponibilidad de asesores</div>
                        <div className="rot-asesor-lista">
                          <div className="rot-asesor-col-hdr" aria-hidden="true">
                            <span>Asesor</span><span>Registros</span>
                          </div>
                          {rotAsesoresDisp.map(a=>(
                            <div key={a.nombre} className="rot-asesor-row">
                              <span className="rot-asesor-nombre" title={a.nombre}>{a.nombre}</span>
                              <span className="rot-asesor-badge">{a.cnt} registros</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="rot-form" style={{marginBottom:12}}>
                      <div className="rot-form-title">Rotar leads a un asesor</div>
                      <div className="rot-form-row">
                        <select value={rotAsesor} onChange={e=>{ setRotAsesor(e.target.value); setRotSel({}) }}>
                          <option value="">-- Seleccionar asesor destino --</option>
                          {asesores.map(a=><option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                        </select>
                        <input type="number" value={rotCant} min={1} max={4} onChange={e=>setRotCant(parseInt(e.target.value)||4)} style={{width:60}} />
                        <span style={{fontSize:12,color:'#888'}}>leads máx.</span>
                        <button className="btn-rotar-masivo" onClick={rotEjecutar} disabled={!rotAsesor || rotProgress>0}>
                          {rotProgress>0 ? 'Rotando...' : 'Rotar ahora'}
                        </button>
                      </div>
                      <div className="rot-progress"><div className="rot-progress-fill" style={{width:`${rotProgress}%`}} /></div>
                    </div>
                    {rotResultado.length > 0 && (
                      <div className="rot-resultado show" style={{marginBottom:12}}>
                        <div className="rot-resultado-title">Rotación ejecutada</div>
                        {rotResultado.map((r,i)=>(
                          <div key={i} className="rot-res-item"><div className="rot-res-dot" /><strong>{r.tel}</strong> → <strong>{r.asesor}</strong> · {r.hora}</div>
                        ))}
                      </div>
                    )}
                    <div className="rot-table-wrap">
                      <div className="rot-table-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          Leads disponibles <span className="tag-aptos">{rotStatAptos} aptos</span>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <label style={{fontSize:11,color:'#6b7280',fontWeight:600}}>Fecha:</label>
                          <select value={rotFiltroFecha} onChange={e=>{ setRotFiltroFecha(e.target.value); setRotSel({}) }} style={{padding:'5px 10px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12,fontFamily:'inherit',outline:'none',background:'#fff',cursor:'pointer'}}>
                            <option value="">Todas las fechas</option>
                            {rotFechasDisp.map(f=><option key={f} value={f}>{formatFecha(f)} ({(baseData[f]||[]).length})</option>)}
                          </select>
                          <label style={{fontSize:11,color:'#6b7280',fontWeight:600}}>Tipificación:</label>
                          <select value={rotFiltroTipif} onChange={e=>{ setRotFiltroTipif(e.target.value); setRotSel({}) }} style={{padding:'5px 10px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12,fontFamily:'inherit',outline:'none',background:'#fff',cursor:'pointer'}}>
                            <option value="">Todas</option>
                            {rotTipifsDisp.map(t=><option key={t} value={t}>{t}</option>)}
                          </select>
                          <button onClick={()=>{ setRotFiltroFecha(''); setRotFiltroTipif(''); setRotSel({}) }} style={{padding:'5px 10px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',color:'#6b7280',fontSize:11,fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>Limpiar</button>
                        </div>
                      </div>
                      <div className="rot-table">
                        <table>
                          <thead><tr>
                            <th>
                              <input type="checkbox" checked={allAptosSelected} onChange={e=>{ if(e.target.checked){const ns={};rotAptos.slice(0,rotCant).forEach(l=>{ns[l.id]=true});setRotSel(ns);}else setRotSel({}) }} />
                            </th>
                            <th>N1 / Campaña</th><th>Fecha</th><th>Tipificación</th>
                            <th>Asesor actual</th><th>Hora asig.</th><th>Tiempo</th>
                            <th>Sin repetir</th><th>Aptitud</th>
                          </tr></thead>
                          <tbody>
                            {allRotLeads.length === 0
                              ? <tr><td colSpan={9} className="bo-empty">Sin leads.</td></tr>
                              : allRotLeads.map(l => {
                                  const { apto, prohibido, sinRepetir, tiempo } = rotApto(l, rotAsesor)
                                  const mins = rotMins(l.ultimaAsig)
                                  const esFechaHoy = l.fecha === fechaHoy()
                                  return (
                                    <tr key={l.id} className={(prohibido||(!apto&&rotAsesor))?'row-noapto':''}>
                                      <td><input type="checkbox" checked={!!rotSel[l.id]} disabled={prohibido||(!apto&&!!rotAsesor)} onChange={e=>rotToggleSel(l.id,e.target.checked)} /></td>
                                      <td><div style={{fontFamily:'monospace',fontWeight:700,color:'#111827',fontSize:12}}>{l.tel}</div><div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>{l.campana} · {l.n2||'—'}</div></td>
                                      <td>{esFechaHoy ? <span style={{background:'#dcfce7',color:'#166534',fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99}}>HOY</span> : <span style={{background:'#f3f4f6',color:'#6b7280',fontSize:9,padding:'1px 6px',borderRadius:99}}>{formatFecha(l.fecha)}</span>}</td>
                                      <td><span className={`tipif-badge ${tipifBadgeClass(l.estado)}`}>{l.estado||'NUEVO'}</span></td>
                                      <td style={{fontSize:12}}>{l.asesor||'—'}{l.histAsesores.length>0&&<div style={{fontSize:9,color:'#9ca3af',marginTop:1}} title={l.histAsesores.join(' → ')}>Tuvo: {l.histAsesores.join(', ')}</div>}</td>
                                      <td className="hora-color">{l.ultimaAsig.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td>
                                      <td className={!rotAsesor?'':tiempo?'timer-ok':'timer-fail'}>{tiempo!==false?`Hace ${rotTxt(l.ultimaAsig)}`:rotFaltanTxt(mins)}</td>
                                      <td>{!rotAsesor?'—':sinRepetir?<span className="check-ok">OK</span>:<span className="check-fail">Ya tuvo</span>}</td>
                                      <td>{!rotAsesor?'—':apto?<span className="badge-apto">Apto</span>:<span className="badge-noapto">No apto</span>}</td>
                                    </tr>
                                  )
                                })
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ESTADÍSTICAS */}
            <div className="base-stats">
              <div className="base-stat"><div className="base-stat-num">{statsBase.total}</div><div className="base-stat-label">Total</div></div>
              <div className="base-stat"><div className="base-stat-num green">{statsBase.ventas}</div><div className="base-stat-label">Ventas</div></div>
              <div className="base-stat"><div className="base-stat-num blue">{statsBase.asignados}</div><div className="base-stat-label">Asignados</div></div>
              <div className="base-stat"><div className="base-stat-num orange">{statsBase.sinAsignar}</div><div className="base-stat-label">Sin asignar</div></div>
              <div className="base-stat"><div className="base-stat-num purple">{statsBase.rotaciones}</div><div className="base-stat-label">Rotaciones</div></div>
            </div>

            {/* NAVEGADOR DE FECHA */}
            <div className="fecha-nav-row">
              <span style={{fontSize:11,fontWeight:600,color:'#6b7280',textTransform:'uppercase',letterSpacing:.4,whiteSpace:'nowrap'}}>Fecha activa:</span>
              <div className="fecha-nav-ctrl">
                <button className="fnav-btn" onClick={()=>navegarFecha(-1)} disabled={prevDis}>←</button>
                <select className="fnav-select" value={fechaActiva} onChange={e=>setFechaActiva(e.target.value)}>
                  {fechaPestanas.map(f=><option key={f} value={f}>{formatFecha(f)} ({(baseData[f]||[]).length})</option>)}
                </select>
                <button className="fnav-btn" onClick={()=>navegarFecha(1)} disabled={nextDis}>→</button>
              </div>
              <span className="fnav-count">{idx+1} / {fechaPestanas.length}</span>
              <div className="fecha-add-wrap">
                <input type="date" value={calPicker} onChange={e=>setCalPicker(e.target.value)} className="fecha-add-input" />
                <button className="fecha-add-btn" onClick={agregarFechaCalendario}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Agregar fecha
                </button>
              </div>
            </div>

            {/* FILTROS EN UNA SOLA FILA, DEBAJO DE LAS FECHAS */}
            <div className="base-filtros">
              <div className="bo-input-group"><label>Tipificación back</label>
                <select className="form-select" value={filtros.tip} onChange={e=>setFiltros(p=>({...p,tip:e.target.value}))}>
                  <option value="">Todas</option>
                  {TIPIF_BACK_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="bo-input-group"><label>Tipif. vendedor</label>
                <select className="form-select" value={filtros.tipVend} onChange={e=>setFiltros(p=>({...p,tipVend:e.target.value}))}>
                  <option value="">Todas</option>
                  <option value="__pendiente__">Pendiente</option>
                  {TIPIF_VEND_OPCIONES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="bo-input-group"><label>Asesor</label>
                <select className="form-select" value={filtros.asesor} onChange={e=>setFiltros(p=>({...p,asesor:e.target.value}))}>
                  <option value="">Todos</option>
                  {asesores.map(a=><option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                </select>
              </div>
              <div className="bo-input-group base-filtro-numero"><label>Número</label>
                <input className="form-control" value={filtros.numero} onChange={e=>setFiltros(p=>({...p,numero:e.target.value}))} placeholder="Buscar N1 o N2..." />
              </div>
              <label className="toggle-col base-filtro-toggle">
                <input type="checkbox" checked={filtros.verTipVend} onChange={e=>setFiltros(p=>({...p,verTipVend:e.target.checked}))} />
                <span>Ver tipif. vendedor</span>
              </label>
              <button className="bo-btn-limpiar btn btn-sm base-filtro-limpiar" onClick={()=>setFiltros({tip:'',tipVend:'',asesor:'',numero:'',verTipVend:true})}>Limpiar filtros</button>
            </div>

            {/* FORMULARIO AGREGAR INDIVIDUAL */}
            <div className="bo-panel" style={{marginBottom:14}}>
              <div className="bo-panel-title">
                + Agregar registro individual —&nbsp;
                <span style={{fontSize:10,color:'#374151',fontWeight:600,textTransform:'none',letterSpacing:0}}>{formatFecha(fechaActiva)}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
                <div className="bo-input-group"><label>Campaña</label><CampanaSelect value={form.campana} onChange={v=>setForm(p=>({...p,campana:v}))} /></div>
                <div className="bo-input-group"><label>Departamento</label>
                  <select className="form-select" value={form.dpto} onChange={e=>setForm(p=>({...p,dpto:e.target.value,prov:'',distrito:''}))}>
                    <option value="">— Seleccionar —</option>
                    {dptos.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="bo-input-group"><label>Provincia</label>
                  <select className="form-select" value={form.prov} onChange={e=>setForm(p=>({...p,prov:e.target.value,distrito:''}))}>
                    <option value="">— Seleccionar —</option>
                    {provs.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="bo-input-group"><label>Distrito</label>
                  <select className="form-select" value={form.distrito} onChange={e=>setForm(p=>({...p,distrito:e.target.value}))}>
                    <option value="">— Seleccionar —</option>
                    {distritos.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="bo-input-group"><label>N1 *</label><input className={`form-control${n1Error?' obligatorio-error':''}`} value={form.n1} onChange={e=>{ setN1Error(false); setForm(p=>({...p,n1:e.target.value})) }} placeholder="Número principal" style={{fontFamily:'monospace'}} /></div>
                <div className="bo-input-group"><label>N2 (opcional)</label><input className="form-control" value={form.n2} onChange={e=>setForm(p=>({...p,n2:e.target.value}))} placeholder="Número secundario" style={{fontFamily:'monospace'}} /></div>
                <div className="bo-input-group"><label>Tipo de contacto</label>
                  <select className="form-select" value={form.tipoContacto} onChange={e=>setForm(p=>({...p,tipoContacto:e.target.value}))}>
                    <option value="LLAMADA">Llamada normal</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                </div>
                <div className="bo-input-group"><label>Dirección</label><input className="form-control" value={form.direccion} onChange={e=>setForm(p=>({...p,direccion:e.target.value}))} placeholder="Dirección del cliente" /></div>
                <div className="bo-input-group"><label>Coordenadas</label><input className="form-control" value={form.coordenadas} onChange={e=>setForm(p=>({...p,coordenadas:e.target.value}))} placeholder="Latitud, longitud" /></div>
                <div className="bo-input-group"><label>Observación Back</label><input className="form-control" value={form.obsBack} onChange={e=>setForm(p=>({...p,obsBack:e.target.value}))} placeholder="Información para el asesor" maxLength={2000} /></div>
                <div className="bo-input-group"><label>Tipif. Back</label>
                  <select className="form-select" value={form.tipifBack} onChange={e=>setForm(p=>({...p,tipifBack:e.target.value}))}>
                    <option value="">— Sin tipificación —</option>
                    {TIPIF_BACK_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="bo-input-group"><label>Asesor</label>
                  <select className="form-select" value={form.asesor} onChange={e=>setForm(p=>({...p,asesor:e.target.value}))}>
                    <option value="">— Sin asignar —</option>
                    {asesores.map(a=><option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button className="bo-btn-limpiar btn btn-sm" onClick={()=>setForm({campana:'',dpto:'',prov:'',distrito:'',n1:'',n2:'',tipoContacto:'LLAMADA',direccion:'',coordenadas:'',obsBack:'',tipifBack:'',asesor:''})}>Limpiar</button>
                <button className="bo-btn-agregar" onClick={agregarRegistro}>+ Agregar registro</button>
              </div>
            </div>

            {/* TABLA BASE — diseño compacto sin scroll horizontal */}
            <div className="base-tabla-wrap">
              <table className="base-tabla" style={{tableLayout:'fixed',width:'100%',minWidth:880}}>
                <colgroup>
                  <col style={{width:34}} />
                  <col style={{width:78}} />
                  <col style={{width:128}} />
                  <col style={{width:82}} />
                  <col style={{width:118}} />
                  <col style={{width:140}} />
                  <col style={{width:128}} />
                  <col style={{width:52}} />
                  <col style={{width:44}} />
                  <col style={{width:112}} />
                </colgroup>
                <thead>
                  <tr>
                    <th>#</th><th>Campaña</th><th>N1 / N2</th>
                    <th>Contacto</th><th>Tipif. Back</th>
                    <th>Asesor asignado</th>
                    <th>
                      <button type="button" className={`th-sort-btn${tableSort.col==='tipif'?' th-sort-active':''}`}
                        onClick={()=>cycleSort('tipif')} title="Ordenar tipificación" aria-label="Ordenar tipificación alfabéticamente"
                        aria-sort={tableSort.col==='tipif'?(tableSort.dir==='az'?'ascending':tableSort.dir==='za'?'descending':'none'):'none'}>
                        Tipif. Vendedor<SortIcon active={tableSort.col==='tipif'} direction={tableSort.col==='tipif'?(tableSort.dir==='az'?'down':tableSort.dir==='za'?'up':null):null}/>
                      </button>
                    </th>
                    <th>
                      <button type="button" className={`th-sort-btn${tableSort.col==='hora'?' th-sort-active':''}`}
                        onClick={()=>cycleSort('hora')} title="Ordenar por hora" aria-label="Ordenar por hora"
                        aria-sort={tableSort.col==='hora'?(tableSort.dir==='asc'?'ascending':'descending'):'none'}>
                        Hora<SortIcon active={tableSort.col==='hora'} direction={tableSort.col==='hora'?(tableSort.dir==='desc'?'down':'up'):null}/>
                      </button>
                    </th>
                    <th>
                      <button type="button" className={`th-sort-btn${tableSort.col==='rots'?' th-sort-active':''}`}
                        onClick={()=>cycleSort('rots')} title="Ordenar por rotaciones" aria-label="Ordenar por cantidad de rotaciones"
                        aria-sort={tableSort.col==='rots'?(tableSort.dir==='asc'?'ascending':'descending'):'none'}>
                        Rots.<SortIcon active={tableSort.col==='rots'} direction={tableSort.col==='rots'?(tableSort.dir==='asc'?'up':'down'):null}/>
                      </button>
                    </th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.length === 0
                    ? <tr><td colSpan={10} className="bo-empty">Sin registros en {formatFecha(fechaActiva)}.</td></tr>
                    : registrosFiltrados.map((r,i) => {
                        const esExclusiva = r._tipifVend==='NO TOCAR'||r._tipifVend==='FRAUDE'
                        const detAbierto  = !!detOpen[r.id]
                        return [
                          <tr key={r.id} id={`fila-${r.id}`}>
                            {/* # */}
                            <td style={{color:'#9ca3af',fontSize:10,textAlign:'center'}}>{i+1}</td>

                            {/* Campaña */}
                            <td style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.campana}>
                              <strong style={{fontSize:11}}>{r.campana}</strong>
                            </td>

                            {/* N1 / N2 combinados */}
                            <td>
                              <div className="num-cell">
                                <div className="num-primary">
                                  <span>{r.n1}</span>
                                  <button type="button" className="num-copy-btn" onClick={()=>copiarNumero(r.n1)} title="Copiar N1"><CopyIcon /></button>
                                </div>
                                {r.n2 && (
                                  <div className="num-secondary">
                                    <span>{r.n2}</span>
                                    <button type="button" className="num-copy-btn" onClick={()=>copiarNumero(r.n2)} title="Copiar N2"><CopyIcon /></button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Contacto */}
                            <td>
                              <select className="bo-sel-compact" value={r.tipo_contacto||'LLAMADA'} onChange={e=>guardarDatosBack(r.id,{tipo_contacto:e.target.value})}>
                                <option value="LLAMADA">Llamada</option>
                                <option value="WHATSAPP">WhatsApp</option>
                              </select>
                            </td>

                            {/* Tipif. Back */}
                            <td>
                              <select className="bo-sel-compact" value={r.tipifBack} onChange={e=>guardarTipifBack(r.id,e.target.value)}>
                                <option value="">— Sin tipif. —</option>
                                {TIPIF_BACK_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
                              </select>
                              {r.tipifBack==='DERIVADO'&&r.derivadoPor&&<small style={{display:'block',fontSize:9,color:'#6b7280',fontWeight:700,marginTop:1}}>Por: {r.derivadoPor}</small>}
                            </td>

                            {/* Asesor asignado */}
                            <td>
                              <AsesorBuscador value={r.asesor} asesores={asesores} disabled={esExclusiva}
                                title={esExclusiva?`Prohibido: ${r._tipifVend}`:''}
                                onChange={v=>reasignarReg(r.id,v)} />
                              {r.sinAsignar&&r.asesor&&<span style={{display:'block',fontSize:9,color:'#6b7280',fontWeight:600,marginTop:1}}>histórico</span>}
                              {r.sinAsignar&&!r.asesor&&<span style={{display:'block',fontSize:9,color:'#c2410c',fontWeight:700,marginTop:1}}>sin asig.</span>}
                            </td>

                            {/* Tipif. Vendedor */}
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:2}}>
                                <select className="bo-sel-compact sel-tipif-vend" value={r._tipifVend} onChange={e=>guardarTipif(r.id,e.target.value)}
                                  style={estiloTipifVend(r._tipifVend)}>
                                  <option value="" style={{background:'#fff',color:'#111827',fontWeight:400}}>— Pendiente —</option>
                                  {TIPIF_VEND_OPCIONES.map(t=><option key={t} value={t} style={{background:'#fff',color:'#111827',fontWeight:400}}>{t}</option>)}
                                </select>
                                {r._tipifVend==='VENTA CERRADA'&&extraerDni(r.obsAsesor)&&(
                                  <button type="button" className="btn-dni-cuaderno"
                                    title="Ver DNI de cierre"
                                    onClick={e=>{
                                      const rect=e.currentTarget.getBoundingClientRect()
                                      setDniModal(prev=>prev&&prev.id===r.id?null:{id:r.id,bid:r._backendId,dni:extraerDni(r.obsAsesor),top:rect.bottom+6,left:rect.left})
                                    }}>
                                    <NotebookIcon/>
                                  </button>
                                )}
                              </div>
                              {r._tipifHora&&<span style={{display:'block',fontSize:9,color:'#9ca3af',marginTop:1}}>{r._tipifHora}</span>}
                            </td>

                            {/* Hora */}
                            <td style={{textAlign:'center'}}>
                              {r.horaAsig?<span className="hora-cell">{r.horaAsig}</span>:<span style={{color:'#d1d5db'}}>—</span>}
                            </td>

                            {/* Rotaciones */}
                            <td style={{textAlign:'center'}}>
                              {r.rotaciones>0
                                ?<span style={{background:'#EDE9FE',color:'#4C1D95',fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:99,display:'inline-block'}}>{r.rotaciones}x</span>
                                :<span style={{color:'#d1d5db',fontSize:10}}>0</span>}
                            </td>

                            {/* Acciones */}
                            <td>
                              <div className="acc-cell-compact">
                                <button className="btn-acc-det" onClick={()=>setDetOpen(p=>({...p,[r.id]:!p[r.id]}))}
                                  title={detAbierto?'Ocultar detalles':'Ver detalles'} aria-label="Detalles">
                                  {detAbierto?'▲':'⋯'}
                                </button>
                                <button className="btn-rotar btn-rotar-sm" disabled={esExclusiva}
                                  title={esExclusiva?`Prohibido: ${r._tipifVend}`:'Rotar'} onClick={()=>abrirModalRotar(r.id)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                </button>
                                <button className="btn-hist btn-hist-sm" onClick={()=>setHistOpen(p=>({...p,[r.id]:!p[r.id]}))} title="Historial">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                </button>
                                <button className="btn-del" onClick={()=>eliminarReg(r.id)} title="Eliminar">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                </button>
                              </div>
                            </td>
                          </tr>,

                          /* Fila expandible: Detalles secundarios */
                          <tr key={`det-${r.id}`} className={`detalles-row${detAbierto?' open':''}`}>
                            <td colSpan={10}>
                              <div className="detalles-inner">
                                <div className="det-campo det-distrito">
                                  <label>Distrito</label>
                                  <input defaultValue={r.distrito||''} onBlur={e=>guardarDatosBack(r.id,{distrito:e.target.value.trim()})} placeholder="Distrito" maxLength={100}/>
                                </div>
                                <div className="det-campo">
                                  <label>Dirección</label>
                                  <input defaultValue={r.direccion||''} onBlur={e=>guardarDatosBack(r.id,{direccion:e.target.value.trim()})} placeholder="Dirección" maxLength={1000}/>
                                </div>
                                <div className="det-campo det-coord">
                                  <label>Coordenadas</label>
                                  <input defaultValue={r.coordenadas||''} onBlur={e=>guardarDatosBack(r.id,{coordenadas:e.target.value.trim()})} placeholder="Coordenadas" maxLength={255}/>
                                </div>
                                <div className="det-campo det-obs">
                                  <label>Obs. Back</label>
                                  <input defaultValue={r.obs_back||''} onBlur={e=>guardarDatosBack(r.id,{obs_back:e.target.value.trim()})} placeholder="Observación para asesor" maxLength={2000}/>
                                </div>
                              </div>
                            </td>
                          </tr>,

                          /* Fila expandible: Historial */
                          <tr key={`hist-${r.id}`} className={`historial-row${histOpen[r.id]?' open':''}`}>
                            <td colSpan={10}>
                              <div className="historial-inner">
                                <div className="hist-label">Historial de asignaciones — N1: {r.n1}</div>
                                {r.historial.length
                                  ? r.historial.map((h,hi)=>(
                                      <div key={hi} className="hist-item">
                                        <div className="hist-dot" style={{background:DOT_COLORS[hi%DOT_COLORS.length]}} />
                                        <div className="hist-content">
                                          <div className="hist-title">
                                            {(h.tipo==='ROTACION' || h.asesorAnterior)
                                              ? <><strong>{h.asesorAnterior||'?'}</strong><span className="hist-arrow"> → </span><strong>{h.asesor}</strong></>
                                              : <strong>{h.asesor||'—'}</strong>
                                            }
                                          </div>
                                          <div className="hist-meta">{h.hora}{h.hora&&h.fecha?' · ':''}{h.fecha}</div>
                                          {h.motivo && <div className="hist-sub">{h.motivo}</div>}
                                          {h.tipif_vend && <div className="hist-sub" style={{color:'#065f46',fontWeight:700}}>{h.tipif_vend}</div>}
                                          {h.rotadoPor && <div className="hist-sub">Rotado por: {h.rotadoPor}</div>}
                                          {h.reasignadoPor && <div className="hist-sub">Reasignado por: {h.reasignadoPor}</div>}
                                          {h.tipo==='ROTACION'&&h.tipifBackAntes && <div className="hist-sub">Estado anterior: {h.tipifBackAntes}</div>}
                                          {h.tipo==='TIPIF_BACK' && <div className="hist-sub">{h.tipifBackAntes||'—'} → {h.tipifBackNueva||'—'}</div>}
                                          {h.tipo==='DERIVADO'&&h.derivadoPor && <div className="hist-sub">Por: {h.derivadoPor}</div>}
                                        </div>
                                      </div>
                                    ))
                                  : <div style={{fontSize:11,color:'#ccc'}}>Sin historial.</div>
                                }
                              </div>
                            </td>
                          </tr>
                        ]
                      })
                  }
                </tbody>
              </table>
            </div>
          </section>

          {/* ══ SECCIÓN: CARGA MASIVA ══════════════════════════════════════════ */}
          <section className={`bo-seccion${seccion==='carga-masiva'?'':' hidden'}`}>
            <div className="bo-seccion-header">
              <div>
                <h2>Carga Masiva de Base</h2>
                <p className="bo-sub">Pega números directamente · importa CSV/TXT/XLSX · o usa tu sistema antiguo</p>
              </div>
            </div>

            {/* Date nav carga masiva */}
            <div className="fecha-nav-row" style={{marginBottom:16}}>
              <span style={{fontSize:11,fontWeight:600,color:'#6b7280',textTransform:'uppercase',letterSpacing:.4,whiteSpace:'nowrap'}}>Fecha destino:</span>
              <div className="fecha-nav-ctrl">
                <button className="fnav-btn" onClick={()=>navegarFecha(-1)} disabled={prevDis}>←</button>
                <select className="fnav-select" value={fechaActiva} onChange={e=>setFechaActiva(e.target.value)}>
                  {fechaPestanas.map(f=><option key={f} value={f}>{formatFecha(f)} ({(baseData[f]||[]).length})</option>)}
                </select>
                <button className="fnav-btn" onClick={()=>navegarFecha(1)} disabled={nextDis}>→</button>
              </div>
              <span className="fnav-count">{idx+1} / {fechaPestanas.length}</span>
              <div className="fecha-add-wrap">
                <input type="date" value={cmCalPicker} onChange={e=>setCmCalPicker(e.target.value)} className="fecha-add-input" />
                <button className="fecha-add-btn" onClick={agregarFechaCargaMasiva}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Agregar fecha
                </button>
              </div>
            </div>

            <div className="bo-panel" style={{marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
                <div className="bo-panel-title" style={{marginBottom:0}}>Selecciona el método de importación</div>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <button className={`btn-tab-carga${cargaTab==='pegar'?' active':''}`} onClick={()=>{ setCargaTab('pegar'); sessionStorage.setItem('nc_backoffice_carga_tab','pegar') }}>Pegar números</button>
                  <button className={`btn-tab-carga${cargaTab==='archivo'?' active':''}`} onClick={()=>{ setCargaTab('archivo'); sessionStorage.setItem('nc_backoffice_carga_tab','archivo') }}>Subir CSV / TXT</button>
                  <button className={`btn-tab-carga${cargaTab==='legacy'?' active':''}`} style={{background:'#fff7ed',color:'#c2410c',borderColor:'#fed7aa'}} onClick={()=>{ setCargaTab('legacy'); sessionStorage.setItem('nc_backoffice_carga_tab','legacy') }}>Sistema antiguo</button>
                </div>
              </div>

              {/* TAB: Pegar */}
              {cargaTab === 'pegar' && (
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,marginBottom:10}}>
                    <div className="bo-input-group" style={{margin:0}}>
                      <label>Pegar lista de N1 (uno por línea, o separados por coma)</label>
                      <textarea value={masivaNums} onChange={e=>setMasivaNums(e.target.value)} rows={8} placeholder={'987654321\n976543210\n965432109'} />
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8,minWidth:160}}>
                      <div className="bo-input-group" style={{margin:0}}><label>Campaña</label><CampanaSelect value={masivaCamp} onChange={setMasivaCamp} plain /></div>
                      <div className="bo-input-group" style={{margin:0}}><label>Asesor (opcional)</label>
                        <select value={masivaAsesor} onChange={e=>setMasivaAsesor(e.target.value)}>
                          <option value="">— Sin asignar —</option>
                          {asesores.map(a=><option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                        </select>
                      </div>
                      <div className="bo-input-group" style={{margin:0}}><label>Lote máx.</label>
                        <select value={masivaLote} onChange={e=>{ setMasivaLote(e.target.value); if(masivaFilas.length) previsualizarMasiva() }}>
                          <option value="10">10 por lote</option><option value="25">25 por lote</option>
                          <option value="50">50 por lote</option><option value="0">Todos</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <button className="btn-masiva-preview" onClick={previsualizarMasiva} disabled={cargandoMasiva}>Vista previa</button>
                    <button className="btn-masiva-go" onClick={ejecutarCargaMasiva} disabled={masivaFilasParaCargar.length===0||cargandoMasiva}>
                      {cargandoMasiva ? 'Importando...' : `Cargar ${masivaFilasParaCargar.length} registros`}
                    </button>
                    <span style={{fontSize:11,color:'#6b7280'}}>Destino: <strong>{formatFecha(fechaActiva)}</strong></span>
                  </div>
                  {masivaFilas.length > 0 && (
                    <>
                      {masivaNDup > 0 && (
                        <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'8px 12px',fontSize:12,color:'#92400e',marginTop:10}}>
                          Se detectaron <strong>{masivaNDup} duplicados</strong>. <strong>{masivaFilasCnt-masivaNDup} números nuevos</strong>.<br/>
                          <label style={{display:'inline-flex',alignItems:'center',gap:6,marginTop:6,cursor:'pointer',fontSize:11,color:'#374151'}}>
                            <input type="checkbox" checked={inclDup} onChange={e=>setInclDup(e.target.checked)} /> Cargar tambien los duplicados
                          </label>
                        </div>
                      )}
                      {masivaNDup === 0 && <div style={{color:'#15803d',fontWeight:600,fontSize:12,marginTop:10}}>{masivaFilasCnt} números nuevos, sin duplicados.</div>}
                      <div style={{marginTop:10,maxHeight:200,overflowY:'auto',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                          <thead><tr style={{background:'#f9fafb'}}>
                            <th style={{padding:'6px 10px',textAlign:'left',color:'#6b7280',fontSize:9,textTransform:'uppercase'}}>#</th>
                            <th style={{padding:'6px 10px',textAlign:'left',color:'#6b7280',fontSize:9,textTransform:'uppercase'}}>N1</th>
                            <th style={{padding:'6px 10px',textAlign:'left',color:'#6b7280',fontSize:9,textTransform:'uppercase'}}>Campaña</th>
                            <th style={{padding:'6px 10px',textAlign:'left',color:'#6b7280',fontSize:9,textTransform:'uppercase'}}>Fecha</th>
                            <th style={{padding:'6px 10px',textAlign:'left',color:'#6b7280',fontSize:9,textTransform:'uppercase'}}>Estado</th>
                          </tr></thead>
                          <tbody>
                            {masivaFilas.map((f,i)=>(
                              <tr key={i} style={{borderBottom:'1px solid #f3f4f6',background:f.dup?'#fef2f2':''}}>
                                <td style={{padding:'5px 10px',color:'#9ca3af'}}>{i+1}</td>
                                <td style={{padding:'5px 10px',fontFamily:'monospace',fontWeight:600}}>{f.n1}</td>
                                <td style={{padding:'5px 10px',color:'#374151'}}>{masivaCamp||'—'}</td>
                                <td style={{padding:'5px 10px',color:'#374151'}}>{formatFecha(fechaActiva)}</td>
                                <td style={{padding:'5px 10px'}}>
                                  {f.dup
                                    ? <><span style={{background:'#fee2e2',color:'#991b1b',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:99}}>DUPLICADO</span> <span style={{fontSize:9,color:'#b91c1c'}}>{f.motivo}</span></>
                                    : <span style={{background:'#dcfce7',color:'#15803d',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:99}}>NUEVO</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB: Archivo */}
              {cargaTab === 'archivo' && (
                <div>
                  <div
                    onClick={()=>archivoInputRef.current?.click()}
                    onDragOver={e=>{ e.preventDefault(); setDragOver(true) }}
                    onDragLeave={()=>setDragOver(false)}
                    onDrop={e=>{ e.preventDefault(); setDragOver(false); if(e.dataTransfer.files.length) procesarArchivo(e.dataTransfer.files[0]) }}
                    style={{border:`2px dashed ${dragOver?'#111827':'#d1d5db'}`,borderRadius:10,padding:36,textAlign:'center',cursor:'pointer',background:dragOver?'#f9fafb':'#fff',transition:'all .18s'}}
                  >
                    <div style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Arrastra tu archivo aquí o haz clic</div>
                    <div style={{fontSize:12,color:'#9ca3af'}}>Acepta CSV · TXT · XLSX — columnas: N1, N2, Campaña, Distrito, Tipif</div>
                    <input ref={archivoInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:'none'}} onChange={e=>{ if(e.target.files.length) procesarArchivo(e.target.files[0]) }} />
                  </div>
                  {archivoStatus && <div style={{marginTop:10,fontSize:12,color:'#6b7280'}}>{archivoStatus}</div>}
                  {archivoRows.length > 0 && (
                    <div style={{marginTop:10}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                        <span style={{fontSize:12,fontWeight:600,color:'#374151'}}>{archivoInfo} — Destino: <strong>{formatFecha(fechaActiva)}</strong></span>
                        <button className="btn-masiva-go" onClick={ejecutarCargaArchivo} disabled={cargandoMasiva}>
                          {cargandoMasiva ? 'Importando...' : `Cargar ${archivoRows.length} registros`}
                        </button>
                      </div>
                      <div style={{maxHeight:200,overflowY:'auto',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                          <thead><tr style={{background:'#f9fafb',position:'sticky',top:0}}>
                            <th style={{padding:'6px 10px',textAlign:'left',color:'#6b7280',fontSize:9,textTransform:'uppercase'}}>#</th>
                            <th style={{padding:'6px 10px',color:'#6b7280',fontSize:9,textTransform:'uppercase',textAlign:'left'}}>N1</th>
                            <th style={{padding:'6px 10px',color:'#6b7280',fontSize:9,textTransform:'uppercase',textAlign:'left'}}>Campaña</th>
                            <th style={{padding:'6px 10px',color:'#6b7280',fontSize:9,textTransform:'uppercase',textAlign:'left'}}>Distrito</th>
                            <th style={{padding:'6px 10px',color:'#6b7280',fontSize:9,textTransform:'uppercase',textAlign:'left'}}>Tipif.</th>
                          </tr></thead>
                          <tbody>
                            {archivoRows.slice(0,50).map((r,i)=>(
                              <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                                <td style={{padding:'5px 10px',color:'#9ca3af'}}>{i+1}</td>
                                <td style={{padding:'5px 10px',fontFamily:'monospace',fontWeight:600}}>{r.n1}</td>
                                <td style={{padding:'5px 10px'}}>{r.camp}</td>
                                <td style={{padding:'5px 10px'}}>{r.dist}</td>
                                <td style={{padding:'5px 10px'}}>{r.tipif||'—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Legacy */}
              {cargaTab === 'legacy' && (
                <div>
                  {/* Título */}
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#1f2937',marginBottom:2}}>Carga masiva desde Excel</div>
                    <div style={{fontSize:12,color:'#6b7280'}}>Importa tu base en formato Excel (.xlsx), CSV o TXT. Un registro por fila.</div>
                  </div>

                  {/* Selector de modo */}
                  <div className="bo-input-group" style={{margin:'0 0 12px'}}>
                    <label>Modo de fecha</label>
                    <select
                      value={legacyUsarFecha}
                      onChange={e=>{ setLegacyUsarFecha(e.target.value); setLegacyRows([]); setLegacyInfo(''); setLegacyStatus(''); setLegacyError(''); setImportResult(null); if(legacyInputRef.current) legacyInputRef.current.value='' }}
                      style={{fontSize:12,padding:'7px 10px',border:'1px solid #e5e7eb',borderRadius:8,fontFamily:'inherit',background:'#fff'}}
                    >
                      <option value="no">Usar fecha seleccionada — una fecha para todo el archivo</option>
                      <option value="si">Usar fecha del archivo — cada fila tiene su propia fecha</option>
                    </select>
                  </div>

                  {/* Controles de fecha condicionales */}
                  {legacyUsarFecha === 'si' ? (
                    <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#1e40af',marginBottom:8,textTransform:'uppercase',letterSpacing:.3}}>Rango permitido (para validación)</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                        <div className="bo-input-group" style={{margin:0}}>
                          <label>Desde</label>
                          <input type="date" value={legacyDesde} onChange={e=>{ setLegacyDesde(e.target.value); setLegacyRows([]); setLegacyInfo(''); if(legacyInputRef.current) legacyInputRef.current.value='' }} style={{fontSize:12,padding:'6px 10px',border:'1px solid #bfdbfe',borderRadius:8,fontFamily:'inherit',background:'#fff'}} />
                        </div>
                        <div className="bo-input-group" style={{margin:0}}>
                          <label>Hasta</label>
                          <input type="date" value={legacyHasta} max={fechaHoy()} onChange={e=>{ setLegacyHasta(e.target.value); setLegacyRows([]); setLegacyInfo(''); if(legacyInputRef.current) legacyInputRef.current.value='' }} style={{fontSize:12,padding:'6px 10px',border:'1px solid #bfdbfe',borderRadius:8,fontFamily:'inherit',background:'#fff'}} />
                        </div>
                      </div>
                      <div style={{fontSize:10,color:'#1e40af',marginTop:6}}>Cada fila debe tener la columna FECHA. Las filas fuera del rango se marcan como error.</div>
                    </div>
                  ) : (
                    <div className="bo-input-group" style={{margin:'0 0 14px'}}>
                      <label>Fecha destino</label>
                      <input
                        type="date"
                        value={legacyFecha}
                        max={fechaHoy()}
                        onChange={e=>{ setLegacyFecha(e.target.value); setLegacyRows([]); setLegacyInfo(''); if(legacyInputRef.current) legacyInputRef.current.value='' }}
                        style={{fontSize:12,padding:'7px 10px',border:'1px solid #e5e7eb',borderRadius:8,fontFamily:'inherit',background:'#fff',width:'100%',boxSizing:'border-box'}}
                      />
                      {legacyFecha > fechaHoy() && <div style={{fontSize:11,color:'#dc2626',marginTop:4}}>No se permiten fechas futuras.</div>}
                    </div>
                  )}

                  {/* Selector de archivo */}
                  <div
                    onClick={()=>legacyInputRef.current?.click()}
                    onDragOver={e=>{ e.preventDefault(); setLegacyDragOver(true) }}
                    onDragLeave={()=>setLegacyDragOver(false)}
                    onDrop={e=>{ e.preventDefault(); setLegacyDragOver(false); if(e.dataTransfer.files.length) procesarLegacy(e.dataTransfer.files[0]) }}
                    style={{border:`2px dashed ${legacyDragOver?'#1d4ed8':'#d1d5db'}`,borderRadius:10,padding:'28px 24px',textAlign:'center',cursor:'pointer',background:legacyDragOver?'#eff6ff':'#fafafa',transition:'all .15s'}}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={legacyDragOver?'#1d4ed8':'#9ca3af'} strokeWidth="1.8" style={{marginBottom:8}} aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <div style={{fontSize:13,fontWeight:600,color:'#374151',marginBottom:3}}>Arrastra tu archivo aquí o haz clic para seleccionar</div>
                    <div style={{fontSize:11,color:'#9ca3af'}}>Archivo Excel (.xlsx), CSV o TXT · Un registro por fila</div>
                    <input ref={legacyInputRef} type="file" accept=".csv,.txt,.xlsx,.xls" style={{display:'none'}} onChange={e=>{ if(e.target.files.length) procesarLegacy(e.target.files[0]) }} />
                  </div>
                  {legacyStatus && <div style={{fontSize:12,color:'#6b7280',marginTop:8}}>{legacyStatus}</div>}

                  {/* Lista de columnas */}
                  <div style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:8,padding:'12px 16px',marginTop:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#374151',marginBottom:6,textTransform:'uppercase',letterSpacing:.4}}>Columnas del archivo (en orden):</div>
                    <div style={{fontSize:11,color:'#374151',lineHeight:2,wordBreak:'break-word'}}>
                      {legacyUsarFecha==='si' && <><span style={{background:'#dbeafe',borderRadius:4,padding:'1px 6px',marginRight:4,fontWeight:700,color:'#1e40af'}}>FECHA *</span></>}
                      <span style={{background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginRight:4}}>CAMPAÑA</span>
                      <span style={{background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginRight:4}}>DISTRITO</span>
                      <span style={{background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginRight:4}}>N2</span>
                      <span style={{background:'#fef3c7',borderRadius:4,padding:'1px 6px',marginRight:4,fontWeight:700,color:'#92400e'}}>N1 *</span>
                      <span style={{background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginRight:4}}>TIPIF. BACK</span>
                      <span style={{background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginRight:4}}>COMENTARIO</span>
                      <span style={{background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginRight:4}}>TIPIFICACIÓN</span>
                      <span style={{background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginRight:4}}>HORA</span>
                      <span style={{background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginRight:4}}>ASESOR 1</span>
                      <span style={{color:'#9ca3af',fontSize:10,marginRight:4}}>···</span>
                      <span style={{background:'#f3f4f6',borderRadius:4,padding:'1px 6px',marginRight:4}}>ASESOR 6</span>
                    </div>
                    <div style={{fontSize:10,color:'#9ca3af',marginTop:6}}>
                      {legacyUsarFecha==='si'
                        ? '* FECHA y N1 son obligatorios. Formatos de fecha aceptados: DD/MM/YYYY o YYYY-MM-DD.'
                        : '* N1 es el único campo obligatorio. El resto son opcionales.'}
                    </div>
                  </div>

                  {/* Botón descargar plantilla */}
                  <button
                    onClick={descargarFormato}
                    style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'14px 20px',background:'#1d4ed8',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',marginTop:12,letterSpacing:.2}}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    DESCARGAR PLANTILLA EXCEL DE EJEMPLO
                  </button>

                  {/* Vista previa + botones de importación */}
                  {legacyRows.length > 0 && (() => {
                    const validRows  = legacyRows.filter(r=>!r._fechaError)
                    const errorRows  = legacyRows.filter(r=>r._fechaError)
                    const distribPrev = {}
                    validRows.forEach(r=>{ distribPrev[r.fecha]=(distribPrev[r.fecha]||0)+1 })
                    const fechasDetectadas = Object.keys(distribPrev).sort()
                    return (
                    <div style={{marginTop:16,background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:10,padding:14}}>
                      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:'#92400e',marginBottom:4}}>Vista previa — {legacyInfo}</div>
                          {legacyUsarFecha==='si' && fechasDetectadas.length > 1 ? (
                            <div style={{fontSize:11,color:'#92400e'}}>
                              Rango detectado: <strong>{formatFecha(fechasDetectadas[0])} – {formatFecha(fechasDetectadas[fechasDetectadas.length-1])}</strong>
                              <span style={{margin:'0 8px',color:'#fed7aa'}}>·</span>
                              {fechasDetectadas.length} fechas distintas
                              {errorRows.length > 0 && <span style={{marginLeft:8,color:'#dc2626',fontWeight:700}}> · {errorRows.length} con error de fecha</span>}
                            </div>
                          ) : (
                            <div style={{fontSize:11,color:'#92400e'}}>
                              Fecha destino: <strong>{legacyUsarFecha==='si' ? formatFecha(legacyRows.find(r=>!r._fechaError)?.fecha||'') : formatFecha(legacyFecha)}</strong>
                              <span style={{margin:'0 8px',color:'#fed7aa'}}>·</span>
                              {validRows.length} válidos{errorRows.length>0&&<span style={{color:'#dc2626',fontWeight:700}}> · {errorRows.length} con error</span>}
                            </div>
                          )}
                        </div>
                        <div style={{display:'flex',gap:6,flexShrink:0}}>
                          <button className="btn-masiva-preview" onClick={()=>{ setLegacyRows([]); setLegacyError(''); setImportResult(null) }} disabled={cargandoLegacy}>Cancelar</button>
                          <button className="btn-masiva-go" onClick={ejecutarCargaLegacy} style={{background:'#c2410c'}} disabled={cargandoLegacy}>
                            {cargandoLegacy ? 'Importando...' : `Importar ${validRows.length} registros`}
                          </button>
                        </div>
                      </div>
                      {/* Distribución por fecha (modo archivo) */}
                      {legacyUsarFecha==='si' && fechasDetectadas.length > 0 && (
                        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:10}}>
                          {fechasDetectadas.map(f=>(
                            <div key={f} style={{background:'#fff',border:'1px solid #fed7aa',borderRadius:6,padding:'4px 10px',fontSize:11}}>
                              <span style={{fontWeight:700,color:'#c2410c'}}>{formatFecha(f)}</span>
                              <span style={{color:'#92400e',marginLeft:6}}>{distribPrev[f]} reg.</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{maxHeight:220,overflowY:'auto',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,whiteSpace:'nowrap'}}>
                          <thead><tr style={{background:'#f9fafb',position:'sticky',top:0}}>
                            {(legacyUsarFecha==='si'
                              ? ['#','Fecha','Campaña','Distrito','N1','N2','Tipif. Back','Hora','Asesores','Estado']
                              : ['#','Campaña','Distrito','N1','N2','Tipif. Back','Tipif. Vend.','Hora','Asesores']
                            ).map(h=>(
                              <th key={h} style={{padding:'5px 10px',textAlign:'left',color:'#6b7280',fontSize:9,textTransform:'uppercase',fontWeight:700,borderBottom:'1px solid #e5e7eb'}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {legacyRows.slice(0,80).map((r,i)=>(
                              <tr key={i} style={{borderBottom:'1px solid #f3f4f6',background:r._fechaError?'#fef2f2':''}}>
                                <td style={{padding:'4px 10px',color:'#9ca3af'}}>{i+1}</td>
                                {legacyUsarFecha==='si' && (
                                  <td style={{padding:'4px 10px',fontWeight:700,color:r._fechaError?'#dc2626':'#1d4ed8',minWidth:85}}>
                                    {r._fechaError ? <span title={r._fechaErrorMsg} style={{cursor:'help'}}>⚠ {r._fechaErrorMsg?.slice(0,18)}</span> : formatFecha(r.fecha)}
                                  </td>
                                )}
                                <td style={{padding:'4px 10px',fontWeight:600,color:'#1f2937'}}>{r.campana}</td>
                                <td style={{padding:'4px 10px',color:'#374151'}}>{r.distrito}</td>
                                <td style={{padding:'4px 10px',fontFamily:'monospace',fontWeight:700,color:'#1d4ed8'}}>{r.n1}</td>
                                <td style={{padding:'4px 10px',fontFamily:'monospace',color:'#6b7280'}}>{r.n2||'—'}</td>
                                <td style={{padding:'4px 10px',color:'#374151'}}>{r.tipifBack||'—'}</td>
                                {legacyUsarFecha!=='si' && <td style={{padding:'4px 10px',color:'#374151'}}>{r.tipifVend||'—'}</td>}
                                <td style={{padding:'4px 10px',color:'#185FA5',fontWeight:600}}>{r.hora||'—'}</td>
                                <td style={{padding:'4px 10px',color:'#6b7280',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis'}}>{r.asesores.join(' → ')||'—'}</td>
                                {legacyUsarFecha==='si' && (
                                  <td style={{padding:'4px 10px'}}>
                                    {r._fechaError
                                      ? <span style={{background:'#fee2e2',color:'#991b1b',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:99}}>ERROR</span>
                                      : <span style={{background:'#dcfce7',color:'#15803d',fontSize:9,fontWeight:700,padding:'2px 6px',borderRadius:99}}>OK</span>}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {legacyRows.length > 80 && <div style={{fontSize:10,color:'#9ca3af',textAlign:'center',marginTop:6}}>Mostrando 80 de {legacyRows.length} registros</div>}
                    </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Error de importación */}
            {legacyError && (
              <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10,padding:14,marginTop:4,display:'flex',alignItems:'flex-start',gap:10}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" style={{flexShrink:0,marginTop:1}} aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:'#dc2626',marginBottom:2}}>Error al importar</div>
                  <div style={{fontSize:11,color:'#7f1d1d'}}>{legacyError}</div>
                </div>
              </div>
            )}
            {/* Resultado de importación */}
            {importResult && (() => {
              const { total, importados, creados, actualizados, existentes, duplicados, errores, erroresDetalle, fecha, fechas, distribucion } = importResult
              const fechasSorted = (fechas||[]).slice().sort()
              const esMultifecha = fechasSorted.length > 1
              const titulo = esMultifecha
                ? `IMPORTACIÓN COMPLETADA · Rango: ${formatFecha(fechasSorted[0])} al ${formatFecha(fechasSorted[fechasSorted.length-1])}`
                : `IMPORTACIÓN COMPLETADA · Fecha: ${formatFecha(fecha)}`
              return (
              <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:18,marginTop:4}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#15803d'}}>{titulo}</div>
                  <button
                    onClick={()=>{ irSeccion('base'); setFechaActiva(fecha) }}
                    style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',background:'#1d4ed8',color:'#fff',border:'none',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    VER REGISTROS EN BASE
                  </button>
                </div>
                <div style={{display:'flex',gap:20,flexWrap:'wrap',marginBottom: distribucion && Object.keys(distribucion).length ? 14 : 0}}>
                  {[
                    ['Procesados',  total,                      '#374151'],
                    ['Creados',     creados    ?? importados,   '#15803d'],
                    ['Actualizados',actualizados ?? 0,          '#1d4ed8'],
                    ['Existentes',  existentes ?? duplicados ?? 0, '#b45309'],
                    ['Con error',   errores,                    '#dc2626'],
                  ].map(([label,val,color])=>(
                    <div key={label} style={{textAlign:'center',minWidth:60}}>
                      <div style={{fontSize:22,fontWeight:800,color}}>{val}</div>
                      <div style={{fontSize:10,color:'#6b7280',textTransform:'uppercase',letterSpacing:.4}}>{label}</div>
                    </div>
                  ))}
                </div>
                {erroresDetalle && erroresDetalle.length > 0 && (
                  <div style={{borderTop:'1px solid #bbf7d0',paddingTop:10,marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#dc2626',marginBottom:6}}>Registros con error ({erroresDetalle.length}):</div>
                    <div style={{maxHeight:100,overflowY:'auto',fontSize:10,color:'#7f1d1d'}}>
                      {erroresDetalle.map((e,i)=><div key={i} style={{padding:'2px 0'}}>Fila {e.fila} · N1: {e.n1} · {e.motivo}</div>)}
                    </div>
                  </div>
                )}
                {distribucion && Object.keys(distribucion).length > 0 && (
                  <div style={{borderTop:'1px solid #bbf7d0',paddingTop:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#15803d',marginBottom:8,textTransform:'uppercase',letterSpacing:.3}}>Distribución final por fecha:</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                      {Object.entries(distribucion).sort(([a],[b])=>a.localeCompare(b)).map(([f,n])=>(
                        <div key={f} style={{background:'#fff',border:'1px solid #bbf7d0',borderRadius:7,padding:'5px 12px',fontSize:11}}>
                          <span style={{fontWeight:700,color:'#15803d'}}>{formatFecha(f)}</span>
                          <span style={{color:'#374151',marginLeft:8,fontWeight:600}}>{n} importados</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )
            })()}
          </section>

          {/* ══ SECCIÓN: RENDIMIENTO ═══════════════════════════════════════════ */}
          <section className={`bo-seccion${seccion==='rendimiento'?'':' hidden'}`}>
            <div className="bo-seccion-header">
              <div>
                <h2>Rendimiento de Asesores</h2>
                <p className="bo-sub">Ranking por período · métricas de leads, ventas y conversión</p>
              </div>
            </div>
            <div className="rend-filtros">
              <div className="bo-input-group" style={{minWidth:150}}>
                <label>Filtrar por</label>
                <select className="form-select" value={rendFiltroTipo} onChange={e=>setRendFiltroTipo(e.target.value)}>
                  <option value="mes">Mes actual</option>
                  <option value="rango">Rango de fechas</option>
                  <option value="dia">Día específico</option>
                  <option value="global">Global (todo)</option>
                </select>
              </div>
              {rendFiltroTipo === 'dia' && (
                <div className="bo-input-group" style={{minWidth:150}}>
                  <label>Fecha</label>
                  <input className="form-control" type="date" value={rendFiltroFecha} onChange={e=>setRendFiltroFecha(e.target.value)} />
                </div>
              )}
              {rendFiltroTipo === 'rango' && <>
                <div className="bo-input-group" style={{minWidth:140}}><label>Desde</label><input className="form-control" type="date" value={rendDesde} onChange={e=>setRendDesde(e.target.value)} /></div>
                <div className="bo-input-group" style={{minWidth:140}}><label>Hasta</label><input className="form-control" type="date" value={rendHasta} onChange={e=>setRendHasta(e.target.value)} /></div>
              </>}
              <div className="bo-input-group" style={{minWidth:150}}>
                <label>Ordenar por</label>
                <select className="form-select" value={rendOrden} onChange={e=>setRendOrden(e.target.value)}>
                  <option value="ventas_desc">Mayor ventas primero</option>
                  <option value="ventas_asc">Menor ventas primero</option>
                  <option value="conv_desc">Mayor conversión</option>
                  <option value="leads_desc">Mayor leads</option>
                </select>
              </div>
              <div style={{alignSelf:'flex-end',paddingBottom:2}}>
                <button className="bo-btn-limpiar btn btn-sm" style={{fontSize:11,padding:'6px 12px'}} onClick={()=>setRendFiltroTipo('global')}>Ver todo</button>
              </div>
            </div>
            <div className="rend-kpis">
              {[['Total Leads',rendTotLeads,'rd-kpi-leads'],['Total Ventas',rendTotVentas,'rd-kpi-ventas'],['Conversión',rendTotConv+'%','rd-kpi-conv'],['Asesores',asesores.length,'rd-kpi-asesores']].map(([l,v,cls])=>(
                <div key={l} className={`rend-kpi ${cls}`}><div className="rend-kpi-label">{l}</div><div className="rend-kpi-valor">{v}</div></div>
              ))}
            </div>
            <div className="bo-tabla-wrap">
              <table className="bo-tabla rend-tabla table table-sm table-hover">
                <thead><tr>
                  <th>#</th><th>Asesor</th>
                  <th style={{cursor:'pointer'}} onClick={()=>setRendOrden('leads_desc')}>Leads</th>
                  <th style={{cursor:'pointer'}} onClick={()=>setRendOrden('contesta_desc')}>Contesta</th>
                  <th style={{cursor:'pointer'}} onClick={()=>setRendOrden('nc_desc')}>NC</th>
                  <th style={{cursor:'pointer'}} onClick={()=>setRendOrden('ventas_desc')}>Ventas</th>
                  <th style={{cursor:'pointer'}} onClick={()=>setRendOrden('conv_desc')}>Conv.</th>
                  <th>Avance</th>
                </tr></thead>
                <tbody>
                  {rendData.length === 0
                    ? <tr><td colSpan={8} className="bo-empty">Sin datos.</td></tr>
                    : rendData.map((r,i)=>(
                        <tr key={r.nombre}>
                          <td><div className={`rend-pos${i<3?' '+['p1','p2','p3'][i]:''}`}>{i+1}</div></td>
                          <td><div className="rd-asesor-cell"><div className="rd-avatar" style={{background:colorAv(r.nombre)}}>{iniciales(r.nombre)}</div><div className="rd-name-block"><div className="rd-asesor-name">{r.nombre}</div><div className="rd-asesor-user">{r.usuario}</div></div></div></td>
                          <td style={{fontWeight:600}}>{r.leads}</td>
                          <td style={{color:'#16a34a',fontWeight:600}}>{r.contesta}</td>
                          <td style={{color:'#d97706',fontWeight:600}}>{r.nc}</td>
                          <td><span className="rd-ventas-num">{r.ventas}</span></td>
                          <td><span className={`tipif-badge ${r.conv>=30?'b-venta':r.conv>=15?'b-nocontesta':'b-default'}`}>{r.conv}%</span></td>
                          <td><div className="rend-bar-wrap"><div className="rend-bar"><div className="rend-bar-fill" style={{width:`${Math.round(r.ventas/rendMaxVentas*100)}%`}} /></div><span className="rd-bar-pct">{Math.round(r.ventas/rendMaxVentas*100)}%</span></div></td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </section>

          {/* ══ SECCIÓN: AVANCE DE ASESORES ═══════════════════════════════════ */}
          <section className={`bo-seccion${seccion==='avance'?'':' hidden'}`}>
            <div className="bo-seccion-header">
              <div>
                <h2>Avance de Asesores</h2>
                <p className="bo-sub">Todos los asesores de todas las salas — abre la base de llamadas de cada uno</p>
              </div>
              <input type="text" value={avanceBuscar} onChange={e=>setAvanceBuscar(e.target.value)} placeholder="Buscar asesor..." style={{padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12,fontFamily:'inherit',outline:'none',minWidth:200}} />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
              {avanceFiltrado.length === 0
                ? <div style={{gridColumn:'1/-1',textAlign:'center',padding:40,color:'#9ca3af'}}>No hay asesores registrados.</div>
                : avanceFiltrado.map(a=>(
                    <div key={a.id} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:16,padding:18,boxShadow:'0 2px 8px rgba(0,0,0,.05)'}}>
                      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                        <div style={{width:44,height:44,borderRadius:'50%',background:colorAv(a.nombre),display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:'#fff'}}>{iniciales(a.nombre)}</div>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:'#111827',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.nombre}</div>
                          <div style={{fontSize:11,color:'#9ca3af'}}>@{a.usuario||'—'} · {a.sala||'—'}</div>
                        </div>
                      </div>
                      <button onClick={()=>abrirBlModal(a.nombre,a.id)} style={{width:'100%',padding:'9px 12px',border:'1px solid #bfdbfe',borderRadius:8,background:'#eff6ff',color:'#1d4ed8',fontSize:12,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>Ver base de llamadas</button>
                    </div>
                  ))
              }
            </div>
          </section>

        </main>
      </div>

      {/* ══ MODAL ROTACIÓN MANUAL ════════════════════════════════════════════ */}
      {modalRotar.open && (
        <div className="modal-overlay open" onClick={e=>{ if(e.target===e.currentTarget) setModalRotar(p=>({...p,open:false})) }}>
          <div className="modal-box">
            <h3>Rotar lead manualmente</h3>
            <p>{modalRotar.desc}</p>
            <select value={rotModalAsesor} onChange={e=>setRotModalAsesor(e.target.value)} style={!rotModalAsesor?{borderColor:'#ef4444'}:{}}>
              <option value="">-- Seleccionar nuevo asesor --</option>
              {asesores.map(a=>(
                <option key={a.id} value={a.nombre} disabled={a.nombre===modalRotar.asesorActual}>{a.nombre}</option>
              ))}
            </select>
            <textarea value={rotModalMotivo} onChange={e=>setRotModalMotivo(e.target.value)} placeholder="Motivo de la rotación (opcional)..." />
            <div className="modal-btns">
              <button className="btn-cancelar-modal" onClick={()=>setModalRotar(p=>({...p,open:false}))}>Cancelar</button>
              <button className="btn-confirmar-modal" onClick={confirmarRotacion} disabled={!rotModalAsesor || rotandoManual}>{rotandoManual ? 'Rotando...' : 'Rotar ahora'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ BL MODAL (base de llamadas asesor) ══════════════════════════════ */}
      {blModal.open && (
        <div style={{display:'flex',position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:9999,alignItems:'flex-start',justifyContent:'center',padding:'40px 20px'}} onClick={e=>{ if(e.target===e.currentTarget) setBlModal(p=>({...p,open:false})) }}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:1000,maxHeight:'85vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
            <div style={{padding:'18px 24px 14px',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:'#111827'}}>Base de llamadas — {blModal.nombre}</div>
                <div style={{fontSize:12,color:'#9ca3af',marginTop:2}}>Solo lectura · Back Data</div>
              </div>
              <button onClick={()=>setBlModal(p=>({...p,open:false}))} style={{width:32,height:32,borderRadius:'50%',border:'1px solid #e5e7eb',background:'#f9fafb',fontSize:18,cursor:'pointer'}}>×</button>
            </div>
            <div style={{padding:'10px 24px',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <label style={{fontSize:12,fontWeight:600}}>Fecha:</label>
              <input type="date" value={blFecha} onChange={e=>setBlFecha(e.target.value)} style={{padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12,fontFamily:'inherit'}} />
              <button onClick={()=>setBlFecha(fechaHoy())} style={{padding:'6px 12px',border:'1px solid #e5e7eb',borderRadius:8,background:'#f9fafb',fontSize:11,fontWeight:700,fontFamily:'inherit',cursor:'pointer'}}>Hoy</button>
              <span style={{fontSize:12,color:'#9ca3af',marginLeft:'auto'}}>{blLeads?.length??0} registros</span>
            </div>
            {blLeads && blLeads.length > 0 && (
              <div style={{padding:'10px 24px',display:'flex',gap:10,flexWrap:'wrap',borderBottom:'1px solid #f3f4f6'}}>
                {[{label:'Leads',val:blLeads.length,color:'#2563eb'},{label:'Tipificados',val:blLeads.filter(l=>(l.tipif_vend||'').trim()!=='').length,color:'#16a34a'},{label:'VENTA CERRADA',val:blLeads.filter(l=>(l.tipif_vend||'').toUpperCase()==='VENTA CERRADA').length,color:'#7c3aed'},{label:'NC/Buzón',val:blLeads.filter(l=>['NO CONTESTA','BUZON DE VOZ'].includes((l.tipif_vend||'').toUpperCase())).length,color:'#d97706'}]
                  .map(k=>(
                    <div key={k.label} style={{background:'#f9fafb',borderRadius:10,padding:'8px 14px',display:'flex',flexDirection:'column',gap:2,minWidth:100}}>
                      <div style={{fontSize:18,fontWeight:800,color:k.color}}>{k.val}</div>
                      <div style={{fontSize:10,color:'#9ca3af',textTransform:'uppercase'}}>{k.label}</div>
                    </div>
                  ))}
              </div>
            )}
            <div style={{flex:1,overflow:'auto',padding:'0 24px 20px'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{position:'sticky',top:0,background:'#f9fafb',zIndex:1}}>
                  {['#','Teléfono N1','N2','Zona','Campaña','Hora asig.','Tipificación','Observación'].map(h=>(
                    <th key={h} style={{padding:'10px 8px',textAlign:'left',fontSize:10,fontWeight:700,color:'#6b7280',textTransform:'uppercase',borderBottom:'1px solid #e5e7eb'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {blCargando
                    ? <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'#9ca3af'}}>Cargando...</td></tr>
                    : !blLeads
                      ? <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'#ef4444'}}>Error de conexión.</td></tr>
                      : blLeads.length === 0
                        ? <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'#9ca3af'}}>Sin leads para esta fecha.</td></tr>
                        : blLeads.map((l,i)=>(
                            <tr key={i} style={{borderBottom:'1px solid #f3f4f6',background:(l.tipif_vend||'').toUpperCase()==='VENTA CERRADA'?'#f0fdf4':''}}>
                              <td style={{padding:8,color:'#9ca3af',fontSize:10}}>{i+1}</td>
                              <td style={{padding:8,fontFamily:'monospace',fontWeight:700,color:'#111827'}}>{l.n1||'—'}</td>
                              <td style={{padding:8,fontFamily:'monospace',color:'#6b7280'}}>{l.n2||'—'}</td>
                              <td style={{padding:8,fontSize:11}}>{l.distrito||l.campana||'—'}</td>
                              <td style={{padding:8,fontSize:11}}>{l.campana||'—'}</td>
                              <td style={{padding:8,fontSize:11,fontFamily:'monospace'}}>{l.hora_asig||'—'}</td>
                              <td style={{padding:8}}><BlBadge tipif={l.tipif_vend} /></td>
                              <td style={{padding:8,fontSize:11,color:'#6b7280'}}>{l.obs_asesor||'—'}</td>
                            </tr>
                          ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOAST ════════════════════════════════════════════════════════════ */}

      {/* Lista compartida de asesores para el buscador de asignación */}
      <datalist id="asesores-datalist">
        {asesores.map(a=><option key={a.id} value={a.nombre} />)}
      </datalist>

      {/* ══ POPOVER DNI ══════════════════════════════════════════════════════ */}
      {dniModal&&(
        <>
          <div style={{position:'fixed',inset:0,zIndex:9998}} onClick={()=>setDniModal(null)}/>
          <div className="dni-popover" style={{top:dniModal.top,left:dniModal.left}}
            onKeyDown={e=>e.key==='Escape'&&setDniModal(null)}>
            <button type="button" className="dni-popover-close" onClick={()=>setDniModal(null)} aria-label="Cerrar">×</button>
            <div className="dni-popover-label">DNI DE LA VENTA</div>
            {dniModal.editing ? (
              <>
                <input className="dni-popover-value" style={{width:'100%',textAlign:'center',border:'1px solid #bbf7d0',borderRadius:6,padding:'4px 6px',outline:'none'}}
                  value={dniModal.editVal||''} autoFocus maxLength={12}
                  onChange={e=>setDniModal(p=>({...p,editVal:e.target.value.replace(/\D/g,'')}))}
                  onKeyDown={e=>{ if(e.key==='Enter') guardarDni() }} />
                <button type="button" className="dni-copy-btn" onClick={guardarDni}>Guardar</button>
              </>
            ) : (
              <>
                <div className="dni-popover-value" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                  <span>{dniModal.dni||'—'}</span>
                  <button type="button" title="Editar DNI" onClick={()=>setDniModal(p=>({...p,editing:true,editVal:p.dni||''}))}
                    style={{border:'none',background:'transparent',cursor:'pointer',fontSize:14,padding:0,lineHeight:1}}>✏️</button>
                </div>
                <button type="button" className="dni-copy-btn" onClick={()=>{ copiarNumero(dniModal.dni); setDniModal(null) }}>Copiar</button>
              </>
            )}
          </div>
        </>
      )}

    </div>
  )
}
