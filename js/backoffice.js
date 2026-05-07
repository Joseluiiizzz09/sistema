// =====================
// DATOS
let asesores = [
    { id: 1, nombre: "Jose Luis Romero", usuario: "jose.romero", sala: "SALA 2", numeros: 0 },
    { id: 2, nombre: "Ana García",       usuario: "ana.garcia",  sala: "SALA 1", numeros: 0 },
    { id: 3, nombre: "Carlos Flores",    usuario: "carlos.flores", sala: "SALA 3", numeros: 0 },
];

let numerosEnCola = [];
let asesorSeleccionado = null;
let historial = [];
let leads = [];
let ventasRegistradas = [];

const COLORES_AVATAR = ["#3b82f6","#8b5cf6","#22c55e","#f97316","#ef4444","#06b6d4","#ec4899"];

// =====================
// NAVEGACION — UNA SOLA FUNCION, SIN SOBREESCRITURA
function mostrarSeccion(id, btn) {
    document.querySelectorAll(".bo-seccion").forEach(s => s.classList.add("hidden"));
    const sec = document.getElementById("sec-" + id);
    if (!sec) return;
    sec.classList.remove("hidden");

    document.querySelectorAll(".bo-nav").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");

    // Acciones por sección
    if (id === "base")       { poblarFiltroAsesorBase(); renderBase(); }
    if (id === "asesores")   renderAsesoresCards();
    if (id === "historial")  renderHistorial();
    if (id === "leads")      { poblarSelects(); renderLeads(); }
    if (id === "ventas")     { poblarSelects(); renderVentas(); }
    if (id === "rotacion")   { poblarSelects(); renderRotacion(); }
    if (id === "rendimiento") renderRendimiento();
}

// =====================
// UTILS
function colorAvatar(nombre) {
    let sum = 0;
    for (let c of nombre) sum += c.charCodeAt(0);
    return COLORES_AVATAR[sum % COLORES_AVATAR.length];
}

function iniciales(nombre) {
    return nombre.trim().split(" ").slice(0,2).map(p => p[0]).join("").toUpperCase();
}

function fechaHoy() {
    return new Date().toISOString().split("T")[0];
}

function horaAhora() {
    return new Date().toLocaleTimeString("es-PE", {hour:"2-digit", minute:"2-digit"});
}

// =====================
// POBLAR SELECTS
function poblarSelects() {
    [
        { id: "lead_asesor",  placeholder: "-- Sin asignar --" },
        { id: "venta_asesor", placeholder: "-- Seleccionar --" },
        { id: "rot_asesor",   placeholder: "-- Seleccionar asesor --" },
    ].forEach(({ id, placeholder }) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const val = sel.value;
        sel.innerHTML = `<option value="">${placeholder}</option>`;
        asesores.forEach(a => {
            sel.innerHTML += `<option value="${a.id}">${a.nombre}</option>`;
        });
        sel.value = val;
    });
}

// =====================
// ASIGNAR NUMEROS
function procesarNumeros() {
    const raw = document.getElementById("inputNumeros").value.trim();
    if (!raw) { alert("Escribe o pega números primero."); return; }

    const zona = document.getElementById("zonaDefecto").value || "LIMA";
    raw.split("\n").map(l => l.trim()).filter(Boolean).forEach(num => {
        if (!numerosEnCola.find(n => n.telefono === num))
            numerosEnCola.push({ telefono: num, zona });
    });

    document.getElementById("inputNumeros").value = "";
    renderPreview();
}

function agregarUno() {
    const num  = document.getElementById("inputUnico").value.trim();
    const zona = document.getElementById("inputZona").value.trim() || "LIMA";
    if (!num) return;
    if (!numerosEnCola.find(n => n.telefono === num))
        numerosEnCola.push({ telefono: num, zona });
    document.getElementById("inputUnico").value = "";
    document.getElementById("inputZona").value = "";
    renderPreview();
}

