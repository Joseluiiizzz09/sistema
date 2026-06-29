import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { API, ncHeaders } from '../services/api'
import { UBIGEO } from '../services/ubigeo'
import '../styles/backoffice.css'

// ── Utilities ────────────────────────────────────────────────────────────
const COLORES_AV = ['#3b82f6','#8b5cf6','#22c55e','#f97316','#ef4444','#06b6d4','#ec4899']
const DOT_COLORS  = ['#185FA5','#0F6E56','#854F0B','#7C3AED','#DC2626']
const BO_SECCIONES = ['base', 'carga-masiva', 'rendimiento', 'avance']

function fechaHoy() {
  const ahora = new Date()
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000
  const peru  = new Date(utcMs - 5 * 3600000)
  return peru.toISOString().split('T')[0]
}
function horaAhora() {
  const ahora = new Date()
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000
  const peru  = new Date(utcMs - 5 * 3600000)
  return String(peru.getHours()).padStart(2,'0') + ':' + String(peru.getMinutes()).padStart(2,'0')
}
function formatFecha(f) {
  if (!f) return ''
  const [y,m,d] = f.split('-')
  return `${d}/${m}/${y}`
}
function colorAv(n)   { let s=0; for (const c of n) s+=c.charCodeAt(0); return COLORES_AV[s % COLORES_AV.length] }
function iniciales(n) { return n.trim().split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase() }
function tipifBadgeClass(t) {
  if (!t) return 'b-default'
  const u = t.toUpperCase()
  if (u.includes('VENTA'))       return 'b-venta'
  if (u.includes('BUZON'))       return 'b-buzon'
  if (u.includes('NO CONTESTA')) return 'b-nocontesta'
  if (u.includes('DER'))         return 'b-derivado'
  return 'b-default'
}

