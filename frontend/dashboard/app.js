// =====================================================
// DOM READY
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {

    // =====================================================
    // VARIABLES
    // =====================================================

    let charts = {};
    let calendario = null;

    const direccionSelect = document.getElementById("direccionSelect");
    const clasificacionFiltro = document.getElementById("clasificacionFiltro");
    const proyectoSelect = document.getElementById("proyectoSelect");
    const btnLogin = document.getElementById("btnLogin");
    const btnSubirExcel = document.getElementById("btnSubirExcel");
    const excelFileInput = document.getElementById("excelFile");
    const fechaInput = document.getElementById("fechaCorte");

    const token = sessionStorage.getItem("token");
    const rol = sessionStorage.getItem("rol");


    // =====================================================
    // EVENTOS FILTROS
    // =====================================================

    direccionSelect?.addEventListener("change", async () => {

        const direccionId = direccionSelect.value;

        await cargarDashboardDireccion(direccionId);

    });

    // =====================================================
    // CAMBIO DE PROYECTO
    // =====================================================

    proyectoSelect?.addEventListener("change", async () => {

        const proyectoId = proyectoSelect.value;
        const fechaActual = fechaInput.value;
        const direccionActual = direccionSelect.value;

        if (!proyectoId) return;

        // actualizar detalle
        if (fechaActual) {
            await cargarDetalleProyecto(proyectoId, fechaActual);
        }

    });
    
        // =====================================================
    // FILTRO CLASIFICACION
    // =====================================================

    clasificacionFiltro?.addEventListener("change", async () => {

        const direccionActual = direccionSelect.value;

        if (direccionActual) {
            await cargarDashboardDireccion(direccionActual);
        }

    });

    // =====================================================
    // ORDEN FIJO DE ESTADOS
    // =====================================================

    const ORDEN_ESTADOS = [
        "Sin iniciar",
        "En ejecución",
        "Paralizado",
        "Concluido"
    ];

    // =====================================================
    // COLORES POR ESTADO
    // =====================================================

    function obtenerColorPorEstado(estado) {

    const e = estado?.toLowerCase() || "";

    if (e.includes("ejec")) return "#bbf7d0";      // verde pastel
    if (e.includes("paral")) return "#fecaca";     // rojo pastel
    if (e.includes("conclu")) return "#bfdbfe";    // azul pastel
    if (e.includes("sin")) return "#e5e7eb";       // gris pastel

    return "#e9d5ff"; // lila pastel por defecto
}

    // =====================================================
    // LOGIN
    // =====================================================

    btnLogin?.addEventListener("click", () => {
        window.location.href = "/login.html";
    });

    if (token && rol === "admin") {
        btnSubirExcel?.classList.remove("hidden");
    }

    // =====================================================
    // SUBIR ARCHIVO
    // =====================================================

    btnSubirExcel?.addEventListener("click", () => {
        excelFileInput.click();
    });

    excelFileInput?.addEventListener("change", async () => {

        const file = excelFileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/admin/upload-excel", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + token
                },
                body: formData
            });

            if (!response.ok) throw new Error();

            alert("Archivo cargado correctamente");
            location.reload();

        } catch {
            alert("Error al subir archivo");
        }
    });

    // =====================================================
    // DASHBOARD GLOBAL
    // =====================================================

    async function cargarDashboardGlobal() {

        try {

            const fecha = fechaInput.value || "";
            const res = await fetch(`/api/dashboard/global?fecha=${fecha}`);
            const data = await res.json();

            // ================= KPI =================

            document.getElementById("totalGlobal").textContent = data.kpis.total || 0;
            document.getElementById("ejecucionGlobal").textContent = data.kpis.en_ejecucion || 0;
            document.getElementById("paralizadoGlobal").textContent = data.kpis.paralizado || 0;
            document.getElementById("sinIniciarGlobal").textContent = data.kpis.sin_iniciar || 0;
            document.getElementById("concluidoGlobal").textContent = data.kpis.concluido || 0;

            // ================= ESTADOS GLOBAL =================

            const mapaEstados = {};
            data.estados.forEach(e => {
                mapaEstados[e.estado] = e.cantidad;
            });

            const cantidadesEstados = ORDEN_ESTADOS.map(
                estado => mapaEstados[estado] || 0
            );

            crearBarChartGlobal(
                "graficoEstadosGlobal",
                ORDEN_ESTADOS,
                cantidadesEstados
            );

            // ================= DONUT GLOBAL =================

            const labelsDependencias = data.dependencias.map(d => d.entidad);
            const valoresDependencias = data.dependencias.map(d => d.cantidad);

            crearDoughnutChart(
                "graficoDependenciasGlobal",
                labelsDependencias,
                valoresDependencias
            );

            actualizarLeyendaDependencias(
                labelsDependencias,
                valoresDependencias,
                charts["graficoDependenciasGlobal"].data.datasets[0].backgroundColor
            );

            // ================= DIRECCIONES GLOBAL =================

            const direccionesOrdenadas = [...data.direcciones_total]
                .sort((a, b) => {
                    if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
                    return a.direccion.localeCompare(b.direccion);
                });

            crearHorizontalBarChart(
                "graficoDireccionesGlobal",
                direccionesOrdenadas.map(d => d.direccion),
                direccionesOrdenadas.map(d => d.cantidad)
            );

            // guardar dirección actual seleccionada
            const direccionActual = direccionSelect.value;

            // rellenar selector
            direccionSelect.innerHTML = data.direcciones_filtradas
                .map(d => `<option value="${d.id}">${d.direccion}</option>`)
                .join("");

            // restaurar selección si ya existía
            if (direccionActual) {
                direccionSelect.value = direccionActual;
            } else if (direccionesOrdenadas.length) {
                direccionSelect.value = direccionesOrdenadas[0].id;
            }

            // cargar dashboard de la dirección seleccionada
            if (direccionSelect.value) {
                await cargarDashboardDireccion(direccionSelect.value);
            }

            } catch (error) {
                console.error("Error dashboard global", error);
            }
}

    // =====================================================
    // DASHBOARD POR DIRECCIÓN (INDEPENDIENTE)
    // =====================================================

    async function cargarDashboardDireccion(direccionId) {

    try {

        const fecha = fechaInput.value || "";
        const res = await fetch(`/api/dashboard/direccion/${direccionId}?fecha=${fecha}`);
        const data = await res.json();

        const mapaEstados = {};
        data.estados.forEach(e => {
            mapaEstados[e.estado] = e.cantidad;
        });

        const cantidadesEstados = ORDEN_ESTADOS.map(
            estado => mapaEstados[estado] || 0
        );

        crearBarChartFiltro(
            "graficoEstadosFiltro",
            ORDEN_ESTADOS,
            cantidadesEstados
        );

        // ================= DEPENDENCIAS INTERNAS =================

        const canvas = document.getElementById("graficoDependenciasFiltro");
        const mensaje = document.getElementById("mensajeDependencias");

        if (data.dependencias && data.dependencias.length > 0) {

            canvas.style.display = "block";

            if (mensaje) {
                mensaje.classList.add("hidden");
            }

            crearPieDependenciasInternas(
                "graficoDependenciasFiltro",
                data.dependencias.map(d => d.direccion_dependencia),
                data.dependencias.map(d => d.cantidad)
            );

        } else {

            destruirChart("graficoDependenciasFiltro");
            canvas.style.display = "none";

            if (mensaje) {
                mensaje.classList.remove("hidden");
            }

        }

        // ================= CLASIFICACIÓN =================

        if (data.clasificacion && data.clasificacion.length > 0) {

            crearBarChartFiltro(
                "graficoDireccionesFiltro",
                data.clasificacion.map(c => c.clasificacion),
                data.clasificacion.map(c => c.cantidad)
            );

        } else {

            destruirChart("graficoDireccionesFiltro");

        }

        // 🔥 IMPORTANTE
        await cargarProyectosPorDireccion(direccionId);

    } catch (error) {

        console.error("Error dashboard dirección", error);

    }

}

    // =====================================================
    // PROYECTOS
    // =====================================================

    async function cargarProyectosPorDireccion(direccionId) {

        try {

            const fecha = fechaInput.value || "";
            const clasificacion = clasificacionFiltro.value;

            let url = `/api/proyectos?direccion_id=${direccionId}&fecha=${fecha}`;

            if (clasificacion && clasificacion !== "todas") {
                url += `&clasificacion_id=${clasificacion}`;
            }

            const res = await fetch(url);

            if (!res.ok) {
                console.error("Error cargando proyectos");
                return;
            }

            const proyectos = await res.json();

            // llenar selector
            proyectoSelect.innerHTML = proyectos
                .map(p => `<option value="${p.id}">${p.nombre}</option>`)
                .join("");

            // 🔴 si no hay proyectos, solo asegurar calendario
            if (!proyectos.length) {

                if (!calendario) {
                    calendario = flatpickr("#fechaCorte", {
                        locale: flatpickr.l10ns.es,
                        dateFormat: "Y-m-d"
                    });
                }

                return;
            }

            // seleccionar primer proyecto
            const primerProyecto = proyectos[0].id;
            proyectoSelect.value = primerProyecto;
          
            // cargar detalle del proyecto
            const fechaActual = fechaInput.value;

            if (fechaActual) {
                await cargarDetalleProyecto(primerProyecto, fechaActual);
            }

        } catch (error) {

            console.error("Error proyectos:", error);

        }
    }

    // =====================================================
    // ACTUALIZAR TODO CUANDO CAMBIA FECHA
    // =====================================================

    fechaInput?.addEventListener("change", () => {

        cargarDashboardGlobal();

    });

