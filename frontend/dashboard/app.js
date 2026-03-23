// =====================================================
// DOM READY
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {

    // =====================================================
    // VARIABLES
    // =====================================================

    let charts = {};
    let calendario = null;

    let dataGlobalIA = null;

    const direccionSelect = document.getElementById("direccionSelect");
    const clasificacionFiltro = document.getElementById("clasificacionFiltro");
    const proyectoSelect = document.getElementById("proyectoSelect");
    const btnLogin = document.getElementById("btnLogin");
    const fechaInput = document.getElementById("fechaCorte");

    const btnSubirProyectos = document.getElementById("btnSubirProyectos");
    const btnSubirARC = document.getElementById("btnSubirARC");
    const btnLogout = document.getElementById("btnLogout");

    const excelProyectos = document.getElementById("excelProyectos");
    const excelARC = document.getElementById("excelARC");

    const token = sessionStorage.getItem("token");
    const rol = sessionStorage.getItem("rol");

    // =====================================================
    // TOGGLE ESTATUS CONSOLIDADO
    // =====================================================

    const toggle = document.getElementById("toggleConsolidado");
    const contenido = document.getElementById("contenidoConsolidado");
    const icono = document.getElementById("iconoToggle");

    let abierto = true;

    toggle?.addEventListener("click", () => {

        abierto = !abierto;

        if (contenido) {
            contenido.style.display = abierto ? "block" : "none";
        }

        if (icono) {
            icono.style.transform = abierto ? "rotate(90deg)" : "rotate(0deg)";
        }

        if (abierto) {
            setTimeout(() => {
                Object.values(charts).forEach(chart => {
                    if (chart) chart.resize();
                });
            }, 200);
        }

    });

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

    // mostrar siempre botones de carga
    if (rol === "admin") {
        btnSubirProyectos?.classList.remove("hidden");
        btnSubirARC?.classList.remove("hidden");
    }

    // =====================================================
    // LOGOUT
    // =====================================================

    btnLogout?.addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "/";
    });

    // =====================================================
    // SUBIR PROYECTOS
    // =====================================================

    btnSubirProyectos?.addEventListener("click", () => {
        excelProyectos.click();
    });

    excelProyectos?.addEventListener("change", async () => {

        const file = excelProyectos.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {

            const response = await fetch("/admin/upload-excel", {
                method:"POST",
                headers:{
                    "Authorization":"Bearer " + token
                },
                body:formData
            });

            if(!response.ok) throw new Error();

            alert("Proyectos cargados correctamente");
            location.reload();

        } catch {
            alert("Error cargando proyectos");
        }

    });

    // =====================================================
    // SUBIR ARC
    // =====================================================

    btnSubirARC?.addEventListener("click", () => {
        excelARC.click();
    });

    excelARC?.addEventListener("change", async () => {

        const file = excelARC.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {

            const response = await fetch("/admin/upload-arc", {
                method:"POST",
                headers:{
                    "Authorization":"Bearer " + token
                },
                body:formData
            });

            if(!response.ok) throw new Error();

            alert("ARC cargados correctamente");
            location.reload();

        } catch {
            alert("Error cargando ARC");
        }

    });

    // =====================================================
    // DASHBOARD GLOBAL
    // =====================================================

    async function cargarDashboardGlobal() {

        try {

            let url = "/api/dashboard/global";

            const fecha = fechaInput.value;

            if (fecha && fecha !== "") {
                url += `?fecha=${fecha}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            dataGlobalIA = data;

            // ================= ÚLTIMA ACTUALIZACIÓN =================
            const fechaEl = document.getElementById("fechaActualizacion");

            if (fechaEl) {

                if (data.fecha_actualizacion) {
                    fechaEl.textContent = "Última actualización: " + data.fecha_actualizacion;
                } else {
                    const fechaTexto = fechaInput.value || "Sin fecha";
                    fechaEl.textContent = "Última actualización: " + fechaTexto;
                }

            }

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

            crearGraficoTorres(
                "graficoEstadosGlobal",
                ORDEN_ESTADOS,
                cantidadesEstados
            );

            // ocultarSiVacio("graficoEstadosGlobal");

            // ================= DONUT GLOBAL =================

            const labelsDependencias = data.dependencias.map(d => d.entidad);
            const valoresDependencias = data.dependencias.map(d => d.cantidad);

            crearDoughnutChart(
                "graficoDependenciasGlobal",
                labelsDependencias,
                valoresDependencias
            );

            ocultarSiVacio("graficoDependenciasGlobal");

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

            ocultarSiVacio("graficoDireccionesGlobal"); 

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

        let url = `/api/dashboard/direccion/${direccionId}`;

        const fecha = fechaInput.value;

        if (fecha && fecha !== "") {
            url += `?fecha=${fecha}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        // ================= ESTADOS =================
        const mapaEstados = {};

        if (data.estados && Array.isArray(data.estados)) {
            data.estados.forEach(e => {
                mapaEstados[e.estado] = e.cantidad;
            });
        }

        // 🔥 PRIMERO construyes esto
        const cantidadesEstados = ORDEN_ESTADOS.map(
            estado => mapaEstados[estado] || 0
        );

        // 🔥 LUEGO calculas total
        const total = cantidadesEstados.reduce((a,b)=>a+b,0);

        // 🔥 VALIDACIÓN
        if (total === 0) {
            document.getElementById("graficoEstadosFiltro").innerHTML = `
                <div class="text-gray-500 text-center">
                    No hay datos para esta dirección
                </div>
            `;
            return;
        }

        // 🔥 RECIÉN dibujas
        crearGraficoEstadosEjecutivo(
            "graficoEstadosFiltro",
            ORDEN_ESTADOS,
            cantidadesEstados
        );

        // ================= DEPENDENCIAS =================
        const canvas = document.getElementById("graficoDependenciasFiltro");
        const mensaje = document.getElementById("mensajeDependencias");

        if (data.dependencias && data.dependencias.length > 0) {

            canvas.style.display = "block";
            mensaje?.classList.add("hidden");

            crearPieDependenciasInternas(
                "graficoDependenciasFiltro",
                data.dependencias.map(d => d.nombre),
                data.dependencias.map(d => d.cantidad)
            );

        } else {

            canvas.style.display = "none";
            mensaje?.classList.remove("hidden");

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

        // 🔥 LLAMADA CORRECTA
        await cargarProyectosPorDireccion(direccionId);

    } catch (error) {
        console.error("Error en dashboard dirección:", error);
    }
}

        // ================= PROYECTOS =================

async function cargarProyectosPorDireccion(direccionId) {

    try {

        const fecha = fechaInput.value || "";
        const clasificacion = clasificacionFiltro.value;

        let url = `/api/proyectos?direccion_id=${direccionId}`;

        if (fecha && fecha !== "") {
            url += `&fecha=${fecha}`;
        }

        if (clasificacion && clasificacion !== "todas") {
            url += `&clasificacion_id=${clasificacion}`;
        }

        const res = await fetch(url);

        if (!res.ok) {
            console.error("Error cargando proyectos");
            return;
        }

        const proyectos = await res.json();

        proyectoSelect.innerHTML = proyectos
            .map(p => `<option value="${p.id}">${p.nombre}</option>`)
            .join("");

        if (!proyectos.length) return;

        const primerProyecto = proyectos[0].id;
        proyectoSelect.value = primerProyecto;

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

    let fechas = [];

    try {
        const res = await fetch(`/api/fechas`);
        if (res.ok) {
            fechas = await res.json();
        }
    } catch (e) {
        console.error("Error cargando fechas", e);
    }

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

    function ocultarSiVacio(idCanvas) {

        const canvas = document.getElementById(idCanvas);
        if (!canvas) return;

        const card = canvas.closest(".card");
        const chart = charts[idCanvas];

        if (!chart || !chart.data || chart.data.datasets[0].data.every(v => v === 0)) {
            if (card) card.style.display = "none";
        } else {
            if (card) card.style.display = "block";
        }
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

        animation: {
            duration: 1200,
            easing: "easeOutQuart"
        },

        animations: {
            y: {
                from: 0,
                duration: 1200,
                easing: "easeOutQuart"
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
                x: { grid: { display: false } },
                y: { beginAtZero: true, ticks: { precision: 0 }, grace: "15%" }
            }
        },

        plugins:[ChartDataLabels]

    });
    
    }

// =====================================================
// NUEVO GRAFICO TORRES
// =====================================================

function crearGraficoTorres(id, labels, data){

    const contenedor = document.getElementById(id);
    if (!contenedor) return;

    contenedor.innerHTML = `
        <div id="graficoTorres" class="grafico-torres">
            ${labels.map((label, i) => {

                const valor = data[i];

                let clase = "sin";
                if(label.toLowerCase().includes("ejec")) clase = "ejec";
                if(label.toLowerCase().includes("paral")) clase = "paral";
                if(label.toLowerCase().includes("conclu")) clase = "conc";

                const niveles = Math.ceil(valor / 5); // 🔥 escala visual

                return `
                    <div class="torre">
                        <div class="bloques">
                            ${Array.from({length: niveles || 1}).map((_, i) => `
                                <div class="bloque ${clase}" style="animation-delay:${i * 0.08}s"></div>
                            `).join("")}
                        </div>
                        <span>${valor}</span>
                        <small>${label}</small>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

// =====================================================
// 🔥 NUEVO GRAFICO PROGRESO
// =====================================================
function crearGraficoEstadosEjecutivo(id, labels, data){

    const contenedor = document.getElementById(id);
    if (!contenedor) return;

    contenedor.innerHTML = "";

    const total = data.reduce((a,b) => a + b, 0) || 1;

    contenedor.innerHTML = `
        <div class="space-y-4">
            ${labels.map((label, i) => {

                const valor = data[i];
                const porcentaje = Math.round((valor / total) * 100);

                let color = "#9ca3af";
                if(label.toLowerCase().includes("ejec")) color = "#22c55e";
                if(label.toLowerCase().includes("paral")) color = "#ef4444";
                if(label.toLowerCase().includes("conclu")) color = "#3b82f6";

                return `
                    <div>
                        <div class="flex justify-between text-sm mb-1">
                            <span>${label}</span>
                            <span>${valor} (${porcentaje}%)</span>
                        </div>

                        <div class="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                                data-width="${porcentaje}"
                                style="width:0%; background:${color}"
                                class="barra-fill h-3 rounded-full transition-all duration-1000 ease-out">
                            </div>
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;

    // 🔥 ANIMACIÓN (DENTRO DE LA FUNCIÓN)
    requestAnimationFrame(() => {
        const barras = contenedor.querySelectorAll(".barra-fill");

        barras.forEach((bar, i) => {
            const width = bar.getAttribute("data-width");

            setTimeout(() => {
                bar.style.width = width + "%";
            }, i * 120); // 🔥 efecto cascada pro
        });
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

        animation: {
            duration: 1200,
            easing: "easeOutQuart"
        },

        animations: {
            y: {
                from: 0,
                duration: 1200,
                easing: "easeOutQuart"
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

            // 🔥 CLAVE: animación horizontal
            animation: {
                duration: 1200,
                easing: "easeOutQuart"
            },

            animations: {
                x: {   // 🔥 IMPORTANTE: X, no Y
                    from: 0
                }
            },

            plugins: {
                legend: { display: false }
            }
        },
        plugins: [ChartDataLabels]
    });

    charts[id].update();
}

// =====================================================
// GRÁFICO DONUT (CON ANIMACIÓN)
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

            // 🔥 ANIMACIÓN CLAVE
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1200,
                easing: "easeOutQuart"
            },

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

    // 🔥 FORZAR ANIMACIÓN (CLAVE)
    charts[id].update();
}

// =====================================================
// PIE - DEPENDENCIAS INTERNAS (CON ANIMACIÓN)
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

            // 🔥 ANIMACIÓN
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1200,
                easing: "easeOutQuart"
            },

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

    // 🔥 CLAVE
    charts[id].update();
}