function renderPreview() {
    const wrap = document.getElementById("previewNumeros");
    if (!numerosEnCola.length) { wrap.style.display = "none"; return; }
    wrap.style.display = "block";
    document.getElementById("previewCount").innerText = numerosEnCola.length;
    document.getElementById("previewLista").innerHTML = numerosEnCola.map((n, i) => `
        <div class="bo-preview-item">
            <span>📱 ${n.telefono} <small style="color:#9ca3af">— ${n.zona}</small></span>
            <button onclick="quitarNumero(${i})">✕</button>
        </div>
    `).join('');
}

function quitarNumero(i) {
    numerosEnCola.splice(i, 1);
    renderPreview();
}

function renderAsesoresSelector() {
    const lista = document.getElementById("listaAsesores");
    if (!lista) return;
    lista.innerHTML = asesores.map(a => `
        <div class="bo-asesor-item ${asesorSeleccionado === a.id ? 'selected' : ''}"
             onclick="seleccionarAsesor(${a.id})">
            <div class="bo-asesor-avatar">${iniciales(a.nombre)}</div>
            <div class="bo-asesor-info">
                <div class="bo-asesor-nombre">${a.nombre}</div>
                <div class="bo-asesor-sala">${a.sala}</div>
            </div>
            <div class="bo-asesor-badge">${a.numeros} nums</div>
        </div>
    `).join('');
}

function seleccionarAsesor(id) {
    asesorSeleccionado = id;
    renderAsesoresSelector();
}

function asignarNumeros() {
    if (!numerosEnCola.length) { alert("No hay números en la cola."); return; }
    if (!asesorSeleccionado)   { alert("Selecciona un asesor primero."); return; }

    const asesor = asesores.find(a => a.id === asesorSeleccionado);
    asesor.numeros += numerosEnCola.length;

    historial.unshift({
        fecha: new Date().toLocaleString("es-PE"),
        asesor: asesor.nombre,
        cantidad: numerosEnCola.length,
        zona: numerosEnCola[0]?.zona || "-",
        numeros: numerosEnCola.map(n => n.telefono).join(", ")
    });

    const res = document.getElementById("resultadoAsignacion");
    document.getElementById("resultadoTexto").innerText =
        `${numerosEnCola.length} números asignados a ${asesor.nombre} correctamente`;
    res.style.display = "block";
    setTimeout(() => res.style.display = "none", 4000);

    numerosEnCola = [];
    renderPreview();
    renderAsesoresSelector();
}

// =====================
// ASESORES CARDS
function renderAsesoresCards() {
    const el = document.getElementById("asesoresCards");
    if (!el) return;
    el.innerHTML = asesores.map(a => `
        <div class="bo-asesor-card">
            <div class="bo-asesor-card-avatar">${iniciales(a.nombre)}</div>
            <div class="bo-asesor-card-nombre">${a.nombre}</div>
            <div class="bo-asesor-card-sala">${a.sala}</div>
            <div class="bo-asesor-card-nums">${a.numeros}</div>
            <div class="bo-asesor-card-label">números asignados</div>
        </div>
    `).join('');
}