// =====================================================
// CALENDARIO CON SOLO FECHAS ACTIVAS
// =====================================================

async function cargarFechasDisponibles() {

    const res = await fetch(`/api/fechas`);
    const fechas = await res.json();

    if (calendario) calendario.destroy();

    if (!fechas || !fechas.length) {

        calendario = flatpickr("#fechaCorte", {
            locale: flatpickr.l10ns.es,
            dateFormat: "Y-m-d"
        });

        return;
    }

    const fechasDate = fechas.map(f => {
        const [y,m,d] = f.split("-");
        return new Date(y, m-1, d);
    });

    const fechasSet = new Set(fechas);
    const fechaInicial = fechas[fechas.length - 1];

    fechaInput.value = fechaInicial;

    calendario = flatpickr("#fechaCorte", {

        locale: flatpickr.l10ns.es,
        dateFormat: "Y-m-d",

        enable: fechasDate,
        defaultDate: fechaInicial,

        onChange: function(_, dateStr){

            if(!dateStr) return;

            fechaInput.value = dateStr;

            cargarDashboardGlobal();

            const direccionActual = direccionSelect.value;

            if(direccionActual){
                cargarDashboardDireccion(direccionActual);
            }

            const proyectoActual = proyectoSelect.value;

            if(proyectoActual){
                cargarDetalleProyecto(proyectoActual, dateStr);
            }

        },

        onDayCreate: function(_,__,___,dayElem){

            const fecha = flatpickr.formatDate(dayElem.dateObj,"Y-m-d");

            if(fechasSet.has(fecha)){
                dayElem.style.color="#b91c1c";
                dayElem.style.fontWeight="700";
                dayElem.style.textDecoration="underline";
            }

        }

    });

    // cargar detalle inicial automáticamente
   const proyectoActual = proyectoSelect.value;

    if (proyectoActual) {
        await cargarDetalleProyecto(proyectoActual, fechaInicial);
    }

}

    // =====================================================
    // DETALLE PROYECTO POR FECHA
    // =====================================================

    async function cargarDetalleProyecto(proyectoId, fecha) {

    if (!proyectoId || !fecha) return;

    const res = await fetch(
        `/public/reportes/${proyectoId}/historico?fecha=${fecha}`
    );

    if (!res.ok) {
        console.error("No hay datos para esa fecha");
        return;
    }

    const data = await res.json();

    console.log("MESES:", data.meses);
    console.log("FISICO:", data.fisico);
    console.log("PROGRAMADO:", data.programado);

    // ================= FICHA IDENTIFICACIÓN =================

    document.getElementById("fichaCui").textContent = data.cui || "-";
    document.getElementById("fichaDsp").textContent = data.codigo_dsp || "-";
    document.getElementById("fichaUbicacion").textContent = data.ubicacion || "-";
    document.getElementById("fichaTipologia").textContent = data.tipologia || "-";
    document.getElementById("fichaEntidadEjecutora").textContent = data.entidad_ejecutora || "-";
    document.getElementById("fichaEntidadFormuladora").textContent = data.entidad_formuladora || "-";

    // ================= CONTROL DE PLAZOS =================

    document.getElementById("plazoInicioProgramado").textContent = data.inicio_programado || "-";
    document.getElementById("plazoInicioEjecutado").textContent = data.inicio_ejecutado || "-";
    document.getElementById("plazoFinProgramado").textContent = data.fin_programado || "-";
    document.getElementById("plazoArc").textContent = data.arc_actual || "-";

    // ================= CONTACTO =================

    document.getElementById("contactoCoordinador").textContent = data.coordinador || "-";
    document.getElementById("contactoCorreo").textContent = data.correo || "-";
    document.getElementById("contactoCelular").textContent = data.celular || "-";

    // ================= CLASIFICACIÓN =================

    document.getElementById("fichaInvierte").textContent = data.es_invierte ? "Sí" : "No";
    document.getElementById("fichaPresupuesto").textContent = data.tiene_presupuesto ? "Sí" : "No";

    // ================= TOMA DE DECISIONES =================

    document.getElementById("tomaDecisiones").textContent =
        data.toma_decisiones || "Sin decisiones registradas.";

    // ================= AVANCE LINEAL =================

    crearLineaChart(
        "graficoAvanceGlobal",
        data.meses,
        [
            {
                label: "Físico Ejecutado",
                data: data.fisico,
                color: "#15803d"
            },
            {
                label: "Físico Programado",
                data: data.programado,
                color: "#dc2626"
            }
        ]
    );

    crearLineaChart(
        "graficoAvancePresupuesto",
        data.meses,
        [
            {
                label: "Presupuesto Ejecutado",
                data: data.financiero,
                color: "#1d4ed8"
            },
            {
                label: "Presupuesto Programado",
                data: data.financiero_programado,
                color: "#f59e0b"
            }
        ]
    );

    // ================= ARC =================

    if (data.arcs?.length) {

        crearGanttArc(data.arcs);

    }
}

    // =====================================================
    // UTILIDADES CHART
    // =====================================================

    function destruirChart(id) {
    if (charts[id]) charts[id].destroy();
}

    // =====================================================
    // GANTT ARC (DHTMLX)
    // =====================================================

    function crearGanttArc(arcs){

        gantt.clearAll();

        gantt.config.date_format = "%Y-%m-%d";

        // columnas
        gantt.config.columns = [
            {name:"codigo", label:"ARC", width:70, align:"center"},
            {name:"descripcion", label:"Descripción", width:220},
            {name:"inicio_prog", label:"Inicio Prog", width:90, align:"center"},
            {name:"fin_prog", label:"Fin Prog", width:90, align:"center"},
            {name:"inicio_ejec", label:"Inicio Ejec", width:90, align:"center"},
            {name:"fin_ejec", label:"Fin Ejec", width:90, align:"center"},
            {name:"avance", label:"%", width:60, align:"center"}
        ];

        // escala de tiempo
        gantt.config.scale_height = 50;

        gantt.config.scales = [
            {unit:"year", step:1, format:"%Y"},
            {unit:"month", step:1, format:"%M"}
        ];

        // 🔹 AJUSTES IMPORTANTES (sin scroll)
        gantt.config.autosize = "y";   // altura automática
        gantt.config.fit_tasks = true; // ajustar timeline al ancho

        // =====================================================
        // DATOS
        // =====================================================

        // eliminar ARC duplicados
        const mapa = new Set();

        const arcsUnicos = arcs.filter(a => {

            const clave = a.codigo + "_" + a.descripcion;

            if(mapa.has(clave)){
                return false;
            }

            mapa.add(clave);
            return true;

        });

        const tareas = arcsUnicos.map((a,i)=>({

            id:i+1,

            codigo:a.codigo,
            descripcion:a.descripcion,

            inicio_prog:a.inicio_programado ?? "-",
            fin_prog:a.fin_programado ?? "-",

            inicio_ejec:a.inicio_ejecutado ?? "-",
            fin_ejec:a.fin_ejecutado ?? "-",

            avance:a.avance + "%",

            start_date:a.inicio_programado,
            end_date:a.fin_programado,

            progress:a.avance/100

        }));


        // =====================================================
        // COLORES DE BARRAS
        // =====================================================

        gantt.templates.task_class = function(start,end,task){

            if(task.progress > 0){
                return "barra-ejecutado";   // verde
            }

            return "barra-programado";     // celeste
        };


        // =====================================================
        // TEXTO EN BARRA
        // =====================================================

        gantt.templates.task_text = function(start,end,task){

            if(task.progress > 0){
                return Math.round(task.progress*100) + "%";
            }

            return "";
        };


        // =====================================================
        // INICIAR GANTT
        // =====================================================

        gantt.init("ganttArc");

        gantt.parse({
            data:tareas
        });

    }

