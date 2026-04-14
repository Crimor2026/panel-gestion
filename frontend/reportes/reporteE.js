// =====================================================
// VARIABLES GLOBALES
// =====================================================
let dataARC = [];


// =====================================================
// INIT FINAL CORRECTO
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {

    // 🔥 1. CARGAR DIRECCIONES
    await cargarDirecciones();

    // 🔥 2. ACTIVAR SELECT2 (ANTES DE USARLO)
    $('#selectProyecto').select2({
        placeholder: "Seleccione proyecto",
        width: '100%'
    });

    // 🔥 3. CAMBIO DE DIRECCIÓN
    document.getElementById("selectDireccion")
        ?.addEventListener("change", async () => {

            await cargarProyectos();
            limpiarTodo();
        });

    // 🔥 NUEVO: función fechas con data
    async function cargarFechasConData(proyecto_id){
        try{
            const res = await fetch(`/api/fechas-con-data/${proyecto_id}`);
            const data = await res.json();

            window.fechasConData = data;

            const fp = document.querySelector("#fechaCorte")?._flatpickr;
            if(fp) fp.redraw();

        }catch(e){
            console.error("Error fechas:", e);
            window.fechasConData = [];
        }
    }

    // 🔥 4. FECHA
    flatpickr("#fechaCorte", {
        dateFormat: "Y-m-d",
        locale: flatpickr.l10ns.es,
        maxDate: "today",

        // 🔥 NUEVO (puntito)
        onDayCreate: function(dObj, dStr, fp, dayElem){

            const fecha = dayElem.dateObj.toISOString().slice(0,10);
            const fechasConData = window.fechasConData || [];

            if(fechasConData.includes(fecha)){
                const dot = document.createElement("span");
                dot.className = "dot-data";
                dayElem.appendChild(dot);
            }
        },

        onChange: () => {
            cargarTodo();
        }
    });

    // 🔥 5. PROYECTO
    $('#selectProyecto').on('change', function () {

        const proyecto_id = this.value;

        if(proyecto_id){
            // 🔥 NUEVO
            cargarFechasConData(proyecto_id);
        }

        cargarTodo();
    });

});

// =====================================================
// 🔄 CARGA GENERAL (OPTIMIZADA)
// =====================================================
async function cargarTodo(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    // 🔥 VALIDACIÓN GLOBAL
    if(!proyecto_id || !fecha){
        limpiarTodo();
        return;
    }

    try{

        // 🔥 EJECUTA EN PARALELO (más rápido)
        await Promise.all([
            cargarInfoProyecto(),
            cargarARC(),
            cargarFirmas()
        ]);

        // 🔥 SOLO ESTO SE AGREGA
        renderARC();
        renderCronograma();

    }catch(e){
        console.error("❌ Error en carga general:", e);
        limpiarTodo();
    }
}

// =====================================================
// 🏢 CARGAR DIRECCIONES
// =====================================================
async function cargarDirecciones(){

    try{

        const res = await fetch("/api/direcciones");
        const data = await res.json();

        const select = document.getElementById("selectDireccion");
        select.innerHTML = '<option value="">Seleccione dirección</option>';

        data.forEach(d => {
            const option = document.createElement("option");
            option.value = d.id;
            option.textContent = d.nombre;
            select.appendChild(option);
        });

    }catch(e){
        console.error("❌ Error cargando direcciones:", e);
    }
}

// =====================================================
// 📁 CARGAR PROYECTOS POR DIRECCIÓN
// =====================================================
async function cargarProyectos(){

    const direccion_id = document.getElementById("selectDireccion")?.value;
    const select = document.getElementById("selectProyecto");

    // limpiar siempre
    select.innerHTML = '<option value="">Seleccione proyecto</option>';

    if(!direccion_id) return;

    try{

        const res = await fetch(`/api/proyectos?direccion_id=${direccion_id}`);

        if(!res.ok){
            throw new Error("Error API proyectos");
        }

        const data = await res.json();

        data.forEach(p => {
            const option = document.createElement("option");
            option.value = p.id;
            option.textContent = p.nombre;
            select.appendChild(option);
        });

    }catch(e){
        console.error("❌ Error cargando proyectos:", e);
    }
}