// =====================================================
// GRÁFICO DE LÍNEA (CON ANIMACIÓN)
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

            // 🔥 ANIMACIÓN (línea dibujándose)
            animation: {
                duration: 1200,
                easing: "easeOutQuart"
            },

            animations: {
                y: {
                    from: 0,
                    duration: 1200,
                    easing: "easeOutQuart"
                }
            },

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
                    offset: true,
                    ticks: { autoSkip: false },
                    grid: { offset: true }
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

    // 🔥 CLAVE
    charts[id].update();
}

    // =====================================================
    // INICIALIZAR
    // =====================================================

    try {
        await cargarFechasDisponibles();
    } catch (e) {
        console.error("Error fechas:", e);
    }

    cargarDashboardGlobal();

    // 🔥 ANIMACIÓN AUTOMÁTICA DE CARDS CON GRÁFICOS
    setTimeout(() => {
        document.querySelectorAll("canvas").forEach(canvas => {
            const card = canvas.closest(".card");
            if (card) {
                card.classList.add("animar");
            }
        });
    }, 500);


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

// =====================================================
// 🤖 IA POPUP CHAT
// =====================================================

const btnIA = document.getElementById("btnIAFloat");
const popupIA = document.getElementById("popupIA");
const cerrarIA = document.getElementById("cerrarIA");
const inputIA = document.getElementById("inputIA");
const chatIA = document.getElementById("chatIA");
const enviarIA = document.getElementById("enviarIA");