// =====================
// HISTORIAL
function renderHistorial() {
    const tbody = document.getElementById("tablaHistorial");
    if (!tbody) return;
    if (!historial.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="bo-empty">Sin asignaciones aún.</td></tr>`;
        return;
    }
    tbody.innerHTML = historial.map(h => `
        <tr>
            <td>${h.fecha}</td>
            <td>${h.asesor}</td>
            <td><strong>${h.cantidad}</strong></td>
            <td>${h.zona}</td>
            <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.numeros}</td>
        </tr>
    `).join('');
}

// =====================
// MODAL NUEVO ASESOR
function abrirModalAsesor() {
    document.getElementById("modalAsesor").classList.remove("hidden");
}
function cerrarModalAsesor() {
    document.getElementById("modalAsesor").classList.add("hidden");
}
function guardarAsesor() {
    const nombre  = document.getElementById("asesor_nombre").value.trim();
    const usuario = document.getElementById("asesor_usuario").value.trim();
    const sala    = document.getElementById("asesor_sala").value.trim();
    if (!nombre) { alert("Ingresa el nombre del asesor."); return; }

    asesores.push({ id: Date.now(), nombre, usuario, sala: sala || "SIN SALA", numeros: 0 });

    ["asesor_nombre","asesor_usuario","asesor_sala"].forEach(id =>
        document.getElementById(id).value = "");

    cerrarModalAsesor();
    renderAsesoresCards();
    renderAsesoresSelector();
}

// =====================
// LEADS
function agregarLead() {
    const nombre = document.getElementById("lead_nombre").value.trim();
    if (!nombre) { alert("El nombre es obligatorio."); return; }

    const asesorId = parseInt(document.getElementById("lead_asesor").value) || null;
    const asesor   = asesores.find(a => a.id === asesorId);

    leads.push({
        id: Date.now(), nombre,
        telefono: document.getElementById("lead_telefono").value.trim(),
        producto: document.getElementById("lead_producto").value.trim() || "—",
        notas:    document.getElementById("lead_notas").value.trim(),
        estado: "Nuevo",
        asesorId,
        asesorNombre: asesor ? asesor.nombre : "— Sin asignar —",
        horaAsig: asesor ? horaAhora() : "—",
        rotaciones: 0,
        fecha: fechaHoy(),
        asignadoA: asesor ? [asesor.id] : []
    });

    ["lead_nombre","lead_telefono","lead_producto","lead_notas"].forEach(id =>
        document.getElementById(id).value = "");
    document.getElementById("lead_asesor").value = "";

    renderLeads();
    renderRotacion();
    renderRendimiento();
}

function cambiarEstadoLead(id, estado) {
    const lead = leads.find(l => l.id === id);
    if (lead) { lead.estado = estado; renderLeads(); renderRotacion(); }
}

function eliminarLead(id) {
    leads = leads.filter(l => l.id !== id);
    renderLeads(); renderRotacion(); renderRendimiento();
}

function reasignarLead(id, asesorId) {
    const lead   = leads.find(l => l.id === parseInt(id));
    const asesor = asesores.find(a => a.id === parseInt(asesorId));
    if (!lead) return;
    lead.asesorId     = asesor ? asesor.id : null;
    lead.asesorNombre = asesor ? asesor.nombre : "— Sin asignar —";
    lead.horaAsig     = asesor ? horaAhora() : "—";
    if (asesor && !lead.asignadoA.includes(asesor.id)) lead.asignadoA.push(asesor.id);
    renderLeads(); renderRotacion(); renderRendimiento();
}

function estadoColor(e) {
    const map = { "Nuevo":"#3b82f6","No contesta":"#ef4444","Buzón":"#6b7280","Contactado":"#f97316","Ganado":"#22c55e" };
    return map[e] || "#374151";
}

function renderLeads() {
    const el = document.getElementById("leadsCount");
    if (el) el.innerText = leads.length;
    const tbody = document.getElementById("tablaLeads");
    if (!tbody) return;

    if (!leads.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="bo-empty">Sin leads aún.</td></tr>`;
        return;
    }

    const optsAsesores = asesores.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');

    tbody.innerHTML = leads.map(l => `
        <tr>
            <td>
                <div class="bo-cliente-cell">
                    <div class="bo-cliente-avatar" style="background:${colorAvatar(l.nombre)}">${iniciales(l.nombre)}</div>
                    <div>
                        <div style="font-weight:600">${l.nombre}</div>
                        <div style="font-size:11px;color:#9ca3af">${l.telefono || ''}</div>
                    </div>
                </div>
            </td>
            <td>${l.producto}</td>
            <td>
                <select class="select-asesor-tabla" style="border:none;background:none;font-size:12px;font-weight:600;color:${estadoColor(l.estado)};padding:0"
                    onchange="cambiarEstadoLead(${l.id}, this.value)">
                    ${["Nuevo","No contesta","Buzón","Contactado","Ganado"].map(e =>
                        `<option value="${e}" ${l.estado===e?'selected':''}>${e}</option>`
                    ).join('')}
                </select>
            </td>
            <td>
                <select class="select-asesor-tabla" onchange="reasignarLead(${l.id}, this.value)">
                    <option value="">— Sin asignar —</option>
                    ${optsAsesores}
                </select>
            </td>
            <td><span class="hora-asig">${l.horaAsig}</span></td>
            <td>${l.rotaciones > 0 ? `<span class="rot-badge">🔁 ${l.rotaciones}x</span>` : '—'}</td>
            <td>${l.fecha}</td>
            <td style="display:flex;gap:6px;align-items:center">
                <button class="bo-btn-eliminar" onclick="eliminarLead(${l.id})">🗑️</button>
                <button class="bo-btn-editar-tabla">✏️</button>
            </td>
        </tr>
    `).join('');
}