// =====================================================
// 🧾 INFO PROYECTO (SOLO LECTURA)
// =====================================================
async function cargarInfoProyecto(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha){
        limpiarCampos();
        return;
    }

    try{

        const res = await fetch(`/api/proyecto/${proyecto_id}?fecha=${fecha}`);

        if(!res.ok){
            throw new Error("Error en API");
        }

        const p = await res.json();

        // 🔥 SIN DATA
        if(!p || Object.keys(p).length === 0){
            limpiarCampos();
            return;
        }

        // =====================================================
        // HEADER
        // =====================================================
        setText("codigoDSP", p.codigo_dsp);
        setText("codigoProyecto", p.codigo_dsp);
        setText("unidad", p.unidad);

        // =====================================================
        // CAMPOS (REPORTE E)
        // =====================================================
        setInput("tipologia", p.tipologia);
        setInput("estado", p.estado);
        setInput("modalidadTransporte", p.modalidad);

        setInput("entidad", p.entidad_ejecutora);
        setInput("presupuestoAprobado", p.presupuesto_programado);
        setInput("presupuestoEjecutado", p.presupuesto_ejecutado);

        setFecha("inicio", p.fecha_inicio_programado);
        setFecha("fin", p.fecha_fin_programado);
        setInput("cui", p.cui);

    }catch(e){
        console.error("❌ Error proyecto:", e);
        limpiarCampos();
    }
}

// =====================================================
// 🧹 LIMPIAR CAMPOS (REPORTE E)
// =====================================================
function limpiarCampos(){

    setText("codigoDSP", "-");
    setText("codigoProyecto", "-");
    setText("unidad", "-");

    setInput("tipologia", "");
    setInput("estado", "");
    setInput("modalidadTransporte", "");

    setInput("entidad", "");
    setInput("presupuestoAprobado", "");
    setInput("presupuestoEjecutado", "");

    setFecha("inicio", "");
    setFecha("fin", "");
    setInput("cui", "");

    for(let i=1;i<=3;i++){
        document.getElementById("imgFirma"+i).src = "";
        document.getElementById("cargo"+i).value = "";
        document.getElementById("nombre"+i).value = "";
    }
}

// =====================================================
// 🔥 ARC → SOLO VISUAL (TIMELINE + CRONOGRAMA)
// =====================================================
async function cargarARC(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    console.log("PROYECTO:", proyecto_id);
    console.log("FECHA:", fecha);

    if(!proyecto_id || !fecha) return;

    try{
        const res = await fetch(`/api/arc/${proyecto_id}?fecha=${fecha}`);
        dataARC = await res.json();

        console.log("ARC DATA:", dataARC); // 🔥

        renderARC();
        renderCronograma();

    }catch(e){
        console.error("Error ARC", e);
    }
}

// =====================================================
// 🎯 RENDER ARC (CHIPS)
// =====================================================
function renderARC(){

    const cont = document.getElementById("contenedorARC"); // 🔥 ID CORRECTO
    if(!cont) return;

    cont.innerHTML = "";

    dataARC.forEach((d)=>{

        const div = document.createElement("div");
        div.className = "arc-item";

        div.innerHTML = `
            <div class="arc-badge">${d.codigo_arc || "-"}</div>
            <div class="arc-codigo">${d.codigo || ""}</div>
        `;

        div.title = d.descripcion || "Sin descripción";

        cont.appendChild(div);
    });
}