// =====================================================
// LINEA VERTICAL FECHA DE CORTE
// =====================================================

const lineaFechaCorte = {

    id: "lineaFechaCorte",

    afterDraw(chart) {

        const fecha = document.getElementById("fechaCorte").value;
        if(!fecha) return;

        const ctx = chart.ctx;
        const xScale = chart.scales.x;

        const x = xScale.getPixelForValue(new Date(fecha));

        ctx.save();

        ctx.beginPath();
        ctx.moveTo(x, chart.chartArea.top);
        ctx.lineTo(x, chart.chartArea.bottom);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#dc2626"; // rojo PMO
        ctx.stroke();

        ctx.fillStyle = "#dc2626";
        ctx.font = "12px sans-serif";
        ctx.fillText("Fecha Corte", x + 5, chart.chartArea.top + 12);

        ctx.restore();

    }

};

// =====================================================
// LEYENDA PERSONALIZADA DONUT - DEPENDENCIAS (ORDENADA)
// =====================================================

function actualizarLeyendaDependencias(labels, valores, colores) {

    const contenedor = document.getElementById("leyendaDependencias");

    if (!contenedor) return;

    contenedor.innerHTML = `
        <div style="
            display:grid;
            grid-template-columns: repeat(2, auto);
            gap:10px 30px;
            justify-content:center;
            margin-top:12px;
        ">
        ${labels.map((label, i) => `
            <div style="
                display:flex;
                align-items:center;
                gap:6px;
                font-size:13px;
                color:#374151;
            ">
                <span style="
                    width:12px;
                    height:12px;
                    background:${colores[i]};
                    display:inline-block;
                    border-radius:3px;
                "></span>

                <span>
                    <strong>${valores[i]}</strong> ${label}
                </span>
            </div>
        `).join("")}
        </div>
    `;
}