// =====================
// VENTAS
function registrarVenta() {
    const cliente = document.getElementById("venta_cliente").value.trim();
    if (!cliente) { alert("El cliente es obligatorio."); return; }

    const monto    = parseFloat(document.getElementById("venta_monto").value) || 0;
    const asesorId = parseInt(document.getElementById("venta_asesor").value) || null;
    const asesor   = asesores.find(a => a.id === asesorId);

    ventasRegistradas.push({
        id: Date.now(), cliente,
        producto: document.getElementById("venta_producto").value.trim() || "—",
        monto, asesorNombre: asesor ? asesor.nombre : "—", asesorId,
        notas: document.getElementById("venta_notas").value.trim(),
        fecha: fechaHoy()
    });

    ["venta_cliente","venta_producto","venta_monto","venta_notas"].forEach(id =>
        document.getElementById(id).value = "");

    renderVentas(); renderRendimiento();
}

function eliminarVenta(id) {
    ventasRegistradas = ventasRegistradas.filter(v => v.id !== id);
    renderVentas(); renderRendimiento();
}

function renderVentas() {
    const total   = ventasRegistradas.length;
    const ingreso = ventasRegistradas.reduce((s,v) => s + v.monto, 0);
    const prom    = total ? Math.round(ingreso / total) : 0;

    const kv = document.getElementById("kpiTotalVentas");
    const ki = document.getElementById("kpiIngresoTotal");
    const kp = document.getElementById("kpiPromedio");
    if (kv) kv.innerText = total;
    if (ki) ki.innerText = `S/ ${ingreso.toLocaleString()}`;
    if (kp) kp.innerText = `S/ ${prom.toLocaleString()}`;

    const tbody = document.getElementById("tablaVentas");
    if (!tbody) return;

    if (!ventasRegistradas.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="bo-empty">Sin ventas registradas.</td></tr>`;
        return;
    }

    tbody.innerHTML = ventasRegistradas.map(v => `
        <tr>
            <td>
                <div class="bo-cliente-cell">
                    <div class="bo-cliente-avatar" style="background:${colorAvatar(v.cliente)}">${iniciales(v.cliente)}</div>
                    <span style="font-weight:600">${v.cliente}</span>
                </div>
            </td>
            <td>${v.producto}</td>
            <td><span class="monto-verde">S/ ${v.monto.toLocaleString()}</span></td>
            <td>${v.asesorNombre}</td>
            <td>${v.fecha}</td>
            <td style="color:#9ca3af;font-size:12px">${v.notas || ''}</td>
            <td><button class="bo-btn-eliminar" onclick="eliminarVenta(${v.id})">🗑️</button></td>
        </tr>
    `).join('');
}

// =====================
// ROTACION
function renderRotacion() {
    const tbody = document.getElementById("tablaRotacion");
    if (!tbody) return;

    const aptos = leads.filter(l => ["Nuevo","No contesta","Buzón"].includes(l.estado));

    if (!aptos.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="bo-empty">Sin leads disponibles para rotar.</td></tr>`;
        return;
    }

    const optsAsesores = asesores.map(a => `<option value="${a.id}">${a.nombre}</option>`).join('');

    tbody.innerHTML = aptos.map(l => `
        <tr>
            <td style="font-weight:600">${l.nombre}</td>
            <td>${l.telefono || '—'}</td>
            <td><span style="font-weight:600;color:${estadoColor(l.estado)}">${l.estado}</span></td>
            <td>${l.asesorNombre}</td>
            <td><span class="tiempo-ok">✅ Apto</span></td>
            <td>—</td>
            <td>
                <select class="select-asesor-tabla" onchange="rotarLead(${l.id}, this.value)">
                    <option value="">Selecciona asesor</option>
                    ${optsAsesores}
                </select>
            </td>
        </tr>
    `).join('');
}