// =====================================================
// 📊 CRONOGRAMA CON DHTMLX (FINAL PRO - SOLO MESES)
// =====================================================
function renderCronograma(){

    const cont = document.getElementById("cronogramaContainer");
    if(!cont) return;

    // gantt.plugins({ marker: true });

    cont.innerHTML = '<div id="gantt_here" style="width:100%; height:500px;"></div>';

    if(!dataARC || !dataARC.length){
        console.warn("dataARC vacío");
    }

    // =====================================================
    // 📅 CONFIGURACIÓN ESCALA (MESES)
    // =====================================================
    gantt.config.date_format = "%Y-%m-%d";

    gantt.config.scale_unit = "month";
    gantt.config.step = 1;
    gantt.config.date_scale = "%M %Y";
    gantt.config.subscales = [];

    gantt.config.scale_height = 50;
    gantt.config.min_column_width = 80;
    gantt.config.smart_scales = false;

    // ❌ ELIMINADO: gantt.ext.zoom (ROMPÍA TODO)

    // =====================================================
    // 📋 COLUMNAS (FINAL)
    // =====================================================
    gantt.config.columns = [
        { name:"codigo", label:"Código", width:160, template: d => d.codigo_arc || "" },

        { name:"descripcion", label:"Descripción", width:400, template: d => `<div style="white-space:normal; line-height:1.1; padding-right:10px;">${d.descripcion || ""}</div>` },

        { name:"direccion_responsable", label:"Dirección Responsable", width:200, template: d => d.direccion_responsable || "" },

        { name:"inicio_programado", label:"Programado Inicio", width:150, align:"center", template: d => formatoFecha(d.inicio_programado) },

        { name:"fin_programado", label:"Programado Fin", width:150, align:"center", template: d => formatoFecha(d.fin_programado) },

        { name:"inicio_ejecutado", label:"Ejecutado Inicio", width:150, align:"center", template: d => formatoFecha(d.inicio_real) },

        { name:"fin_ejecutado", label:"Ejecutado Fin", width:150, align:"center", template: d => formatoFecha(d.fin_real) },

        { name:"avance", label:"% Avance", width:110, align:"center", template: d => (d.avance ?? 0) + "%" }
    ];

    gantt.config.readonly = true;
    gantt.config.autosize = "y";
    gantt.config.row_height = 60;
    gantt.config.bar_height = 20;

    gantt.templates.task_text = function(){
        return "";
    };

    gantt.clearAll();

    // =====================================================
    // 📦 DATA REAL (CORREGIDA)
    // =====================================================
    const data = dataARC.map((d, i) => {

        let inicio = d.inicio_programado;
        let fin = d.fin_programado;

        if(!inicio && fin) inicio = fin;
        if(!fin && inicio) fin = inicio;

        if(!inicio && !fin){
            inicio = new Date().toISOString().split("T")[0];
            fin = inicio;
        }

        return {
            id: i + 1,
            text: d.descripcion || " ",

            codigo_arc: d.codigo_arc,
            descripcion: d.descripcion,
            direccion_responsable: d.direccion_responsable,
            direccion: d.direccion,

            inicio_programado: d.inicio_programado,
            fin_programado: d.fin_programado,
            inicio_real: d.inicio_real,
            fin_real: d.fin_real,

            avance: Number(d.avance_percent) || 0,

            // 🔥 AQUÍ ESTÁ EL FIX
            start_date: formatearFechaGantt(inicio),
            end_date: formatearFechaGantt(fin),

            progress: (Number(d.avance_percent) || 0) / 100
        };

    });

    // =====================================================
    // 📅 RANGO DINÁMICO
    // =====================================================
    const fechasInicio = dataARC
        .map(d => d.inicio_programado)
        .filter(f => f)
        .map(f => new Date(f));

    const fechasFin = dataARC
        .map(d => d.fin_programado)
        .filter(f => f)
        .map(f => new Date(f));

    if(fechasInicio.length && fechasFin.length){

        const minFecha = new Date(Math.min(...fechasInicio));
        const maxFecha = new Date(Math.max(...fechasFin));

        minFecha.setMonth(minFecha.getMonth() - 1);
        maxFecha.setMonth(maxFecha.getMonth() + 1);

        gantt.config.start_date = minFecha;
        gantt.config.end_date   = maxFecha;
    }

    // =====================================================
    // 🚀 INIT (CORREGIDO)
    // =====================================================
    gantt.config.fit_tasks = true;

    gantt.init("gantt_here"); // 🔥 SIEMPRE

    gantt.clearAll();
    gantt.parse({ data });

    // =====================================================
    // 🔥 ESPERAR RENDER DEL GANTT (FINAL CON ETIQUETAS)
    // =====================================================
    gantt.attachEvent("onGanttRender", function(){

        const area = document.querySelector(".gantt_data_area") 
                || document.querySelector(".gantt_task_area");

        if(!area) return;

        // 🔥 limpiar anteriores
        area.querySelectorAll(".linea-marcador, .label-marcador")
            .forEach(el => el.remove());

        // =====================================================
        // 🔴 FECHA DE CORTE
        // =====================================================
        const fechaCorte = document.getElementById("fechaCorte")?.value;

        if(fechaCorte){

            const fc = new Date(fechaCorte);
            const pos = gantt.posFromDate(fc);

            if(pos !== null && !isNaN(pos)){

                // 🔴 línea
                const linea = document.createElement("div");
                linea.className = "linea-marcador";
                linea.style.position = "absolute";
                linea.style.left = pos + "px";
                linea.style.top = "0";
                linea.style.width = "3px";
                linea.style.height = "100%";
                linea.style.background = "red";
                linea.style.zIndex = "9999";

                area.appendChild(linea);

                // 🔴 etiqueta
                const label = document.createElement("div");
                label.className = "label-marcador";
                label.innerText = "Corte";
                label.style.position = "absolute";
                label.style.left = pos + "px";
                label.style.top = "-18px";
                label.style.transform = "translateX(-50%)";
                label.style.background = "red";
                label.style.color = "#fff";
                label.style.fontSize = "10px";
                label.style.padding = "2px 6px";
                label.style.borderRadius = "4px";
                label.style.zIndex = "10000";

                area.appendChild(label);
            }
        }

    // =====================================================
    // 🔵 HOY
    // =====================================================
    const hoy = new Date();
    const posHoy = gantt.posFromDate(hoy);

    if(posHoy !== null && !isNaN(posHoy)){

        // 🔵 línea
        const lineaHoy = document.createElement("div");
        lineaHoy.className = "linea-marcador";
        lineaHoy.style.position = "absolute";
        lineaHoy.style.left = posHoy + "px";
        lineaHoy.style.top = "0";
        lineaHoy.style.width = "3px";
        lineaHoy.style.height = "100%";
        lineaHoy.style.background = "#007bff";
        lineaHoy.style.zIndex = "9999";

        area.appendChild(lineaHoy);

        // 🔵 etiqueta
        const labelHoy = document.createElement("div");
        labelHoy.className = "label-marcador";
        labelHoy.innerText = "Hoy";
        labelHoy.style.position = "absolute";
        labelHoy.style.left = posHoy + "px";
        labelHoy.style.top = "-18px";
        labelHoy.style.transform = "translateX(-50%)";
        labelHoy.style.background = "#007bff";
        labelHoy.style.color = "#fff";
        labelHoy.style.fontSize = "10px";
        labelHoy.style.padding = "2px 6px";
        labelHoy.style.borderRadius = "4px";
        labelHoy.style.zIndex = "10000";

        area.appendChild(labelHoy);
    }

});

}

