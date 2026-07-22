import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import MediaViewer from '../components/MediaViewer'
import { HistorialVentaModal, ReasignarVentaModal } from '../components/VentaAssignmentModal'
import { API, ncHeaders } from '../services/api'
import { permisosDeUsuario, usuarioTieneCargo } from '../utils/roles'
import Chart from 'chart.js/auto'
import '../styles/jefatura.css'

/* ── constantes ── */
const JEF_APARTADO_KEY     = 'nc_jefatura_apartado'
const JEF_SALA_REPORTE_KEY = 'nc_jefatura_sala_reporte'
const JEF_SEG_FILTRO_KEY   = 'nc_jefatura_seg_filtro'

const CARGOS = [
  { id:'asesor',         label:'Asesor',           cls:'bc-asesor'         },
  { id:'supervisor',     label:'Supervisor',        cls:'bc-supervisor'     },
  { id:'backoffice',     label:'Back Data',         cls:'bc-backoffice'     },
  { id:'validacion',     label:'Validación',        cls:'bc-validacion'     },
  { id:'grabaciones',    label:'Grabaciones',       cls:'bc-grabaciones'    },
  { id:'seguimiento',    label:'Seguimiento',       cls:'bc-seguimiento'    },
  { id:'jefatura',       label:'Jefatura',          cls:'bc-jefatura'       },
  { id:'usuarios',       label:'Usuarios',          cls:'bc-usuarios'       },
  { id:'programacion',   label:'Programación',      cls:'bc-programacion'   },
  { id:'supgrabaciones', label:'Sup. Grabaciones',  cls:'bc-supgrabaciones' },
]
const SALAS = ['SALA 1','SALA 2','SALA 3','SALA 4','SALA CHANCAY','SALA 5','SIN SALA']

const SEG_MAP = {
  aprobado:'ejecucion',programado:'ejecucion',en_ejecucion:'ejecucion',
  instalado:'instalado',caida:'caida',rechazo_campo:'rechazo',tecnico_casa:'tecnico',
  validado:'ejecucion',observado:'ejecucion',
}
const SEG_BADGES = {
  ejecucion:{ label:'EN EJECUCIÓN',    bg:'#cffafe', color:'#155e75' },
  instalado:{ label:'INSTALADO',       bg:'#d1fae5', color:'#065f46' },
  rechazo:  { label:'RECHAZO CAMPO',   bg:'#ffedd5', color:'#9a3412' },
  caida:    { label:'CAÍDA',           bg:'#fee2e2', color:'#991b1b' },
  tecnico:  { label:'TÉCNICO EN CASA', bg:'#f3e8ff', color:'#6b21a8' },
}
const SEG_ORD = { caida:0, rechazo:1, tecnico:2, ejecucion:3, instalado:4 }

const ACCESOS_MODS = [
  { nombre:'Back Data',        desc:'Gestión y asignación de leads', icon:'clipboard', path:'/backoffice',      color:'#dc3545', cargo:'backoffice' },
  { nombre:'Validación',       desc:'Control y revisión de ventas',  icon:'shield',    path:'/validacion',      color:'#059669', cargo:'validacion' },
  { nombre:'Grabaciones',      desc:'Auditoría de llamadas',         icon:'mic',       path:'/grabaciones',     color:'#0f766e', cargo:'grabaciones' },
  { nombre:'Seguimiento',      desc:'Seguimiento postventa',         icon:'activity',  path:'/seguimiento',     color:'#0284c7', cargo:'seguimiento' },
  { nombre:'Supervisor',       desc:'Gestión de equipos y salas',    icon:'briefcase', path:'/supervisor',      color:'#7c3aed', cargo:'supervisor' },
  { nombre:'Dashboard CRM',    desc:'Panel individual del asesor',   icon:'chart',     path:'/dashboard',       color:'#2563eb', cargo:'asesor' },
  { nombre:'Gestión Usuarios', desc:'Administración de accesos',     icon:'users',     path:'/usuarios',        color:'#be185d', cargo:'usuarios' },
  { nombre:'Programación',     desc:'Agenda de instalaciones',       icon:'calendar',  path:'/programacion',    color:'#c2410c', cargo:'programacion' },
  { nombre:'Sup. Grabaciones', desc:'Supervisión del equipo de audio',icon:'headphones',path:'/sup-grabaciones',color:'#047857', cargo:'supgrabaciones' },
]