function rotarLead(leadId, asesorId) {
    if (!asesorId) return;
    const lead   = leads.find(l => l.id === leadId);
    const asesor = asesores.find(a => a.id === parseInt(asesorId));
    if (!lead || !asesor) return;

    if (lead.asignadoA.includes(asesor.id)) {
        alert(`${asesor.nombre} ya tuvo este lead. Regla: sin repetir.`); return;
    }

    lead.asesorId = asesor.id; lead.asesorNombre = asesor.nombre;
    lead.horaAsig = horaAhora(); lead.rotaciones++;
    lead.asignadoA.push(asesor.id);

    renderLeads(); renderRotacion(); renderRendimiento();
}

function ejecutarRotacion() {
    const asesorId = parseInt(document.getElementById("rot_asesor").value);
    const cantidad = parseInt(document.getElementById("rot_cantidad").value) || 4;
    const asesor   = asesores.find(a => a.id === asesorId);
    if (!asesor) { alert("Selecciona un asesor destino."); return; }

    const aptos = leads.filter(l =>
        ["Nuevo","No contesta","Buzón"].includes(l.estado) && !l.asignadoA.includes(asesorId)
    ).slice(0, Math.min(cantidad, 4));

    if (!aptos.length) { alert("No hay leads aptos para rotar a este asesor."); return; }

    aptos.forEach(l => {
        l.asesorId = asesor.id; l.asesorNombre = asesor.nombre;
        l.horaAsig = horaAhora(); l.rotaciones++;
        l.asignadoA.push(asesor.id);
    });

    alert(`✅ ${aptos.length} leads rotados a ${asesor.nombre}`);
    renderLeads(); renderRotacion(); renderRendimiento();
}