// 🔹 ABRIR / CERRAR
btnIA?.addEventListener("click", () => {
    popupIA.classList.toggle("hidden");
});

cerrarIA?.addEventListener("click", () => {
    popupIA.classList.add("hidden");
});

// 🔹 ENVIAR MENSAJE
enviarIA?.addEventListener("click", responderIA);

async function responderIA(){

    const pregunta = inputIA.value.trim();
    if (!pregunta) return;

    chatIA.innerHTML += `<div><strong>Tú:</strong> ${pregunta}</div>`;

    let respuesta = generarRespuestaIA(pregunta);

    // 🔥 SI NO SABE → USA IA
    if (respuesta.includes("Prueba:") || respuesta.includes("No entendí")) {

        try {
            const res = await fetch("/api/ia", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    pregunta,
                    data: dataGlobalIA
                })
            });

            const data = await res.json();
            respuesta = data.respuesta;

        } catch {
            respuesta = "Error consultando IA externa.";
        }
    }

    chatIA.innerHTML += `<div class="text-indigo-600"><strong>Aura:</strong> ${respuesta}</div>`;

    chatIA.scrollTop = chatIA.scrollHeight;

    inputIA.value = "";
}
    function generarRespuestaIA(pregunta){

    if (!dataGlobalIA) {
        return "Cargando datos...";
    }

    const p = pregunta.toLowerCase();

    if (p.includes("total")) {
        return `Hay ${dataGlobalIA?.kpis?.total || 0} proyectos.`;
    }

    if (p.includes("ejec")) {

        const estados = dataGlobalIA?.estados || [];

        const ejec = estados.find(e => 
            e.estado?.toLowerCase().includes("ejec")
        )?.cantidad || 0;

        return `Hay ${ejec} proyectos en ejecución.`;
    }

    return "Prueba:";
}

// 👇 ESTE ES EL CIERRE CORRECTO DEL DOM
});