// =====================================================
// 🖊️ FIRMAS (SOLO CARGA)
// =====================================================
async function cargarFirmas(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha) return;

    try{

        const res = await fetch(`/api/firmas/${proyecto_id}?fecha=${fecha}`);
        const data = await res.json();

        for(let i=1;i<=3;i++){

            const img = document.getElementById("imgFirma"+i);

            if(data["firma"+i]){
                img.src = data["firma"+i];
            }else{
                img.src = "";
            }

            document.getElementById("cargo"+i).value = data["cargo"+i] ?? "";
            document.getElementById("nombre"+i).value = data["nombre"+i] ?? "";
        }

    }catch(e){
        console.error("Error firmas", e);
    }
}


// =====================================================
// 🧹 LIMPIAR
// =====================================================
function limpiarTodo(){
    limpiarCampos();
    document.getElementById("contenedorARC").innerHTML = "";
    document.getElementById("cronogramaContainer").innerHTML = "";
}

// =====================================================
// HELPERS
// =====================================================
function setText(id, val){
    const el = document.getElementById(id);
    if(el) el.innerText = val || "-";
}

function setInput(id, val){
    const el = document.getElementById(id);
    if(el) el.value = val || "";
}

function setFecha(id, val){
    const el = document.getElementById(id);
    if(el) el.value = val ? val.split("T")[0] : "";
}