function ModuloIcon({ tipo, size = 24 }) {
  const trazos = {
    clipboard: <><rect x="7" y="4.5" width="10" height="15" rx="2.3"/><path d="M10 8.5h4M10 12h4M10 15.5h4"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></>,
    activity: <><path d="M3 12h4l2.2-5 4.1 10 2.2-5H21"/><circle cx="12" cy="12" r="9"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="m4 7 5-3 6 5 5-4"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 18h2"/></>,
    headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M18 19h-2v-7h4v5a2 2 0 0 1-2 2ZM6 19H4a2 2 0 0 1-2-2v-5h4v7Z"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{display:'block', margin:'auto', flex:'0 0 auto'}}>{trazos[tipo] || trazos.activity}</svg>
}

/* ── helpers puros ── */
function fechaHoy()    { return new Date().toISOString().split('T')[0] }
function horaAhora()   { return new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',hour12:false}) }
function mesActual()   { return fechaHoy().slice(0,7) }
function formatF(f)    { if(!f)return'—'; const p=f.split('-'); return `${p[2]}/${p[1]}/${p[0]}` }
function cargoObj(id)  { return CARGOS.find(c=>c.id===id)||{label:id,cls:'bc-default'} }
function colorAvatar(n){ const c=["#3b82f6","#8b5cf6","#22c55e","#f97316","#ef4444","#06b6d4","#ec4899","#f59e0b"]; let s=0; for(const ch of n) s+=ch.charCodeAt(0); return c[s%c.length] }
function iniciales(n)  { return n.trim().split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase() }
function mapSeg(e)     { const s=(e||'').toLowerCase(); if(s.includes('tecnico'))return'tecnico'; if(s.includes('rechazo'))return'rechazo'; if(s.includes('ejecucion'))return'ejecucion'; return SEG_MAP[s]||null }
function efColor(v)    { return v>=70?'#16a34a':v>=40?'#d97706':'#dc2626' }
function efBg(v)       { return v>=70?'#d1fae5':v>=40?'#fef3c7':'#fee2e2' }
function normEstado(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
const FLUJO_NO_VALIDA = new Set(['venta','corta_llamada','fraude','no_desea','no_contesta','buzon_voz','servicio_activo','no_validado','bloqueado','zona_restringida','caracter_especial','sin_agenda'])
const FLUJO_GRABADA = new Set(['grabado','grabada','aprobado','programado','en_ejecucion','instalado','caida','rechazo_campo','tecnico_casa'])
const FLUJO_SEGUIMIENTO = new Set(['programado','en_ejecucion','instalado','caida','rechazo_campo','tecnico_casa'])
function flujoTieneAudio(v) {
  return Boolean(v?.audio || v?.audio_url || v?.archivo_audio || v?.archivoAudio || v?.grabacion || v?.grabacion_url || v?.audio_path)
}
function flujoNoValidada(v) { return FLUJO_NO_VALIDA.has(normEstado(v?.estado || v?.estado_venta)) }
function flujoValidada(v) {
  const e = normEstado(v?.estado || v?.estado_venta)
  return Boolean(e) && e !== 'venta' && !flujoNoValidada(v)
}
function flujoGrabada(v) { return FLUJO_GRABADA.has(normEstado(v?.estado || v?.estado_venta)) || flujoTieneAudio(v) }
function flujoNoGrabada(v) { return flujoValidada(v) && !flujoGrabada(v) }
function flujoLabelEstado(estado) {
  const e = normEstado(estado)
  return ({
    venta:'Venta subida',
    validado:'Validada',
    validada:'Validada',
    no_validado:'No validada',
    grabado:'Grabada',
    grabada:'Grabada',
    aprobado:'Grabada',
    observado:'Observada',
    en_revision:'En revisión',
    programado:'Programada',
    en_ejecucion:'En ejecución',
    instalado:'Instalada',
    caida:'Caída',
    rechazo_campo:'Rechazo campo',
    tecnico_casa:'Técnico en casa',
    corta_llamada:'Corta llamada',
    fraude:'Fraude',
    no_desea:'No desea',
    no_contesta:'No contesta',
    servicio_activo:'Servicio activo',
    buzon_voz:'Buzón de voz',
    bloqueado:'Bloqueado',
    zona_restringida:'Zona restringida',
    caracter_especial:'Carácter especial',
    sin_agenda:'Sin agenda',
  })[e] || (estado || 'Venta subida')
}

const MEDALS = ['🥇','🥈','🥉']
const MOD_FORM_VACIO = { nombre:'', usuario:'', cargo:'', cargo2:'', sala:'', pass:'', pass2:'' }

export default function Jefatura() {
  const navigate = useNavigate()
  const { sesion, logout } = useAuth()
  const usuarioNombre = sesion?.nombre || 'Jefatura'
  const mainRef = useRef(null)
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)

  /* nav */
  const [seccion, setSeccion] = useState(() => {
    try { return sessionStorage.getItem(JEF_APARTADO_KEY) || 'dashboard' } catch { return 'dashboard' }
  })

  /* data */
  const [usuarios,    setUsuarios]    = useState([])
  const [usuariosCarga, setUsuariosCarga] = useState({ cargando:true, error:'' })
  const [ventasCache, setVentasCache] = useState([])
  const [ventasSeg,   setVentasSeg]   = useState([])


  /* filtros persistentes */
  const [filtroSeg, setFiltroSeg] = useState(() => {
    try { return sessionStorage.getItem(JEF_SEG_FILTRO_KEY) || '' } catch { return '' }
  })
  const [salaReporte, setSalaReporte] = useState(() => {
    try { return sessionStorage.getItem(JEF_SALA_REPORTE_KEY) || 'todas' } catch { return 'todas' }
  })
  const [mesReporte, setMesReporte] = useState('')
  const [busqUsuarios, setBusqUsuarios] = useState('')
  const [filtroFlujoVentas, setFiltroFlujoVentas] = useState('todas')
  const [busqFlujoVentas, setBusqFlujoVentas] = useState('')

  /* logs */
  const [logs, setLogs] = useState(() => {
    try { const r = localStorage.getItem('jef_logs'); return r ? JSON.parse(r) : [] } catch { return [] }
  })

  /* modal usuario */
  const [modalUsu,    setModalUsu]    = useState(false)
  const [editandoId,  setEditandoId]  = useState(null)
  const [modForm,     setModForm]     = useState(MOD_FORM_VACIO)
  const [modErrores,  setModErrores]  = useState({})
  const [guardandoUsu,setGuardandoUsu]= useState(false)
  const [modalEliminar, setModalEliminar] = useState(null)
  const [eliminandoUsu, setEliminandoUsu] = useState(false)

  /* selector de usuario por módulo */
  const [selectorModulo, setSelectorModulo] = useState({ open:false, modulo:null, buscar:'' })
  const [mediaVenta, setMediaVenta] = useState(null)
  const [ventaReasignar, setVentaReasignar] = useState(null)
  const [ventaHistorial, setVentaHistorial] = useState(null)

  /* charts */
  const canvasEstados = useRef(null)
  const canvasSalas   = useRef(null)
  const canvasDiario  = useRef(null)
  const chartInst     = useRef({})

  /* toast */
  const [toastMsg, setToastMsg] = useState('')
  const toastRef = useRef(null)

  function mostrarToast(msg) {
    setToastMsg(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToastMsg(''), 3200)
  }

  function agregarLog(accion, detalle = '') {
    const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, fecha: fechaHoy(), hora: horaAhora(), usuario: usuarioNombre, accion, detalle, color: '#7C3AED' }
    setLogs(prev => {
      const next = [entry, ...prev].slice(0, 200)
      try { localStorage.setItem('jef_logs', JSON.stringify(next.slice(0, 100))) } catch {}
      return next
    })
  }

  /* ── carga de datos ── */
  const cargarUsuarios = useCallback(async () => {
    setUsuariosCarga({ cargando:true, error:'' })
    try {
      const res  = await fetch(`${API}/usuarios`, { headers: ncHeaders() })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        sessionStorage.removeItem('nc_token')
        sessionStorage.removeItem('nc_usuario')
        window.location.replace('/login')
        return
      }
      if (!res.ok || !data.ok) {
        setUsuariosCarga({ cargando:false, error:data.mensaje || 'No se pudo cargar la lista de usuarios.' })
        return
      }
      setUsuarios(Array.isArray(data.data) ? data.data : [])
      setUsuariosCarga({ cargando:false, error:'' })
    } catch {
      setUsuariosCarga({ cargando:false, error:'No fue posible conectar con la API. Los usuarios no han sido eliminados.' })
    }
  }, [])

  const cargarVentasCache = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/ventas`, { headers: ncHeaders() })
      const data = await res.json()
      if (data.ok) setVentasCache(data.data.map(v => ({ ...v, _fecha: (v.created_at || '').split(' ')[0] })))
    } catch { console.error('Error cargando ventas') }
  }, [])

  const cargarSeguimiento = useCallback(async () => {
    try {
      const res  = await fetch(`${API}/ventas`, { headers: ncHeaders() })
      const data = await res.json()
      if (data.ok) {
        setVentasSeg(data.data
          .filter(v => mapSeg(v.estado) !== null)
          .map(v => ({ ...v, _seg: mapSeg(v.estado), _fecha: (v.created_at || '').split(' ')[0] }))
        )
      }
    } catch { console.error('Error seguimiento') }
  }, [])

  async function completarReasignacion(data) {
    const venta = ventaReasignar
    setVentaReasignar(null)
    await Promise.all([cargarSeguimiento(), cargarVentasCache()])
    agregarLog('Venta reasignada', data?.mensaje || `Venta ${venta?.id || ''}`)
    mostrarToast(data?.mensaje || 'Venta reasignada correctamente')
  }

  async function eliminarVenta(venta) {
    const cliente = venta?.nombre || `venta ${venta?.id}`
    if (!window.confirm(`¿Eliminar definitivamente la venta de ${cliente}? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`${API}/ventas/${venta.id}`, { method:'DELETE', headers:ncHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.mensaje || 'No se pudo eliminar la venta.')
      setVentasSeg(prev => prev.filter(item => item.id !== venta.id))
      setVentasCache(prev => prev.filter(item => item.id !== venta.id))
      agregarLog('Venta eliminada', `${cliente} · DNI ${venta?.dni || '—'}`)
      mostrarToast('Venta eliminada correctamente')
    } catch (error) {
      mostrarToast(error.message || 'Error de conexión')
    }
  }

  /* mount */
  useEffect(() => {
    cargarUsuarios()
    cargarVentasCache()
    agregarLog('Sesión iniciada', 'Panel de Jefatura')
    const iv = setInterval(async () => {
      await cargarVentasCache()
    }, 3000)
    return () => clearInterval(iv)
  }, [cargarUsuarios, cargarVentasCache])

  useEffect(() => {
    if (seccion === 'seguimiento') cargarSeguimiento()
  }, [seccion, cargarSeguimiento])

  /* charts — siempre en DOM; solo recrear cuando estamos en dashboard */
  useEffect(() => {
    if (seccion !== 'dashboard') return

    function destroy(key) {
      if (chartInst.current[key]) { try { chartInst.current[key].destroy() } catch {} delete chartInst.current[key] }
    }

    /* Chart 1 — doughnut estados */
    if (canvasEstados.current) {
      destroy('estados')
      const e  = s => (s || '').toLowerCase()
      const estados = [
        { label:'Validadas',       val: ventasCache.filter(v=>!['venta','','corta_llamada','fraude','no_desea','no_contesta','servicio_activo','no_validado'].includes(e(v.estado))).length, color:'#7C3AED' },
        { label:'No validadas',    val: ventasCache.filter(v=>['venta','corta_llamada','fraude','no_desea','no_contesta','servicio_activo','no_validado'].includes(e(v.estado))).length,        color:'#ef4444' },
        { label:'Grabadas',        val: ventasCache.filter(v=>['grabado','aprobado','en_ejecucion','instalado','caida','rechazo_campo','tecnico_casa','programado'].includes(e(v.estado))).length, color:'#d97706' },
        { label:'No grabadas',     val: ventasCache.filter(v=>e(v.estado)==='validado').length,  color:'#9ca3af' },
        { label:'No programadas',  val: ventasCache.filter(v=>['bloqueado','sin_agenda','caracter_especial','fraude','zona_restringida'].includes(e(v.estado))).length, color:'#6366f1' },
        { label:'Instaladas',      val: ventasCache.filter(v=>e(v.estado)==='instalado').length, color:'#16a34a' },
        { label:'Caídas',          val: ventasCache.filter(v=>e(v.estado)==='caida').length,     color:'#dc2626' },
        { label:'Rechazos',        val: ventasCache.filter(v=>e(v.estado)==='rechazo_campo').length, color:'#f97316' },
      ].filter(x => x.val > 0)
      if (estados.length) {
        chartInst.current.estados = new Chart(canvasEstados.current, {
          type: 'doughnut',
          data: { labels: estados.map(x=>x.label), datasets: [{ data: estados.map(x=>x.val), backgroundColor: estados.map(x=>x.color), borderWidth:2, borderColor:'#fff', hoverOffset:6 }] },
          options: { responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{position:'right',labels:{font:{size:11},boxWidth:12,padding:10}}, tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw}`}} } }
        })
      }
    }

    /* Chart 2 — bar salas */
    if (canvasSalas.current) {
      destroy('salas')
      const mesUsar   = mesReporte || mesActual()
      const ventasMes = ventasCache.filter(v => v._fecha && v._fecha.startsWith(mesUsar))
      const salas     = ['SALA 1','SALA 2','SALA 3','SALA 4','SALA CHANCAY','SALA 5']
      const instaladas = salas.map(s => {
        const nombres = usuarios.filter(u=>u.sala===s).map(u=>u.nombre)
        return ventasMes.filter(v=>nombres.includes(v.asesor_nombre||'')&&(v.estado||'').toLowerCase()==='instalado').length
      })
      const caidas = salas.map(s => {
        const nombres = usuarios.filter(u=>u.sala===s).map(u=>u.nombre)
        return ventasMes.filter(v=>nombres.includes(v.asesor_nombre||'')&&(v.estado||'').toLowerCase()==='caida').length
      })
      chartInst.current.salas = new Chart(canvasSalas.current, {
        type: 'bar',
        data: { labels:salas, datasets:[
          { label:'Instaladas', data:instaladas, backgroundColor:'#16a34a', borderRadius:6 },
          { label:'Caídas',     data:caidas,     backgroundColor:'#ef4444', borderRadius:6 },
        ]},
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}} }
      })
    }

    /* Chart 3 — line diario */
    if (canvasDiario.current) {
      destroy('diario')
      const dias = []
      for (let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); dias.push(d.toISOString().split('T')[0]) }
      const salas  = ['SALA 1','SALA 2','SALA 3','SALA 4','SALA CHANCAY','SALA 5']
      const colors = ['#3b82f6','#8b5cf6','#22c55e','#f97316','#06b6d4','#f43f5e']
      const datasets = salas.map((s,i) => {
        const nombres = usuarios.filter(u=>u.sala===s).map(u=>u.nombre)
        return { label:s, data:dias.map(d=>ventasCache.filter(v=>v._fecha===d&&nombres.includes(v.asesor_nombre||'')).length), borderColor:colors[i], backgroundColor:colors[i]+'22', fill:true, tension:.4, borderWidth:2, pointRadius:4 }
      })
      chartInst.current.diario = new Chart(canvasDiario.current, {
        type: 'line',
        data: { labels:dias.map(d=>{const p=d.split('-');return `${p[2]}/${p[1]}`}), datasets },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{font:{size:11},boxWidth:12}}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#f3f4f6'}},x:{grid:{display:false}}} }
      })
    }

    return () => { destroy('estados'); destroy('salas'); destroy('diario') }
  }, [seccion, ventasCache, usuarios, mesReporte])

  /* ── navegación ── */
  function irSeccion(id) {
    setSeccion(id)
    setMenuMovilAbierto(false)
    try { sessionStorage.setItem(JEF_APARTADO_KEY, id) } catch {}
  }

  /* ── KPIs dashboard ── */
  const kpis = useMemo(() => {
    const e   = s => (s||'').toLowerCase()
    const hoy = fechaHoy(), mes = mesActual()
    const inst  = ventasCache.filter(v=>e(v.estado)==='instalado').length
    const caida = ventasCache.filter(v=>['caida','rechazo_campo'].includes(e(v.estado))).length
    const instM = ventasCache.filter(v=>v._fecha&&v._fecha.startsWith(mes)&&e(v.estado)==='instalado').length
    const caidM = ventasCache.filter(v=>v._fecha&&v._fecha.startsWith(mes)&&['caida','rechazo_campo'].includes(e(v.estado))).length
    const efect = (instM+caidM)>0?Math.round(instM/(instM+caidM)*100):0
    return {
      ventasHoy:     ventasCache.filter(v=>v._fecha===hoy).length,
      validadas:     ventasCache.filter(v=>!['venta',''].includes(e(v.estado))).length,
      noValidadas:   ventasCache.filter(v=>['venta','corta_llamada','fraude','no_desea','no_contesta','servicio_activo','no_validado'].includes(e(v.estado))).length,
      grabadas:      ventasCache.filter(v=>['grabado','aprobado','en_ejecucion','instalado','caida','rechazo_campo','tecnico_casa','programado'].includes(e(v.estado))).length,
      noGrabadas:    ventasCache.filter(v=>e(v.estado)==='validado').length,
      enEjecucion:   ventasCache.filter(v=>['aprobado','programado','en_ejecucion','tecnico_casa'].includes(e(v.estado))).length,
      noProgramadas: ventasCache.filter(v=>['bloqueado','sin_agenda','caracter_especial','fraude','zona_restringida'].includes(e(v.estado))).length,
      instaladas:    inst,
      caidas:        caida,
      conv:          efect+'%',
      totalUs:       usuarios.length,
      activos:       usuarios.filter(u=>u.activo).length,
      asesores:      usuarios.filter(u=>usuarioTieneCargo(u,'asesor')&&u.activo).length,
      supervisores:  usuarios.filter(u=>usuarioTieneCargo(u,'supervisor')&&u.activo).length,
    }
  }, [ventasCache, usuarios])

  /* ── usuarios para el selector de accesos ── */
  const usuariosModulo = useMemo(() => {
    const modulo = selectorModulo.modulo
    if (!modulo) return []
    const buscar = selectorModulo.buscar.trim().toLowerCase()
    return usuarios
      .filter(u => usuarioTieneCargo(u, modulo.cargo))
      .filter(u => !buscar || [u.nombre, u.usuario, u.sala].some(v => String(v || '').toLowerCase().includes(buscar)))
      .sort((a, b) => Number(Boolean(b.activo)) - Number(Boolean(a.activo)) || String(a.nombre || '').localeCompare(String(b.nombre || '')))
  }, [usuarios, selectorModulo])

  function abrirSelectorModulo(modulo) {
    setSelectorModulo({ open:true, modulo, buscar:'' })
  }

  function cerrarSelectorModulo() {
    setSelectorModulo({ open:false, modulo:null, buscar:'' })
  }

  function entrarModulo(modulo, usuario) {
    const objetivo = {
      id: usuario.id,
      nombre: usuario.nombre,
      usuario: usuario.usuario,
      cargo: modulo.cargo,
      cargoPrincipal: usuario.cargo,
      cargos: [usuario.cargo, ...permisosDeUsuario(usuario)],
      permisos: permisosDeUsuario(usuario),
      sala: usuario.sala || '',
      path: modulo.path,
    }
    sessionStorage.setItem('nc_jefatura_usuario_objetivo', JSON.stringify(objetivo))
    if (modulo.cargo === 'asesor') {
      sessionStorage.setItem('nc_dashboard_asesor_objetivo', JSON.stringify(objetivo))
    } else {
      sessionStorage.removeItem('nc_dashboard_asesor_objetivo')
    }
    agregarLog('Acceso a módulo', `${modulo.nombre}: ${usuario.nombre}`)
    cerrarSelectorModulo()
    navigate(modulo.path)
  }

  /* ── seguimiento ── */
  const ventasSegFiltradas = useMemo(() => {
    const lista = (filtroSeg ? ventasSeg.filter(v=>v._seg===filtroSeg) : [...ventasSeg])
      .sort((a,b) => (SEG_ORD[a._seg]??5) - (SEG_ORD[b._seg]??5))
    return lista
  }, [ventasSeg, filtroSeg])

  const kpisSeg = useMemo(() => ({
    ejecucion: ventasSeg.filter(v=>v._seg==='ejecucion').length,
    instalado: ventasSeg.filter(v=>v._seg==='instalado').length,
    rechazo:   ventasSeg.filter(v=>v._seg==='rechazo').length,
    caida:     ventasSeg.filter(v=>v._seg==='caida').length,
    tecnico:   ventasSeg.filter(v=>v._seg==='tecnico').length,
  }), [ventasSeg])

  /* ── flujo general de ventas ── */
  const resumenFlujoVentas = useMemo(() => ({
    todas: ventasCache.length,
    validadas: ventasCache.filter(flujoValidada).length,
    noValidadas: ventasCache.filter(flujoNoValidada).length,
    grabadas: ventasCache.filter(flujoGrabada).length,
    noGrabadas: ventasCache.filter(flujoNoGrabada).length,
    seguimiento: ventasCache.filter(v => FLUJO_SEGUIMIENTO.has(normEstado(v.estado || v.estado_venta))).length,
  }), [ventasCache])

  const ventasFlujoFiltradas = useMemo(() => {
    let lista = [...ventasCache]
    if (filtroFlujoVentas === 'validadas') lista = lista.filter(flujoValidada)
    if (filtroFlujoVentas === 'noValidadas') lista = lista.filter(flujoNoValidada)
    if (filtroFlujoVentas === 'grabadas') lista = lista.filter(flujoGrabada)
    if (filtroFlujoVentas === 'noGrabadas') lista = lista.filter(flujoNoGrabada)
    if (filtroFlujoVentas === 'seguimiento') {
      lista = lista.filter(v => FLUJO_SEGUIMIENTO.has(normEstado(v.estado || v.estado_venta)))
    }

    const b = busqFlujoVentas.trim().toLowerCase()
    if (b) {
      lista = lista.filter(v => [
        v.nombre, v.nombre_apellidos, v.cliente, v.dni, v.documento, v.telefono, v.n1, v.n2,
        v.asesor_nombre, v.asesor, v.vendedor, v.sala, v.estado, v.estado_venta, v.distrito
      ].some(x => String(x || '').toLowerCase().includes(b)))
    }

    return lista.sort((a, b) => {
      const fb = String(b._fecha || b.fecha_ingreso || b.fecha || b.created_at || '')
      const fa = String(a._fecha || a.fecha_ingreso || a.fecha || a.created_at || '')
      return fb.localeCompare(fa) || Number(b.id || 0) - Number(a.id || 0)
    })
  }, [ventasCache, filtroFlujoVentas, busqFlujoVentas])

  /* ── reportes ── */
  const { reporteData, repKpis } = useMemo(() => {
    let asesFilt = usuarios.filter(u=>usuarioTieneCargo(u,'asesor'))
    if (salaReporte !== 'todas') asesFilt = asesFilt.filter(u=>u.sala===salaReporte)
    let ventasFilt = ventasCache
    if (salaReporte !== 'todas') {
      const nombres = asesFilt.map(a=>a.nombre)
      ventasFilt = ventasCache.filter(v=>nombres.includes(v.asesor_nombre||''))
    }
    const inst   = ventasFilt.filter(v=>(v.estado||'').toLowerCase()==='instalado').length
    const caidas = ventasFilt.filter(v=>(v.estado||'').toLowerCase()==='caida').length
    const efect  = ventasFilt.length ? Math.round(inst/ventasFilt.length*100) : 0
    const rendData = asesFilt.map(a => {
      const mis   = ventasCache.filter(v=>(v.asesor_nombre||'')===a.nombre)
      const inst2 = mis.filter(v=>(v.estado||'').toLowerCase()==='instalado').length
      const caid  = mis.filter(v=>(v.estado||'').toLowerCase()==='caida').length
      const ef    = mis.length ? Math.round(inst2/mis.length*100) : 0
      return { ...a, totalVentas:mis.length, instaladas:inst2, caidas:caid, efectividad:ef }
    }).sort((a,b)=>b.instaladas-a.instaladas)
    return { reporteData:rendData, repKpis:{ total:ventasFilt.length, inst, caidas, efect:efect+'%' } }
  }, [usuarios, ventasCache, salaReporte])

  /* ── usuarios filtrados ── */
  const usuariosFiltrados = useMemo(() => {
    if (!busqUsuarios) return usuarios
    const b = busqUsuarios.toLowerCase()
    return usuarios.filter(u => (u.nombre||'').toLowerCase().includes(b)||(u.usuario||'').toLowerCase().includes(b)||(u.sala||'').toLowerCase().includes(b))
  }, [usuarios, busqUsuarios])

  /* ── modal usuario ── */
  function abrirModalNuevo() {
    setEditandoId(null); setModForm(MOD_FORM_VACIO); setModErrores({}); setModalUsu(true)
  }
  function abrirModalEditar(u) {
    setEditandoId(u.id)
    const cargo2 = permisosDeUsuario(u).find(c => c !== u.cargo) || ''
    setModForm({ nombre:u.nombre||'', usuario:u.usuario||'', cargo:u.cargo||'', cargo2, sala:u.sala||'', pass:'', pass2:'' })
    setModErrores({}); setModalUsu(true)
  }
  function cerrarModalUsu() { setModalUsu(false); setEditandoId(null); setModForm(MOD_FORM_VACIO); setModErrores({}) }
  function setField(k, v) { setModForm(f=>({...f,[k]:v})); setModErrores(e=>({...e,[k]:false})) }

  async function guardarUsuario() {
    const { nombre, usuario, cargo, cargo2, sala, pass, pass2 } = modForm
    const errs = {}
    if (!nombre.trim())         errs.nombre  = true
    if (!usuario.trim())        errs.usuario = true
    if (!cargo)                 errs.cargo   = true
    if (cargo2 && cargo2 === cargo) errs.cargo2 = true
    if (!editandoId && !pass)   errs.pass    = true
    if (pass && pass !== pass2) errs.pass2   = true
    if (Object.keys(errs).length) { setModErrores(errs); mostrarToast('⚠️ Completa los campos requeridos'); return }
    setGuardandoUsu(true)
    try {
      const loginNorm = usuario.toLowerCase().replace(/\s+/g,'.')
      if (editandoId) {
        const body = { nombre, usuario:loginNorm, cargo, sala, permisos:cargo2 ? [cargo2] : [] }
        if (pass) body.password = pass
        const res  = await fetch(`${API}/usuarios/${editandoId}`,{method:'PATCH',headers:ncHeaders(),body:JSON.stringify(body)})
        const data = await res.json()
        if (!data.ok) { mostrarToast('❌ '+(data.mensaje||'Error')); setGuardandoUsu(false); return }
        agregarLog('Usuario editado', nombre)
        mostrarToast(`✅ Usuario actualizado: ${nombre}`)
      } else {
        const res  = await fetch(`${API}/usuarios`,{method:'POST',headers:ncHeaders(),body:JSON.stringify({nombre,usuario:loginNorm,password:pass,cargo,sala,activo:true,permisos:cargo2 ? [cargo2] : []})})
        const data = await res.json()
        if (!data.ok) { mostrarToast('❌ '+(data.mensaje||'Error')); setGuardandoUsu(false); return }
        agregarLog('Usuario creado', `${nombre} — ${cargo}`)
        mostrarToast(`✅ Usuario creado: ${nombre}`)
      }
      await cargarUsuarios()
      cerrarModalUsu()
    } catch { mostrarToast('❌ Error conectando') }
    setGuardandoUsu(false)
  }

  async function toggleActivo(u) {
    const nuevo = !u.activo
    try {
      const res  = await fetch(`${API}/usuarios/${u.id}/estado`,{method:'PATCH',headers:ncHeaders(),body:JSON.stringify({activo:nuevo})})
      const data = await res.json()
      if (!data.ok) { mostrarToast('❌ '+data.mensaje); return }
      setUsuarios(list=>list.map(x=>x.id===u.id?{...x,activo:nuevo}:x))
      agregarLog(nuevo?'Activado':'Desactivado', u.nombre)
      mostrarToast(`${nuevo?'✅ Activado':'🔴 Desactivado'}: ${u.nombre}`)
    } catch { mostrarToast('❌ Error') }
  }

  async function confirmarEliminarUsuario() {
    if (!modalEliminar || eliminandoUsu) return
    if (modalEliminar.cargo === 'jefatura') {
      const jefActivas = usuarios.filter(u => usuarioTieneCargo(u, 'jefatura') && u.activo)
      if (jefActivas.length <= 1) {
        mostrarToast('⚠️ No puedes eliminar el último usuario de Jefatura')
        return
      }
    }
    setEliminandoUsu(true)
    try {
      const res = await fetch(`${API}/usuarios/${modalEliminar.id}`, { method:'DELETE', headers:ncHeaders() })
      const data = await res.json()
      if (!data.ok) { mostrarToast('❌ '+(data.mensaje||'No se pudo eliminar')); setEliminandoUsu(false); return }
      agregarLog('Usuario eliminado', modalEliminar.nombre)
      mostrarToast(`✅ Usuario eliminado: ${modalEliminar.nombre}`)
      setModalEliminar(null)
      await cargarUsuarios()
    } catch {
      mostrarToast('❌ Error conectando con el servidor')
    } finally {
      setEliminandoUsu(false)
    }
  }

  function limpiarLogs() {
    if (!window.confirm('¿Limpiar logs?')) return
    setLogs([])
    try { localStorage.removeItem('jef_logs') } catch {}
    mostrarToast('Logs limpiados')
  }

  /* ── meses para select ── */
  const MESES_SALAS = useMemo(() => {
    const arr = [{ value:'', label:'Mes actual' }]
    for (let i=1;i<=11;i++) {
      const d = new Date(); d.setMonth(d.getMonth()-i)
      arr.push({ value:d.toISOString().slice(0,7), label:d.toLocaleString('es-PE',{month:'long',year:'numeric'}) })
    }
    return arr
  }, [])

  function salir() { logout(); navigate('/login') }

  /* ═══════════════════════════════════
     RENDER
  ═══════════════════════════════════ */
  return (
    <div className="jef-root">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuMovilAbierto ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuMovilAbierto}
            aria-controls="jefatura-sidebar"
            onClick={() => setMenuMovilAbierto(abierto => !abierto)}
          >
            <span></span><span></span><span></span>
          </button>
          <div className="brand">
          <div className="logo-circle"><img src="/assets/logo3.png" alt="NC" onError={e=>{e.target.parentNode.textContent='🏢'}} /></div>
          <div className="brand-text">
            <h1>NET<span className="dot"></span><span className="red">CONTACT</span></h1>
            <span className="brand-sub">Panel de Jefatura</span>
          </div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="topbar-badge">JEFATURA</span>
          <span className="topbar-user">{usuarioNombre}</span>
          <button className="topbar-salir" onClick={salir}>Salir</button>
        </div>
      </div>

      <div className="app-layout">
        {/* SIDEBAR */}
        <aside id="jefatura-sidebar" className={`sidebar${menuMovilAbierto ? ' open' : ''}`}>
          <div className="sidebar-sep">General</div>
          <button className={`nav-btn${seccion==='dashboard'?'   active':''}`} onClick={()=>irSeccion('dashboard')}><span className="nav-dot"></span> Dashboard</button>
          <button className={`nav-btn${seccion==='accesos'?'     active':''}`} onClick={()=>irSeccion('accesos')}><span className="nav-dot"></span> Accesos directos</button>
          <div className="sidebar-sep">Operaciones</div>
          <button className={`nav-btn${seccion==='ventas-flujo'?' active':''}`} onClick={()=>irSeccion('ventas-flujo')}><span className="nav-dot"></span> Ventas generales</button>
          <button className={`nav-btn${seccion==='seguimiento'?' active':''}`} onClick={()=>irSeccion('seguimiento')}><span className="nav-dot"></span> Seguimiento en campo</button>
          <div className="sidebar-sep">Gestión</div>
          <button className={`nav-btn${seccion==='usuarios'?'   active':''}`} onClick={()=>irSeccion('usuarios')}><span className="nav-dot"></span> Usuarios</button>
          <button className={`nav-btn${seccion==='reportes'?'   active':''}`} onClick={()=>irSeccion('reportes')}><span className="nav-dot"></span> Reportes</button>
          <div className="sidebar-sep">Sistema</div>
          <button className={`nav-btn${seccion==='logs'?'       active':''}`} onClick={()=>irSeccion('logs')}><span className="nav-dot"></span> Logs de actividad</button>
        </aside>

        {menuMovilAbierto && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Cerrar menú"
            onClick={() => setMenuMovilAbierto(false)}
          />
        )}

        <main className="main" ref={mainRef}>

          {/* ===== DASHBOARD ===== */}
          <section className={`section${seccion==='dashboard'?' active':''}`}>
            <div className="sec-header">
              <div><h2>Dashboard General</h2><p>Resumen global del sistema</p></div>
            </div>

            <div className="kpi-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))'}}>
              <div className="kpi-card k-blue">  <div className="kpi-num">{kpis.ventasHoy}</div>     <div className="kpi-label">Ventas hoy</div>         <div className="kpi-sub">del día</div></div>
              <div className="kpi-card k-purple"><div className="kpi-num">{kpis.validadas}</div>     <div className="kpi-label">Validadas</div>          <div className="kpi-sub">pasaron validación</div></div>
              <div className="kpi-card k-red">   <div className="kpi-num">{kpis.noValidadas}</div>   <div className="kpi-label">No validadas</div>       <div className="kpi-sub">rechazadas val.</div></div>
              <div className="kpi-card k-orange"><div className="kpi-num">{kpis.grabadas}</div>      <div className="kpi-label">Grabadas</div>           <div className="kpi-sub">con audio</div></div>
              <div className="kpi-card k-yellow"><div className="kpi-num">{kpis.noGrabadas}</div>    <div className="kpi-label">No grabadas</div>        <div className="kpi-sub">esperando audio</div></div>
              <div className="kpi-card k-teal">  <div className="kpi-num">{kpis.enEjecucion}</div>   <div className="kpi-label">En ejecución</div>       <div className="kpi-sub">programadas</div></div>
              <div className="kpi-card" style={{borderTopColor:'#94a3b8'}}><div className="kpi-num">{kpis.noProgramadas}</div><div className="kpi-label">No programadas</div><div className="kpi-sub">esperando prog.</div></div>
              <div className="kpi-card k-green"> <div className="kpi-num">{kpis.instaladas}</div>    <div className="kpi-label">Instaladas</div>         <div className="kpi-sub">completadas</div></div>
              <div className="kpi-card k-red">   <div className="kpi-num">{kpis.caidas}</div>        <div className="kpi-label">Caídas + Rechazos</div>  <div className="kpi-sub">fallidas</div></div>
              <div className="kpi-card k-purple"><div className="kpi-num">{kpis.conv}</div>          <div className="kpi-label">Efectividad mes</div>    <div className="kpi-sub">inst / (inst+caídas)</div></div>
              <div className="kpi-card k-teal">  <div className="kpi-num">{kpis.totalUs}</div>       <div className="kpi-label">Usuarios</div>           <div className="kpi-sub">registrados</div></div>
              <div className="kpi-card k-yellow"><div className="kpi-num">{kpis.activos}</div>       <div className="kpi-label">Activos</div>            <div className="kpi-sub">en el sistema</div></div>
              <div className="kpi-card k-blue">  <div className="kpi-num">{kpis.asesores}</div>      <div className="kpi-label">Asesores</div>           <div className="kpi-sub">activos</div></div>
              <div className="kpi-card k-orange"><div className="kpi-num">{kpis.supervisores}</div>  <div className="kpi-label">Supervisores</div>       <div className="kpi-sub">activos</div></div>
            </div>
            <div className="charts-grid">
              <div className="chart-card">
                <div className="chart-title">🥧 Ventas por estado</div>
                <div className="chart-wrap"><canvas ref={canvasEstados}></canvas></div>
              </div>
              <div className="chart-card">
                <div className="chart-title-row">
                  <span>🏢 Instaladas y Caídas por sala</span>
                  <select value={mesReporte} onChange={e=>setMesReporte(e.target.value)}
                    style={{padding:'4px 8px',border:'1px solid #e5e7eb',borderRadius:'7px',fontSize:'11px',fontFamily:'inherit',outline:'none',color:'#374151',cursor:'pointer'}}>
                    {MESES_SALAS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="chart-wrap"><canvas ref={canvasSalas}></canvas></div>
              </div>
              <div className="chart-card full">
                <div className="chart-title-row">
                  <span>📈 Ventas diarias por sala — últimos 7 días</span>
                  <span style={{fontSize:'11px',color:'#9ca3af'}}>Se actualiza cada 60 seg.</span>
                </div>
                <div className="chart-wrap"><canvas ref={canvasDiario}></canvas></div>
              </div>
            </div>
          </section>

          {/* ===== ACCESOS ===== */}
          <section className={`section${seccion==='accesos'?' active':''}`}>
            <div className="sec-header"><div><h2>Accesos Directos</h2><p>Navega a cualquier módulo del sistema</p></div></div>
            <div className="accesos-grid">
              {ACCESOS_MODS.map(m => {
                const cantidad = usuarios.filter(u=>usuarioTieneCargo(u,m.cargo)).length
                return (
                  <button
                    key={m.path}
                    type="button"
                    className="acceso-card"
                    style={{'--mod-color':m.color,'--mod-soft':m.color+'12'}}
                    onClick={()=>abrirSelectorModulo(m)}
                  >
                    <div className="acceso-card-head">
                      <div className="acceso-icon"><ModuloIcon tipo={m.icon} size={24}/></div>
                      <span className="acceso-conteo">{cantidad} {cantidad===1?'usuario':'usuarios'}</span>
                    </div>
                    <div className="acceso-card-body">
                      <div className="acceso-nombre">{m.nombre}</div>
                      <div className="acceso-desc">{m.desc}</div>
                    </div>
                    <div className="acceso-card-foot">
                      <span>Seleccionar usuario</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ===== SEGUIMIENTO ===== */}
          <section className={`section${seccion==='seguimiento'?' active':''}`}>
            <div className="sec-header">
              <div><h2>Seguimiento en campo</h2><p>Estado actual de todas las ventas — se actualiza automáticamente</p></div>
              <button className="btn-nuevo" style={{background:'#0891b2'}} onClick={cargarSeguimiento}>↻ Actualizar</button>
            </div>
            <div className="kpi-grid" style={{gridTemplateColumns:'repeat(5,1fr)',marginBottom:'20px'}}>
              <div className="kpi-card k-teal">  <div className="kpi-num">{kpisSeg.ejecucion}</div><div className="kpi-label">En ejecución</div></div>
              <div className="kpi-card k-green">  <div className="kpi-num">{kpisSeg.instalado}</div><div className="kpi-label">Instalados</div></div>
              <div className="kpi-card k-orange"> <div className="kpi-num">{kpisSeg.rechazo}</div>  <div className="kpi-label">Rechazo en campo</div></div>
              <div className="kpi-card k-red">    <div className="kpi-num">{kpisSeg.caida}</div>    <div className="kpi-label">Caídas</div></div>
              <div className="kpi-card k-purple"> <div className="kpi-num">{kpisSeg.tecnico}</div>  <div className="kpi-label">Técnicos en casa</div></div>
            </div>
            <div style={{display:'flex',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
              {[
                { id:'',          label:'Todos'           },
                { id:'ejecucion', label:'En ejecución'    },
                { id:'instalado', label:'Instalado'       },
                { id:'rechazo',   label:'Rechazo en campo'},
                { id:'caida',     label:'Caída'           },
                { id:'tecnico',   label:'Técnicos en casa'},
              ].map(tab => (
                <button key={tab.id}
                  className={`seg-tab${filtroSeg===tab.id?' active':''}`}
                  onClick={() => { setFiltroSeg(tab.id); try{sessionStorage.setItem(JEF_SEG_FILTRO_KEY,tab.id)}catch{} }}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="tabla-wrap usuarios-pro-card">
              <div className="tabla-header">
                <span className="tabla-title">Ventas en seguimiento</span>
                <span className="tabla-count">{ventasSegFiltradas.length} registros</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="tabla">
                  <thead><tr>
                    <th>Estado</th><th>Fecha</th><th>Cliente</th><th>DNI</th>
                    <th>Distrito</th><th>Asesor</th><th>Sala</th><th>Plan</th><th>Tramo</th><th>Motivo / Obs.</th><th>Acciones</th>
                  </tr></thead>
                  <tbody>
                    {ventasSegFiltradas.length === 0
                      ? <tr><td colSpan="11" className="tabla-empty">Sin registros.</td></tr>
                      : ventasSegFiltradas.map((v, i) => {
                          const b = SEG_BADGES[v._seg] || SEG_BADGES.ejecucion
                          const motivo = v.obs_backoffice || v.observacion || '—'
                          return (
                            <tr key={v.id != null ? `seg-${v.id}` : `seg-i-${i}`}>
                              <td><span style={{display:'inline-block',padding:'4px 12px',borderRadius:'99px',fontSize:'10px',fontWeight:700,letterSpacing:'.3px',background:b.bg,color:b.color,whiteSpace:'nowrap'}}>{b.label}</span></td>
                              <td style={{fontSize:'11px',color:'#185FA5',fontWeight:700,whiteSpace:'nowrap'}}>{formatF(v._fecha)}</td>
                              <td style={{fontWeight:600,fontSize:'12px'}}>{v.nombre||'—'}</td>
                              <td style={{fontFamily:'monospace',fontSize:'11px'}}>{v.dni||'—'}</td>
                              <td style={{fontSize:'11px'}}>{v.distrito||'—'}</td>
                              <td style={{fontWeight:600,color:'#7C3AED',fontSize:'11px'}}>{v.asesor_nombre||'—'}</td>
                              <td style={{fontSize:'11px',color:'#9ca3af'}}>{v.sala||'—'}</td>
                              <td style={{fontSize:'10px',maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.paquete||'—'}</td>
                              <td style={{fontSize:'11px',textAlign:'center'}}>{v._tramo||'—'}</td>
                              <td style={{fontSize:'10px',color:'#6b7280',maxWidth:'160px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={motivo}>{motivo}</td>
                              <td style={{minWidth:'310px'}}>
                                <div className="venta-actions">
                                  <button type="button" className="venta-action-btn" onClick={()=>setMediaVenta(v)}>Archivos</button>
                                  <button type="button" className="venta-action-btn reassign" onClick={()=>setVentaReasignar(v)}>Reasignar</button>
                                  <button type="button" className="venta-action-btn" onClick={()=>setVentaHistorial(v)}>Historial</button>
                                  <button type="button" className="venta-action-btn delete" onClick={()=>eliminarVenta(v)}>Eliminar</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ===== VENTAS GENERALES ===== */}
          <section className={`section${seccion==='ventas-flujo'?' active':''}`}>
            <div className="sec-header">
              <div>
                <h2>Ventas generales</h2>
                <p>Flujo completo desde que el asesor sube la venta. Seguimiento en campo queda en su apartado.</p>
              </div>
              <button className="btn-nuevo" onClick={cargarVentasCache}>↻ Actualizar</button>
            </div>

            <div className="flujo-kpi-grid">
              {[
                { id:'todas', label:'Ventas generales', sub:'subidas por asesores', value:resumenFlujoVentas.todas, cls:'k-blue' },
                { id:'validadas', label:'Validadas', sub:'pasaron validación', value:resumenFlujoVentas.validadas, cls:'k-green' },
                { id:'noValidadas', label:'No validadas', sub:'rechazadas / no aptas', value:resumenFlujoVentas.noValidadas, cls:'k-red' },
                { id:'grabadas', label:'Grabadas', sub:'con audio aprobado o subido', value:resumenFlujoVentas.grabadas, cls:'k-orange' },
                { id:'noGrabadas', label:'No grabadas', sub:'esperando audio', value:resumenFlujoVentas.noGrabadas, cls:'k-purple' },
                { id:'seguimiento', label:'En seguimiento', sub:'postventa / campo', value:resumenFlujoVentas.seguimiento, cls:'k-teal' },
              ].map(card => (
                <button
                  type="button"
                  key={card.id}
                  className={`kpi-card flujo-kpi ${card.cls} ${filtroFlujoVentas===card.id?'active':''}`}
                  onClick={()=>setFiltroFlujoVentas(card.id)}
                >
                  <div className="kpi-num">{card.value}</div>
                  <div className="kpi-label">{card.label}</div>
                  <div className="kpi-sub">{card.sub}</div>
                </button>
              ))}
            </div>

            <div className="flujo-panel">
              <div>
                <h3>Vista completa del flujo</h3>
                <p>Acá se ve cada venta desde carga del asesor, validación, grabación y estado final.</p>
              </div>
              <input
                className="tabla-search flujo-search"
                value={busqFlujoVentas}
                onChange={e=>setBusqFlujoVentas(e.target.value)}
                placeholder="Buscar cliente, DNI, asesor, sala..."
              />
            </div>

            <div className="tabla-wrap usuarios-pro-card flujo-tabla">
              <div className="tabla-header">
                <div className="tabla-header-left">
                  <span className="tabla-title">Ventas desde carga del asesor</span>
                  <span className="tabla-count">{ventasFlujoFiltradas.length} registros</span>
                </div>
                <button
                  type="button"
                  className="flujo-clear"
                  onClick={() => { setFiltroFlujoVentas('todas'); setBusqFlujoVentas('') }}
                >
                  Limpiar filtros
                </button>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Fecha subida</th>
                      <th>Cliente</th>
                      <th>DNI</th>
                      <th>Asesor</th>
                      <th>Sala</th>
                      <th>Estado actual</th>
                      <th>Validación</th>
                      <th>Grabación</th>
                      <th>Seguimiento</th>
                      <th>Última obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasFlujoFiltradas.length === 0 ? (
                      <tr><td colSpan="11" className="tabla-empty">No hay ventas registradas.</td></tr>
                    ) : ventasFlujoFiltradas.map((v, i) => {
                      const estado = normEstado(v.estado || v.estado_venta)
                      const enSeg = FLUJO_SEGUIMIENTO.has(estado)
                      return (
                        <tr key={v.id || `${v.dni || v.documento || 'venta'}-${i}`}>
                          <td>{i + 1}</td>
                          <td>{formatF(v._fecha || v.fecha_ingreso || v.fecha || v.created_at)}</td>
                          <td className="flujo-cliente">{v.nombre || v.nombre_apellidos || v.cliente || '—'}</td>
                          <td>{v.dni || v.documento || '—'}</td>
                          <td>{v.asesor_nombre || v.asesor || v.vendedor || '—'}</td>
                          <td>{v.sala || '—'}</td>
                          <td><span className={`flujo-estado estado-${estado || 'venta'}`}>{flujoLabelEstado(v.estado || v.estado_venta)}</span></td>
                          <td>{flujoValidada(v) ? <span className="flujo-ok">Validada</span> : <span className="flujo-warn">Pendiente / no válida</span>}</td>
                          <td>{flujoGrabada(v) ? <span className="flujo-ok">Grabada</span> : <span className="flujo-warn">Sin grabación</span>}</td>
                          <td>{enSeg ? <span className="flujo-info">{flujoLabelEstado(v.estado || v.estado_venta)}</span> : '—'}</td>
                          <td>{v.obs_backoffice || v.observacion || v.obs_supervisor || v.ultima_obs || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ===== USUARIOS ===== */}
          <section className={`section${seccion==='usuarios'?' active':''}`}>
            <div className="sec-header">
              <div><h2>Gestión de Usuarios</h2><p>Crea, edita y gestiona todos los usuarios</p></div>
              <button className="btn-nuevo" onClick={abrirModalNuevo}>+ Nuevo usuario</button>
            </div>
            <div className="tabla-wrap">
              <div className="tabla-header">
                <div className="tabla-header-left">
                  <span className="tabla-title">Usuarios del sistema</span>
                  <span className="tabla-count">
                    {usuariosCarga.cargando ? 'Cargando...' : usuariosCarga.error ? 'Sin conexión' : `${usuariosFiltrados.length} usuarios`}
                  </span>
                </div>
                <input type="text" className="tabla-search" value={busqUsuarios}
                  onChange={e=>setBusqUsuarios(e.target.value)} placeholder="🔍 Buscar usuario..." />
              </div>
              <table className="tabla tabla-usuarios-pro">
                <thead><tr><th>Usuario</th><th>Cargo</th><th>Sala</th><th>Login</th><th>Creado</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {usuariosCarga.cargando
                    ? <tr><td colSpan="7" className="tabla-empty">Cargando usuarios del sistema...</td></tr>
                    : usuariosCarga.error
                    ? <tr><td colSpan="7" className="tabla-empty">
                        <div style={{display:'grid',justifyItems:'center',gap:9}}>
                          <strong style={{color:'#dc2626'}}>No se pudo consultar la lista</strong>
                          <span>{usuariosCarga.error}</span>
                          <button type="button" className="btn-nuevo" onClick={cargarUsuarios}>Reintentar</button>
                        </div>
                      </td></tr>
                    : usuariosFiltrados.length === 0
                    ? <tr><td colSpan="7" className="tabla-empty">No hay usuarios que coincidan con la búsqueda.</td></tr>
                    : usuariosFiltrados.map(u => {
                        const c    = cargoObj(u.cargo)
                        const cargo2 = permisosDeUsuario(u).find(rol => rol !== u.cargo)
                        const col  = colorAvatar(u.nombre)
                        const fecha= u.created_at ? u.created_at.split(' ')[0] : ''
                        const protegido = String(u.id) === String(sesion?.id)
                        return (
                          <tr key={u.id}>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:'9px'}}>
                                <div style={{width:'32px',height:'32px',borderRadius:'50%',background:col,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'#fff',flexShrink:0}}>{iniciales(u.nombre)}</div>
                                <div><div style={{fontWeight:700,fontSize:'13px'}}>{u.nombre}</div><div style={{fontSize:'11px',color:'#9ca3af'}}>{u.usuario}</div></div>
                              </div>
                            </td>
                            <td>
                              <div className="usuario-cargos">
                                <span className={`badge-cargo ${c.cls}`}>{c.label}</span>
                                {cargo2 && <span className={`badge-cargo ${cargoObj(cargo2).cls}`}>{cargoObj(cargo2).label}</span>}
                              </div>
                            </td>
                            <td style={{fontSize:'12px'}}>{u.sala||'—'}</td>
                            <td style={{fontFamily:'monospace',fontSize:'12px',color:'#6b7280'}}>{u.usuario}</td>
                            <td style={{fontSize:'11px',color:'#9ca3af'}}>{formatF(fecha)}</td>
                            <td><span className={`badge-estado-user ${u.activo?'bu-activo':'bu-inactivo'}`}>{u.activo?'Activo':'Inactivo'}</span></td>
                            <td>
                              <div className="acc-cell">
                                <button className="btn-edit" onClick={()=>abrirModalEditar(u)}>✏️ Editar</button>
                                <button className={`btn-toggle-activo ${u.activo?'btn-desactivar':'btn-activar'}`} onClick={()=>toggleActivo(u)}>
                                  {u.activo?'Desactivar':'Activar'}
                                </button>
                                <button className="btn-eliminar-usuario" onClick={()=>setModalEliminar(u)} disabled={protegido}
                                  title={protegido?'Esta cuenta está protegida':'Eliminar usuario'}>
                                  🗑️ Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                  }
                </tbody>
              </table>
            </div>
          </section>

          {/* ===== REPORTES ===== */}
          <section className={`section${seccion==='reportes'?' active':''}`}>
            <div className="sec-header"><div><h2>Reportes Globales</h2><p>Rendimiento por sala y asesor — solo asesores</p></div></div>
            <div className="sala-tabs sala-tabs-pro">
              {[
                { id:'todas', label:'Todas las salas' },
                { id:'SALA 1', label:'Sala 1' },
                { id:'SALA 2', label:'Sala 2' },
                { id:'SALA 3', label:'Sala 3' },
                { id:'SALA 4', label:'Sala 4' },
                { id:'SALA CHANCAY', label:'Sala Chancay' },
                { id:'SALA 5', label:'Sala 5' },
              ].map(tab => (
                <button key={tab.id}
                  className={`sala-tab${salaReporte===tab.id?' active':''}`}
                  onClick={() => { setSalaReporte(tab.id); try{sessionStorage.setItem(JEF_SALA_REPORTE_KEY,tab.id)}catch{} }}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="kpi-grid reportes-kpis" style={{gridTemplateColumns:'repeat(4,1fr)',margin:'16px 0'}}>
              <div className="kpi-card k-blue"> <div className="kpi-num">{repKpis.total}</div>  <div className="kpi-label">Total ventas</div></div>
              <div className="kpi-card k-green"><div className="kpi-num">{repKpis.inst}</div>   <div className="kpi-label">Instaladas</div></div>
              <div className="kpi-card k-red">  <div className="kpi-num">{repKpis.caidas}</div> <div className="kpi-label">Caídas</div></div>
              <div className="kpi-card k-purple"><div className="kpi-num">{repKpis.efect}</div> <div className="kpi-label">Efectividad</div></div>
            </div>
            <div className="tabla-wrap ranking-pro-card">
              <div className="tabla-header">
                <span className="tabla-title">🏆 Ranking de Asesores</span>
                <span className="tabla-count">{reporteData.length} asesores</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="tabla tabla-ranking-pro">
                  <thead><tr><th style={{width:'60px'}}>RANK</th><th>ASESOR</th><th>SALA</th><th>VENTAS INSTALADAS</th><th>TOTAL VENTAS</th><th>CAÍDAS</th><th>EFECTIVIDAD</th></tr></thead>
                  <tbody>
                    {reporteData.length === 0
                      ? <tr><td colSpan="7" className="tabla-empty">Sin datos.</td></tr>
                      : reporteData.map((r, i) => (
                          <tr key={r.id != null ? `rep-${r.id}` : `rep-i-${i}`}>
                            <td style={{textAlign:'center',fontSize:i<3?'18px':'13px',fontWeight:700}}>{i<3?MEDALS[i]:i+1}</td>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:'9px'}}>
                                <div style={{width:'32px',height:'32px',borderRadius:'50%',background:colorAvatar(r.nombre),display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'#fff'}}>{iniciales(r.nombre)}</div>
                                <div><div style={{fontWeight:700,fontSize:'13px'}}>{r.nombre}</div><div style={{fontSize:'10px',color:'#9ca3af'}}>{r.usuario||''}</div></div>
                              </div>
                            </td>
                            <td style={{fontSize:'12px',color:'#6b7280'}}>{r.sala||'—'}</td>
                            <td style={{fontSize:'24px',fontWeight:900,color:'#16a34a',textAlign:'center'}}>{r.instaladas}</td>
                            <td style={{fontWeight:700,textAlign:'center'}}>{r.totalVentas}</td>
                            <td style={{color:'#dc2626',fontWeight:600,textAlign:'center'}}>{r.caidas}</td>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                <div style={{height:'7px',background:'#e5e7eb',borderRadius:'99px',overflow:'hidden',width:'70px'}}>
                                  <div style={{height:'100%',background:efColor(r.efectividad),borderRadius:'99px',width:r.efectividad+'%'}}></div>
                                </div>
                                <span style={{fontSize:'12px',fontWeight:700,padding:'2px 8px',borderRadius:'6px',background:efBg(r.efectividad),color:efColor(r.efectividad)}}>{r.efectividad}%</span>
                              </div>
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ===== LOGS ===== */}
          <section className={`section${seccion==='logs'?' active':''}`}>
            <div className="sec-header">
              <div><h2>Logs de Actividad</h2><p>Registro de acciones en el sistema</p></div>
              <button className="btn-nuevo" style={{background:'#ef4444'}} onClick={limpiarLogs}>🗑️ Limpiar</button>
            </div>
            <div className="tabla-wrap" style={{padding:'16px 20px'}}>
              {logs.length === 0
                ? <div style={{textAlign:'center',color:'#9ca3af',padding:'32px',fontSize:'13px'}}>Sin actividad.</div>
                : logs.slice(0,50).map((l, i) => (
                    <div key={`log-${String(l.id)}-${i}`} className="log-item">
                      <div className="log-dot" style={{background:l.color||'#7C3AED'}}></div>
                      <div className="log-content">
                        <div className="log-accion">
                          {l.accion}
                          {l.detalle && <span style={{color:'#6b7280',fontWeight:400}}> — {l.detalle}</span>}
                        </div>
                        <div className="log-meta"><span className="log-user">{l.usuario}</span> · {formatF(l.fecha)} {l.hora}</div>
                      </div>
                    </div>
                  ))
              }
            </div>
          </section>

        </main>
      </div>

      {/* MODAL USUARIO */}
      {modalUsu && (
        <div className="modal-bg open" onClick={e=>{if(e.target===e.currentTarget)cerrarModalUsu()}}>
          <div className="modal-box">
            <div className="modal-title">{editandoId?'Editar usuario':'Nuevo usuario'}</div>
            <div className="modal-sub">{editandoId?`Editando: ${modForm.nombre}`:'Completa todos los campos.'}</div>
            <div className="modal-grid">
              <div className="modal-sep">Datos personales</div>
              <div className={`modal-campo span2${modErrores.nombre?' error':''}`}>
                <label>Nombre completo *</label>
                <input value={modForm.nombre} onChange={e=>setField('nombre',e.target.value)} placeholder="Nombre y apellidos" className={modErrores.nombre?'error':''} />
              </div>
              <div className={`modal-campo${modErrores.usuario?' error':''}`}>
                <label>Usuario (login) *</label>
                <input value={modForm.usuario} onChange={e=>setField('usuario',e.target.value)} placeholder="nombre.apellido" style={{fontFamily:'monospace'}} className={modErrores.usuario?'error':''} />
              </div>
              <div className={`modal-campo${modErrores.cargo?' error':''}`}>
                <label>Cargo principal *</label>
                <select value={modForm.cargo} onChange={e=>setField('cargo',e.target.value)} className={modErrores.cargo?'error':''}>
                  <option value="">— Seleccionar cargo —</option>
                  {CARGOS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className={`modal-campo${modErrores.cargo2?' error':''}`}>
                <label>Cargo adicional (opcional)</label>
                <select value={modForm.cargo2} onChange={e=>setField('cargo2',e.target.value)} className={modErrores.cargo2?'error':''}>
                  <option value="">— Sin cargo adicional —</option>
                  {CARGOS.filter(c=>c.id!==modForm.cargo && c.id!=='jefatura').map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="modal-campo">
                <label>Sala / Equipo</label>
                <select value={modForm.sala} onChange={e=>setField('sala',e.target.value)}>
                  <option value="">— Sin sala —</option>
                  {SALAS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="modal-sep">Contraseña</div>
              <div className={`modal-campo${modErrores.pass?' error':''}`}>
                <label>Contraseña *</label>
                <input type="password" value={modForm.pass} onChange={e=>setField('pass',e.target.value)} placeholder="Mínimo 6 caracteres" className={modErrores.pass?'error':''} />
              </div>
              <div className={`modal-campo${modErrores.pass2?' error':''}`}>
                <label>Confirmar contraseña *</label>
                <input type="password" value={modForm.pass2} onChange={e=>setField('pass2',e.target.value)} placeholder="Repite la contraseña" className={modErrores.pass2?'error':''} />
              </div>
            </div>
            <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:'8px',padding:'10px 14px',fontSize:'12px',color:'#14532d',marginBottom:'16px'}}>
              💡 Al crear un usuario con cargo <strong>Asesor</strong>, estará disponible en Back Data para asignar leads.
            </div>
            <div className="modal-btns">
              <button className="btn-cancelar-m" onClick={cerrarModalUsu}>Cancelar</button>
              <button className="btn-guardar" onClick={guardarUsuario} disabled={guardandoUsu}>
                {guardandoUsu ? 'Guardando...' : '💾 Guardar usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MediaViewer
        open={!!mediaVenta}
        onClose={()=>setMediaVenta(null)}
        ventaId={mediaVenta?.id}
        title={`Archivos de ${mediaVenta?.nombre || 'la venta'}`}
        subtitle={`DNI: ${mediaVenta?.dni || '—'} · Tel: ${mediaVenta?.telefono1 || '—'}`}
        audioPath={mediaVenta?.audio_path}
        audioName={mediaVenta?.audio_path ? mediaVenta.audio_path.split('/').pop() : ''}
      />

      {ventaReasignar && (
        <ReasignarVentaModal
          venta={ventaReasignar}
          asesores={usuarios.filter(usuario => usuarioTieneCargo(usuario, 'asesor') && usuario.activo)}
          alcance="global"
          onClose={()=>setVentaReasignar(null)}
          onSuccess={completarReasignacion}
        />
      )}

      {ventaHistorial && (
        <HistorialVentaModal
          venta={ventaHistorial}
          onClose={()=>setVentaHistorial(null)}
        />
      )}

      {/* MODAL ELIMINAR USUARIO */}
      {modalEliminar && (
        <div className="modal-bg open" onClick={e=>{if(e.target===e.currentTarget&&!eliminandoUsu)setModalEliminar(null)}}>
          <div className="modal-box modal-eliminar-box" role="dialog" aria-modal="true" aria-labelledby="titulo-eliminar-usuario">
            <div className="modal-eliminar-icon">🗑️</div>
            <div id="titulo-eliminar-usuario" className="modal-title">Eliminar usuario</div>
            <p className="modal-eliminar-texto">
              ¿Estás seguro de eliminar a <strong>{modalEliminar.nombre}</strong>?
              <span>Esta acción no se puede deshacer.</span>
            </p>
            <div className="modal-btns">
              <button className="btn-cancelar-m" onClick={()=>setModalEliminar(null)} disabled={eliminandoUsu}>Cancelar</button>
              <button className="btn-confirmar-eliminar" onClick={confirmarEliminarUsuario} disabled={eliminandoUsu}>
                {eliminandoUsu?'Eliminando...':'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELECTOR DE USUARIO POR MÓDULO */}
      {selectorModulo.open && selectorModulo.modulo && (
        <div className="selector-modulo-overlay" onClick={e=>{ if(e.target===e.currentTarget) cerrarSelectorModulo() }}>
          <div className="selector-modulo-box">
            <div className="selector-modulo-head">
              <div className="selector-modulo-titulo">
                <span className="selector-modulo-icon" style={{background:selectorModulo.modulo.color+'12',color:selectorModulo.modulo.color}}><ModuloIcon tipo={selectorModulo.modulo.icon} size={24}/></span>
                <div>
                  <strong>Entrar a {selectorModulo.modulo.nombre}</strong>
                  <span>Selecciona un usuario para abrir el módulo con acceso de Jefatura</span>
                </div>
              </div>
              <button type="button" className="selector-modulo-cerrar" onClick={cerrarSelectorModulo} aria-label="Cerrar">×</button>
            </div>
            <div className="selector-modulo-busqueda">
              <div className="selector-busqueda-campo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
                <input
                  autoFocus
                  type="search"
                  value={selectorModulo.buscar}
                  onChange={e=>setSelectorModulo(prev=>({...prev,buscar:e.target.value}))}
                  placeholder="Buscar por nombre, usuario o sala..."
                />
              </div>
              <span className="selector-resultados">{usuariosModulo.length} resultado{usuariosModulo.length===1?'':'s'}</span>
            </div>
            <div className="selector-modulo-lista">
              {usuariosModulo.length === 0 ? (
                <div className="selector-modulo-vacio">
                  No hay usuarios registrados con el cargo {cargoObj(selectorModulo.modulo.cargo).label}.
                </div>
              ) : usuariosModulo.map(u => (
                <div className={`selector-usuario${u.activo?'':' inactivo'}`} key={u.id}>
                  <div className="selector-usuario-avatar" style={{background:colorAvatar(u.nombre||u.usuario||'U')}}>{iniciales(u.nombre||u.usuario||'U')}</div>
                  <div className="selector-usuario-info">
                    <strong>{u.nombre || u.usuario}</strong>
                    <span>@{u.usuario || 'sin usuario'} · {u.sala || 'Sin sala'}</span>
                  </div>
                  <span className={`selector-usuario-estado ${u.activo?'activo':'inactivo'}`}>{u.activo?'Activo':'Inactivo'}</span>
                  <button type="button" onClick={()=>entrarModulo(selectorModulo.modulo,u)} disabled={!u.activo}>
                    <span>Entrar</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="selector-modulo-nota">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>
              <span>La sesión conservará todos los permisos de Jefatura.</span>
            </div>
          </div>
        </div>
      )}

      <div className={`toast${toastMsg?' show':''}`}>{toastMsg}</div>
    </div>
  )
}
