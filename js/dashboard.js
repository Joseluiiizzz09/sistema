// =====================
// DATOS
let clientes = [
    { telefono: "987654321", zona: "SMP", estado: "NUEVO", obs: "" },
    { telefono: "912345678", zona: "LIMA", estado: "NUEVO", obs: "" }
];

let seleccionado = null;
let llamadas = 0;
let ventas = 0;
let instaladas = 0;

// =====================
// CAMBIO DE PANTALLA
function mostrar(pantalla, btn) {
    document.querySelectorAll(".pantalla").forEach(p => p.classList.add("hidden"));
    document.getElementById(pantalla).classList.remove("hidden");
    document.querySelectorAll(".tabs .tab").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
    if (pantalla === "rendimiento") setTimeout(iniciarGraficos, 50);
}

// =====================
// RENDER TABLA
function render() {
    let tabla = document.getElementById("tabla");
    tabla.innerHTML = "";
    clientes.forEach((c, i) => {
        tabla.innerHTML += `
        <tr>
            <td>${c.telefono}</td>
            <td>${c.zona}</td>
            <td><span class="badge-estado ${colorEstado(c.estado)}">${c.estado}</span></td>
            <td><input class="input-obs" placeholder="Escribir..." value="${c.obs || ''}" onchange="guardarObs(${i}, this.value)"></td>
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

// =====================
// GUARDAR OBSERVACION
function guardarObs(i, valor) {
    clientes[i].obs = valor;
}

// =====================
// MODALES
function abrirModal(i) {
    seleccionado = i;
    document.getElementById("modalTipos").classList.add("show");
    document.getElementById("modalTipos").classList.remove("hidden");
}

function cerrarModal() {
    document.getElementById("modalTipos").classList.remove("show");
    document.getElementById("modalVenta").classList.remove("show");
}

// =====================
// TIPIFICAR
function tipificar(tipo) {
    llamadas++;
    if (tipo === "VENTA CERRADA") {
        ventas++;
        cerrarModal();
        document.getElementById("modalVenta").classList.add("show");
        actualizarStats();
        return;
    }
    clientes[seleccionado].estado = tipo;
    cerrarModal();
    render();
}

// =====================
// GUARDAR VENTA
function guardarVenta() {
    clientes[seleccionado].estado = "VENTA CERRADA";
    instaladas++;
    const campos = [
        "mv_nombre","mv_dni","mv_email","mv_departamento","mv_provincia",
        "mv_distrito","mv_canal","mv_puntoVenta","mv_tipoVenta","mv_tipoDomicilio",
        "mv_telefono1","mv_telefono2","mv_fechaNac","mv_lugarNac","mv_padre",
        "mv_madre","mv_direccion","mv_coordenadas","mv_relacionPredio",
        "mv_cuotaInstalacion","mv_claroHogar","mv_tecnologia","mv_paquete",
        "mv_fullClaro","mv_decos","mv_mesh","mv_cuotaMesh","mv_plano",
        "mv_estadoVenta","mv_observacion"
    ];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    cerrarModal();
    seleccionado = null;
    render();
}

// =====================
// STATS
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
    if (chartDiario) {
        chartDiario.data.datasets[0].data = getVentasDiarias();
        chartDiario.data.datasets[0].backgroundColor = getVentasDiarias().map((v, i) =>
            i === 6 ? "rgba(255,45,45,0.85)" : "rgba(99,102,241,0.65)"
        );
        chartDiario.update();
        actualizarMeta();
    }
}

// =====================
// FRASES
const FRASES = [
    "No vendas precio, vende valor",
    "Cada llamada cuenta, cada cliente importa",
    "Escucha al cliente antes de hablar",
    "La confianza se gana con cada conversación",
    "Un NO hoy puede ser un SÍ mañana — no te rindas",
    "Tu actitud determina tus resultados",
    "La persistencia vence a la resistencia",
    "El éxito es la suma de pequeños esfuerzos repetidos"
];

function cargarFrase() {
    const r = Math.floor(Math.random() * FRASES.length);
    const fraseEl = document.getElementById("frase");
    if (fraseEl) fraseEl.innerText = FRASES[r];
    const grid = document.getElementById("frasesGrid");
    if (!grid) return;
    grid.innerHTML = FRASES.map((f, i) => `
        <div class="frase-card">
            <div class="frase-card-num">#${i + 1}</div>
            <div class="frase-card-texto">${f}</div>
        </div>
    `).join('');
}

// =====================
// COLORES ESTADO
function colorEstado(e) {
    const map = {
        "VENTA CERRADA":        "estado-venta-cerrada",
        "CORTA LLAMADA":        "estado-corta-llamada",
        "PREVENTA":             "estado-preventa",
        "NO CONTESTA":          "estado-no-contesta",
        "EN EJECUCION":         "estado-en-ejecucion",
        "SIN COBERTURA":        "estado-sin-cobertura",
        "DESEA MOVIL":          "estado-desea-movil",
        "SERVICIO ACTIVO":      "estado-servicio-activo",
        "AGENDADO":             "estado-agendado",
        "NO CALIFICA":          "estado-no-califica",
        "EDIFICIO NO LIBERADO": "estado-sh-edificio-no-liberado",
        "CONTACTO CON TERCEROS":"estado-contacto-con-terceros",
        "NO DESEA":             "estado-no-desea",
        "BUZON DE VOZ":         "estado-buzon-voz",
        "NUEVO":                "estado-nuevo",
    };
    return map[e] || "estado-nuevo";
}

// =====================
// SALUDO
function cargarSaludo() {
    let usuario = localStorage.getItem("usuario") || "ASESOR";
    let genero  = localStorage.getItem("genero")  || "M";
    let hora    = new Date().getHours();
    let saludoHora = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
    let saludoGenero = genero === "F" ? "Bienvenida" : "Bienvenido";
    const el = document.getElementById("saludoUsuario");
    if (el) el.innerText = `${saludoHora}, ${saludoGenero} ${usuario} 👋`;
}

// =====================
// VENTAS SUBIDAS
let ventasSubidas = [];

function buscarVentas() {
    actualizarTablaVentas(ventasSubidas);
}

function borrarFiltros() {
    const dni   = document.getElementById("filtroDni");
    const desde = document.getElementById("fechaDesde");
    const hasta = document.getElementById("fechaHasta");
    if (dni)   dni.value   = "";
    if (desde) desde.value = "";
    if (hasta) hasta.value = "";
}

function refrescarVentas() { buscarVentas(); }

function badgeEstado(e) {
    const map = {
        "PROGRAMADO": "vs-badge-programado",
        "VENTA":      "vs-badge-venta",
        "VALIDADO":   "vs-badge-validado",
        "DUPLICADA":  "vs-badge-duplicada",
    };
    const cls = map[e] || "vs-badge-venta";
    return e ? `<span class="vs-badge ${cls}">${e}</span>` : '-';
}

function actualizarTablaVentas(data) {
    const tbody  = document.getElementById("tablaVentasSubidas");
    const contEl = document.getElementById("vsContador");
    if (contEl) contEl.innerText = `Registros del 1 al ${data.length} de ${data.length} registros`;
    if (!tbody) return;
    if (!data.length) {
        tbody.innerHTML = `<tr class="vs-empty"><td colspan="33">Sin registros encontrados.</td></tr>`;
        return;
    }
    tbody.innerHTML = data.map((v, i) => `
        <tr>
            <td>${badgeEstado(v.estadoVenta)}</td>
            <td>${v.obsBackOffice || '-'}</td>
            <td>${v.agendado || '-'}</td>
            <td>${v.tipoVenta || '-'}</td>
            <td>${v.fechaIngreso || '-'}</td>
            <td>${v.nombre || '-'}</td>
            <td>${v.tipoDocumento || 'DNI'}</td>
            <td>${v.dni || '-'}</td>
            <td>${v.representanteLegal || '-'}</td>
            <td>${v.telefonoContacto || '-'}</td>
            <td>${v.telefonoReferencia || '-'}</td>
            <td>${v.departamento || '-'}</td>
            <td>${v.provincia || '-'}</td>
            <td>${v.distrito || '-'}</td>
            <td>${v.direccion || '-'}</td>
            <td>${v.coordenadas || '-'}</td>
            <td>${v.vendedor || '-'}</td>
            <td>${v.supervisor || '-'}</td>
            <td>${v.canal || '-'}</td>
            <td>${v.tipoDomicilio || '-'}</td>
            <td>${v.email || '-'}</td>
            <td>${v.relacionPredio || '-'}</td>
            <td>${v.cuotasPagoInstalacion || '-'}</td>
            <td>${v.claroHogar || '-'}</td>
            <td>${v.tecnologia || '-'}</td>
            <td>${v.paquete || '-'}</td>
            <td>${v.fullClaro || '-'}</td>
            <td>${v.cantidadDecos || '0'}</td>
            <td>${v.cantidadMesh || '0'}</td>
            <td>${v.cuotaPagoMesh || '-'}</td>
            <td>${v.plano || '-'}</td>
            <td>${v.observacion || '-'}</td>
            <td>
                <div class="vs-acciones-cell">
                    <button class="vs-btn-editar"   onclick="editarVenta(${i})">Editar</button>
                    <button class="vs-btn-fotos"    onclick="fotosVenta(${i})">Fotos 📷</button>
                    <button class="vs-btn-adjuntar" onclick="adjuntarVenta(${i})">Adjuntar 📎</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editarVenta(i)   { alert("Editar — conectar backend"); }
function fotosVenta(i)    { alert("Fotos — conectar backend"); }
function adjuntarVenta(i) { alert("Adjuntar — conectar backend"); }

// =====================
// GRAFICOS RENDIMIENTO
const META_DIARIA = 5;
let chartDiario  = null;
let chartSemanal = null;
let chartMensual = null;

let datosBackend = {
    semanal: { labels:["Sem 1","Sem 2","Sem 3","Sem 4"], ventas:[0,0,0,0], instaladas:[0,0,0,0] },
    mensual: {
        labels:["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
        ventas:[0,0,0,0,0,0,0,0,0,0,0,0],
        instaladas:[0,0,0,0,0,0,0,0,0,0,0,0],
        ejecutadas:[0,0,0,0,0,0,0,0,0,0,0,0],
        noInstaladas:[0,0,0,0,0,0,0,0,0,0,0,0]
    }
};

function getDiasLabels() {
    const dias = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    const hoy  = new Date().getDay();
    return Array.from({length:7}, (_, i) => {
        const idx = (hoy - (6-i) + 7) % 7;
        return i === 6 ? "Hoy" : dias[idx];
    });
}

function getVentasDiarias() {
    return [0,0,0,0,0,0,ventas];
}

function iniciarGraficos() {
    const ctxD = document.getElementById("chartDiario");
    if (!ctxD) return;
    const vd = getVentasDiarias();
    if (chartDiario) chartDiario.destroy();
    chartDiario = new Chart(ctxD, {
        type: "bar",
        data: {
            labels: getDiasLabels(),
            datasets: [{ label:"Ventas", data: vd, backgroundColor: vd.map((_,i) => i===6?"rgba(255,45,45,0.85)":"rgba(99,102,241,0.65)"), borderRadius:6 }]
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{stepSize:1}}} }
    });

    const ctxS = document.getElementById("chartSemanal");
    if (chartSemanal) chartSemanal.destroy();
    chartSemanal = new Chart(ctxS, {
        type:"bar",
        data:{ labels:datosBackend.semanal.labels, datasets:[
            {label:"Ventas",    data:datosBackend.semanal.ventas,    backgroundColor:"rgba(34,197,94,0.75)",  borderRadius:6},
            {label:"Instaladas",data:datosBackend.semanal.instaladas,backgroundColor:"rgba(139,92,246,0.75)",borderRadius:6}
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",labels:{font:{size:11}}}},scales:{y:{beginAtZero:true}}}
    });

    const ctxM = document.getElementById("chartMensual");
    if (chartMensual) chartMensual.destroy();
    chartMensual = new Chart(ctxM, {
        type:"line",
        data:{ labels:datosBackend.mensual.labels, datasets:[
            {label:"Ventas",       data:datosBackend.mensual.ventas,      borderColor:"#22c55e", backgroundColor:"rgba(34,197,94,0.08)",  tension:0.4,fill:true, pointRadius:4},
            {label:"Instaladas",   data:datosBackend.mensual.instaladas,  borderColor:"#8b5cf6", backgroundColor:"rgba(139,92,246,0.08)", tension:0.4,fill:true, pointRadius:4},
            {label:"Ejecutadas",   data:datosBackend.mensual.ejecutadas,  borderColor:"#3b82f6", backgroundColor:"rgba(59,130,246,0.08)", tension:0.4,fill:false,pointRadius:4,borderDash:[5,3]},
            {label:"No instaladas",data:datosBackend.mensual.noInstaladas,borderColor:"#ef4444", backgroundColor:"rgba(239,68,68,0.08)",  tension:0.4,fill:false,pointRadius:4,borderDash:[5,3]}
        ]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"top",labels:{font:{size:11}}}},scales:{y:{beginAtZero:true}}}
    });
    actualizarMeta();
}

function actualizarMeta() {
    const pct = Math.min(Math.round((ventas / META_DIARIA) * 100), 100);
    const mt  = document.getElementById("metaTexto");
    const mb  = document.getElementById("metaBarra");
    const mp  = document.getElementById("metaPct");
    if (mt) mt.innerText = `${ventas} / ${META_DIARIA} ventas`;
    if (mb) mb.style.width = pct + "%";
    if (mp) mp.innerText  = pct + "%";
    const ni = document.getElementById("noInstaladasCount");
    if (ni) ni.innerText = Math.max(0, ventas - instaladas);
}

// =====================
// INIT
window.onload = () => {
    render();
    cargarFrase();
    cargarSaludo();
};