function formatoFecha(f){
    if(!f) return "-";
    return new Date(f).toLocaleDateString("es-PE");
}

function getMes(f){
    return new Date(f).getMonth();
}

// =====================================================
// 📅 FORMATEAR FECHA PARA GANTT (OBLIGATORIO)
// =====================================================
function formatearFechaGantt(fecha){

    if(!fecha) return null;

    const f = new Date(fecha);

    const y = f.getFullYear();
    const m = String(f.getMonth() + 1).padStart(2, "0");
    const d = String(f.getDate()).padStart(2, "0");

    return `${y}-${m}-${d}`;
}

// =====================================================
// 🔥 CLICK FIRMA
// =====================================================
function clickFirma(i){

    console.log("CLICK FIRMA", i);

    const input = document.getElementById("fileFirma"+i);

    if(!input){
        console.error("No existe fileFirma"+i);
        return;
    }

    input.click();
}

// =====================================================
// 🔥 SUBIR FIRMA
// =====================================================
async function subirFirma(event, i){

    console.log("ENTRO A SUBIR FIRMA", i);

    const file = event.target.files[0];
    if(!file) return;

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha){
        alert("Selecciona proyecto y fecha");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("proyecto_id", proyecto_id);
    formData.append("fecha_corte", fecha);
    formData.append("firma_num", i);

    try{

        const res = await fetch("/api/subir-firma", {
            method: "POST",
            body: formData
        });

        if(!res.ok){
            throw new Error("Error servidor");
        }

        const data = await res.json();

        const img = document.getElementById("imgFirma"+i);
        if(img){
            img.src = data.url + "?t=" + new Date().getTime();
        }

        event.target.value = "";

    }catch(e){
        console.error("Error firma", e);
        alert("Error al subir firma");
    }
}

// =====================================================
// 🔥 EVENTO INPUT FILE
// =====================================================
document.addEventListener("DOMContentLoaded", () => {

    [1,2,3].forEach(i => {

        const input = document.getElementById("fileFirma"+i);

        if(!input) return;

        input.addEventListener("change", (e) => {

            console.log("🔥 CHANGE FIRMA", i);

            subirFirma(e, i);
        });

    });

});