// =====================================================
// GRÁFICO BARRAS VERTICALES - GLOBAL (CORREGIDO)
// =====================================================

function crearBarChartGlobal(id, labels, data) {

    destruirChart(id);

    const colores = labels.map(label => obtenerColorPorEstado(label));

    charts[id] = new Chart(document.getElementById(id),{

        plugins:[lineaFechaCorte],

        type:"bar",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colores,
                borderRadius: 8,
                maxBarThickness: 60
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,

            // 🔥 Espacio superior para que no se corte el número
            layout: {
                padding: {
                    top: 30
                }
            },

            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: "end",
                    align: "end",
                    offset: 4,
                    clamp: true,
                    font: { weight: "bold", size: 14 },
                    color: "#374151",
                    formatter: value => value
                }
            },

            scales: {
                x: { 
                    grid: { display: false } 
                },
                y: { 
                    beginAtZero: true, 
                    ticks: { precision: 0 },
                    grace: "15%"   // 🔥 espacio adicional arriba
                }
            }
        },
        plugins:[ChartDataLabels]
    });
}


// =====================================================
// GRÁFICO BARRAS VERTICALES - FILTRO (DEGRADADO ELEGANTE)
// =====================================================

function crearBarChartFiltro(id, labels, data) {

    destruirChart(id);

    charts[id] = new Chart(document.getElementById(id), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: function(context) {

                    const chart = context.chart;
                    const { ctx, chartArea } = chart;

                    if (!chartArea) return null;

                    const gradient = ctx.createLinearGradient(
                        0,
                        chartArea.top,
                        0,
                        chartArea.bottom
                    );

                    // 🎨 Degradado pastel neutro (sin colores prohibidos)
                    gradient.addColorStop(0, "#EADCF8"); // lavanda claro
                    gradient.addColorStop(1, "#F8E1D4"); // durazno suave

                    return gradient;
                },
                borderRadius: 14,
                borderSkipped: false,
                maxBarThickness: 45
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,

            layout: {
                padding: {
                    top: 25
                }
            },

            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: "end",
                    align: "end",
                    offset: 4,
                    clamp: true,
                    font: { weight: "bold", size: 12 },
                    color: "#5B4B63",
                    formatter: value => value
                }
            },

            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        color: "#6B5A70"
                    },
                    grace: "15%"
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// =====================================================
// GENERAR COLORES PASTEL PARA DIRECCIONES
// =====================================================

