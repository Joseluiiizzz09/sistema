import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { API, ncHeaders } from '../services/api'
import Chart from 'chart.js/auto'
import '../styles/jefatura.css'

/* ── constantes ── */
const JEF_APARTADO_KEY     = 'nc_jefatura_apartado'
const JEF_SALA_REPORTE_KEY = 'nc_jefatura_sala_reporte'
const JEF_SEG_FILTRO_KEY   = 'nc_jefatura_seg_filtro'

const CARGOS = [
  { id:'asesor',         label:'Asesor',           cls:'bc-asesor'         },
  { id:'supervisor',     label:'Supervisor',        cls:'bc-supervisor'     },
  { id:'backoffice',     label:'Back Office',       cls:'bc-backoffice'     },
  { id:'validacion',     label:'Validación',        cls:'bc-validacion'     },
  { id:'grabaciones',    label:'Grabaciones',       cls:'bc-grabaciones'    },
  { id:'seguimiento',    label:'Seguimiento',       cls:'bc-seguimiento'    },
  { id:'jefatura',       label:'Jefatura',          cls:'bc-jefatura'       },
  { id:'usuarios',       label:'Usuarios',          cls:'bc-usuarios'       },
  { id:'programacion',   label:'Programación',      cls:'bc-programacion'   },
  { id:'supgrabaciones', label:'Sup. Grabaciones',  cls:'bc-supgrabaciones' },
]
const SALAS = ['SALA 1','SALA 2','SALA 3','SIN SALA']

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
  { nombre:'Back Office',      desc:'Gestión de leads',             icon:'📋', path:'/backoffice',      color:'#111827' },
  { nombre:'Validación',       desc:'Validar ventas',               icon:'✅', path:'/validacion',      color:'#d97706' },
  { nombre:'Grabaciones',      desc:'Control de grabaciones',       icon:'🎙️', path:'/grabaciones',    color:'#16a34a' },
  { nombre:'Seguimiento',      desc:'Post-venta y estados',         icon:'📡', path:'/seguimiento',     color:'#0891b2' },
  { nombre:'Supervisor',       desc:'Portal supervisores',          icon:'👔', path:'/supervisor',      color:'#7C3AED' },
  { nombre:'Dashboard CRM',    desc:'Vista del asesor',             icon:'📊', path:'/dashboard',       color:'#2563eb' },
  { nombre:'Gestión Usuarios', desc:'Administrar usuarios',         icon:'👥', path:'/usuarios',        color:'#db2777' },
  { nombre:'Programación',     desc:'Ventas aprobadas grabaciones', icon:'📅', path:'/programacion',    color:'#7C3AED' },
  { nombre:'Sup. Grabaciones', desc:'Supervisor grabaciones',       icon:'🎧', path:'/sup-grabaciones', color:'#16a34a' },
]

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