// =====================================================
// 📄 GENERAR PDF (VERSIÓN FINAL REAL 🔥)
// =====================================================
async function generarPDF(){

    // 🔥 ACTIVAR MODO PDF (AQUÍ)
    document.body.classList.add("modo-pdf");

    const original = document.querySelector(".container");

    // ===============================
    // 🔥 1. CLONAR DOM + MARGEN REAL
    // ===============================
    const clone = original.cloneNode(true);

    clone.style.position = "absolute";
    clone.style.top = "-9999px";
    clone.style.left = "-9999px";

    // 🔥 ESTE YA NO DEBE TENER PADDING
    clone.style.width = "100%";              // 🔥 clave
    clone.style.background = "white";
    clone.style.boxSizing = "border-box";

    // ===============================
    // 🔥 WRAPPER REAL (FIX FINAL)
    // ===============================
    const wrapper = document.createElement("div");

    wrapper.style.position = "absolute";
    wrapper.style.top = "-9999px";
    wrapper.style.left = "-9999px";

    // 🔥 AQUÍ ESTÁ LA CLAVE REAL
    wrapper.style.width = "1122px";          // ✅ A4 real
    wrapper.style.padding = "40px";          // ✅ margen REAL
    wrapper.style.background = "white";
    wrapper.style.boxSizing = "border-box";

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // ===============================
    // 🔥 2. INPUT → TEXTAREA
    // ===============================
    clone.querySelectorAll('input:not([type="file"])').forEach((el, i) => {

        const originalInputs = original.querySelectorAll('input:not([type="file"])');
        const originalInput = originalInputs[i];

        const textarea = document.createElement("textarea");

        textarea.value = originalInput?.value || "";
        textarea.className = el.className + " box";

        textarea.style.width = "100%";
        textarea.style.border = "none";
        textarea.style.background = "#f1f3f5";
        textarea.style.resize = "none";
        textarea.style.padding = "7px 10px";
        textarea.style.borderRadius = "6px";
        textarea.style.fontSize = "13px";

        textarea.style.whiteSpace = "normal";
        textarea.style.wordBreak = "break-word";

        el.parentNode.replaceChild(textarea, el);
    });

    // ===============================
    // 🔥 FIX FIRMA DEFINITIVO
    // ===============================
    clone.querySelectorAll(".firma-box").forEach((box, i) => {

        const originalBox = original.querySelectorAll(".firma-box")[i];

        const nombre = originalBox.querySelector('[id^="nombre"]')?.value || "";
        const cargo  = originalBox.querySelector('[id^="cargo"]')?.value || "";

        const nombreDiv = document.createElement("div");
        nombreDiv.innerText = nombre;
        nombreDiv.style.textAlign = "center";
        nombreDiv.style.fontSize = "12px";

        const cargoDiv = document.createElement("div");
        cargoDiv.innerText = cargo;
        cargoDiv.style.textAlign = "center";
        cargoDiv.style.fontSize = "12px";

        const inputs = box.querySelectorAll(".input-texto");

        if(inputs[0]) inputs[0].replaceWith(cargoDiv);
        if(inputs[1]) inputs[1].replaceWith(nombreDiv);
    });

    // ===============================
    // 🔥 3. SELECT → DIV
    // ===============================
    clone.querySelectorAll("select").forEach((el, i) => {

        const originalSelect = original.querySelectorAll("select")[i];

        const div = document.createElement("div");

        let selectedText = "";

        if(originalSelect && originalSelect.selectedIndex >= 0){
            selectedText = originalSelect.options[originalSelect.selectedIndex].text;
        }

        div.innerText = selectedText;
        div.className = "box";

        div.style.width = "100%";
        div.style.minHeight = "50px";
        div.style.display = "flex";
        div.style.alignItems = "center";

        div.style.padding = "7px 10px";
        div.style.background = "#f1f3f5";
        div.style.borderRadius = "6px";
        div.style.fontSize = "13px";

        el.parentNode.replaceChild(div, el);
    });

    // ===============================
    // 🔥 4. ELIMINAR BOTONES
    // ===============================
    clone.querySelectorAll(".btn-pdf").forEach(el => el.remove());

    // ===============================
    // 🔥 5. AUTO ALTURA
    // ===============================
    clone.querySelectorAll("textarea.box").forEach(el => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    });

    // ===============================
    // 🔥 6. CAPTURA (FORZADO REAL)
    // ===============================
    const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true
    });

    // 🔥 NUEVO CANVAS CON MARGEN REAL
    const marginPx = 80; // 🔥 controla el margen (sube esto si quieres más)

    const finalCanvas = document.createElement("canvas");
    const ctx = finalCanvas.getContext("2d");

    // 🔥 agrandamos el canvas
    finalCanvas.width = canvas.width + (marginPx * 2);
    finalCanvas.height = canvas.height + (marginPx * 2);

    // 🔥 fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // 🔥 dibujar contenido al centro
    ctx.drawImage(canvas, marginPx, marginPx);

    // ===============================
    // 🔥 PDF
    // ===============================
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("landscape", "mm", "a4");

    const pageWidth = 297;
    const pageHeight = 210;

    const margin = 40;

    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = finalCanvas.height * imgWidth / finalCanvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // 🔥 PRIMERA
    pdf.addImage(
        finalCanvas.toDataURL("image/png"),
        "PNG",
        margin,   // 🔥 aquí está el margen real
        position,
        imgWidth,
        imgHeight
    );

    heightLeft -= pageHeight;

    // 🔥 MULTIPÁGINA
    while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();

        pdf.addImage(
            finalCanvas.toDataURL("image/png"),
            "PNG",
            margin,   // 🔥 también aquí
            position,
            imgWidth,
            imgHeight
        );

        heightLeft -= pageHeight;
    }

    pdf.save("reporteE.pdf");

    // ===============================
    // 🔥 7. LIMPIAR
    // ===============================
    wrapper.remove();

    // 🔥 DESACTIVAR MODO PDF (AQUÍ)
    document.body.classList.remove("modo-pdf");

    }