const TIPIF_BACK_OPTIONS = ['BUZON','NO CONTESTA','DER CHAMO','VENTA CERRADA','NO DESEA','CORTA LLAMADA','PREVENTA','EN EJECUCION','AGENDADO','NO CALIFICA','EDIFICIO NO LIBERADO']
const TIPIF_VEND_OPCIONES = ['VENTA CERRADA','PREVENTA','AGENDADO','EN EJECUCION','CONTESTA','NO CONTESTA','BUZON DE VOZ','CORTA LLAMADA','NO DESEA','NO CALIFICA','SIN COBERTURA','CONTACTO CON TERCEROS','EDIFICIO NO LIBERADO','DESEA MOVIL','SERVICIO ACTIVO','DERIVADO','NC','NO TOCAR','FRAUDE']
const TIPIF_VEND_STYLES = {
  'VENTA CERRADA':['#d1fae5','#065f46'],'PREVENTA':['#dbeafe','#1e40af'],'AGENDADO':['#fef3c7','#78350f'],
  'NO CONTESTA':['#fefce8','#854d0e'],'BUZON DE VOZ':['#e0f2fe','#0c4a6e'],'CORTA LLAMADA':['#f8fafc','#334155'],
  'EN EJECUCION':['#dcfce7','#14532d'],'SIN COBERTURA':['#ffe4e6','#881337'],'NO CALIFICA':['#fefce8','#713f12'],
  'NO DESEA':['#ffe4e6','#7f1d1d'],'CONTACTO CON TERCEROS':['#ccfbf1','#134e4a'],'EDIFICIO NO LIBERADO':['#f5f3ff','#4c1d95'],
  'DESEA MOVIL':['#f8fafc','#1e293b'],'SERVICIO ACTIVO':['#f1f5f9','#1e293b'],'CONTESTA':['#d1fae5','#065f46'],
  'NC':['#fefce8','#854d0e'],'DERIVADO':['#ede9fe','#5b21b6'],'NO TOCAR':['#fef2f2','#dc2626'],'FRAUDE':['#fee2e2','#991b1b'],
}
const BL_TIPIF_COLORS = {
  'VENTA CERRADA':'#16a34a','PREVENTA':'#2563eb','AGENDADO':'#7c3aed','NO CONTESTA':'#9ca3af',
  'CORTA LLAMADA':'#f97316','NO DESEA':'#ef4444','BUZON DE VOZ':'#6b7280','SERVICIO ACTIVO':'#0891b2',
  'SIN COBERTURA':'#dc2626','NO CALIFICA':'#d97706','NO TOCAR':'#dc2626','FRAUDE':'#991b1b',
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

// ── Component ─────────────────────────────────────────────────────────────
export default function Backoffice() {
  const navigate    = useNavigate()
  const { sesion, logout } = useAuth()
  const idCntRef    = useRef(1)
  const toastTimer  = useRef(null)
  const archivoInputRef = useRef(null)
  const legacyInputRef  = useRef(null)

  // ── Section ──
  const [seccion, setSeccion] = useState(() => {
    const guardada = sessionStorage.getItem('nc_backoffice_apartado')
    return BO_SECCIONES.includes(guardada) ? guardada : 'base'
  })

  // ── Data ──
  const [asesores,      setAsesores]      = useState([])
  const [baseData,      setBaseData]      = useState({})
  const [fechaPestanas, setFechaPestanas] = useState([fechaHoy()])
  const [fechaActiva,   setFechaActiva]   = useState(fechaHoy())

  // ── Form (agregar registro) ──
  const [form,     setForm]     = useState({ campana:'', dpto:'', prov:'', distrito:'', n1:'', n2:'', tipifBack:'', asesor:'' })
  const [n1Error,  setN1Error]  = useState(false)
  const [calPicker,   setCalPicker]   = useState('')
  const [cmCalPicker, setCmCalPicker] = useState('')

  // ── Ubigeo cascada ──
  const dptos     = Object.keys(UBIGEO).sort()
  const provs     = form.dpto ? Object.keys(UBIGEO[form.dpto] || {}).sort() : []
  const distritos = (form.dpto && form.prov) ? (UBIGEO[form.dpto]?.[form.prov] || []) : []

  // ── Filtros base ──
  const [filtros, setFiltros] = useState({ tip:'', tipVend:'', asesor:'', numero:'', verTipVend:true })

  // ── Historial ──
  const [histOpen, setHistOpen] = useState({})

  // ── Rotación panel ──
  const [rotPanelOpen,  setRotPanelOpen]  = useState(false)
  const [rotAsesor,     setRotAsesor]     = useState('')
  const [rotCant,       setRotCant]       = useState(4)
  const [rotSel,        setRotSel]        = useState({})
  const [rotFiltroFecha,setRotFiltroFecha]= useState('')
  const [rotProgress,   setRotProgress]   = useState(0)
  const [rotResultado,  setRotResultado]  = useState([])
  const [rotRotados,    setRotRotados]    = useState(0)

  // ── Modal rotación manual ──
  const [modalRotar,    setModalRotar]    = useState({ open:false, regId:null, desc:'', asesorActual:'' })
  const [rotModalAsesor,setRotModalAsesor]= useState('')
  const [rotModalMotivo,setRotModalMotivo]= useState('')

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
  const [dragOver,     setDragOver]     = useState(false)
  const [legacyDragOver, setLegacyDragOver] = useState(false)

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

  // ── Helpers ──────────────────────────────────────────────────────────────
  function mostrarToast(msg) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(''), 3200)
  }

  function findReg(id) {
    for (const f in baseData) {
      const reg = baseData[f].find(r => r.id === id)
      if (reg) return { reg, fecha: f }
    }
    return null
  }

  function updateReg(id, updater) {
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
      if (data.ok) setAsesores(data.data.filter(u => u.cargo === 'asesor' && u.activo).map(u => ({ id:u.id, nombre:u.nombre, usuario:u.usuario, sala:u.sala })))
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
        const fecha = l.fecha || fechaHoy()
        if (!nuevoBase[fecha]) nuevoBase[fecha] = []
        if (!nuevasFechas.includes(fecha)) nuevasFechas.push(fecha)
        nuevoBase[fecha].push({
          id:         idCntRef.current++,
          _backendId: l.id,
          campana:    l.campana || '—',
          distrito:   l.distrito || '—',
          n1:         l.n1,
          n2:         l.n2 || '',
          tipifBack:  l.tipif_back || '',
          asesor:     l.asesor_nombre || '',
          horaAsig:   l.hora_asig || '',
          sinAsignar: !!l.sin_asignar,
          rotaciones: l.rotaciones || 0,
          _tipifVend: l.tipif_vend || '',
          _tipifHora: l.tipif_hora || '',
          historial:  Array.isArray(l.historial) ? l.historial : [],
        })
      })
      const hoy = fechaHoy()
      if (!nuevasFechas.includes(hoy)) nuevasFechas.push(hoy)
      nuevasFechas.sort().reverse()
      setBaseData(nuevoBase)
      setFechaPestanas(nuevasFechas)
      setFechaActiva(prev => nuevasFechas.includes(prev) ? prev : nuevasFechas[0])
    } catch(e) { console.error('Error cargando leads:', e) }
  }, [])

  useEffect(() => {
    cargarAsesores()
    cargarLeads()
    const t = setInterval(cargarLeads, 15000)
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
    mostrarToast('Fecha ' + formatFecha(f) + ' agregada')
  }

  function agregarFechaCargaMasiva() {
    const f = cmCalPicker
    if (!f) { mostrarToast('Selecciona una fecha primero'); return }
    if (fechaPestanas.includes(f)) { mostrarToast('Esa fecha ya existe'); return }
    setFechaPestanas(prev => [...prev, f].sort().reverse())
    setBaseData(prev => prev[f] ? prev : { ...prev, [f]: [] })
    setFechaActiva(f)
    setCmCalPicker('')
    mostrarToast('Fecha ' + formatFecha(f) + ' agregada')
  }

  // ── Form (agregar registro individual) ───────────────────────────────────
  async function agregarRegistro() {
    const n1 = form.n1.trim()
    if (!n1) { setN1Error(true); mostrarToast('El campo N1 es obligatorio'); return }
    setN1Error(false)
    const campana  = form.campana.trim() || '—'
    const distrito = form.distrito || '—'
    const n2       = form.n2.trim()
    const tipifBack = form.tipifBack
    const asesor   = form.asesor
    const hora     = asesor ? horaAhora() : ''
    const fecha    = fechaActiva
    const reg = {
      id:idCntRef.current++, _backendId:null, campana, distrito, n1, n2, tipifBack, asesor, horaAsig:hora,
      sinAsignar:!asesor, rotaciones:0, _tipifVend:'', _tipifHora:'',
      historial: asesor ? [{asesor, hora, fecha, motivo:'Asignacion inicial'}] : [],
    }
    setBaseData(prev => ({ ...prev, [fecha]: [reg, ...(prev[fecha] || [])] }))
    setFechaPestanas(prev => prev.includes(fecha) ? prev : [...prev, fecha].sort().reverse())
    try {
      const res  = await fetch(`${API}/leads`, { method:'POST', headers:ncHeaders(), body:JSON.stringify({ campana, distrito, n1, n2, tipif_back:tipifBack, asesor_nombre:asesor, fecha, hora_asig:hora }) })
      const data = await res.json()
      const bid  = data.ids?.[0] || data.id
      if (bid) {
        setBaseData(prev => {
          const next = { ...prev }
          const arr  = [...(next[fecha] || [])]
          const idx  = arr.findIndex(r => r.id === reg.id)
          if (idx >= 0) { arr[idx] = { ...arr[idx], _backendId: bid }; next[fecha] = arr }
          return next
        })
      }
    } catch(e) {}
    setForm({ campana:'', dpto:'', prov:'', distrito:'', n1:'', n2:'', tipifBack:'', asesor:'' })
    mostrarToast(`N1: ${n1} agregado${asesor ? ' → '+asesor : ''}`)
  }

  // ── Reasignar ────────────────────────────────────────────────────────────
  async function reasignarReg(id, nuevoAsesor) {
    const found = findReg(id)
    if (!found) return
    const { reg } = found
    const hora = horaAhora()
    if (!nuevoAsesor) {
      updateReg(id, { asesor:'', horaAsig:'', sinAsignar:true })
      if (reg._backendId) fetch(`${API}/leads/${reg._backendId}`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ asesor_nombre:'', hora_asig:'' }) }).catch(()=>{})
      return
    }
    const newHist = [...reg.historial, { asesor:nuevoAsesor, hora, fecha:fechaHoy(), motivo:'Reasignacion directa' }]
    updateReg(id, { asesor:nuevoAsesor, horaAsig:hora, sinAsignar:false, historial:newHist })
    if (reg._backendId) fetch(`${API}/leads/${reg._backendId}`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ asesor_nombre:nuevoAsesor, hora_asig:hora, historial:newHist }) }).catch(()=>{})
    mostrarToast(`N1 ${reg.n1} → ${nuevoAsesor} · ${hora}`)
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  async function eliminarReg(id) {
    const found = findReg(id)
    if (found?.reg._backendId) fetch(`${API}/leads/${found.reg._backendId}`, { method:'DELETE', headers:ncHeaders() }).catch(()=>{})
    setBaseData(prev => { const n={}; for(const f in prev) n[f]=prev[f].filter(r=>r.id!==id); return n })
    setHistOpen(prev => { const n={...prev}; delete n[id]; return n })
    mostrarToast('Lead eliminado')
  }

  // ── Tipif vendedor ────────────────────────────────────────────────────────
  async function guardarTipif(id, valor) {
    const found = findReg(id)
    if (!found) return
    const { reg } = found
    const hora = horaAhora()
    updateReg(id, { _tipifVend:valor, _tipifHora:hora })
    if (reg._backendId) fetch(`${API}/leads/${reg._backendId}/tipif`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ tipif_vend:valor }) }).catch(()=>{})
    mostrarToast(`Tipif. vendedor: ${valor||'— Pendiente —'} · N1 ${reg.n1}`)
  }

  // ── Modal rotación manual ─────────────────────────────────────────────────
  function abrirModalRotar(id) {
    const found = findReg(id)
    if (!found) return
    const { reg } = found
    setModalRotar({ open:true, regId:id, desc:`N1: ${reg.n1} — Asesor actual: ${reg.asesor||'Sin asignar'}`, asesorActual:reg.asesor })
    setRotModalAsesor('')
    setRotModalMotivo('')
  }

  async function confirmarRotacion() {
    if (!rotModalAsesor) return
    const found = findReg(modalRotar.regId)
    if (!found) return
    const { reg } = found
    const hora    = horaAhora()
    const motivo  = rotModalMotivo.trim() || 'Rotacion manual'
    const newHist = [...reg.historial, { asesor:rotModalAsesor, hora, fecha:fechaHoy(), motivo }]
    updateReg(modalRotar.regId, { asesor:rotModalAsesor, horaAsig:hora, sinAsignar:false, rotaciones:reg.rotaciones+1, historial:newHist })
    setHistOpen(prev => ({ ...prev, [modalRotar.regId]: true }))
    if (reg._backendId) fetch(`${API}/leads/${reg._backendId}`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ asesor_nombre:rotModalAsesor, hora_asig:hora, historial:newHist, sumarRotacion:true }) }).catch(()=>{})
    mostrarToast(`Rotado: ${reg.asesor||'Sin asignar'} → ${rotModalAsesor} · ${hora}`)
    setModalRotar({ open:false, regId:null, desc:'', asesorActual:'' })
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
        list.push({ id:reg.id, tel:reg.n1, campana:reg.campana, n2:reg.n2||'', estado:reg.tipifBack||'Nuevo', asesor:reg.asesor||'', ultimaAsig, fecha, histAsesores:reg.historial.map(h=>h.asesor), _reg:reg })
      })
    })
    return list
  }

  function rotApto(lead, asesor) {
    const ahora = new Date()
    if (!asesor) return { apto:false }
    const sinRepetir = !lead.histAsesores.includes(asesor)
    const mins = Math.floor((ahora - lead.ultimaAsig)/60000)
    const tiempo = mins >= 120
    const estadoOk = ['Buzon','No contesta','Nuevo','BUZON','NO CONTESTA',''].includes(lead.estado)
    if (!lead.asesor) return { apto:sinRepetir, sinRepetir, tiempo:true, estadoOk:true }
    return { apto:sinRepetir&&tiempo&&estadoOk, sinRepetir, tiempo, estadoOk }
  }

  function rotMins(f) { return Math.floor((new Date() - f)/60000) }
  function rotTxt(f) { const m=rotMins(f); if(m<60) return m+' min'; const h=Math.floor(m/60),r=m%60; return h+'h'+(r>0?' '+r+'min':'') }

  async function rotFinalizarWith(selToUse, asesorActual) {
    const hora     = horaAhora()
    const allLeads = buildRotLeads()
    const rotados  = allLeads.filter(l => selToUse[l.id])
    const res = []
    for (const l of rotados) {
      const reg = l._reg
      const newHist = [...reg.historial, { asesor:asesorActual, hora, fecha:fechaHoy(), motivo:'Rotacion masiva' }]
      updateReg(reg.id, { asesor:asesorActual, horaAsig:hora, sinAsignar:false, rotaciones:(reg.rotaciones||0)+1, historial:newHist })
      if (reg._backendId) fetch(`${API}/leads/${reg._backendId}`, { method:'PATCH', headers:ncHeaders(), body:JSON.stringify({ asesor_nombre:asesorActual, hora_asig:hora, historial:newHist, sumarRotacion:true }) }).catch(()=>{})
      res.push({ tel:reg.n1, asesor:asesorActual, hora })
    }
    setRotRotados(prev => prev + rotados.length)
    setRotResultado(res)
    setRotSel({})
    mostrarToast(`${rotados.length} leads rotados a ${asesorActual}`)
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

  async function ejecutarCargaMasiva() {
    const lista = (inclDup ? masivaFilas : masivaFilas.filter(f=>!f.dup)).map(f=>f.n1)
    if (!lista.length) { mostrarToast('No hay numeros para cargar'); return }
    const campana = masivaCamp.trim() || '—'
    const asesor  = masivaAsesor
    const hora    = asesor ? horaAhora() : ''
    const fecha   = fechaActiva
    const leadsParaBackend = []
    const nuevosRegs = []
    lista.forEach(n1 => {
      if ((baseData[fecha]||[]).find(r=>r.n1===n1)) return
      const reg = { id:idCntRef.current++, _backendId:null, campana, distrito:'—', n1, n2:'', tipifBack:'', asesor, horaAsig:hora, sinAsignar:!asesor, rotaciones:0, _tipifVend:'', _tipifHora:'', historial:asesor?[{asesor,hora,fecha,motivo:'Carga masiva'}]:[] }
      nuevosRegs.push(reg)
      leadsParaBackend.push({ campana, distrito:'—', n1, n2:'', tipif_back:'', asesor_nombre:asesor, fecha, hora_asig:hora })
    })
    if (nuevosRegs.length) {
      setBaseData(prev => ({ ...prev, [fecha]:[...(prev[fecha]||[]), ...nuevosRegs] }))
      setFechaPestanas(prev => prev.includes(fecha) ? prev : [...prev, fecha].sort().reverse())
      try {
        const res  = await fetch(`${API}/leads`, { method:'POST', headers:ncHeaders(), body:JSON.stringify(leadsParaBackend) })
        const data = await res.json()
        if (data.ok && data.ids) {
          setBaseData(prev => {
            const next = { ...prev }
            const arr  = [...(next[fecha]||[])]
            const off  = arr.length - nuevosRegs.length
            data.ids.forEach((bid,i) => { if(arr[off+i]) arr[off+i]={...arr[off+i],_backendId:bid} })
            next[fecha] = arr
            return next
          })
        }
      } catch(e) {}
    }
    setMasivaNums(''); setMasivaFilas([]); setInclDup(false)
    mostrarToast(`${nuevosRegs.length} registros cargados${asesor?' → '+asesor:''}`)
  }

  function procesarArchivo(file) {
    setArchivoStatus(`Leyendo ${file.name}...`)
    const reader = new FileReader()
    reader.onload = e => {
      const text   = e.target.result
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
    reader.readAsText(file, 'UTF-8')
  }

  async function ejecutarCargaArchivo() {
    if (!archivoRows.length) { mostrarToast('No hay datos'); return }
    const fecha = fechaActiva
    const nuevos = []; const leadsBackend = []
    archivoRows.forEach(r => {
      if ((baseData[fecha]||[]).find(x=>x.n1===r.n1)) return
      nuevos.push({ id:idCntRef.current++, _backendId:null, campana:r.camp, distrito:r.dist, n1:r.n1, n2:r.n2, tipifBack:r.tipif, asesor:'', horaAsig:'', sinAsignar:true, rotaciones:0, _tipifVend:'', _tipifHora:'', historial:[] })
      leadsBackend.push({ campana:r.camp, distrito:r.dist, n1:r.n1, n2:r.n2, tipif_back:r.tipif, asesor_nombre:'', fecha, hora_asig:'' })
    })
    const omitidos = archivoRows.length - nuevos.length
    if (nuevos.length) {
      setBaseData(prev => ({ ...prev, [fecha]:[...(prev[fecha]||[]), ...nuevos] }))
      try { await fetch(`${API}/leads`, { method:'POST', headers:ncHeaders(), body:JSON.stringify(leadsBackend) }) } catch(e) {}
    }
    setArchivoRows([]); setArchivoInfo(''); setArchivoStatus('')
    if (archivoInputRef.current) archivoInputRef.current.value = ''
    mostrarToast(`${nuevos.length} importados${omitidos?' · '+omitidos+' omitidos':''}`)
  }

  function procesarLegacy(file) {
    setLegacyStatus(`Leyendo ${file.name}...`)
    const reader = new FileReader()
    reader.onload = e => {
      const text   = e.target.result
      const lineas = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0)
      if (!lineas.length) { setLegacyStatus('Archivo vacio'); return }
      const sep   = lineas[0].includes('\t')?'\t':lineas[0].includes(';')?';':','
      const prim  = lineas[0].split(sep)
      const cab   = isNaN((prim[3]||'').replace(/\s/g,''))||(prim[3]||'').length<6
      const datos = cab ? lineas.slice(1) : lineas
      const fechaDest = legacyFecha || fechaActiva
      const usarFF = legacyUsarFecha === 'si'
      const rows   = []
      datos.forEach(linea => {
        const c  = linea.split(sep).map(x=>x.trim().replace(/^["']|["']$/g,''))
        const n1 = c[3]||c[0]||''
        if (!n1||n1.length<6) return
        const asesoresHist = []
        for (let i=8;i<=13;i++) { const a=(c[i]||'').trim(); if(a&&a.length>1) asesoresHist.push(a) }
        let fechaFila = fechaDest
        if (usarFF) { for(let i=0;i<c.length;i++) { const m=c[i].match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(m){fechaFila=`${m[3]}-${m[2]}-${m[1]}`;break;} if(/^\d{4}-\d{2}-\d{2}$/.test(c[i])){fechaFila=c[i];break;} } }
        rows.push({ campana:c[0]||'—', distrito:c[1]||'—', n2:c[2]||'', n1, tipifBack:c[4]||'', tipifVend:c[6]||'', hora:c[7]||'', asesores:asesoresHist, fecha:fechaFila })
      })
      if (!rows.length) { setLegacyStatus('No se encontraron filas validas'); return }
      setLegacyRows(rows); setLegacyInfo(`${rows.length} registros desde "${file.name}"`); setLegacyStatus('')
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function ejecutarCargaLegacy() {
    if (!legacyRows.length) { mostrarToast('No hay datos'); return }
    let importados=0, omitidos=0
    const leadsBackend = []
    const updates = {}
    const nuevasFechasLocal = []
    legacyRows.forEach(r => {
      const fecha = r.fecha
      if (!fechaPestanas.includes(fecha)&&!nuevasFechasLocal.includes(fecha)) nuevasFechasLocal.push(fecha)
      if (!updates[fecha]) updates[fecha] = []
      if ((baseData[fecha]||[]).find(x=>x.n1===r.n1)||updates[fecha].find(x=>x.n1===r.n1)) { omitidos++; return }
      const hist = r.asesores.map((a,i)=>({ asesor:a, hora:r.hora||'—', fecha, motivo:i===0?'Asignacion inicial':`Rotacion ${i}` }))
      updates[fecha].push({ id:idCntRef.current++, _backendId:null, campana:r.campana, distrito:r.distrito, n1:r.n1, n2:r.n2, tipifBack:r.tipifBack, asesor:r.asesores[r.asesores.length-1]||'', horaAsig:r.hora, sinAsignar:r.asesores.length===0, rotaciones:Math.max(0,r.asesores.length-1), _tipifVend:r.tipifVend||'', _tipifHora:r.hora||'', historial:hist })
      leadsBackend.push({ campana:r.campana, distrito:r.distrito, n1:r.n1, n2:r.n2, tipif_back:r.tipifBack, asesor_nombre:r.asesores[r.asesores.length-1]||'', fecha, hora_asig:r.hora })
      importados++
    })
    setBaseData(prev => { const n={...prev}; for(const f in updates) n[f]=[...(prev[f]||[]),...updates[f]]; return n })
    setFechaPestanas(prev => [...prev, ...nuevasFechasLocal.filter(f=>!prev.includes(f))].sort().reverse())
    if (leadsBackend.length) { try { await fetch(`${API}/leads`,{method:'POST',headers:ncHeaders(),body:JSON.stringify(leadsBackend)}) } catch(e){} }
    setLegacyRows([]); setLegacyInfo(''); setLegacyStatus('')
    if (legacyInputRef.current) legacyInputRef.current.value = ''
    mostrarToast(`${importados} importados${omitidos?' · '+omitidos+' omitidos':''}`)
  }

  // ── BL Modal ──────────────────────────────────────────────────────────────
  function abrirBlModal(nombre, asesorId) {
    setBlModal({ open:true, nombre, asesorId })
    setBlFecha(fechaHoy())
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const registrosActivos = baseData[fechaActiva] || []
  const registrosFiltrados = registrosActivos.filter(r => {
    if (filtros.tip    && !(r.tipifBack||'').toUpperCase().includes(filtros.tip.toUpperCase())) return false
    if (filtros.tipVend&& (r._tipifVend||'').toUpperCase() !== filtros.tipVend.toUpperCase())  return false
    if (filtros.asesor && !(r.asesor||'').toUpperCase().includes(filtros.asesor.toUpperCase())) return false
    if (filtros.numero && !r.n1.includes(filtros.numero) && !(r.n2||'').includes(filtros.numero)) return false
    return true
  })

  const statsBase = {
    total:      registrosActivos.length,
    ventas:     registrosActivos.filter(r=>(r.tipifBack||'').toUpperCase().includes('VENTA')).length,
    asignados:  registrosActivos.filter(r=>r.asesor&&r.asesor!=='').length,
    sinAsignar: registrosActivos.filter(r=>r.sinAsignar).length,
    rotaciones: registrosActivos.reduce((s,r)=>s+r.rotaciones,0),
  }

  const rendData = useMemo(() => {
    const mesActual = new Date().toISOString().slice(0,7)
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

  const allRotLeads    = rotPanelOpen ? buildRotLeads() : []
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
      <div className="topbar">
        <div className="brand">
          <div className="logo-circle"><img src="/assets/logo3.png" alt="Netcontact" /></div>
          <div className="brand-text">
            <h1>NET<span className="dot" /><span className="red">CONTACT</span></h1>
            <span className="brand-sub">Back Office</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="bo-usuario">{sesion?.nombre || 'Back Office'}</span>
          <a href="#" className="bo-salir" onClick={e=>{ e.preventDefault(); logout(); navigate('/') }}>Salir</a>
        </div>
      </div>

      <div className="bo-layout">
        {/* SIDEBAR */}
        <aside className="bo-sidebar">
          <div className="sidebar-sep">Principal</div>
          <button className={`bo-nav${seccion==='base'?' active':''}`} onClick={()=>irSeccion('base')}><span className="nav-dot" /> Base</button>
          <button className={`bo-nav${seccion==='carga-masiva'?' active':''}`} onClick={()=>irSeccion('carga-masiva')}><span className="nav-dot" /> Carga Masiva</button>
          <div className="sidebar-sep">Reportes</div>
          <button className={`bo-nav${seccion==='rendimiento'?' active':''}`} onClick={()=>irSeccion('rendimiento')}><span className="nav-dot" /> Rendimiento</button>
          <button className={`bo-nav${seccion==='avance'?' active':''}`} onClick={()=>irSeccion('avance')}><span className="nav-dot" /> Avance Asesores</button>
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
                        <div className="rot-regla"><div className="rot-regla-icon r-blue">⏱</div><div><strong>Mínimo 2h</strong> sin ser contactado para rotar</div></div>
                        <div className="rot-regla"><div className="rot-regla-icon r-green">✓</div><div><strong>Estado válido:</strong> Buzón, No contesta o Nuevo</div></div>
                        <div className="rot-regla"><div className="rot-regla-icon r-purple">#</div><div><strong>Máximo 4 leads</strong> por rotación a un mismo asesor</div></div>
                      </div>
                      <div className="bo-panel" style={{padding:'14px 16px'}}>
                        <div className="bo-panel-title">Disponibilidad de asesores</div>
                        {rotAsesoresDisp.map(a=>(
                          <div key={a.nombre} className="rot-asesor-row"><span>{a.nombre}</span><span className="rot-asesor-badge">{a.cnt} registros</span></div>
                        ))}
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
                          <button onClick={()=>{ setRotFiltroFecha(''); setRotSel({}) }} style={{padding:'5px 10px',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff',color:'#6b7280',fontSize:11,fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>Limpiar</button>
                        </div>
                      </div>
                      <div style={{overflowX:'auto'}} className="rot-table">
                        <table>
                          <thead><tr>
                            <th>
                              <input type="checkbox" checked={allAptosSelected} onChange={e=>{ if(e.target.checked){const ns={};rotAptos.slice(0,rotCant).forEach(l=>{ns[l.id]=true});setRotSel(ns);}else setRotSel({}) }} />
                            </th>
                            <th>N1 / Campaña</th><th>Fecha</th><th>Tipif. Back</th>
                            <th>Asesor actual</th><th>Hora asig.</th><th>Tiempo</th>
                            <th>Sin repetir</th><th>Aptitud</th>
                          </tr></thead>
                          <tbody>
                            {allRotLeads.length === 0
                              ? <tr><td colSpan={9} className="bo-empty">Sin leads.</td></tr>
                              : allRotLeads.map(l => {
                                  const { apto, sinRepetir, tiempo } = rotApto(l, rotAsesor)
                                  const mins = rotMins(l.ultimaAsig)
                                  const esFechaHoy = l.fecha === fechaHoy()
                                  return (
                                    <tr key={l.id} className={(!rotAsesor||apto)?'':'row-noapto'}>
                                      <td><input type="checkbox" checked={!!rotSel[l.id]} disabled={!apto&&!!rotAsesor} onChange={e=>rotToggleSel(l.id,e.target.checked)} /></td>
                                      <td><div style={{fontFamily:'monospace',fontWeight:700,color:'#111827',fontSize:12}}>{l.tel}</div><div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>{l.campana} · {l.n2||'—'}</div></td>
                                      <td>{esFechaHoy ? <span style={{background:'#dcfce7',color:'#166534',fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99}}>HOY</span> : <span style={{background:'#f3f4f6',color:'#6b7280',fontSize:9,padding:'1px 6px',borderRadius:99}}>{formatFecha(l.fecha)}</span>}</td>
                                      <td><span className={`tipif-badge ${tipifBadgeClass(l.estado)}`}>{l.estado||'Sin tipif.'}</span></td>
                                      <td style={{fontSize:12}}>{l.asesor}</td>
                                      <td className="hora-color">{l.ultimaAsig.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td>
                                      <td className={tiempo?'timer-ok':'timer-fail'}>{rotTxt(l.ultimaAsig)} {tiempo?'OK':'falta '+(120-mins)+'min'}</td>
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

            {/* FORMULARIO AGREGAR INDIVIDUAL */}
            <div className="bo-panel" style={{marginBottom:14}}>
              <div className="bo-panel-title">
                + Agregar registro individual —&nbsp;
                <span style={{fontSize:10,color:'#374151',fontWeight:600,textTransform:'none',letterSpacing:0}}>{formatFecha(fechaActiva)}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:10}}>
                <div className="bo-input-group"><label>Campaña</label><input className="form-control" value={form.campana} onChange={e=>setForm(p=>({...p,campana:e.target.value}))} placeholder="Ej: NKT" /></div>
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
                <button className="bo-btn-limpiar btn btn-sm" onClick={()=>setForm({campana:'',dpto:'',prov:'',distrito:'',n1:'',n2:'',tipifBack:'',asesor:''})}>Limpiar</button>
                <button className="bo-btn-agregar" onClick={agregarRegistro}>+ Agregar registro</button>
              </div>
            </div>

            {/* FILTROS */}
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
                  <option>CONTESTA</option><option>NC</option><option>SIN COBERTURA</option><option>DERIVADO</option>
                </select>
              </div>
              <div className="bo-input-group"><label>Asesor</label>
                <select className="form-select" value={filtros.asesor} onChange={e=>setFiltros(p=>({...p,asesor:e.target.value}))}>
                  <option value="">Todos</option>
                  {asesores.map(a=><option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                </select>
              </div>
              <div className="bo-input-group"><label>Número</label>
                <input className="form-control" value={filtros.numero} onChange={e=>setFiltros(p=>({...p,numero:e.target.value}))} placeholder="Buscar N1 o N2..." />
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6,justifyContent:'flex-end',paddingBottom:2}}>
                <label className="toggle-col">
                  <input type="checkbox" checked={filtros.verTipVend} onChange={e=>setFiltros(p=>({...p,verTipVend:e.target.checked}))} /> Ver tipif. vendedor
                </label>
                <button className="bo-btn-limpiar btn btn-sm" style={{fontSize:11,padding:'5px 11px'}} onClick={()=>setFiltros({tip:'',tipVend:'',asesor:'',numero:'',verTipVend:true})}>Limpiar filtros</button>
              </div>
            </div>

            {/* TABLA BASE */}
            <div className="base-tabla-wrap">
              <table className="base-tabla table table-sm table-hover">
                <thead>
                  <tr>
                    <th>#</th><th>Campaña</th><th>Distrito</th>
                    <th>N1</th><th>N2</th><th>Tipif. Back</th>
                    <th>Asesor asignado</th><th>Hora / Fecha asign.</th>
                    {filtros.verTipVend && <th>Tipif. Vendedor</th>}
                    <th>Sin asig.</th><th>Rotaciones</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.length === 0
                    ? <tr><td colSpan={filtros.verTipVend?12:11} className="bo-empty">Sin registros en {formatFecha(fechaActiva)}.</td></tr>
                    : registrosFiltrados.map((r,i) => {
                        const esExclusiva = r._tipifVend==='NO TOCAR'||r._tipifVend==='FRAUDE'
                        return [
                          <tr key={r.id} id={`fila-${r.id}`}>
                            <td style={{color:'#9ca3af',fontSize:10}}>{i+1}</td>
                            <td><strong>{r.campana}</strong></td>
                            <td style={{fontSize:11}}>{r.distrito}</td>
                            <td style={{fontFamily:'monospace',fontWeight:700,color:'#111827'}}>{r.n1}</td>
                            <td style={{fontFamily:'monospace',color:'#6b7280'}}>{r.n2||'—'}</td>
                            <td>{r.tipifBack ? <span className={`tipif-badge ${tipifBadgeClass(r.tipifBack)}`}>{r.tipifBack}</span> : <span style={{color:'#ccc',fontSize:10}}>—</span>}</td>
                            <td>
                              <select className="sel-asesor-tabla" value={r.asesor} onChange={e=>reasignarReg(r.id,e.target.value)}>
                                <option value="">— Sin asignar —</option>
                                {asesores.map(a=><option key={a.id} value={a.nombre}>{a.nombre}</option>)}
                              </select>
                            </td>
                            <td>{r.horaAsig ? <><span className="hora-cell">{r.horaAsig}</span> <span className="hora-date">{formatFecha(fechaActiva)}</span></> : <span className="hora-empty">—</span>}</td>
                            {filtros.verTipVend && (
                              <td>
                                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                                  <select className="sel-tipif-vend" value={r._tipifVend} onChange={e=>guardarTipif(r.id,e.target.value)} style={{fontSize:10,padding:'3px 6px',border:`1px solid ${esExclusiva?'#dc2626':'#e5e7eb'}`,borderRadius:6,fontFamily:'inherit',maxWidth:155,cursor:'pointer',color:esExclusiva?'#dc2626':'inherit',fontWeight:esExclusiva?700:'inherit',background:esExclusiva?'#fef2f2':'#fff'}}>
                                    <option value="">— Pendiente —</option>
                                    {TIPIF_VEND_OPCIONES.map(t=><option key={t} value={t}>{t}</option>)}
                                  </select>
                                  {r._tipifHora && <span style={{fontSize:9,color:'#9ca3af'}}>vendedor · {r._tipifHora}</span>}
                                </div>
                              </td>
                            )}
                            <td>{r.sinAsignar ? <span className="sin-asig-badge">Sin asig.</span> : <span style={{color:'#d1d5db',fontSize:10}}>—</span>}</td>
                            <td style={{textAlign:'center'}}>
                              {r.rotaciones > 0
                                ? <span style={{background:'#EDE9FE',color:'#4C1D95',fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:99,display:'inline-block'}}>{r.rotaciones}x</span>
                                : <span style={{color:'#d1d5db',fontSize:11}}>0</span>}
                            </td>
                            <td>
                              <div className="acciones-cell">
                                <button className="btn-rotar" onClick={()=>abrirModalRotar(r.id)}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                  Rotar
                                </button>
                                <button className="btn-hist" onClick={()=>setHistOpen(p=>({...p,[r.id]:!p[r.id]}))}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                  Historial
                                </button>
                                <button className="btn-del" onClick={()=>eliminarReg(r.id)} title="Eliminar">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                </button>
                              </div>
                            </td>
                          </tr>,
                          <tr key={`hist-${r.id}`} className={`historial-row${histOpen[r.id]?' open':''}`}>
                            <td colSpan={filtros.verTipVend?12:11}>
                              <div className="historial-inner">
                                <div className="hist-label">Historial de asignaciones — N1: {r.n1}</div>
                                {r.historial.length
                                  ? r.historial.map((h,hi)=>(
                                      <div key={hi} className="hist-item">
                                        <div className="hist-dot" style={{background:DOT_COLORS[hi%DOT_COLORS.length]}} />
                                        <span style={{fontWeight:600}}>{h.asesor}</span>
                                        <span className="hora-cell" style={{marginLeft:4}}>{h.hora}</span>
                                        <span style={{color:'#9ca3af',marginLeft:4}}>{h.fecha}</span>
                                        <span style={{color:'#6b7280',fontStyle:'italic',marginLeft:8}}>{h.motivo}</span>
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
                <p className="bo-sub">Pega números directamente · importa CSV/TXT · o usa tu sistema antiguo</p>
              </div>
            </div>

            {/* Date nav carga masiva */}
            <div className="fecha-nav-row" style={{marginBottom:16}}>
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
                      <div className="bo-input-group" style={{margin:0}}><label>Campaña</label><input value={masivaCamp} onChange={e=>setMasivaCamp(e.target.value)} placeholder="NKT" /></div>
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
                    <button className="btn-masiva-preview" onClick={previsualizarMasiva}>Vista previa</button>
                    <button className="btn-masiva-go" onClick={ejecutarCargaMasiva} disabled={masivaFilasParaCargar.length===0}>Cargar {masivaFilasParaCargar.length} registros</button>
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
                    <div style={{fontSize:12,color:'#9ca3af'}}>Acepta CSV · TXT — columnas: N1, N2, Campaña, Distrito, Tipif</div>
                    <input ref={archivoInputRef} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>{ if(e.target.files.length) procesarArchivo(e.target.files[0]) }} />
                  </div>
                  {archivoStatus && <div style={{marginTop:10,fontSize:12,color:'#6b7280'}}>{archivoStatus}</div>}
                  {archivoRows.length > 0 && (
                    <div style={{marginTop:10}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                        <span style={{fontSize:12,fontWeight:600,color:'#374151'}}>{archivoInfo}</span>
                        <button className="btn-masiva-go" onClick={ejecutarCargaArchivo}>Cargar {archivoRows.length} registros</button>
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
                  <div style={{background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:10,padding:14,marginBottom:14}}>
                    <div style={{fontSize:12,fontWeight:700,color:'#c2410c',marginBottom:4}}>Importación de sistema antiguo</div>
                    <div style={{fontSize:11,color:'#92400e',lineHeight:1.6}}>
                      Formato: <strong>CAMPAÑA · DISTRITO · N2 · N1 · TIPIF.BACK · COMENTARIO · TIPIFICACIÓN · HORA · ASESOR 1 · ... · ASESOR 6</strong>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 180px',gap:12,marginBottom:12}}>
                    <div
                      onClick={()=>legacyInputRef.current?.click()}
                      onDragOver={e=>{ e.preventDefault(); setLegacyDragOver(true) }}
                      onDragLeave={()=>setLegacyDragOver(false)}
                      onDrop={e=>{ e.preventDefault(); setLegacyDragOver(false); if(e.dataTransfer.files.length) procesarLegacy(e.dataTransfer.files[0]) }}
                      style={{border:`2px dashed ${legacyDragOver?'#c2410c':'#fed7aa'}`,borderRadius:10,padding:28,textAlign:'center',cursor:'pointer',background:legacyDragOver?'#fff7ed':'#fff'}}
                    >
                      <div style={{fontSize:13,fontWeight:600,color:'#374151',marginBottom:3}}>Arrastra tu base o haz clic</div>
                      <div style={{fontSize:11,color:'#9ca3af'}}>CSV exportado desde tu sistema anterior</div>
                      <input ref={legacyInputRef} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={e=>{ if(e.target.files.length) procesarLegacy(e.target.files[0]) }} />
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <div className="bo-input-group" style={{margin:0}}><label>Fecha destino</label>
                        <select value={legacyFecha} onChange={e=>setLegacyFecha(e.target.value)} style={{fontSize:12,padding:'7px 10px',border:'1px solid #e5e7eb',borderRadius:8,fontFamily:'inherit',background:'#fff'}}>
                          {fechaPestanas.map(f=><option key={f} value={f}>{formatFecha(f)}</option>)}
                        </select>
                      </div>
                      <div className="bo-input-group" style={{margin:0}}><label>Fecha de la fila</label>
                        <select value={legacyUsarFecha} onChange={e=>setLegacyUsarFecha(e.target.value)} style={{fontSize:12,padding:'7px 10px',border:'1px solid #e5e7eb',borderRadius:8,fontFamily:'inherit',background:'#fff'}}>
                          <option value="no">Usar fecha seleccionada</option>
                          <option value="si">Leer fecha de la fila</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  {legacyStatus && <div style={{fontSize:12,color:'#6b7280',marginBottom:8}}>{legacyStatus}</div>}
                  {legacyRows.length > 0 && (
                    <div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,flexWrap:'wrap',gap:8}}>
                        <span style={{fontSize:12,fontWeight:600,color:'#374151'}}>{legacyInfo}</span>
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn-masiva-preview" onClick={()=>setLegacyRows([])}>Cancelar</button>
                          <button className="btn-masiva-go" onClick={ejecutarCargaLegacy} style={{background:'#c2410c'}}>Importar {legacyRows.length} registros</button>
                        </div>
                      </div>
                      <div style={{maxHeight:200,overflowY:'auto',border:'1px solid #e5e7eb',borderRadius:8,background:'#fff'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11,whiteSpace:'nowrap'}}>
                          <thead><tr style={{background:'#f9fafb',position:'sticky',top:0}}>
                            {['#','Camp.','Dist.','N1','N2','Tipif. Back','Tipif.','Hora','Asesores','Fecha'].map(h=>(
                              <th key={h} style={{padding:'5px 10px',textAlign:'left',color:'#6b7280',fontSize:9,textTransform:'uppercase'}}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {legacyRows.slice(0,60).map((r,i)=>(
                              <tr key={i} style={{borderBottom:'1px solid #f3f4f6'}}>
                                <td style={{padding:'4px 10px',color:'#9ca3af'}}>{i+1}</td>
                                <td style={{padding:'4px 10px',fontWeight:600}}>{r.campana}</td>
                                <td style={{padding:'4px 10px'}}>{r.distrito}</td>
                                <td style={{padding:'4px 10px',fontFamily:'monospace',fontWeight:700,color:'#111827'}}>{r.n1}</td>
                                <td style={{padding:'4px 10px',fontFamily:'monospace',color:'#6b7280'}}>{r.n2||'—'}</td>
                                <td style={{padding:'4px 10px'}}>{r.tipifBack||'—'}</td>
                                <td style={{padding:'4px 10px'}}>{r.tipifVend||'—'}</td>
                                <td style={{padding:'4px 10px',color:'#185FA5',fontWeight:600}}>{r.hora||'—'}</td>
                                <td style={{padding:'4px 10px',color:'#6b7280'}}>{r.asesores.join(' → ')||'—'}</td>
                                <td style={{padding:'4px 10px',color:'#374151'}}>{formatFecha(r.fecha)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ══ SECCIÓN: RENDIMIENTO ═══════════════════════════════════════════ */}
          <section className={`bo-seccion${seccion==='rendimiento'?'':' hidden'}`}>
            <div className="bo-seccion-header"><h2>Rendimiento de Asesores</h2></div>
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
              {[['Total Leads',rendTotLeads],['Total Ventas',rendTotVentas],['Conversion',rendTotConv+'%'],['Asesores',asesores.length]].map(([l,v])=>(
                <div key={l} className="rend-kpi"><div className="rend-kpi-label">{l}</div><div className="rend-kpi-valor">{v}</div></div>
              ))}
            </div>
            <div className="bo-tabla-wrap">
              <table className="bo-tabla table table-sm table-hover">
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
                          <td><div className="bo-cliente-cell"><div className="bo-cliente-avatar" style={{background:colorAv(r.nombre)}}>{iniciales(r.nombre)}</div><div><div style={{fontWeight:600,fontSize:13}}>{r.nombre}</div><div style={{fontSize:10,color:'#9ca3af'}}>{r.usuario}</div></div></div></td>
                          <td style={{fontWeight:600}}>{r.leads}</td>
                          <td style={{color:'#16a34a',fontWeight:600}}>{r.contesta}</td>
                          <td style={{color:'#d97706',fontWeight:600}}>{r.nc}</td>
                          <td><span style={{fontSize:18,fontWeight:800,color:'#111827'}}>{r.ventas}</span></td>
                          <td><span className={`tipif-badge ${r.conv>=30?'b-venta':r.conv>=15?'b-nocontesta':'b-default'}`}>{r.conv}%</span></td>
                          <td><div className="rend-bar-wrap"><div className="rend-bar"><div className="rend-bar-fill" style={{width:`${Math.round(r.ventas/rendMaxVentas*100)}%`}} /></div><span style={{fontSize:10,color:'#9ca3af'}}>{Math.round(r.ventas/rendMaxVentas*100)}%</span></div></td>
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
              <button className="btn-confirmar-modal" onClick={confirmarRotacion}>Rotar ahora</button>
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
                <div style={{fontSize:12,color:'#9ca3af',marginTop:2}}>Solo lectura · Back Office</div>
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
      <div className={`notify-toast${toast?' show':''}`}>{toast}</div>
    </div>
  )
}