const MEDALS = ['🥇','🥈','🥉']
const MOD_FORM_VACIO = { nombre:'', usuario:'', cargo:'', sala:'', pass:'', pass2:'' }

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
    try {
      const res  = await fetch(`${API}/usuarios`, { headers: ncHeaders() })
      const data = await res.json()
      if (data.ok) setUsuarios(data.data)
    } catch { mostrarToast('❌ Error conectando al servidor') }
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

  /* mount */
  useEffect(() => {
    cargarUsuarios()
    cargarVentasCache()
    agregarLog('Sesión iniciada', 'Panel de Jefatura')
    const iv = setInterval(async () => {
      await cargarVentasCache()
    }, 60000)
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
      const salas     = ['SALA 1','SALA 2','SALA 3']
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
      const salas  = ['SALA 1','SALA 2','SALA 3']
      const colors = ['#3b82f6','#8b5cf6','#22c55e']
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
      asesores:      usuarios.filter(u=>u.cargo==='asesor'&&u.activo).length,
      supervisores:  usuarios.filter(u=>u.cargo==='supervisor'&&u.activo).length,
    }
  }, [ventasCache, usuarios])

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

  /* ── reportes ── */
  const { reporteData, repKpis } = useMemo(() => {
    let asesFilt = usuarios.filter(u=>u.cargo==='asesor')
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
    setModForm({ nombre:u.nombre||'', usuario:u.usuario||'', cargo:u.cargo||'', sala:u.sala||'', pass:'', pass2:'' })
    setModErrores({}); setModalUsu(true)
  }
  function cerrarModalUsu() { setModalUsu(false); setEditandoId(null); setModForm(MOD_FORM_VACIO); setModErrores({}) }
  function setField(k, v) { setModForm(f=>({...f,[k]:v})); setModErrores(e=>({...e,[k]:false})) }

  async function guardarUsuario() {
    const { nombre, usuario, cargo, sala, pass, pass2 } = modForm
    const errs = {}
    if (!nombre.trim())         errs.nombre  = true
    if (!usuario.trim())        errs.usuario = true
    if (!cargo)                 errs.cargo   = true
    if (!editandoId && !pass)   errs.pass    = true
    if (pass && pass !== pass2) errs.pass2   = true
    if (Object.keys(errs).length) { setModErrores(errs); mostrarToast('⚠️ Completa los campos requeridos'); return }
    setGuardandoUsu(true)
    try {
      const loginNorm = usuario.toLowerCase().replace(/\s+/g,'.')
      if (editandoId) {
        const body = { nombre, usuario:loginNorm, cargo, sala }
        if (pass) body.password = pass
        const res  = await fetch(`${API}/usuarios/${editandoId}`,{method:'PATCH',headers:ncHeaders(),body:JSON.stringify(body)})
        const data = await res.json()
        if (!data.ok) { mostrarToast('❌ '+(data.mensaje||'Error')); setGuardandoUsu(false); return }
        agregarLog('Usuario editado', nombre)
        mostrarToast(`✅ Usuario actualizado: ${nombre}`)
      } else {
        const res  = await fetch(`${API}/usuarios`,{method:'POST',headers:ncHeaders(),body:JSON.stringify({nombre,usuario:loginNorm,password:pass,cargo,sala,activo:true})})
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
    setEliminandoUsu(true)
    try {
      const res = await fetch(`${API}/usuarios/${modalEliminar.id}`, { method:'DELETE', headers:ncHeaders() })
      const data = await res.json()
      if (!data.ok) { mostrarToast('❌ '+(data.mensaje||'No se pudo eliminar')); return }
      setUsuarios(list => list.filter(u => u.id !== modalEliminar.id))
      agregarLog('Usuario eliminado', modalEliminar.nombre)
      mostrarToast(`✅ Usuario eliminado: ${modalEliminar.nombre}`)
      setModalEliminar(null)
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
              {ACCESOS_MODS.map(m => (
                <Link key={m.path} className="acceso-card" to={m.path}>
                  <div className="acceso-icon" style={{background:m.color+'22'}}>{m.icon}</div>
                  <div className="acceso-nombre">{m.nombre}</div>
                  <div className="acceso-desc">{m.desc}</div>
                </Link>
              ))}
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
            <div className="tabla-wrap">
              <div className="tabla-header">
                <span className="tabla-title">Ventas en seguimiento</span>
                <span className="tabla-count">{ventasSegFiltradas.length} registros</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="tabla">
                  <thead><tr>
                    <th>Estado</th><th>Fecha</th><th>Cliente</th><th>DNI</th>
                    <th>Distrito</th><th>Asesor</th><th>Sala</th><th>Plan</th><th>Tramo</th><th>Motivo / Obs.</th>
                  </tr></thead>
                  <tbody>
                    {ventasSegFiltradas.length === 0
                      ? <tr><td colSpan="10" className="tabla-empty">Sin registros.</td></tr>
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
                            </tr>
                          )
                        })
                    }
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
                  <span className="tabla-count">{usuariosFiltrados.length} usuarios</span>
                </div>
                <input type="text" className="tabla-search" value={busqUsuarios}
                  onChange={e=>setBusqUsuarios(e.target.value)} placeholder="🔍 Buscar usuario..." />
              </div>
              <table className="tabla">
                <thead><tr><th>Usuario</th><th>Cargo</th><th>Sala</th><th>Login</th><th>Creado</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {usuariosFiltrados.length === 0
                    ? <tr><td colSpan="7" className="tabla-empty">No hay usuarios.</td></tr>
                    : usuariosFiltrados.map(u => {
                        const c    = cargoObj(u.cargo)
                        const col  = colorAvatar(u.nombre)
                        const fecha= u.created_at ? u.created_at.split(' ')[0] : ''
                        const protegido = u.usuario === 'admin' || String(u.id) === String(sesion?.id)
                        return (
                          <tr key={u.id}>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:'9px'}}>
                                <div style={{width:'32px',height:'32px',borderRadius:'50%',background:col,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700,color:'#fff',flexShrink:0}}>{iniciales(u.nombre)}</div>
                                <div><div style={{fontWeight:700,fontSize:'13px'}}>{u.nombre}</div><div style={{fontSize:'11px',color:'#9ca3af'}}>{u.usuario}</div></div>
                              </div>
                            </td>
                            <td><span className={`badge-cargo ${c.cls}`}>{c.label}</span></td>
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
            <div className="sala-tabs">
              {[
                { id:'todas', label:'Todas las salas' },
                { id:'SALA 1', label:'Sala 1' },
                { id:'SALA 2', label:'Sala 2' },
                { id:'SALA 3', label:'Sala 3' },
              ].map(tab => (
                <button key={tab.id}
                  className={`sala-tab${salaReporte===tab.id?' active':''}`}
                  onClick={() => { setSalaReporte(tab.id); try{sessionStorage.setItem(JEF_SALA_REPORTE_KEY,tab.id)}catch{} }}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="kpi-grid" style={{gridTemplateColumns:'repeat(4,1fr)',margin:'16px 0'}}>
              <div className="kpi-card k-blue"> <div className="kpi-num">{repKpis.total}</div>  <div className="kpi-label">Total ventas</div></div>
              <div className="kpi-card k-green"><div className="kpi-num">{repKpis.inst}</div>   <div className="kpi-label">Instaladas</div></div>
              <div className="kpi-card k-red">  <div className="kpi-num">{repKpis.caidas}</div> <div className="kpi-label">Caídas</div></div>
              <div className="kpi-card k-purple"><div className="kpi-num">{repKpis.efect}</div> <div className="kpi-label">Efectividad</div></div>
            </div>
            <div className="tabla-wrap">
              <div className="tabla-header">
                <span className="tabla-title">🏆 Ranking de Asesores</span>
                <span className="tabla-count">{reporteData.length} asesores</span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table className="tabla">
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
                <label>Cargo *</label>
                <select value={modForm.cargo} onChange={e=>setField('cargo',e.target.value)} className={modErrores.cargo?'error':''}>
                  <option value="">— Seleccionar cargo —</option>
                  {CARGOS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
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
              💡 Al crear un usuario con cargo <strong>Asesor</strong>, estará disponible en el Back Office para asignar leads.
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

      <div className={`toast${toastMsg?' show':''}`}>{toastMsg}</div>
    </div>
  )
}
