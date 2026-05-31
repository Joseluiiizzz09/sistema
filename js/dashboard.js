/* ================================================
   DASHBOARD.JS — Asesor Netcontact
   ================================================ */

const API = 'http://127.0.0.1:3000/api';

let clientes = [];
let seleccionado = null;
let llamadas = 0;
let ventas = 0;
let instaladas = 0;

function fechaISO(d) { return d.toISOString().split('T')[0]; }
function fechaHoy()  { return fechaISO(new Date()); }

function fechaHoyFormateada() {
    return new Date().toLocaleDateString('es-PE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function mostrar(pantalla, btn) {
    document.querySelectorAll(".pantalla").forEach(p => p.classList.add("hidden"));
    document.getElementById(pantalla).classList.remove("hidden");
    document.querySelectorAll(".tabs .tab").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    if (pantalla === "rendimiento")   setTimeout(iniciarGraficos, 50);
    if (pantalla === "frases")        cargarFrasesSuper();
    if (pantalla === "ventassubidas") cargarVentasSubidas();
}

function render() {
    let tabla = document.getElementById("tabla");
    const fechaEl = document.getElementById("fechaHoyLabel");
    if (fechaEl) fechaEl.textContent = fechaHoyFormateada();

    if (!clientes.length) {
        tabla.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">
            Sin registros asignados para hoy.<br>
            <span style="font-size:11px;margin-top:6px;display:block;">El Back Office asignará registros a tu usuario.</span>
        </td></tr>`;
        actualizarStats();
        return;
    }
    tabla.innerHTML = "";
    clientes.forEach((c, i) => {
        tabla.innerHTML += `
        <tr>
            <td>${c.telefono}</td>
            <td>${c.zona}</td>
            <td style="font-size:11px;color:#9ca3af;">${c.horaAsig || '—'}</td>
            <td><span class="badge-estado ${colorEstado(c.estado)}">${c.estado}</span></td>
            <td><input class="input-obs" placeholder="Nro. documento..." value="${c.obs || ''}"
                oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                onchange="guardarObs(${i}, this.value)" maxlength="15"></td>
            <td>
                <button class="btn-accion" onclick="abrirModal(${i})" title="Tipificar">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="rgba(255,255,255,0.25)" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
                        <path d="M14 2v4h4" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
                        <path d="M9 17l1.5-1.5 3-3-1.5-1.5-3 3L9 17z" fill="#fff"/>
                        <path d="M13.5 12.5l1-1a1 1 0 0 0-1.5-1.5l-1 1 1.5 1.5z" fill="#fff"/>
                    </svg>
                </button>
            </td>
        </tr>`;
    });
    actualizarStats();
}

function guardarObs(i, valor) { clientes[i].obs = valor; }

function abrirModal(i) {
    seleccionado = i;
    document.getElementById("modalTipos").classList.add("show");
    document.getElementById("modalTipos").classList.remove("hidden");
}

function cerrarModal() {
    document.getElementById("modalTipos").classList.remove("show");
    document.getElementById("modalVenta").classList.remove("show");
    const s = document.getElementById("tipSearch");
    if (s) { s.value = ""; filtrarTips(""); }
}

function filtrarTips(q) {
    const chips = document.querySelectorAll("#tipGrid .tip-chip");
    const b = q.trim().toLowerCase();
    chips.forEach(c => { c.style.display = !b || c.textContent.toLowerCase().includes(b) ? "" : "none"; });
}

function tipificar(tipo) {
    llamadas++;
    if (tipo === "VENTA CERRADA") {
        ventas++;
        cerrarModal();
        document.getElementById("modalVenta").classList.remove("hidden");
        document.getElementById("modalVenta").classList.add("show");
        document.getElementById("mv_dni").value = "";
        actualizarStats();
        return;
    }
    if (seleccionado !== null) clientes[seleccionado].estado = tipo;
    cerrarModal();
    render();
}

function actualizarLabelDoc() {
    const tipo = document.getElementById("mv_tipoDoc")?.value || "DNI";
    const labels = { DNI: "Número de DNI", CE: "Número de Carnet de Extranjería", RUC: "Número de RUC" };
    const el = document.getElementById("mv_docLabel");
    if (el) el.textContent = labels[tipo] || "Número de documento";
}

function irANuevaVenta() {
    const dni = document.getElementById("mv_dni")?.value.trim();
    if (!dni) { const el = document.getElementById("mv_dni"); if (el) el.style.borderColor = "#ef4444"; return; }
    const tipo = document.getElementById("mv_tipoDoc")?.value || "DNI";
    if (seleccionado !== null) {
        clientes[seleccionado].estado = "VENTA CERRADA";
        clientes[seleccionado].obs = tipo + ": " + dni;
        const obsInput = document.querySelector("#tabla tr:nth-child(" + (seleccionado + 1) + ") .input-obs");
        if (obsInput) obsInput.value = clientes[seleccionado].obs;
    }
    instaladas++;
    cerrarModal();
    render();
    mostrarToastDash("Venta cerrada — " + tipo + ": " + dni);
}

function guardarVenta() {
    if (seleccionado !== null) clientes[seleccionado].estado = "VENTA CERRADA";
    instaladas++;
    cerrarModal();
    seleccionado = null;
    render();
}

function actualizarStats() {
    const lc = document.getElementById("llamadasCount");
    const vc = document.getElementById("ventasCount");
    const ic = document.getElementById("instaladasCount");
    const ef = document.getElementById("efectividad");
    const ni = document.getElementById("noInstaladasCount");
    if (lc) lc.innerText = llamadas;
    if (vc) vc.innerText = ventas;
    if (ic) ic.innerText = instaladas;
    if (ef) ef.innerText = (ventas ? Math.round((instaladas / ventas) * 100) : 0) + "%";
    if (ni) ni.innerText = Math.max(0, ventas - instaladas);
    actualizarMeta();
}

async function cargarFrasesSuper() {
    const cont = document.getElementById("frasesSupContainer");
    if (!cont) return;
    try {
        const u   = ncGetSesion();
        const url = u?.sala ? `${API}/frases?sala=${encodeURIComponent(u.sala)}` : `${API}/frases`;
        const res  = await fetch(url, { headers: ncHeaders() });
        const data = await res.json();
        if (!data.ok || !data.data?.length) {
            cont.innerHTML = `<div style="text-align:center;padding:60px 24px;color:#9ca3af;"><div style="font-size:15px;font-weight:600;color:#374151;margin-bottom:6px;">Sin mensajes por ahora</div><div style="font-size:13px;">Tu supervisor aún no ha publicado mensajes hoy.</div></div>`;
            return;
        }
        const frases = data.data;
        const principal = frases[0];
        const resto = frases.slice(1);
        cont.innerHTML = `
            <div class="frase-destacada">
                <div class="frase-comilla">"</div>
                <p class="frase-texto">${principal.texto}</p>
                <div class="frase-autor">— ${principal.supervisor_nombre || "Tu supervisor"}</div>
            </div>
            ${resto.length ? `<div class="frases-grid">${resto.map((f, i) => `<div class="frase-card"><div class="frase-card-num">#${i + 1}</div><div class="frase-card-texto">${f.texto}</div></div>`).join("")}</div>` : ""}`;
    } catch(e) {
        const cont2 = document.getElementById("frasesSupContainer");
        if (cont2) cont2.innerHTML = `<div style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">Sin mensajes disponibles.</div>`;
    }
}

function colorEstado(e) {
    const map = {
        "VENTA CERRADA":"estado-venta-cerrada","CORTA LLAMADA":"estado-corta-llamada","PREVENTA":"estado-preventa",
        "NO CONTESTA":"estado-no-contesta","EN EJECUCION":"estado-en-ejecucion","SIN COBERTURA":"estado-sin-cobertura",
        "DESEA MOVIL":"estado-desea-movil","SERVICIO ACTIVO":"estado-servicio-activo","AGENDADO":"estado-agendado",
        "NO CALIFICA":"estado-no-califica","EDIFICIO NO LIBERADO":"estado-sh-edificio-no-liberado",
        "CONTACTO CON TERCEROS":"estado-contacto-con-terceros","NO DESEA":"estado-no-desea",
        "BUZON DE VOZ":"estado-buzon-voz","NUEVO":"estado-nuevo",
    };
    return map[e] || "estado-nuevo";
}

function cargarSaludo() {
    const u = ncGetSesion();
    const nombre = u?.nombre || 'ASESOR';
    const hora   = new Date().getHours();
    const saludoHora = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
    const el = document.getElementById("saludoUsuario");
    if (el) el.innerText = `${saludoHora}, ${nombre}`;
}

let ventasSubidas = [];

async function cargarVentasSubidas() {
    try {
        const res  = await fetch(`${API}/ventas`, { headers: ncHeaders() });
        const data = await res.json();
        if (data.ok) { ventasSubidas = data.data; actualizarTablaVentas(ventasSubidas); }
    } catch(e) { console.error("Error cargando ventas:", e); }
}

function buscarVentas() {
    const dni   = document.getElementById("filtroDni")?.value.trim().toLowerCase() || "";
    const desde = document.getElementById("fechaDesde")?.value || "";
    const hasta = document.getElementById("fechaHasta")?.value || "";
    const filtradas = ventasSubidas.filter(v => {
        const matchDni   = !dni   || (v.dni||"").toLowerCase().includes(dni);
        const fechaV     = (v.created_at || "").split(" ")[0];
        const matchDesde = !desde || fechaV >= desde;
        const matchHasta = !hasta || fechaV <= hasta;
        return matchDni && matchDesde && matchHasta;
    });
    actualizarTablaVentas(filtradas);
}

function borrarFiltros() {
    ["filtroDni","fechaDesde","fechaHasta"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
    actualizarTablaVentas(ventasSubidas);
}

function refrescarVentas() { cargarVentasSubidas(); }

function badgeEstado(e) {
    const map = { "PROGRAMADO":"vs-badge-programado","VENTA":"vs-badge-venta","VALIDADO":"vs-badge-validado","DUPLICADA":"vs-badge-duplicada" };
    const cls = map[(e||"").toUpperCase()] || "vs-badge-venta";
    return e ? `<span class="vs-badge ${cls}">${e.toUpperCase()}</span>` : "-";
}

function actualizarTablaVentas(data) {
    const tbody  = document.getElementById("tablaVentasSubidas");
    const contEl = document.getElementById("vsContador");
    if (contEl) contEl.innerText = `${data.length} registros`;
    if (!tbody) return;
    if (!data.length) { tbody.innerHTML = `<tr class="vs-empty"><td colspan="33">Sin registros encontrados.</td></tr>`; return; }
    tbody.innerHTML = data.map((v, i) => `
        <tr>
            <td>${badgeEstado(v.estado)}</td>
            <td>${v.obs_backoffice || "-"}</td>
            <td>${v.agendado || "-"}</td>
            <td>${v.tipoVenta || "-"}</td>
            <td>${(v.created_at || "-").split(" ")[0]}</td>
            <td>${v.nombre || "-"}</td>
            <td>${v.tipo_doc || "DNI"}</td>
            <td>${v.dni || "-"}</td>
            <td>${v.representanteLegal || "-"}</td>
            <td>${v.telefono1 || "-"}</td>
            <td>${v.telefono2 || "-"}</td>
            <td>${v.departamento || "-"}</td>
            <td>${v.provincia || "-"}</td>
            <td>${v.distrito || "-"}</td>
            <td>${v.direccion || "-"}</td>
            <td>${v.coordenadas || "-"}</td>
            <td>${v.asesor_nombre || "-"}</td>
            <td>${v.supervisor || "-"}</td>
            <td>${v.canal || "-"}</td>
            <td>${v.tipoDomicilio || "-"}</td>
            <td>${v.email || "-"}</td>
            <td>${v.predio || "-"}</td>
            <td>${v.cuota_inst || "-"}</td>
            <td>${v.claro_hogar || "-"}</td>
            <td>${v.tecnologia || "-"}</td>
            <td>${v.paquete || "-"}</td>
            <td>${v.full_claro || "-"}</td>
            <td>${v.cant_decos || "0"}</td>
            <td>${v.cant_mesh || "0"}</td>
            <td>${v.cuotaPagoMesh || "-"}</td>
            <td>${v.plano || "-"}</td>
            <td>${v.observacion || "-"}</td>
            <td>
                <div class="vs-acciones-cell">
                    <button class="vs-btn-editar"   onclick="editarVenta(${i})">Editar</button>
                    <button class="vs-btn-fotos"    onclick="fotosVenta(${i})">Fotos</button>
                    <button class="vs-btn-adjuntar" onclick="adjuntarVenta(${i})">Adjuntar</button>
                </div>
            </td>
        </tr>
    `).join("");
}

function editarVenta(i)   { alert("Editar — próximamente"); }
function fotosVenta(i)    { alert("Fotos — próximamente"); }
function adjuntarVenta(i) { alert("Adjuntar — próximamente"); }

function poblarDepartamentos() {
    const sel = document.getElementById('nv_dpto');
    if (!sel || typeof UBIGEO === 'undefined') return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Seleccionar departamento</option>';
    Object.keys(UBIGEO).forEach(dep => {
        sel.innerHTML += '<option value="' + dep + '">' + dep + '</option>';
    });
    if (val) sel.value = val;
}

function toggleNuevaVenta() {
    const p   = document.getElementById("panelNuevaVenta");
    const btn = document.getElementById("btnNuevaVenta");
    if (!p) return;
    const visible = p.style.display === "flex";
    p.style.display = visible ? "none" : "flex";
    if (btn) btn.textContent = visible ? "+ Nueva Venta" : "Cerrar";
    if (!visible) poblarDepartamentos();
}

function actualizarLabelDocNV() {
    const tipo = document.getElementById("nv_tipoDoc")?.value || "DNI";
    const labels = { DNI: "Número DNI *", CE: "Número Carnet Extranjería *", RUC: "Número RUC *" };
    const el = document.getElementById("nv_docLabel");
    if (el) el.textContent = labels[tipo] || "Número de documento *";
}

const PAQUETES_POR_PLAN = {
  '1 PLAY': [
    '150 MBPS S/70.00',
    '300 MBPS S/75.00',
    '800 MBPS S/100.00',
    '1500 MBPS S/200.00',
    'PROM ENTRADA 200 X 12 M 400 MBPS X 6M 39.5',
    'PROM GRANDE 1000 MBPS X 6M 59.9',
    'PROM GRANDE 850 X 12M 1000 MBPS X 4M 55',
    'PROM LIM/ARQ 400 X 12 M 1000 MBPS X 2 M 1 SOL',
    'PROM MEDIANA 400 X 12M 1000 MBPS X 6M 55',
    'REG PRO 1000 MBPS',
    'REG PRO 500 MBPS',
  ],
  '2 PLAY INTERNET + TELEFONO': [
    '150 MBPS S/70.00',
    '1000 MBPS S/150.00',
    '1500 MBPS S/205.00',
    '300 MBPS S/80.00',
    '300 MPBS 84.00',
    '400 MBPS 94.00 S',
    '400 MBPS S/90.00',
    '800 MBPS S/105.00',
  ],
  '2 PLAY INTERNET + CABLE ESTANDAR': [
    '1000 MBPS S/230.00',
    '150 MBPS S/150.00',
    '1500 MBPS S/285.00',
    '300 MBPS S/160.00',
    '400 MBPS S/170.00',
    '800 MBPS S/185.00',
  ],
  '2 PLAY INTERNET + CABLE SUPERIOR': [
    '1000 MBPS S/270.00',
    '150 MBPS S/190.00',
    '1500 MBPS S/325.00',
    '300 MBPS S/200.00',
    '400 MBPS S/210.00',
    '800 MBPS S/225.00',
  ],
  '3 PLAY ESTANDAR': [
    '1000 MBPS S/235.00',
    '150 MBPS S/155.00',
    '1500 MBPS S/290.00',
    '300 MBPS S/165.00',
    '400 MBPS S/175.00',
    '800 MBPS S/190.00',
  ],
  '3 PLAY SUPERIOR': [
    '1000 MBPS S/275.00',
    '150 MBPS S/195.00',
    '1500 MBPS S/330.00',
    '300 MBPS S/205.00',
    '400 MBPS S/215.00',
    '800 MBPS S/230.00',
  ],
};

function actualizarPaquetes() {
  const hogar = document.getElementById('nv_hogar')?.value || '';
  const sel   = document.getElementById('nv_paquete');
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar</option>';
  const planes = PAQUETES_POR_PLAN[hogar] || [];
  planes.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p; opt.textContent = p;
    sel.appendChild(opt);
  });
}

async function guardarNuevaVenta() {
    const dni    = document.getElementById("nv_dni")?.value.trim();
    const nombre = document.getElementById("nv_nombre")?.value.trim();
    if (!dni)    { const el=document.getElementById("nv_dni");    if(el) el.style.borderColor="#ef4444"; return; }
    if (!nombre) { const el=document.getElementById("nv_nombre"); if(el) el.style.borderColor="#ef4444"; return; }
    const venta = {
        tipoDoc: document.getElementById("nv_tipoDoc")?.value || "DNI", dni, nombre,
        email: document.getElementById("nv_email")?.value?.trim() || "",
        telefono1: document.getElementById("nv_tel1")?.value.trim() || "",
        telefono2: document.getElementById("nv_tel2")?.value.trim() || "",
        departamento: document.getElementById("nv_dpto")?.value.trim() || "",
        provincia: document.getElementById("nv_prov")?.value.trim() || "",
        distrito: document.getElementById("nv_dist")?.value.trim() || "",
        direccion: document.getElementById("nv_dir")?.value.trim() || "",
        coordenadas: document.getElementById("nv_coord")?.value.trim() || "",
        fechaNac: document.getElementById("nv_fechaNac")?.value || "",
        lugarNac: document.getElementById("nv_lugarNac")?.value.trim() || "",
        padre: document.getElementById("nv_padre")?.value.trim() || "",
        madre: document.getElementById("nv_madre")?.value.trim() || "",
        predio: document.getElementById("nv_predio")?.value || "",
        cuotaInstalacion: document.getElementById("nv_cuota")?.value || "",
        hogar: document.getElementById("nv_hogar")?.value || "",
        tec: document.getElementById("nv_tec")?.value || "",
        paquete: document.getElementById("nv_paquete")?.value || "",
        full: document.getElementById("nv_full")?.value || "",
        cantDecos: document.getElementById("nv_decos")?.value || "0",
        cantMesh: document.getElementById("nv_mesh")?.value || "0",
        plano: document.getElementById("nv_plano")?.value.trim() || "",
        estado: document.getElementById("nv_estado")?.value || "VENTA",
        obs: document.getElementById("nv_obs")?.value.trim() || "",
    };
    const btnGuardar = document.querySelector('[onclick="guardarNuevaVenta()"]');
    if (btnGuardar) { btnGuardar.disabled=true; btnGuardar.textContent="Guardando..."; }
    try {
        const res  = await fetch(`${API}/ventas`, { method:"POST", headers:ncHeaders(), body:JSON.stringify(venta) });
        const data = await res.json();
        if (!data.ok) {
            mostrarToastDash("Error al guardar: " + (data.mensaje || ""));
            if (btnGuardar) { btnGuardar.disabled=false; btnGuardar.textContent="Guardar venta"; }
            return;
        }
        ["nv_dni","nv_nombre","nv_email","nv_tel1","nv_tel2","nv_dpto","nv_prov","nv_dist","nv_dir","nv_coord","nv_lugarNac","nv_padre","nv_madre","nv_plano","nv_obs","nv_fechaNac"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
        ["nv_dpto","nv_prov","nv_dist","nv_cuota","nv_hogar","nv_tec","nv_paquete","nv_full"].forEach(id => { const el=document.getElementById(id); if(el) el.selectedIndex=0; }); actualizarPaquetes();
        ["nv_decos","nv_mesh"].forEach(id => { const el=document.getElementById(id); if(el) el.selectedIndex=0; });
        if (btnGuardar) { btnGuardar.disabled=false; btnGuardar.textContent="Guardar venta"; }
        toggleNuevaVenta();
        await cargarVentasSubidas();
        mostrarToastDash("Venta guardada correctamente");
    } catch(e) {
        mostrarToastDash("Error conectando al servidor");
        if (btnGuardar) { btnGuardar.disabled=false; btnGuardar.textContent="Guardar venta"; }
    }
}

function mostrarToastDash(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;bottom:20px;right:20px;background:#111827;color:#fff;padding:12px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.2);";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

/* ===================== GRÁFICOS CON FILTRO DE FECHAS ===================== */
const META_DIARIA = 5;
let chartDiario=null, chartSemanal=null, chartMensual=null;

// Por defecto hoy
function getFiltroDiarioDesde() {
    return document.getElementById("filtroDiarioDesde")?.value || fechaHoy();
}
function getFiltroDiarioHasta() {
    return document.getElementById("filtroDiarioHasta")?.value || fechaHoy();
}

function generarRangoFechas(desde, hasta) {
    const fechas = [];
    const d = new Date(desde + 'T00:00:00');
    const h = new Date(hasta + 'T00:00:00');
    while (d <= h) {
        fechas.push(fechaISO(d));
        d.setDate(d.getDate() + 1);
    }
    return fechas;
}

function getVentasPorRango() {
    const desde = getFiltroDiarioDesde();
    const hasta = getFiltroDiarioHasta();
    const fechas = generarRangoFechas(desde, hasta);
    // Contar ventas e instaladas por fecha desde ventasSubidas
    const ventasPorFecha = {};
    const instaladasPorFecha = {};
    fechas.forEach(f => { ventasPorFecha[f] = 0; instaladasPorFecha[f] = 0; });
    ventasSubidas.forEach(v => {
        const f = (v.created_at || "").split(" ")[0];
        if (ventasPorFecha[f] !== undefined) {
            ventasPorFecha[f]++;
            if ((v.estado||"").toUpperCase() === "VALIDADO") instaladasPorFecha[f]++;
        }
    });
    // Formato corto para labels
    const labels = fechas.map(f => {
        const p = f.split('-');
        return p[2] + '/' + p[1];
    });
    return {
        labels,
        ventas:    fechas.map(f => ventasPorFecha[f]),
        instaladas: fechas.map(f => instaladasPorFecha[f]),
    };
}

function getKPIsRango() {
    const desde = getFiltroDiarioDesde();
    const hasta = getFiltroDiarioHasta();
    let v = 0, inst = 0;
    ventasSubidas.forEach(vv => {
        const f = (vv.created_at || "").split(" ")[0];
        if (f >= desde && f <= hasta) {
            v++;
            if ((vv.estado||"").toUpperCase() === "VALIDADO") inst++;
        }
    });
    return { ventas: v, instaladas: inst };
}

function actualizarKPIsRango() {
    const kpis = getKPIsRango();
    const vc = document.getElementById("ventasCount");
    const ic = document.getElementById("instaladasCount");
    const ef = document.getElementById("efectividad");
    const ni = document.getElementById("noInstaladasCount");
    if (vc) vc.innerText = kpis.ventas;
    if (ic) ic.innerText = kpis.instaladas;
    if (ef) ef.innerText = (kpis.ventas ? Math.round(kpis.instaladas/kpis.ventas*100) : 0) + "%";
    if (ni) ni.innerText = Math.max(0, kpis.ventas - kpis.instaladas);
    // Meta basada en ventas del rango
    const pct = Math.min(Math.round(kpis.ventas/META_DIARIA*100), 100);
    const mt=document.getElementById("metaTexto"), mb=document.getElementById("metaBarra"), mp=document.getElementById("metaPct");
    if(mt) mt.innerText = kpis.ventas + " / " + META_DIARIA + " ventas";
    if(mb) mb.style.width = pct + "%";
    if(mp) mp.innerText = pct + "%";
}

function aplicarFiltroGrafico() {
    const datos = getVentasPorRango();
    if (chartDiario) {
        chartDiario.data.labels = datos.labels;
        chartDiario.data.datasets[0].data = datos.ventas;
        chartDiario.data.datasets[1].data = datos.instaladas;
        chartDiario.update();
    }
    actualizarKPIsRango();
}

// Gráfico semanal — semanas del mes actual
function getDatosSemanal() {
    const hoy = new Date();
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();
    const semanas = [0,0,0,0];
    const semanasInst = [0,0,0,0];
    ventasSubidas.forEach(v => {
        const f = new Date((v.created_at||"").split(" ")[0]+"T00:00:00");
        if (f.getMonth()===mes && f.getFullYear()===anio) {
            const sem = Math.min(Math.floor((f.getDate()-1)/7), 3);
            semanas[sem]++;
            if ((v.estado||"").toUpperCase()==="VALIDADO") semanasInst[sem]++;
        }
    });
    return { labels:["Sem 1","Sem 2","Sem 3","Sem 4"], ventas:semanas, instaladas:semanasInst };
}

// Gráfico mensual — 12 meses del año actual
function getDatosMensual() {
    const anio = new Date().getFullYear();
    const meses = Array(12).fill(0);
    const mesesInst = Array(12).fill(0);
    ventasSubidas.forEach(v => {
        const f = new Date((v.created_at||"").split(" ")[0]+"T00:00:00");
        if (f.getFullYear()===anio) {
            meses[f.getMonth()]++;
            if ((v.estado||"").toUpperCase()==="VALIDADO") mesesInst[f.getMonth()]++;
        }
    });
    return { labels:["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"], ventas:meses, instaladas:mesesInst };
}

function iniciarGraficos() {
    // Set default dates to today
    const desde = document.getElementById("filtroDiarioDesde");
    const hasta  = document.getElementById("filtroDiarioHasta");
    if (desde && !desde.value) desde.value = fechaHoy();
    if (hasta && !hasta.value)  hasta.value  = fechaHoy();

    const datos = getVentasPorRango();
    const ctxD = document.getElementById("chartDiario"); if(!ctxD) return;
    if(chartDiario) chartDiario.destroy();
    chartDiario = new Chart(ctxD, {
        type:"bar",
        data:{
            labels: datos.labels,
            datasets:[
                { label:"Ventas",    data:datos.ventas,    backgroundColor:"rgba(34,197,94,0.8)",  borderRadius:5 },
                { label:"Instaladas",data:datos.instaladas,backgroundColor:"rgba(139,92,246,0.8)", borderRadius:5 }
            ]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",labels:{font:{size:11}}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1}}}}
    });

    const semanal = getDatosSemanal();
    const ctxS = document.getElementById("chartSemanal");
    if(chartSemanal) chartSemanal.destroy();
    chartSemanal = new Chart(ctxS, {
        type:"bar",
        data:{labels:semanal.labels,datasets:[
            {label:"Ventas",    data:semanal.ventas,    backgroundColor:"rgba(34,197,94,0.75)",  borderRadius:5},
            {label:"Instaladas",data:semanal.instaladas,backgroundColor:"rgba(139,92,246,0.75)", borderRadius:5}
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",labels:{font:{size:11}}}},scales:{y:{beginAtZero:true}}}
    });

    const mensual = getDatosMensual();
    const ctxM = document.getElementById("chartMensual");
    if(chartMensual) chartMensual.destroy();
    chartMensual = new Chart(ctxM, {
        type:"line",
        data:{labels:mensual.labels,datasets:[
            {label:"Ventas",    data:mensual.ventas,    borderColor:"#22c55e",backgroundColor:"rgba(34,197,94,0.08)",  tension:0.4,fill:true,pointRadius:4},
            {label:"Instaladas",data:mensual.instaladas,borderColor:"#8b5cf6",backgroundColor:"rgba(139,92,246,0.08)", tension:0.4,fill:true,pointRadius:4}
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",labels:{font:{size:11}}}},scales:{y:{beginAtZero:true}}}
    });

    actualizarKPIsRango();
}

function actualizarMeta() {
    const pct = Math.min(Math.round((ventas/META_DIARIA)*100),100);
    const mt=document.getElementById("metaTexto"), mb=document.getElementById("metaBarra"), mp=document.getElementById("metaPct");
    if(mt) mt.innerText = ventas + " / " + META_DIARIA + " ventas";
    if(mb) mb.style.width = pct + "%";
    if(mp) mp.innerText = pct + "%";
}

window.onload = () => {
    render();
    cargarSaludo();
    cargarFrasesSuper();
    cargarVentasSubidas();
    cargarLeadsAsesor();
    setInterval(cargarFrasesSuper, 30000);
    setInterval(cargarLeadsAsesor, 60000);
};

/* ===================== CARGAR LEADS DEL ASESOR ===================== */
async function cargarLeadsAsesor() {
    try {
        const res  = await fetch(`${API}/leads`, { headers: ncHeaders() });
        const data = await res.json();
        if (data.ok && data.data.length) {
            const hoy = fechaHoy();
            const soloHoy = data.data.filter(l => l.fecha === hoy);
            clientes = soloHoy.map(l => ({
                id:       l.id,
                telefono: l.n1,
                n2:       l.n2 || '',
                zona:     l.distrito || l.campana || '—',
                campana:  l.campana || '—',
                horaAsig: l.hora_asig || '',
                estado:   'NUEVO',
                obs:      '',
            }));
            render();
        }
    } catch(e) { console.error('Error cargando leads:', e); }
}