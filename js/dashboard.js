/* ================================================
   DASHBOARD.JS — Asesor Netcontact
   ================================================ */

const API = window.NC_API + '/api';
const DASHBOARD_APARTADO_KEY = 'nc_dashboard_apartado';

let clientes = [];
let seleccionado = null;
let llamadas = 0;
let ventas = 0;
let instaladas = 0;

function fechaISO(d) { return d.toISOString().split('T')[0]; }
function fechaHoy() {
  // Zona horaria Peru UTC-5
  const ahora = new Date();
  const utcMs = ahora.getTime() + ahora.getTimezoneOffset() * 60000;
  const peru  = new Date(utcMs + (-5 * 60 * 60000));
  const y = peru.getFullYear();
  const m = String(peru.getMonth() + 1).padStart(2, '0');
  const d = String(peru.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fechaHoyFormateada() {
    return new Date().toLocaleDateString('es-PE', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

function mostrar(pantalla, btn) {
    const panel = document.getElementById(pantalla);
    if (!panel) return;
    try { sessionStorage.setItem(DASHBOARD_APARTADO_KEY, pantalla); } catch(e) {}
    document.querySelectorAll(".pantalla").forEach(p => p.classList.toggle("hidden", p.id !== pantalla));
    const activeBtn = btn || buscarTabDashboard(pantalla);
    document.querySelectorAll(".tabs .tab").forEach(b => b.classList.toggle("active", b === activeBtn));
    if (pantalla === "rendimiento") {
        cargarVentasSubidas().then(async () => {
            await sincronizarKpisRendimiento();
            setTimeout(iniciarGraficos, 100);
        });
    }
    if (pantalla === "frases")        cargarFrasesSuper();
    if (pantalla === "ventassubidas") cargarVentasSubidas();
}

function buscarTabDashboard(pantalla) {
    return Array.from(document.querySelectorAll(".tabs .tab")).find(b => {
        const on = b.getAttribute("onclick") || "";
        return on.includes("mostrar('" + pantalla + "'") || on.includes('mostrar("' + pantalla + '"');
    }) || null;
}

function restaurarApartadoDashboard() {
    let pantalla = '';
    try { pantalla = sessionStorage.getItem(DASHBOARD_APARTADO_KEY) || ''; } catch(e) {}
    if (!pantalla || !document.getElementById(pantalla)) return;
    mostrar(pantalla, buscarTabDashboard(pantalla));
}

function render() {
    let tabla = document.getElementById("tabla");
    const fechaEl = document.getElementById("fechaHoyLabel");
    if (fechaEl) fechaEl.textContent = fechaHoyFormateada();
    if (!clientes.length) {
        tabla.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">Sin registros asignados para hoy.<br><span style="font-size:11px;margin-top:6px;display:block;">El Back Office asignara registros a tu usuario.</span></td></tr>';
        actualizarStats(); return;
    }
    tabla.innerHTML = "";
    clientes.forEach((c, i) => {
        tabla.innerHTML += '<tr>' +
            '<td>' + c.telefono + '</td>' +
            '<td>' + c.zona + '</td>' +
            '<td style="font-size:11px;color:#9ca3af;">' + (c.horaAsig || '--') + '</td>' +
            '<td><span class="badge-estado ' + colorEstado(c.estado) + '">' + c.estado + '</span></td>' +
            '<td><input class="input-obs" placeholder="Escribe una observacion..." value="' + esc(c.obs || '') + '" onchange="guardarObs(' + i + ', this.value)" maxlength="200"></td>' +
            '<td><button class="btn-accion" onclick="abrirModal(' + i + ')" title="Tipificar"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="rgba(255,255,255,0.25)" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 2v4h4" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 17l1.5-1.5 3-3-1.5-1.5-3 3L9 17z" fill="#fff"/><path d="M13.5 12.5l1-1a1 1 0 0 0-1.5-1.5l-1 1 1.5 1.5z" fill="#fff"/></svg></button></td>' +
        '</tr>';
    });
    actualizarStats();
}

function guardarObs(i, valor) {
    clientes[i].obs = valor;
    // Guardar observacion en backend
    if (clientes[i]?.id) {
        fetch(API + '/leads/' + clientes[i].id + '/obs', {
            method: 'PATCH',
            headers: ncHeaders(),
            body: JSON.stringify({ obs: valor }),
        }).catch(e => console.error('Error guardando obs:', e));
    }
}

function abrirModal(i) {
    seleccionado = i;
    // Mover modal al body para evitar stacking context del nv-overlay
    const m = document.getElementById("modalTipos");
    if (m.parentElement !== document.body) {
        document.body.appendChild(m);
    }
    m.classList.remove("hidden");
    m.classList.add("show");
}

function cerrarModal() {
    const mt = document.getElementById("modalTipos");
    const mv = document.getElementById("modalVenta");
    mt.classList.remove("show");
    mv.classList.remove("show");
    const s = document.getElementById("tipSearch");
    if (s) { s.value = ""; filtrarTips(""); }
}

function filtrarTips(q) {
    const chips = document.querySelectorAll("#tipGrid .tip-chip");
    const b = q.trim().toLowerCase();
    chips.forEach(c => { c.style.display = !b || c.textContent.toLowerCase().includes(b) ? "" : "none"; });
}

async function tipificar(tipo) {
    llamadas++;
    if (tipo === "VENTA CERRADA") {
        ventas++;
        cerrarModal();
        const mv2 = document.getElementById("modalVenta");
        if (mv2.parentElement !== document.body) document.body.appendChild(mv2);
        mv2.classList.remove("hidden");
        mv2.classList.add("show");
        document.getElementById("mv_dni").value = "";
        actualizarStats();
        // Guardar en backend
        if (seleccionado !== null && clientes[seleccionado]?.id) {
            await guardarTipifBackend(clientes[seleccionado].id, tipo);
        }
        return;
    }
    if (seleccionado !== null) {
        clientes[seleccionado].estado = tipo;
        // Guardar en backend
        if (clientes[seleccionado]?.id) {
            await guardarTipifBackend(clientes[seleccionado].id, tipo);
        }
    }
    cerrarModal();
    render();
}

async function guardarTipifBackend(leadId, tipif) {
    try {
        await fetch(API + '/leads/' + leadId + '/tipif', {
            method: 'PATCH',
            headers: ncHeaders(),
            body: JSON.stringify({ tipif_vend: tipif }),
        });
    } catch(e) { console.error('Error guardando tipif:', e); }
}

function actualizarLabelDoc() {
    const tipo = document.getElementById("mv_tipoDoc")?.value || "DNI";
    const labels = { DNI: "Numero de DNI", CE: "Numero de Carnet de Extranjeria", RUC: "Numero de RUC" };
    const el = document.getElementById("mv_docLabel");
    if (el) el.textContent = labels[tipo] || "Numero de documento";
}

function irANuevaVenta() {
    const dni = document.getElementById("mv_dni")?.value.trim();
    if (!dni) { const el = document.getElementById("mv_dni"); if (el) el.style.borderColor = "#ef4444"; return; }
    const tipo = document.getElementById("mv_tipoDoc")?.value || "DNI";
    if (seleccionado !== null) {
        clientes[seleccionado].estado = "VENTA CERRADA";
        clientes[seleccionado].obs = tipo + ": " + dni;
        // Guardar obs en backend
        if (clientes[seleccionado]?.id) {
            fetch(API + '/leads/' + clientes[seleccionado].id + '/obs', {
                method: 'PATCH',
                headers: ncHeaders(),
                body: JSON.stringify({ obs: tipo + ": " + dni }),
            }).catch(e => console.error('Error guardando obs:', e));
        }
        const obsInput = document.querySelector("#tabla tr:nth-child(" + (seleccionado + 1) + ") .input-obs");
        if (obsInput) obsInput.value = clientes[seleccionado].obs;
    }
    instaladas++;
    cerrarModal();
    render();
    mostrarToastDash("Venta cerrada: " + tipo + ": " + dni);
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
    // Sincronizar KPIs del rendimiento con datos reales del backend
    sincronizarKpisRendimiento();
}

async function sincronizarKpisRendimiento() {
    const hoy = fechaHoy();

    try {
        // Solo contar llamadas desde leads
        const resL = await fetch(API + '/leads', { headers: ncHeaders() });
        const dataL = await resL.json();
        if (dataL.ok) {
            const leadsHoy = dataL.data.filter(l => l.fecha === hoy);
            const tipificados = leadsHoy.filter(l =>
                l.tipif_vend && l.tipif_vend !== '' && l.tipif_vend !== 'NUEVO'
            );
            llamadas = Math.max(llamadas, tipificados.length);
            const lc = document.getElementById("llamadasCount");
            if (lc) lc.innerText = llamadas;
        }
    } catch(e) {}

    // Ventas = solo las ventas formalmente subidas en /api/ventas
    const ventasHoy   = ventasSubidas.filter(v => (v.created_at||'').split(' ')[0] === hoy);
    const instHoy     = ventasHoy.filter(v => (v.estado||'').toLowerCase() === 'instalado');

    ventas     = Math.max(ventas, ventasHoy.length);
    instaladas = Math.max(instaladas, instHoy.length);

    const pct = Math.min(Math.round(ventas / META_DIARIA * 100), 100);

    const vc = document.getElementById("ventasCount");
    const ic = document.getElementById("instaladasCount");
    const ef = document.getElementById("efectividad");
    const ni = document.getElementById("noInstaladasCount");
    const mt = document.getElementById("metaTexto");
    const mb = document.getElementById("metaBarra");
    const mp = document.getElementById("metaPct");

    if (vc) vc.innerText = ventas;
    if (ic) ic.innerText = instaladas;
    if (ef) ef.innerText = (ventas ? Math.round(instaladas/ventas*100) : 0) + "%";
    if (ni) ni.innerText = Math.max(0, ventas - instaladas);
    if (mt) mt.innerText = ventas + " / " + META_DIARIA + " ventas";
    if (mb) mb.style.width = pct + "%";
    if (mp) mp.innerText  = pct + "%";
}

async function cargarFrasesSuper() {
    const cont = document.getElementById("frasesSupContainer");
    if (!cont) return;
    try {
        const u   = ncGetSesion();
        const url = u?.sala ? API + '/frases?sala=' + encodeURIComponent(u.sala) : API + '/frases';
        const res  = await fetch(url, { headers: ncHeaders() });
        const data = await res.json();
        if (!data.ok || !data.data?.length) {
            cont.innerHTML = '<div style="text-align:center;padding:60px 24px;color:#9ca3af;"><div style="font-size:15px;font-weight:600;color:#374151;margin-bottom:6px;">Sin mensajes por ahora</div><div style="font-size:13px;">Tu supervisor no ha publicado mensajes hoy.</div></div>';
            return;
        }
        const frases = data.data;
        const principal = frases[0];
        const resto = frases.slice(1);
        cont.innerHTML = '<div class="frase-destacada"><div class="frase-comilla">"</div><p class="frase-texto">' + esc(principal.texto) + '</p><div class="frase-autor">— ' + esc(principal.supervisor_nombre || "Tu supervisor") + '</div></div>' +
            (resto.length ? '<div class="frases-grid">' + resto.map(function(f, i){ return '<div class="frase-card"><div class="frase-card-num">#' + (i+1) + '</div><div class="frase-card-texto">' + esc(f.texto) + '</div></div>'; }).join('') + '</div>' : '');
    } catch(e) {
        const cont2 = document.getElementById("frasesSupContainer");
        if (cont2) cont2.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af;font-size:13px;">Sin mensajes disponibles.</div>';
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
    const saludoHora = hora < 12 ? "Buenos dias" : hora < 18 ? "Buenas tardes" : "Buenas noches";
    const el = document.getElementById("saludoUsuario");
    if (el) el.innerText = saludoHora + ', ' + nombre;
}

let ventasSubidas = [];

async function cargarVentasSubidas() {
    try {
        const res  = await fetch(API + '/ventas', { headers: ncHeaders() });
        const data = await res.json();
        if (data.ok) {
            ventasSubidas = data.data;
            actualizarTablaVentas(ventasSubidas);
            // Actualizar KPIs del rendimiento con datos reales
            sincronizarKpisRendimiento();
            // Si estamos en la pestaña rendimiento, actualizar graficos
            if (!document.getElementById('rendimiento')?.classList.contains('hidden')) {
                aplicarFiltroGrafico();
            }
        }
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
    const estado = (e || '').toLowerCase().trim();
    const map = {
        'venta':         { cls: 'vs-badge-venta',      label: 'VENTA' },
        'validado':      { cls: 'vs-badge-validado',    label: 'VALIDADO' },
        'grabado':       { cls: 'vs-badge-grabado',     label: 'EN GRABACION' },
        'aprobado':      { cls: 'vs-badge-programado',  label: 'APROBADO' },
        'programado':    { cls: 'vs-badge-programado',  label: 'PROGRAMADO' },
        'en_ejecucion':  { cls: 'vs-badge-ejecucion',   label: 'EN EJECUCION' },
        'tecnico_casa':  { cls: 'vs-badge-tecnico',     label: 'TECNICO EN CASA' },
        'rechazo_campo': { cls: 'vs-badge-caida',       label: 'RECHAZO EN CAMPO' },
        'no_validado':   { cls: 'vs-badge-observado',   label: 'NO VALIDADO' },
        'instalado':     { cls: 'vs-badge-instalado',   label: 'INSTALADO' },
        'caida':         { cls: 'vs-badge-caida',       label: 'CAIDA' },
        'duplicada':     { cls: 'vs-badge-duplicada',   label: 'DUPLICADA' },
        'rechazado':     { cls: 'vs-badge-caida',       label: 'RECHAZADO' },
        'observado':     { cls: 'vs-badge-observado',   label: 'OBSERVADO' },
    };
    const found = map[estado];
    if (!found) return e ? '<span class="vs-badge vs-badge-venta">' + e.toUpperCase() + '</span>' : '-';
    return '<span class="vs-badge ' + found.cls + '">' + found.label + '</span>';
}

function actualizarTablaVentas(data) {
    const tbody  = document.getElementById("tablaVentasSubidas");
    const contEl = document.getElementById("vsContador");
    if (contEl) contEl.innerText = data.length + ' registros';
    if (!tbody) return;
    if (!data.length) { tbody.innerHTML = '<tr class="vs-empty"><td colspan="28">Sin registros encontrados.</td></tr>'; return; }
    tbody.innerHTML = data.map(function(v, i) {
        return '<tr>' +
            '<td>' + badgeEstado(v.estado) + '</td>' +
            '<td style="font-size:11px;color:#185FA5;font-weight:700;">' + esc((v.created_at||"-").split(" ")[0]) + '</td>' +
            '<td style="font-weight:600;min-width:160px;">' + esc(v.nombre||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.tipo_doc||"DNI") + '</td>' +
            '<td style="font-family:monospace;font-size:11px;">' + esc(v.dni||"-") + '</td>' +
            '<td style="font-family:monospace;color:#185FA5;font-weight:700;">' + esc(v.telefono1||"-") + '</td>' +
            '<td style="font-family:monospace;font-size:11px;">' + esc(v.telefono2||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.departamento||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.provincia||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.distrito||"-") + '</td>' +
            '<td style="font-size:11px;min-width:140px;">' + esc(v.direccion||"-") + '</td>' +
            '<td style="font-size:10px;color:#9ca3af;">' + esc(v.coordenadas||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.fecha_nac||v.fechaNac||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.lugar_nac||v.lugarNac||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.padre||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.madre||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.cuota_inst||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.claro_hogar||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.tecnologia||"-") + '</td>' +
            '<td style="font-size:11px;min-width:180px;">' + esc(v.paquete||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.full_claro||"-") + '</td>' +
            '<td style="text-align:center;">' + esc(v.cant_decos||"0") + '</td>' +
            '<td style="text-align:center;">' + esc(v.cant_mesh||"0") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.plano||"-") + '</td>' +
            '<td style="font-weight:600;color:#7C3AED;font-size:11px;">' + esc(v.asesor_nombre||"-") + '</td>' +
            '<td style="font-size:11px;">' + esc(v.supervisor||"-") + '</td>' +
            '<td style="font-size:11px;color:#6b7280;min-width:140px;">' + esc(v.observacion||"-") + '</td>' +
            '<td><div class="vs-acciones-cell">' +
                '<button class="vs-btn-accion vs-btn-editar" onclick="editarVenta(' + i + ')" title="Editar venta">Editar</button>' +
                '<button class="vs-btn-accion vs-btn-fotos"  onclick="fotosVenta(' + i + ')"  title="Ver fotos">Fotos</button>' +
            '</div></td>' +
        '</tr>';
    }).join('');
}

/* ===== EDITAR VENTA ===== */
function editarVenta(i) {
    const v = ventasSubidas[i];
    if (!v) return;
    poblarDepartamentos();
    const ov = document.getElementById('panelNuevaVenta');
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    const titulo = ov.querySelector('.nv-title');
    if (titulo) titulo.textContent = 'Editar Venta';
    const sub = ov.querySelector('.nv-subtitle');
    if (sub) sub.textContent = 'Modifica los datos y guarda';
    setTimeout(function() {
        var set = function(id, val) { var el=document.getElementById(id); if(el) el.value = val||''; };
        set('nv_nombre',   v.nombre);
        set('nv_tipoDoc',  v.tipo_doc||'DNI');
        set('nv_dni',      v.dni);
        set('nv_tel1',     v.telefono1);
        set('nv_tel2',     v.telefono2);
        set('nv_coord',    v.coordenadas);
        set('nv_dir',      v.direccion);
        set('nv_fechaNac', v.fecha_nac);
        set('nv_lugarNac', v.lugar_nac);
        set('nv_padre',    v.padre);
        set('nv_madre',    v.madre);
        set('nv_cuota',    v.cuota_inst);
        set('nv_hogar',    v.claro_hogar);
        set('nv_tec',      v.tecnologia);
        set('nv_full',     v.full_claro);
        set('nv_plano',    v.plano);
        set('nv_obs',      v.observacion);
        var decos = document.getElementById('nv_decos'); if(decos) decos.value = v.cant_decos||'0';
        var mesh  = document.getElementById('nv_mesh');  if(mesh)  mesh.value  = v.cant_mesh||'0';
        actualizarPaquetes();
        setTimeout(function(){ set('nv_paquete', v.paquete); }, 100);
        ov._editId = v.id;
    }, 50);
}

/* ===== FOTOS ===== */
var _fotosCache = {};

function fotosVenta(i) {
    const v = ventasSubidas[i];
    if (!v) return;
    var m = document.getElementById('modalFotos');
    if (!m) {
        m = document.createElement('div');
        m.id = 'modalFotos';
        m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';
        // Build modal HTML safely
        var div = document.createElement('div');
        div.style.cssText = 'background:#fff;border-radius:20px;width:min(600px,96vw);max-height:88vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 32px 80px rgba(0,0,0,.25);';
        div.innerHTML = [
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #f3f4f6;">',
            '<div>',
              '<div style="font-size:15px;font-weight:700;color:#111827;">Fotos de la venta</div>',
              '<div style="font-size:12px;color:#9ca3af;margin-top:2px;" id="fotosNombre"></div>',
            '</div>',
            '<button id="btnCerrarFotos" style="width:30px;height:30px;border:none;border-radius:8px;background:#f3f4f6;color:#6b7280;font-size:16px;cursor:pointer;">x</button>',
          '</div>',
          '<div style="padding:20px 22px;overflow-y:auto;flex:1;">',
            '<div style="margin-bottom:20px;">',
              '<label style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:8px;">Adjuntar foto</label>',
              '<div id="fotoDropZone" style="border:2px dashed #e5e7eb;border-radius:12px;padding:24px;text-align:center;cursor:pointer;">',
                '<div style="font-size:13px;color:#9ca3af;font-weight:500;">Arrastra fotos aqui o haz clic para seleccionar</div>',
                '<div style="font-size:11px;color:#d1d5db;margin-top:4px;">JPG, PNG, PDF</div>',
              '</div>',
              '<input type="file" id="inputFotos" accept="image/*,.pdf" multiple style="display:none">',
            '</div>',
            '<div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px;">Fotos adjuntas</div>',
            '<div id="galeriaFotos" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;"></div>',
          '</div>'
        ].join('');
        m.appendChild(div);
        // Wire up events
        div.querySelector('#btnCerrarFotos').onclick = function(){ m.style.display='none'; };
        var dz = div.querySelector('#fotoDropZone');
        dz.onclick = function(){ div.querySelector('#inputFotos').click(); };
        dz.ondragover = function(e){ e.preventDefault(); dz.style.borderColor='#111827'; };
        dz.ondragleave = function(){ dz.style.borderColor='#e5e7eb'; };
        dz.ondrop = function(e){ e.preventDefault(); dz.style.borderColor='#e5e7eb'; adjuntarFotos(e.dataTransfer.files); };
        div.querySelector('#inputFotos').onchange = function(){ adjuntarFotos(this.files); };
        document.body.appendChild(m);
        m.addEventListener('click', function(e){ if(e.target===m) m.style.display='none'; });
    }
    m._ventaId = v.id;
    document.getElementById('fotosNombre').textContent = v.nombre || '--';
    m.style.display = 'flex';
    // Cargar fotos desde backend
    cargarFotosBackend(v.id);
}

async function cerrarModalFotos(){ var m=document.getElementById("modalFotos"); if(m) m.style.display="none"; }

async function cargarFotosBackend(ventaId) {
    try {
        const res  = await fetch(API + '/ventas/' + ventaId + '/fotos', { headers: ncHeaders() });
        const data = await res.json();
        if (data.ok) renderGaleria(data.data, ventaId);
        else renderGaleria([], ventaId);
    } catch(e) { renderGaleria([], ventaId); }
}


function adjuntarVenta(i) { fotosVenta(i); }

async function adjuntarFotos(files) {
    var m = document.getElementById('modalFotos');
    var ventaId = m ? m._ventaId : null;
    if (!ventaId || !files.length) return;
    for (const file of Array.from(files)) {
        var formData = new FormData();
        formData.append('foto', file);
        try {
            var hdr = ncHeaders();
            delete hdr['Content-Type'];
            var res = await fetch(API + '/ventas/' + ventaId + '/fotos', {
                method: 'POST',
                headers: { 'Authorization': hdr['Authorization'] },
                body: formData,
            });
            var data = await res.json();
            if (!data.ok) mostrarToastDash('Error subiendo: ' + (data.mensaje||''));
        } catch(e) { mostrarToastDash('Error de conexion al subir foto'); }
    }
    await cargarFotosBackend(ventaId);
    mostrarToastDash('Foto guardada correctamente');
}

function handleFotosDrop(event) {
    var files = event.dataTransfer ? event.dataTransfer.files : event.files;
    if (files && files.length) adjuntarFotos(files);
}

function renderGaleria(fotos, ventaId) {
    var gal = document.getElementById('galeriaFotos');
    if (!gal) return;
    var vid = ventaId || (document.getElementById('modalFotos') ? document.getElementById('modalFotos')._ventaId : 0);
    if (!fotos || !fotos.length) {
        gal.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#d1d5db;font-size:13px;">Sin fotos adjuntas aun.</div>';
        return;
    }
    var baseUrl = window.NC_API + '/';
    gal.innerHTML = fotos.map(function(f) {
        var url    = f.ruta ? baseUrl + f.ruta : (f.url || '');
        var tipo   = f.mimetype || f.tipo || '';
        var nombre = f.nombre || 'archivo';
        var fecha  = (f.created_at || f.fecha || '').split(' ')[0];
        var fId    = f.id || 0;
        var preview = tipo.startsWith('image')
            ? '<img src="' + url + '" onclick="window.open(this.src)" style="width:100%;height:100px;object-fit:cover;display:block;cursor:pointer;">'
            : '<div onclick="window.open(this.dataset.url)" data-url="' + url + '" style="height:100px;display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;">PDF</div>';
        var delBtn = fId ? '<button onclick="eliminarFoto(' + fId + ',' + vid + ')" style="width:100%;padding:4px;border:none;background:#fff5f5;color:#dc2626;font-size:10px;font-weight:700;cursor:pointer;">Eliminar</button>' : '';
        return '<div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#f9fafb;">' +
            preview +
            '<div style="padding:6px 8px;">' +
                '<div style="font-size:10px;font-weight:600;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + nombre + '</div>' +
                '<div style="font-size:9px;color:#9ca3af;">' + fecha + '</div>' +
            '</div>' + delBtn + '</div>';
    }).join('');
}

async function eliminarFoto(fotoId, ventaId) {
    if (!confirm('Eliminar esta foto?')) return;
    try {
        await fetch(API + '/ventas/' + ventaId + '/fotos/' + fotoId, { method: 'DELETE', headers: ncHeaders() });
        cargarFotosBackend(ventaId);
        mostrarToastDash('Foto eliminada');
    } catch(e) { mostrarToastDash('Error eliminando foto'); }
}

/* ===== NUEVA VENTA ===== */
function poblarDepartamentos() {
    const sel = document.getElementById('nv_dpto');
    if (!sel || typeof UBIGEO === 'undefined') return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Seleccionar departamento</option>';
    Object.keys(UBIGEO).forEach(dep => { sel.innerHTML += '<option value="' + dep + '">' + dep + '</option>'; });
    if (val) sel.value = val;
}

function abrirNuevaVenta() {
    poblarDepartamentos();
    const ov = document.getElementById('panelNuevaVenta');
    // Resetear titulo
    const titulo = ov.querySelector('.nv-title');
    if (titulo) titulo.textContent = 'Nueva Venta';
    const sub = ov.querySelector('.nv-subtitle');
    if (sub) sub.textContent = 'Completa todos los datos del cliente';
    // Limpiar _editId
    ov._editId = null;
    // Limpiar TODOS los campos del formulario
    ["nv_nombre","nv_dni","nv_tel1","nv_tel2","nv_dir","nv_coord",
     "nv_lugarNac","nv_padre","nv_madre","nv_plano","nv_obs","nv_fechaNac"].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = "";
        if(el) el.style.borderColor = "";
    });
    ["nv_tipoDoc","nv_cuota","nv_hogar","nv_tec","nv_paquete","nv_full"].forEach(id => {
        const el = document.getElementById(id); if(el) el.selectedIndex = 0;
    });
    ["nv_decos","nv_mesh"].forEach(id => {
        const el = document.getElementById(id); if(el) el.selectedIndex = 0;
    });
    // Reset ubigeo
    const dpto = document.getElementById('nv_dpto');
    const prov = document.getElementById('nv_prov');
    const dist = document.getElementById('nv_dist');
    if(dpto) dpto.selectedIndex = 0;
    if(prov) prov.innerHTML = '<option value="">Seleccionar provincia</option>';
    if(dist) dist.innerHTML = '<option value="">Seleccionar distrito</option>';
    // Reset estado venta
    const est = document.getElementById('nv_estado'); if(est) est.value = 'VENTA';
    actualizarPaquetes();
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
}

function cerrarNuevaVenta() {
    document.getElementById('panelNuevaVenta').classList.remove('open');
    document.body.style.overflow = '';
}

function toggleNuevaVenta() { abrirNuevaVenta(); }

function actualizarLabelDocNV() {
    const tipo = document.getElementById("nv_tipoDoc")?.value || "DNI";
    const labels = { DNI: "Numero DNI *", CE: "Numero Carnet Extranjeria *", RUC: "Numero RUC *" };
    const el = document.getElementById("nv_docLabel");
    if (el) el.textContent = labels[tipo] || "Numero de documento *";
}

const PAQUETES_POR_PLAN = {
  '1 PLAY': ['150 MBPS S/70.00','300 MBPS S/75.00','800 MBPS S/100.00','1500 MBPS S/200.00','PROM ENTRADA 200 X 12 M 400 MBPS X 6M 39.5','PROM GRANDE 1000 MBPS X 6M 59.9','PROM GRANDE 850 X 12M 1000 MBPS X 4M 55','PROM LIM/ARQ 400 X 12 M 1000 MBPS X 2 M 1 SOL','PROM MEDIANA 400 X 12M 1000 MBPS X 6M 55','REG PRO 1000 MBPS','REG PRO 500 MBPS'],
  '2 PLAY INTERNET + TELEFONO': ['150 MBPS S/70.00','1000 MBPS S/150.00','1500 MBPS S/205.00','300 MBPS S/80.00','300 MPBS 84.00','400 MBPS 94.00 S','400 MBPS S/90.00','800 MBPS S/105.00'],
  '2 PLAY INTERNET + CABLE ESTANDAR': ['1000 MBPS S/230.00','150 MBPS S/150.00','1500 MBPS S/285.00','300 MBPS S/160.00','400 MBPS S/170.00','800 MBPS S/185.00'],
  '2 PLAY INTERNET + CABLE SUPERIOR': ['1000 MBPS S/270.00','150 MBPS S/190.00','1500 MBPS S/325.00','300 MBPS S/200.00','400 MBPS S/210.00','800 MBPS S/225.00'],
  '3 PLAY ESTANDAR': ['1000 MBPS S/235.00','150 MBPS S/155.00','1500 MBPS S/290.00','300 MBPS S/165.00','400 MBPS S/175.00','800 MBPS S/190.00'],
  '3 PLAY SUPERIOR': ['1000 MBPS S/275.00','150 MBPS S/195.00','1500 MBPS S/330.00','300 MBPS S/205.00','400 MBPS S/215.00','800 MBPS S/230.00'],
};

function actualizarPaquetes() {
    const hogar = document.getElementById('nv_hogar')?.value || '';
    const sel   = document.getElementById('nv_paquete');
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar</option>';
    (PAQUETES_POR_PLAN[hogar] || []).forEach(p => { const opt = document.createElement('option'); opt.value = p; opt.textContent = p; sel.appendChild(opt); });
}

async function guardarNuevaVenta() {
    const dni    = document.getElementById("nv_dni")?.value.trim();
    const nombre = document.getElementById("nv_nombre")?.value.trim();
    if (!dni)    { const el=document.getElementById("nv_dni");    if(el) el.style.borderColor="#ef4444"; return; }
    if (!nombre) { const el=document.getElementById("nv_nombre"); if(el) el.style.borderColor="#ef4444"; return; }
    const venta = {
        tipoDoc: document.getElementById("nv_tipoDoc")?.value || "DNI", dni, nombre,
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
    const ov = document.getElementById('panelNuevaVenta');
    const editId = ov ? ov._editId : null;
    const btnGuardar = document.getElementById('btnGuardarVenta');
    if (btnGuardar) { btnGuardar.disabled=true; btnGuardar.textContent="Guardando..."; }
    try {
        const url    = editId ? API + '/ventas/' + editId : API + '/ventas';
        const method = editId ? 'PATCH' : 'POST';
        const res  = await fetch(url, { method, headers: ncHeaders(), body: JSON.stringify(venta) });
        const data = await res.json();
        if (!data.ok) {
            mostrarToastDash("Error al guardar: " + (data.mensaje || ""));
            if (btnGuardar) { btnGuardar.disabled=false; btnGuardar.textContent="Guardar venta"; }
            return;
        }
        // Limpiar campos
        ["nv_dni","nv_nombre","nv_tel1","nv_tel2","nv_dpto","nv_prov","nv_dist","nv_dir","nv_coord","nv_lugarNac","nv_padre","nv_madre","nv_plano","nv_obs","nv_fechaNac"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
        ["nv_cuota","nv_hogar","nv_tec","nv_paquete","nv_full"].forEach(id => { const el=document.getElementById(id); if(el) el.selectedIndex=0; }); actualizarPaquetes();
        ["nv_decos","nv_mesh"].forEach(id => { const el=document.getElementById(id); if(el) el.selectedIndex=0; });
        if (btnGuardar) { btnGuardar.disabled=false; btnGuardar.textContent="Guardar venta"; }
        cerrarNuevaVenta();
        await cargarVentasSubidas();
        mostrarToastDash(editId ? "Venta actualizada correctamente" : "Venta guardada correctamente");
    } catch(e) {
        mostrarToastDash("Error conectando al servidor");
        if (btnGuardar) { btnGuardar.disabled=false; btnGuardar.textContent="Guardar venta"; }
    }
}

function mostrarToastDash(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = "position:fixed;bottom:24px;right:24px;background:#111827;color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:aparecer .25s ease;";
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 2700);
}

const META_DIARIA = 5;
let chartDiario=null, chartSemanal=null, chartMensual=null;

function getFiltroDiarioDesde() { return document.getElementById("filtroDiarioDesde")?.value || fechaHoy(); }
function getFiltroDiarioHasta() { return document.getElementById("filtroDiarioHasta")?.value || fechaHoy(); }

function generarRangoFechas(desde, hasta) {
    const fechas = []; const d = new Date(desde+'T00:00:00'); const h = new Date(hasta+'T00:00:00');
    while (d <= h) { fechas.push(fechaISO(d)); d.setDate(d.getDate()+1); }
    return fechas;
}

function getVentasPorRango() {
    const desde=getFiltroDiarioDesde(), hasta=getFiltroDiarioHasta();
    const fechas=generarRangoFechas(desde,hasta);
    const vPF={}, iPF={};
    fechas.forEach(f=>{ vPF[f]=0; iPF[f]=0; });
    ventasSubidas.forEach(v=>{
        const f=(v.created_at||"").split(" ")[0];
        if(vPF[f]!==undefined){ vPF[f]++; if((v.estado||"").toLowerCase()==="instalado") iPF[f]++; }
    });
    const labels=fechas.map(f=>{ const p=f.split('-'); return p[2]+'/'+p[1]; });
    return { labels, ventas:fechas.map(f=>vPF[f]), instaladas:fechas.map(f=>iPF[f]) };
}

function getKPIsRango() {
    const desde=getFiltroDiarioDesde(), hasta=getFiltroDiarioHasta();
    let v=0, inst=0;
    ventasSubidas.forEach(vv=>{
        const f=(vv.created_at||"").split(" ")[0];
        if(f>=desde&&f<=hasta){ v++; if((vv.estado||"").toLowerCase()==="instalado") inst++; }
    });
    return { ventas:v, instaladas:inst };
}

function actualizarKPIsRango() {
    const kpis=getKPIsRango();
    const vc=document.getElementById("ventasCount"), ic=document.getElementById("instaladasCount");
    const ef=document.getElementById("efectividad"), ni=document.getElementById("noInstaladasCount");
    if(vc) vc.innerText=kpis.ventas;
    if(ic) ic.innerText=kpis.instaladas;
    if(ef) ef.innerText=(kpis.ventas?Math.round(kpis.instaladas/kpis.ventas*100):0)+"%";
    if(ni) ni.innerText=Math.max(0,kpis.ventas-kpis.instaladas);
    const pct=Math.min(Math.round(kpis.ventas/META_DIARIA*100),100);
    const mt=document.getElementById("metaTexto"),mb=document.getElementById("metaBarra"),mp=document.getElementById("metaPct");
    if(mt) mt.innerText=kpis.ventas+" / "+META_DIARIA+" ventas";
    if(mb) mb.style.width=pct+"%";
    if(mp) mp.innerText=pct+"%";
}

function aplicarFiltroGrafico() {
    const datos=getVentasPorRango();
    if(chartDiario){ chartDiario.data.labels=datos.labels; chartDiario.data.datasets[0].data=datos.ventas; chartDiario.data.datasets[1].data=datos.instaladas; chartDiario.update(); }
    actualizarKPIsRango();
}

function getDatosSemanal() {
    const hoy=new Date(),mes=hoy.getMonth(),anio=hoy.getFullYear();
    const semanas=[0,0,0,0],semanasInst=[0,0,0,0];
    ventasSubidas.forEach(v=>{
        const f=new Date((v.created_at||"").split(" ")[0]+"T00:00:00");
        if(f.getMonth()===mes&&f.getFullYear()===anio){ const sem=Math.min(Math.floor((f.getDate()-1)/7),3); semanas[sem]++; if((v.estado||"").toLowerCase()==="instalado") semanasInst[sem]++; }
    });
    return { labels:["Sem 1","Sem 2","Sem 3","Sem 4"], ventas:semanas, instaladas:semanasInst };
}

function getDatosMensual() {
    const anio=new Date().getFullYear();
    const meses=Array(12).fill(0),mesesInst=Array(12).fill(0);
    ventasSubidas.forEach(v=>{
        const f=new Date((v.created_at||"").split(" ")[0]+"T00:00:00");
        if(f.getFullYear()===anio){ meses[f.getMonth()]++; if((v.estado||"").toLowerCase()==="instalado") mesesInst[f.getMonth()]++; }
    });
    return { labels:["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"], ventas:meses, instaladas:mesesInst };
}

function iniciarGraficos() {
    const desde=document.getElementById("filtroDiarioDesde"), hasta=document.getElementById("filtroDiarioHasta");
    if(desde&&!desde.value) desde.value=fechaHoy();
    if(hasta&&!hasta.value) hasta.value=fechaHoy();
    const datos=getVentasPorRango();
    const ctxD=document.getElementById("chartDiario"); if(!ctxD) return;
    if(chartDiario) chartDiario.destroy();
    chartDiario=new Chart(ctxD,{type:"bar",data:{labels:datos.labels,datasets:[{label:"Ventas",data:datos.ventas,backgroundColor:"rgba(34,197,94,0.8)",borderRadius:6},{label:"Instaladas",data:datos.instaladas,backgroundColor:"rgba(139,92,246,0.8)",borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",labels:{font:{size:11},boxWidth:12}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:"#f3f4f6"}},x:{grid:{display:false}}}}});
    const semanal=getDatosSemanal();
    const ctxS=document.getElementById("chartSemanal");
    if(chartSemanal) chartSemanal.destroy();
    chartSemanal=new Chart(ctxS,{type:"bar",data:{labels:semanal.labels,datasets:[{label:"Ventas",data:semanal.ventas,backgroundColor:"rgba(34,197,94,0.75)",borderRadius:6},{label:"Instaladas",data:semanal.instaladas,backgroundColor:"rgba(139,92,246,0.75)",borderRadius:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",labels:{font:{size:11},boxWidth:12}}},scales:{y:{beginAtZero:true,grid:{color:"#f3f4f6"}},x:{grid:{display:false}}}}});
    const mensual=getDatosMensual();
    const ctxM=document.getElementById("chartMensual");
    if(chartMensual) chartMensual.destroy();
    chartMensual=new Chart(ctxM,{type:"line",data:{labels:mensual.labels,datasets:[{label:"Ventas",data:mensual.ventas,borderColor:"#22c55e",backgroundColor:"rgba(34,197,94,0.08)",tension:0.4,fill:true,pointRadius:4},{label:"Instaladas",data:mensual.instaladas,borderColor:"#8b5cf6",backgroundColor:"rgba(139,92,246,0.08)",tension:0.4,fill:true,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",labels:{font:{size:11},boxWidth:12}}},scales:{y:{beginAtZero:true,grid:{color:"#f3f4f6"}},x:{grid:{display:false}}}}});
    actualizarKPIsRango();
    sincronizarKpisRendimiento();
}

function actualizarMeta() {
    const pct=Math.min(Math.round((ventas/META_DIARIA)*100),100);
    const mt=document.getElementById("metaTexto"),mb=document.getElementById("metaBarra"),mp=document.getElementById("metaPct");
    if(mt) mt.innerText=ventas+" / "+META_DIARIA+" ventas";
    if(mb) mb.style.width=pct+"%";
    if(mp) mp.innerText=pct+"%";
}

window.onload = () => {
    render();
    cargarSaludo();
    cargarFrasesSuper();
    // Cargar ventas y luego sincronizar KPIs al inicio
    cargarVentasSubidas().then(() => sincronizarKpisRendimiento());
    cargarLeadsAsesor();
    restaurarApartadoDashboard();
    setInterval(cargarFrasesSuper, 30000);
    setInterval(cargarLeadsAsesor, 15000);
    // Sincronizar KPIs cada 30s en tiempo real
    setInterval(async () => {
        await cargarVentasSubidas();
        await sincronizarKpisRendimiento();
    }, 30000);
};

async function cargarLeadsAsesor() {
    try {
        const res  = await fetch(API + '/leads', { headers: ncHeaders() });
        const data = await res.json();
        if (!data.ok) return;

        const hoy = fechaHoy();
        const soloHoy = data.data.filter(l => l.fecha === hoy);

        // Preservar estado local al recargar
        const estadoActual = {};
        clientes.forEach(c => { estadoActual[c.id] = { estado: c.estado, obs: c.obs }; });

        // Siempre actualizar clientes desde backend (incluso si es array vacio)
        clientes = soloHoy.map(l => {
            const prev = estadoActual[l.id] || {};
            return {
                id: l.id,
                telefono: l.n1,
                n2: l.n2 || '',
                zona: l.distrito || l.campana || '--',
                campana: l.campana || '--',
                horaAsig: l.hora_asig || '',
                // Estado: backend primero, luego local
                estado: l.tipif_vend && l.tipif_vend !== ''
                    ? l.tipif_vend
                    : (prev.estado || 'NUEVO'),
                // Obs: backend primero, luego local
                obs: l.obs_asesor && l.obs_asesor !== ''
                    ? l.obs_asesor
                    : (prev.obs || ''),
            };
        });
        render();
    } catch(e) { console.error('Error cargando leads:', e); }
}