// =====================
// RENDIMIENTO
function renderRendimiento() {
    const totalLeads  = leads.length;
    const totalVentas = ventasRegistradas.length;
    const ingreso     = ventasRegistradas.reduce((s,v) => s + v.monto, 0);
    const conv        = totalLeads ? Math.round((totalVentas / totalLeads) * 100) : 0;

    const ids = {
        rend_totalLeads: totalLeads,
        rend_totalVentas: totalVentas,
        rend_conversion: conv + "%",
        rend_ingreso: `S/ ${ingreso.toLocaleString()}`,
        rend_asesores: asesores.length
    };
    Object.entries(ids).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    });

    const tbody = document.getElementById("tablaRendimiento");
    if (!tbody) return;

    if (!asesores.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="bo-empty">Sin asesores registrados.</td></tr>`;
        return;
    }

    tbody.innerHTML = asesores.map(a => {
        const misLeads    = leads.filter(l => l.asesorId === a.id).length;
        const misVentas   = ventasRegistradas.filter(v => v.asesorId === a.id);
        const misIngresos = misVentas.reduce((s,v) => s + v.monto, 0);
        const miConv      = misLeads ? Math.round((misVentas.length / misLeads) * 100) : 0;

        return `
        <tr>
            <td>
                <div class="rend-asesor-cell">
                    <div class="bo-cliente-avatar" style="background:${colorAvatar(a.nombre)}">${iniciales(a.nombre)}</div>
                    <div>
                        <div class="rend-asesor-nombre">${a.nombre}</div>
                        <div class="rend-asesor-user">${a.usuario || ''}</div>
                    </div>
                </div>
            </td>
            <td><span class="rend-rol-badge">Asesor</span></td>
            <td>${misLeads}</td>
            <td>${misVentas.length}</td>
            <td>${miConv}%</td>
            <td><span class="monto-verde">S/ ${misIngresos.toLocaleString()}</span></td>
        </tr>`;
    }).join('');
}

// =====================
// INIT — UN SOLO HANDLER
window.onload = () => {
    renderAsesoresSelector();
    poblarSelects();
};

// =====================
// BASE DE LLAMADAS
// Cuando conectes el backend, llena este array con tu API:
// baseRegistros = await fetch('/api/base').then(r => r.json())
let baseRegistros = [
    // Datos de ejemplo — reemplazar con backend
    { zona:"NKT", distrito:"SMP",      num1:"987654321", num2:"998877665", tipifBO:"BUZON",        comentario:"",           dniVenta:"",         tipif:"NO CONTESTA",   hora:"10:15", asesor1:"JOSE OUT",    asesor2:"",          asesor3:"",         asesor4:"" },
    { zona:"NKT", distrito:"LIMA",     num1:"912345678", num2:"",          tipifBO:"",             comentario:"",           dniVenta:"47593188", tipif:"VENTA CERRADA", hora:"11:22", asesor1:"ANA OUT",     asesor2:"JOSE OUT",  asesor3:"",         asesor4:"" },
    { zona:"C1",  distrito:"CALLAO",   num1:"923456789", num2:"",          tipifBO:"DER CHAMO",    comentario:"No atiende", dniVenta:"",         tipif:"NO CONTESTA",   hora:"09:40", asesor1:"CARLOS OUT",  asesor2:"",          asesor3:"",         asesor4:"" },
    { zona:"NKT", distrito:"HUANCAYO", num1:"934567890", num2:"",          tipifBO:"",             comentario:"",           dniVenta:"",         tipif:"SIN COBERTURA", hora:"13:05", asesor1:"JOSE OUT",    asesor2:"",          asesor3:"",         asesor4:"" },
    { zona:"NKT", distrito:"TACNA",    num1:"945678901", num2:"",          tipifBO:"",             comentario:"",           dniVenta:"75152423", tipif:"VENTA CERRADA", hora:"15:30", asesor1:"ANA OUT",     asesor2:"CARLOS OUT",asesor3:"JOSE OUT", asesor4:"" },
    { zona:"SCW", distrito:"LIMA",     num1:"956789012", num2:"",          tipifBO:"BUZON",        comentario:"",           dniVenta:"",         tipif:"BUZON DE VOZ",  hora:"08:50", asesor1:"CARLOS OUT",  asesor2:"",          asesor3:"",         asesor4:"" },
    { zona:"NKT", distrito:"COMAS",    num1:"967890123", num2:"",          tipifBO:"CORTA",        comentario:"",           dniVenta:"",         tipif:"CORTA LLAMADA", hora:"12:10", asesor1:"JOSE OUT",    asesor2:"",          asesor3:"",         asesor4:"" },
    { zona:"C1",  distrito:"LIMA",     num1:"978901234", num2:"911223344", tipifBO:"",             comentario:"AGENDADO",   dniVenta:"",         tipif:"AGENDADO",      hora:"14:00", asesor1:"ANA OUT",     asesor2:"",          asesor3:"",         asesor4:"" },
];

function tipRowClass(tipif) {
    const t = (tipif || "").toUpperCase();
    if (t.includes("VENTA CERRADA"))       return "tip-row-venta";
    if (t.includes("NO CONTESTA"))         return "tip-row-nocontesta";
    if (t.includes("BUZON"))               return "tip-row-buzon";
    if (t.includes("SIN COBERTURA"))       return "tip-row-sincobertura";
    if (t.includes("NO DESEA"))            return "tip-row-nodesea";
    if (t.includes("CORTA"))               return "tip-row-corta";
    if (t.includes("PREVENTA"))            return "tip-row-preventa";
    if (t.includes("EN EJECUCION"))        return "tip-row-ejecucion";
    if (t.includes("AGENDADO"))            return "tip-row-agendado";
    if (t.includes("NO CALIFICA"))         return "tip-row-nocalifica";
    if (t.includes("EDIFICIO"))            return "tip-row-edificio";
    if (t.includes("CONTACTO"))            return "tip-row-contacto";
    return "tip-row-default";
}

function tipBadgeClass(tipif) {
    const t = (tipif || "").toUpperCase();
    if (t.includes("VENTA CERRADA"))  return "tip-venta-badge";
    if (t.includes("NO CONTESTA"))    return "tip-nocon-badge";
    if (t.includes("BUZON"))          return "tip-buzon-badge";
    if (t.includes("SIN COBERTURA"))  return "tip-sinco-badge";
    if (t.includes("NO DESEA"))       return "tip-nodesea-badge";
    if (t.includes("CORTA"))          return "tip-corta-badge";
    if (t.includes("PREVENTA"))       return "tip-preventa-badge";
    if (t.includes("EN EJECUCION"))   return "tip-ejec-badge";
    if (t.includes("AGENDADO"))       return "tip-agend-badge";
    if (t.includes("NO CALIFICA"))    return "tip-nocal-badge";
    if (t.includes("EDIFICIO"))       return "tip-edif-badge";
    if (t.includes("CONTACTO"))       return "tip-cont-badge";
    return "tip-default-badge";
}

function poblarFiltroAsesorBase() {
    const sel = document.getElementById("filtro_asesor_base");
    if (!sel) return;
    // Recoger todos los asesores únicos de los registros
    const nombres = new Set();
    baseRegistros.forEach(r => {
        [r.asesor1, r.asesor2, r.asesor3, r.asesor4].forEach(a => {
            if (a && a.trim()) nombres.add(a.trim());
        });
    });
    sel.innerHTML = '<option value="">Todos</option>';
    [...nombres].sort().forEach(n => {
        sel.innerHTML += `<option value="${n}">${n}</option>`;
    });
}

function renderBase() {
    const tbody = document.getElementById("tablaBaseBody");
    const contEl = document.getElementById("baseContador");
    if (!tbody) return;

    const filtroTip      = (document.getElementById("filtro_tip")?.value || "").toUpperCase();
    const filtroAsesor   = (document.getElementById("filtro_asesor_base")?.value || "").toUpperCase();
    const filtroDistrito = (document.getElementById("filtro_distrito")?.value || "").toUpperCase();
    const filtroNumero   = (document.getElementById("filtro_numero")?.value || "").trim();

    let datos = baseRegistros.filter(r => {
        if (filtroTip      && !(r.tipif || "").toUpperCase().includes(filtroTip)) return false;
        if (filtroDistrito && !(r.distrito || "").toUpperCase().includes(filtroDistrito)) return false;
        if (filtroNumero   && !r.num1.includes(filtroNumero) && !r.num2.includes(filtroNumero)) return false;
        if (filtroAsesor) {
            const asesores = [r.asesor1, r.asesor2, r.asesor3, r.asesor4].map(a => (a||"").toUpperCase());
            if (!asesores.some(a => a.includes(filtroAsesor))) return false;
        }
        return true;
    });

    if (contEl) contEl.innerText = `${datos.length} registros`;

    if (!datos.length) {
        tbody.innerHTML = `<tr><td colspan="14" class="bo-empty">Sin registros con esos filtros.</td></tr>`;
        return;
    }

    tbody.innerHTML = datos.map((r, i) => `
        <tr class="${tipRowClass(r.tipif)}">
            <td style="color:#9ca3af;font-size:10px">${i + 1}</td>
            <td><strong>${r.zona || '—'}</strong></td>
            <td>${r.distrito || '—'}</td>
            <td style="font-family:monospace;font-weight:600">${r.num1 || '—'}</td>
            <td style="font-family:monospace;color:#6b7280">${r.num2 || '—'}</td>
            <td>${r.tipifBO ? `<span class="tip-cell tip-default-badge">${r.tipifBO}</span>` : '—'}</td>
            <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;color:#6b7280">${r.comentario || '—'}</td>
            <td style="font-family:monospace">${r.dniVenta || '—'}</td>
            <td><span class="tip-cell ${tipBadgeClass(r.tipif)}">${r.tipif || '—'}</span></td>
            <td style="color:#3b82f6;font-weight:600">${r.hora || '—'}</td>
            <td>${r.asesor1 || '—'}</td>
            <td>${r.asesor2 || '—'}</td>
            <td>${r.asesor3 || '—'}</td>
            <td>${r.asesor4 || '—'}</td>
        </tr>
    `).join('');
}

function limpiarFiltrosBase() {
    ["filtro_tip","filtro_asesor_base"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    ["filtro_distrito","filtro_numero"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    renderBase();
}