function generarColoresDirecciones(cantidad) {

    const paleta = [
        "#E8DFF5",
        "#FFE5D9",
        "#D8F3DC",
        "#FDE2E4",
        "#E0FBFC",
        "#FFF1E6",
        "#F1F0C0",
        "#E4C1F9",
        "#FAD2E1",
        "#CDB4DB",
        "#FFC8DD",
        "#FFAFCC",
        "#BDE0FE",
        "#A2D2FF",
        "#E9EDC9"
    ];

    return paleta.slice(0, cantidad);
}


// =====================================================
// GRÁFICO BARRAS HORIZONTALES
// =====================================================

function crearHorizontalBarChart(id, labels, data) {

    destruirChart(id);

    const colores = generarColoresDirecciones(labels.length);

    charts[id] = new Chart(document.getElementById(id), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colores,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        },
        plugins: [ChartDataLabels]
    });
}


// =====================================================
// GRÁFICO DONUT
// =====================================================

function crearDoughnutChart(id, labels, data, coloresCustom = null) {

    destruirChart(id);

    const coloresPastel = coloresCustom || [
        "#FCD5CE",
        "#FAE588",
        "#BDE0FE",
        "#E4C1F9",
        "#FFD6A5",
        "#D0F4DE"
    ];

    charts[id] = new Chart(document.getElementById(id), {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: coloresPastel.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: "#374151",
                    font: {
                        weight: "bold",
                        size: 14
                    },
                    formatter: value => value
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// =====================================================
// PIE - DEPENDENCIAS INTERNAS (PASTEL NEUTRO)
// =====================================================

function crearPieDependenciasInternas(id, labels, data) {

    destruirChart(id);

    const coloresPastelNeutros = [
        "#F6E7CB",
        "#EDE4FF",
        "#F5E6CC",
        "#EADBC8",
        "#E8DFF5",
        "#FFF1E6",
        "#FDE2E4",
        "#F3E8FF"
    ];

    charts[id] = new Chart(document.getElementById(id), {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: coloresPastelNeutros.slice(0, labels.length),
                borderColor: "#ffffff",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom"
                },
                datalabels: {
                    color: "#6B5A70",
                    font: {
                        weight: "bold",
                        size: 12
                    },
                    formatter: value => value
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// =====================================================
// GRÁFICO DE LÍNEA
// =====================================================

function crearLineaChart(id, labels, datasetsConfig) {

    destruirChart(id);

    charts[id] = new Chart(document.getElementById(id), {

        type: "line",

        data: {
            labels,
            datasets: datasetsConfig.map(d => ({
                label: d.label,
                data: d.data,
                borderColor: d.color,
                borderWidth: 3,
                fill: false,
                tension: 0.3,
                pointRadius: 5
            }))
        },

options: {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
        legend: { 
            position: "bottom" 
        },

        datalabels: {
            align: "top",
            anchor: "end",
            formatter: function(value) {
                return value + "%";
            },
            font: {
                weight: "bold",
                size: 12
            }
        }
    },

    scales: {

        x: {
            type: "category",
            offset: true,          // ⭐ ESTA ES LA CLAVE
            ticks: {
                autoSkip: false
            },
            grid: {
                offset: true       // ⭐ TAMBIÉN ESTA
            }
        },

        y: {
            beginAtZero: true,
            max: 100,
            ticks:{
                callback:function(value){
                    return value + "%";
                }
            }
        }
    }
},

plugins: [ChartDataLabels]

});
}

    // =====================================================
    // INICIALIZAR
    // =====================================================

    // cargar calendario con fechas del sistema
    await cargarFechasDisponibles();

    // cargar dashboard
    cargarDashboardGlobal();


    // =====================================================
    // CONTROL FLECHAS GANTT MOVIL
    // =====================================================

    const ganttContainer = document.getElementById("ganttContainer");
    const btnLeft = document.getElementById("ganttLeft");
    const btnRight = document.getElementById("ganttRight");

    btnLeft?.addEventListener("click", () => {
        ganttContainer.scrollBy({
            left: -300,
            behavior: "smooth"
        });
    });

    btnRight?.addEventListener("click", () => {
        ganttContainer.scrollBy({
            left: 300,
            behavior: "smooth"
        });
    });

    });