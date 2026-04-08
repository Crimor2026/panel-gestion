// =====================================================
// VARIABLES GLOBALES
// =====================================================
let data = []; // 🔥 DATA GLOBAL (SIEMPRE ESTA SE USA)
let fechaGlobal = null;

// =====================================================
// INIT (VERSIÓN FINAL CORRECTA)
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {

    // 🔹 Cargar direcciones primero
    await cargarDirecciones();

    document.getElementById("selectDireccion")
        ?.addEventListener("change", cargarProyectos);

    // 🔥 CALENDARIO
    flatpickr("#fechaCorte", {
        dateFormat: "Y-m-d",
        locale: flatpickr.l10ns.es,
        maxDate: "today",
        onChange: function(selectedDates, dateStr) {
            cargarDatos();
        }
    });

    // 🔹 Ficha (persistencia)
    const input = document.getElementById("numeroFicha");

    if(input){
        input.addEventListener("input", (e)=>{
            localStorage.setItem("numeroFicha", e.target.value);
        });

        const num = localStorage.getItem("numeroFicha");
        if(num){
            input.value = num;
        }
    }

    // 🔥 RESET SELECT PROYECTO (SIN ROMPER EVENTOS)
    const selectProyecto = document.getElementById("selectProyecto");
    if(selectProyecto){
        $('#selectProyecto').val(null).trigger('change.select2'); // 👈 FIX
    }

    // 🔹 PROYECTO (Select2 compatible)
    $('#selectProyecto').on('change', function () {

        const proyecto_id = this.value;

        if(!proyecto_id){
            limpiarCampos();
            limpiarARC();
            return;
        }

        cargarInfoProyecto();
        cargarDatos();
    });

});

// =====================================================
// 🔄 CARGAR DATA DESDE BACKEND (VERSIÓN FINAL PRO FIX 🔥)
// =====================================================
async function cargarDatos(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    // 🔒 VALIDACIÓN
    if (!proyecto_id || !fecha){
        console.warn("Faltan filtros: proyecto o fecha");
        limpiarCampos();
        limpiarARC();
        return;
    }

    try{

        // =====================================================
        // 🔥 1. PRIMERO CARGA INFO DEL PROYECTO (CLAVE)
        // =====================================================
        await cargarInfoProyecto();

        // =====================================================
        // 🔥 2. LUEGO CARGA ARC
        // =====================================================
        const res = await fetch(`/api/arc/${proyecto_id}?fecha=${fecha}`);

        if(!res.ok){
            throw new Error("Error en la respuesta del servidor (ARC)");
        }

        let arcData = await res.json();

        console.log("DATA ARC:", arcData);

        // =====================================================
        // 🔥 VALIDACIÓN ARC (NO TOCAR FORMULARIO)
        // =====================================================
        if(!Array.isArray(arcData) || arcData.length === 0){

            console.warn("No hay data ARC para esta fecha");

            data = [];

            // 🔥 SOLO LIMPIA ARC (NO FORMULARIO)
            limpiarARC();

        }else{
            data = arcData;
            renderAll();
        }

    }catch(e){
        console.error("Error cargando datos:", e);

        limpiarCampos();
        limpiarARC();
    }

}


// =====================================================
// 🧹 LIMPIAR CAMPOS (FORMULARIO)
// =====================================================
function limpiarCampos(){

    const ids = [
        "direccion","subdireccion","coordinador",
        "cui","estado","modalidad",
        "inicio","fin","nuevaFecha",
        "presupuestoA","presupuestoAct",
        "avancePlan","avanceReal",
        "avanceFinPlan","avanceFinReal"
    ];

    ids.forEach(id=>{
        const el = document.getElementById(id);
        if(!el) return;

        if(el.tagName === "INPUT" || el.tagName === "SELECT"){
            el.value = "";
        }else{
            el.innerText = "-";
        }
    });

    // header también
    setText("codigoDSP", "-");
    setText("codigoProyecto", "-");
}


// =====================================================
// 🧹 LIMPIAR SOLO ARC (🔥 NUEVO - CLAVE)
// =====================================================
function limpiarARC(){

    const tabla = document.getElementById("tablaARC");
    const linea = document.getElementById("lineaARC");
    const gantt = document.getElementById("ganttGrid");

    if(tabla) tabla.innerHTML = "";
    if(linea) linea.innerHTML = "";
    if(gantt) gantt.innerHTML = "";
}

// =====================================================
// 🔁 RENDER GENERAL (SEGURO)
// =====================================================
function renderAll(){

    try{

        if(typeof renderARC === "function"){
            renderARC();
        }

        if(typeof renderTablaARC === "function"){
            renderTablaARC();
        }

        if(typeof renderGantt === "function"){
            renderGantt();
        }

        if(typeof renderSeguimiento === "function"){
            renderSeguimiento();
        }

        if(typeof renderNoRealizado === "function"){
            renderNoRealizado();
        }

        if(typeof renderProximo === "function"){
            renderProximo();
        }

        if(typeof initCamposFinales === "function"){
            initCamposFinales();
        }

        if(typeof renderActividades === "function"){
            renderActividades();
        }

        if(typeof renderActividadesAvanzadas === "function"){
            renderActividadesAvanzadas();
        }

        if(typeof cargarCamposFinales === "function"){
            cargarCamposFinales();
        }

        if(typeof cargarFirmas === "function"){
            cargarFirmas();
        }

    }catch(e){
        console.error("Error en renderAll:", e);
    }

}

// =====================================================
// ARC LINEA SUPERIOR
// =====================================================
function renderARC(){

    const cont = document.getElementById("lineaARC");
    if(!cont) return;

    cont.innerHTML = "";

    data.forEach((d, i) => {

        const div = document.createElement("div");
        div.className = "arc";

        div.innerHTML = `
            <span>ARC.${(i+1).toString().padStart(2,"0")}</span>
        `;

        cont.appendChild(div);
    });
}


// =====================================================
// TABLA ARC EDITABLE (VERSIÓN FINAL PRO 🔥)
// =====================================================
function renderTablaARC(){

    const cont = document.getElementById("tablaARC");
    if(!cont) return;

    cont.innerHTML = "";

    console.log("ARC DATA:", data);

    // 🔒 SIN DATA
    if(!Array.isArray(data) || data.length === 0){
        cont.innerHTML = `
            <tr>
                <td colspan="6" class="sin-data">
                    No hay ARC para este proyecto
                </td>
            </tr>
        `;
        return;
    }

    data.forEach((d, i)=>{

        const fila = document.createElement("tr");

        // 🔥 LIMPIEZA SEGURA (FIX REAL)
        const codigo = d.codigo_arc ?? "";

        const descripcion = (d.descripcion === null || d.descripcion === undefined)
            ? ""
            : d.descripcion;

        const inicio = formatoInputFecha(d.inicio_programado);
        const fin = formatoInputFecha(d.fin_programado);

        // 🔥 NUEVA FECHA
        const nuevaFecha = formatoInputFecha(d.nueva_fecha_fin);

        const riesgo = d.riesgo ?? "";

        fila.innerHTML = `
            <!-- Código ARC -->
            <td class="col-codigo">
                <input class="codigo" value="${codigo}" readonly>
            </td>

            <!-- Descripción -->
            <td class="col-descripcion">
                <textarea class="descripcion" placeholder="Sin descripción">${descripcion}</textarea>
            </td>

            <!-- Inicio -->
            <td>
                <input class="inicio" type="date" value="${inicio}">
            </td>

            <!-- Fin -->
            <td>
                <input class="fin" type="date" value="${fin}">
            </td>

            <!-- Nueva fecha fin -->
            <td class="highlight col-nueva">
                <input class="nueva_fecha" type="date" value="${nuevaFecha}">
            </td>

            <!-- Riesgo -->
            <td class="col-riesgo">
                <input class="riesgo" type="text" value="${riesgo}">
            </td>
        `;

        // =====================================================
        // 🔥 EVENTO AUTO-GUARDADO CON DEBOUNCE (FIX REAL)
        // =====================================================
        let timeout;

        fila.querySelectorAll("input, textarea").forEach(el=>{
            el.addEventListener("input", ()=>{

                clearTimeout(timeout);

                timeout = setTimeout(()=>{
                    guardarFila(i, fila);
                }, 600);

            });
        });

        cont.appendChild(fila);
    });
}

// =====================================================
// RENDER + GUARDADO PRO - FILA 6
// =====================================================

function renderActividades(){

    const cont = document.getElementById("tablaActividades");
    if(!cont) return;

    cont.innerHTML = "";

    if(!Array.isArray(data) || data.length === 0){
        cont.innerHTML = `
            <tr>
                <td colspan="2">Sin datos</td>
            </tr>
        `;
        return;
    }

    data.forEach((d, i)=>{

        const fila = document.createElement("tr");

        const codigo = d.codigo_arc ?? "";
        const actividad = d.actividades_mes ?? "";

        fila.innerHTML = `
            <td class="col-codigo">
                <input value="${codigo}" readonly>
            </td>

            <td>
                <textarea class="actividad">${actividad}</textarea>
            </td>
        `;

        // 🔥 AUTOGUARDADO
        fila.querySelector(".actividad").addEventListener("input", ()=>{
            guardarActividad(i, fila);
        });

        cont.appendChild(fila);
    });
}

// =====================================================
// 🔥 FILAS 7 Y 8 (VERSIÓN FINAL PRO 🔥)
// =====================================================
function renderActividadesAvanzadas(){

    const tablaPasadas = document.getElementById("tablaActividadesPasadas");
    const tablaFuturas = document.getElementById("tablaActividadesFuturas");

    if(!tablaPasadas || !tablaFuturas) return;

    tablaPasadas.innerHTML = "";
    tablaFuturas.innerHTML = "";

    const hoy = new Date();

    data.forEach((d, i)=>{

        const codigo = d.codigo_arc ?? "";
        const actividad = d.actividades_mes ?? "";
        const estado = d.estado ?? "En proceso"; // 🔥 default nuevo

        const fechaInicio = d.inicio_programado
            ? new Date(d.inicio_programado)
            : null;

        // ================= PASADAS =================
        if(!fechaInicio || fechaInicio <= hoy){

            const tr = document.createElement("tr");

            const tdCodigo = document.createElement("td");
            tdCodigo.className = "col-codigo";
            tdCodigo.textContent = codigo;
            tdCodigo.setAttribute("data-label", "Código ARC");

            const tdActividad = document.createElement("td");
            tdActividad.setAttribute("data-label", "Actividad");
            tdActividad.innerHTML = `<textarea class="actividad">${actividad}</textarea>`;

            const tdEstado = document.createElement("td");
            tdEstado.className = "col-estado";
            tdEstado.setAttribute("data-label", "Estado");

            // 🔥 SELECT EDITABLE
            tdEstado.innerHTML = `
                <select class="estado-select">
                    <option value="En proceso" ${estado === "En proceso" ? "selected" : ""}>En proceso</option>
                    <option value="Concluida" ${estado === "Concluida" ? "selected" : ""}>Concluida</option>
                </select>
            `;

            tr.appendChild(tdCodigo);
            tr.appendChild(tdActividad);
            tr.appendChild(tdEstado);

            // =====================================================
            // 🔥 COLOR DINÁMICO (NUEVO)
            // =====================================================
            function aplicarColor(){

                const val = tdEstado.querySelector(".estado-select").value;

                tr.classList.remove("fila-pendiente");

                if(val === "En proceso"){
                    tr.classList.add("fila-pendiente"); // 🔴 rojo
                }

                if(val === "Concluida"){
                    tdEstado.querySelector(".estado-select").classList.add("estado-ok");
                } else {
                    tdEstado.querySelector(".estado-select").classList.remove("estado-ok");
                }
            }

            aplicarColor();

            // 🔥 CAMBIO EN TIEMPO REAL
            tdEstado.querySelector(".estado-select").addEventListener("change", ()=>{
                aplicarColor();
                guardarEstado(i, tr); // 🔥 ACTIVAR
            });

            // 🔥 FIX: usar índice (NO codigo_arc)
            tr.querySelector(".actividad").addEventListener("input", ()=>{
                guardarActividad(i, tr);
            });

            tablaPasadas.appendChild(tr);
        }

        // ================= FUTURAS =================
        if(fechaInicio && fechaInicio > hoy){

            const tr = document.createElement("tr");

            const tdCodigo = document.createElement("td");
            tdCodigo.className = "col-codigo";
            tdCodigo.textContent = codigo;
            tdCodigo.setAttribute("data-label", "Código ARC");

            const tdActividad = document.createElement("td");
            tdActividad.setAttribute("data-label", "Actividad");
            tdActividad.innerHTML = `<textarea class="actividad">${actividad}</textarea>`;

            tr.appendChild(tdCodigo);
            tr.appendChild(tdActividad);

            // 🔥 ya estaba bien (NO TOCAR)
            tr.querySelector(".actividad").addEventListener("input", ()=>{
                guardarActividad(i, tr);
            });

            tablaFuturas.appendChild(tr);
        }

    });
}

// =====================================================
// 💾 GUARDAR FILA ARC (VERSIÓN FINAL PRO 🔥)
// =====================================================
async function guardarFila(index, fila){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = fechaGlobal || document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha){
        console.warn("Falta proyecto o fecha");
        return;
    }

    // 🔥 NUEVO: CAMPOS A BORRAR INTENCIONALMENTE
    const clear_fields = [];

    // 🔥 INPUTS
    const nuevaFechaInput = fila.querySelector(".nueva_fecha");
    const riesgoInput = fila.querySelector(".riesgo");

    const nuevaFechaRaw = nuevaFechaInput?.value?.trim();
    let riesgo = riesgoInput?.value?.trim();

    // =====================================================
    // 🔥 FECHA: SI ESTÁ VACÍA → BORRAR
    // =====================================================
    const nueva_fecha_fin = nuevaFechaRaw || null;

    if(!nuevaFechaRaw){
        clear_fields.push("nueva_fecha_fin");
    }

    // =====================================================
    // 🔥 RIESGO: MISMA LÓGICA QUE PROYECTO
    // =====================================================
    if(riesgo === "-"){
        clear_fields.push("riesgo");
        riesgo = null;
    }else if(riesgo === ""){
        riesgo = undefined; // mantiene comportamiento actual
    }

    // =====================================================
    // 🔥 ARMADO DINÁMICO (NO SOBREESCRIBE CAMPOS)
    // =====================================================
    const arc = {
        codigo_arc: fila.querySelector(".codigo").value,
        descripcion: fila.querySelector(".descripcion").value,
        inicio_programado: fila.querySelector(".inicio").value || null,
        fin_programado: fila.querySelector(".fin").value || null,
        nueva_fecha_fin: nueva_fecha_fin
    };

    // 🔥 SOLO AGREGA riesgo SI EXISTE
    if(riesgo !== undefined){
        arc.riesgo = riesgo;
    }

    console.log("Enviando ARC:", arc, "clear_fields:", clear_fields);

    try{

        const res = await fetch("/api/guardar-todo", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                proyecto_id: parseInt(proyecto_id),
                fecha_corte: fecha,
                arcs: [arc],
                _clear_fields: clear_fields   // 🔥 NUEVO
            })
        });

        if(!res.ok){
            throw new Error("Error en respuesta del servidor");
        }

        const r = await res.json();

        console.log("Guardado:", r);

        // =====================================================
        // 🔥 ACTUALIZAR DATA LOCAL (FIX REAL SIN BORRAR)
        // =====================================================
        if(data[index]){

            // 🔥 SIEMPRE actualizar fecha (aunque sea null)
            data[index].nueva_fecha_fin = arc.nueva_fecha_fin;

            // 🔥 SOLO actualizar riesgo si vino en el request
            if(arc.hasOwnProperty("riesgo")){
                data[index].riesgo = arc.riesgo;
            }

            // 🔥 SI SE BORRÓ EXPLÍCITAMENTE
            if(clear_fields.includes("riesgo")){
                data[index].riesgo = null;
            }

            if(clear_fields.includes("nueva_fecha_fin")){
                data[index].nueva_fecha_fin = null;
            }

            // 🔥 NO tocar si no vino
        }

    }catch(e){
        console.error("Error guardando ARC", e);
    }
}

// =====================================================
// GUARDAR ACTIVIDADES - FILA 6
// =====================================================

async function guardarActividad(index, fila){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = fechaGlobal || document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha) return;

    // 🔥 FIX: evitar índice inválido (SIN ROMPER LÓGICA)
    if(!data || !data[index]){
        console.warn("Índice inválido en guardarActividad:", index);
        return;
    }

    const clear_fields = [];

    let actividad = fila.querySelector(".actividad")?.value?.trim();

    // 🔥 BORRADO INTENCIONAL
    if(actividad === "-"){
        clear_fields.push("actividades_mes");
        actividad = null;
    }else if(actividad === ""){
        actividad = undefined;
    }

    const arc = {
        codigo_arc: data[index].codigo_arc
    };

    if(actividad !== undefined){
        arc.actividades_mes = actividad;
    }

    try{

        await fetch("/api/guardar-todo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                proyecto_id: parseInt(proyecto_id),
                fecha_corte: fecha,
                arcs: [arc],
                _clear_fields: clear_fields
            })
        });

        // 🔥 actualizar local (MISMA LÓGICA)
        if(data[index]){
            if(clear_fields.includes("actividades_mes")){
                data[index].actividades_mes = null;
            }else if(arc.hasOwnProperty("actividades_mes")){
                data[index].actividades_mes = arc.actividades_mes;
            }
        }

    }catch(e){
        console.error("Error actividad", e);
    }
}

// =====================================================
// GANTT
// =====================================================
function renderGantt(){

    const cont = document.getElementById("ganttGrid");
    const header = document.getElementById("ganttHeader");

    if(!cont || !header) return;

    cont.innerHTML = "";
    header.innerHTML = "";

    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

    for(let year = 2026; year <= 2028; year++){
        meses.forEach((m,i)=>{
            const div = document.createElement("div");
            div.className = "mes";
            div.style.left = ((year-2026)*12*80 + i*80) + "px";
            div.innerText = m;
            header.appendChild(div);
        });
    }

    data.forEach((d,i)=>{

        if(!d.inicio_programado || !d.fin_programado) return;

        const ini = new Date(d.inicio_programado);
        const fin = new Date(d.fin_programado);

        const baseYear = 2026;

        const x1 = ((ini.getFullYear()-baseYear)*12 + ini.getMonth()) * 80;
        const x2 = ((fin.getFullYear()-baseYear)*12 + fin.getMonth()) * 80;

        const barra = document.createElement("div");
        barra.className = "barra";

        barra.style.left = x1 + "px";
        barra.style.width = (x2 - x1 + 80) + "px";
        barra.style.top = (i * 30 + 50) + "px";

        cont.appendChild(barra);
    });
}


// =====================================================
// 📅 FORMATO FECHA PARA INPUT (VERSIÓN FINAL PRO 🔥)
// =====================================================
function formatoInputFecha(fecha){

    // 🔒 NULL / VACÍO
    if(!fecha || fecha === "") return "";

    try{

        const str = String(fecha);

        // 🔥 CASOS BASURA DE BD
        if(
            str === "0001-01-01" ||
            str.startsWith("0001-01-01") ||
            str.toLowerCase() === "null"
        ){
            return "";
        }

        // 🔥 SI YA VIENE BIEN (YYYY-MM-DD)
        if(/^\d{4}-\d{2}-\d{2}$/.test(str)){
            return str;
        }

        // 🔥 SI VIENE ISO (2026-03-16T00:00:00)
        if(str.includes("T")){
            return str.split("T")[0];
        }

        // 🔥 ÚLTIMO INTENTO (solo si es necesario)
        const f = new Date(str);

        if(isNaN(f.getTime())) return "";

        const year  = f.getFullYear();
        const month = String(f.getMonth() + 1).padStart(2, "0");
        const day   = String(f.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;

    }catch(e){
        console.warn("Error formateando fecha:", fecha);
        return "";
    }
}

// =====================================================
// FIRMA
// =====================================================
function previewFirma(event, index){
    const file = event.target.files[0];
    if(!file) return;

    const reader = new FileReader();

    reader.onload = function(e){
        document.getElementById("imgFirma"+index).src = e.target.result;
    }

    reader.readAsDataURL(file);
}


// =====================================================
// RESTO (SIN CAMBIOS)
// =====================================================
// renderSeguimiento()
// renderNoRealizado()
// renderProximo()
// guardarTexto()
// etc.

// ================= DIRECCIONES =================
async function cargarDirecciones(){

    const res = await fetch("/api/direcciones");
    const response = await res.json();

    const dirs = Array.isArray(response) ? response : response.data || [];

    const select = document.getElementById("selectDireccion");

    if(!select) return;

    select.innerHTML = `<option value="">Seleccione dirección</option>`;

    dirs.forEach(d=>{
        select.innerHTML += `<option value="${d.id}">${d.nombre}</option>`;
    });
}


// ================= PROYECTOS =================
async function cargarProyectos(){

    const direccion_id = document.getElementById("selectDireccion")?.value;

    const select = document.getElementById("selectProyecto");

    if(!direccion_id){

        // 🔥 LIMPIAR SI NO HAY DIRECCIÓN
        select.innerHTML = `<option value="">Seleccione proyecto</option>`;

        if ($('#selectProyecto').hasClass("select2-hidden-accessible")) {
            $('#selectProyecto').val(null).trigger('change');
        }

        return;
    }

    try{

        const res = await fetch(`/api/proyectos?direccion_id=${direccion_id}`);

        if(!res.ok){
            throw new Error("Error cargando proyectos");
        }

        const proyectos = await res.json();

        // 🔥 RESET
        select.innerHTML = `<option value="">Seleccione proyecto</option>`;

        proyectos.forEach(p=>{
            select.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });

        // 🔥 DESTRUIR SELECT2 SI EXISTE
        if ($('#selectProyecto').hasClass("select2-hidden-accessible")) {
            $('#selectProyecto').select2('destroy');
        }

        // 🔥 REINICIALIZAR SELECT2
        $('#selectProyecto').select2({
            placeholder: "Seleccione proyecto",
            width: '100%',
            dropdownParent: $('.fila2')
        });

        // 🔥 LIMPIAR SELECCIÓN (CLAVE PARA FILTRO)
        $('#selectProyecto').val(null).trigger('change');

    }catch(e){
        console.error("Error cargando proyectos:", e);

        select.innerHTML = `<option value="">Error cargando</option>`;
    }
}

// =====================================================
// 📊 CARGAR INFO PROYECTO (FINAL PRO COMPLETO 🔥)
// =====================================================
async function cargarInfoProyecto(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fechaRaw = document.getElementById("fechaCorte")?.value;

    if(!proyecto_id){
        console.warn("No hay proyecto seleccionado");
        return;
    }

    // 🔥 LIMPIAR FECHA (CLAVE REAL DEL BUG)
    const fecha = fechaRaw ? fechaRaw.split("T")[0] : "";

    let url = `/api/proyecto/${proyecto_id}`;
    if(fecha){
        url += `?fecha=${fecha}`;
    }

    try{

        const res = await fetch(url);

        if(!res.ok){
            throw new Error("Error en la respuesta del servidor");
        }

        const p = await res.json();

        console.log("DATA:", p);

        // =====================================================
        // ❌ SIN DATA → LIMPIA TODO
        // =====================================================
        if(!p || Object.keys(p).length === 0){
            console.warn("No hay data para esta fecha");
            limpiarCampos();
            return;
        }

        // =====================================================
        // 🧾 HEADER
        // =====================================================
        setText("codigoDSP", p.codigo_dsp);
        setText("codigoProyecto", p.codigo_dsp);

        // =====================================================
        // 🧩 CAMPOS EDITABLES (MAPEO REAL BD)
        // =====================================================
        setInput("direccion", p.direccion_id);
        setInput("subdireccion", p.subdireccion || "");
        setInput("coordinador", p.coordinador || "");

        // =====================================================
        // 🔥 BASICOS
        // =====================================================
        setInput("cui", p.cui || "");
        setInput("estado", p.estado || "");
        setInput("modalidad", p.modalidad || "");

        // =====================================================
        // 🔥 FECHAS (CORRECTAS)
        // =====================================================
        setFecha("inicio", p.fecha_inicio_programado);
        setFecha("fin", p.fecha_fin_programado);
        setFecha("nuevaFecha", p.fecha_conclusion_real);

        // =====================================================
        // 🔥 PRESUPUESTOS (FIX REAL 🔥)
        // =====================================================
        setInput("presupuestoA", p.presupuesto_programado ?? 0);
        setInput("presupuestoAct", p.presupuesto_actualizado ?? 0);

        // =====================================================
        // 🔥 AVANCE FÍSICO
        // =====================================================
        setInput("avancePlan", p.avance_programado ?? p.avance_prog ?? 0);
        setInput("avanceReal", p.avance_fisico ?? p.avance_real ?? 0);

        // =====================================================
        // 🔥 AVANCE FINANCIERO (CLAVE 🔥)
        // =====================================================
        setInput("avanceFinPlan", p.avance_financiero_programado ?? 0);
        setInput("avanceFinReal", p.avance_financiero_real ?? 0);

        }catch(e){
            console.error("Error cargando proyecto:", e);
            limpiarCampos();
        }
}


// =====================================================
// 🔧 FUNCIONES AUXILIARES (VERSIÓN FINAL REAL)
// =====================================================

// 🔹 texto (span/div)
function setText(id, valor){
    const el = document.getElementById(id);
    if(!el) return;

    el.innerText = (valor !== null && valor !== undefined && valor !== "")
        ? valor
        : "-";
}

// 🔹 inputs / selects
function setInput(id, valor){
    const el = document.getElementById(id);
    if(!el) return;

    el.value = (valor !== null && valor !== undefined)
        ? valor
        : "";
}

// 🔹 fechas limpias (SET desde backend → UI)
function setFecha(id, fecha){
    const el = document.getElementById(id);
    if(!el) return;

    // 🔥 limpiar casos inválidos
    if(
        !fecha ||
        fecha === "" ||
        fecha === "0001-01-01" ||
        (typeof fecha === "string" && fecha.startsWith("0001-01-01"))
    ){
        el.value = "";
        return;
    }

    // 🔥 asegurar formato YYYY-MM-DD
    el.value = fecha.split("T")[0];
}

// 🔹 obtener fecha (UI → backend)
function getFecha(id){
    const el = document.getElementById(id);
    if(!el) return null;

    let val = el.value;

    // 🔥 limpiar vacíos
    if(!val || val.trim() === ""){
        return null;
    }

    val = val.trim();

    // 🔥 evitar fechas basura
    if(val === "0001-01-01" || val.startsWith("0001-01-01")){
        return null;
    }

    return val; // formato YYYY-MM-DD
}


// =====================================================
// 🧹 LIMPIAR CAMPOS
// =====================================================
function limpiarCampos(){

    const ids = [
        "direccion","subdireccion","coordinador",
        "cui","estado","modalidad",
        "inicio","fin","nuevaFecha",
        "presupuestoA","presupuestoAct",
        "avancePlan","avanceReal",
        "avanceFinPlan","avanceFinReal"
    ];

    ids.forEach(id=>{
        const el = document.getElementById(id);
        if(!el) return;

        if(el.tagName === "INPUT" || el.tagName === "SELECT"){
            el.value = "";
        }else{
            el.innerText = "-";
        }
    });

    // header también
    setText("codigoDSP", "-");
    setText("codigoProyecto", "-");
}
// ================= FORMATOS =================

function formatearFecha(f){
    if(!f) return "-";
    return new Date(f).toLocaleDateString("es-PE");
}

function formatearMoneda(v){
    if(!v) return "S/ 0.00";
    return "S/ " + Number(v).toLocaleString("es-PE", {
        minimumFractionDigits: 2
    });
}

function formatearPorcentaje(v){
    if(v == null) return "0%";
    return `${Number(v).toFixed(1)}%`;
}

// ================= COLORES AUTOMATICOS =================

function pintarEstado(valor){

    const el = document.getElementById("estado");
    el.className = ""; // reset

    if(!valor) return;

    const v = valor.toLowerCase();

    if(v.includes("ejec")){
        el.style.background = "#d1e7dd";
        el.style.color = "#0f5132";
    }else if(v.includes("paral")){
        el.style.background = "#f8d7da";
        el.style.color = "#842029";
    }else{
        el.style.background = "#e2e3e5";
        el.style.color = "#41464b";
    }

    el.style.padding = "3px 6px";
    el.style.borderRadius = "4px";
}

// ================= FILTRO PROYECTO FILA 2 ==========================
function activarSelectProyecto(){

    $('#selectProyecto').select2({
        placeholder: "Seleccione proyecto",
        width: '100%',
        dropdownParent: $('.fila2')   
    });

}

// ================= GUARDAR CAMBIOS FILA 4 ==========================

// =====================================================
// 🔧 HELPERS (NO BORRAN NADA, SOLO LIMPIAN)
// =====================================================
function limpiarTexto(valor){
    if(valor === undefined || valor === null) return null;
    const v = valor.trim();
    return v === "" ? null : v;
}

function limpiarNumero(valor){
    if(valor === undefined || valor === null) return null;
    const v = parseFloat(valor);
    return isNaN(v) ? null : v;
}

// 🔥 NUEVO: DETECTAR BORRADO INTENCIONAL
function procesarCampoTexto(valor, campo, clear_fields){
    if(valor === undefined || valor === null) return null;

    const v = valor.trim();

    // 🔥 si usuario escribe "-" => borrar intencional
    if(v === "-"){
        clear_fields.push(campo);
        return null;
    }

    return v === "" ? null : v;
}

// =====================================================
// 🔥 NUEVO: SOPORTE "-" PARA NÚMEROS (SIN TOCAR TU LÓGICA)
// =====================================================
function procesarNumero(valor, campo, clear_fields){
    if(valor === undefined || valor === null) return null;

    const v = String(valor).trim();

    if(v === "-"){
        clear_fields.push(campo);
        return null;
    }

    const num = parseFloat(v);
    return isNaN(num) ? null : num;
}

// =====================================================
// 🔥 NUEVO: SOPORTE "-" PARA FECHAS (SIN TOCAR TU LÓGICA)
// =====================================================
function procesarFecha(valor, campo, clear_fields){
    if(valor === undefined || valor === null) return null;

    const v = String(valor).trim();

    if(v === "-"){
        clear_fields.push(campo);
        return null;
    }

    return valor; // respeta tu flujo actual
}

// =====================================================
// 💾 GUARDAR REPORTE D (VERSIÓN FINAL REAL)
// =====================================================
async function guardarReporte(){

    try{

        const proyecto_id = document.getElementById("selectProyecto")?.value;
        let fecha = document.getElementById("fechaCorte")?.value;

        if(!proyecto_id || !fecha){
            mostrarMensaje("Selecciona proyecto y fecha", true);
            return;
        }

        // =====================================================
        // 🔥 POPUP PARA ELEGIR FECHA (CLAVE)
        // =====================================================
        const fechaElegida = prompt(
            "¿En qué fecha deseas guardar este reporte? (YYYY-MM-DD)",
            fecha
        );

        if(!fechaElegida){
            mostrarMensaje("Guardado cancelado", true);
            return;
        }

        // 🔥 usar la nueva fecha elegida
        fecha = fechaElegida;

        // 🔥🔥🔥 FIX CRÍTICO (SIN ESTO TODO FALLA)
        document.getElementById("fechaCorte").value = fecha;

        // 🔥🔥🔥 NUEVO (NO ROMPE NADA - VARIABLE GLOBAL)
        fechaGlobal = fecha;

        // 🔥 NUEVO: lista de campos a borrar intencionalmente
        const clear_fields = [];

        const inicioInput = document.getElementById("inicio")?.value;
        const finInput = document.getElementById("fin")?.value;
        const conclusionInput = document.getElementById("nuevaFecha")?.value;

        const fInicio = getFecha("inicio");
        const fFin = getFecha("fin");
        const fConclusion = getFecha("nuevaFecha");

        // 🔥 DETECCIÓN REAL (INPUT VACÍO)
        if(!inicioInput) clear_fields.push("fecha_inicio_programado");
        if(!finInput) clear_fields.push("fecha_fin_programado");
        if(!conclusionInput) clear_fields.push("fecha_conclusion_real");

        const data = {
            proyecto_id: parseInt(proyecto_id),
            fecha_corte: fecha,

            codigo_dsp: limpiarTexto(document.getElementById("codigoDSP")?.innerText),
            unidad: limpiarTexto(document.getElementById("unidad")?.innerText),

            direccion_id: document.getElementById("selectDireccion")?.value || null,

            subdireccion: procesarCampoTexto(document.getElementById("subdireccion")?.value, "subdireccion", clear_fields),
            coordinador: procesarCampoTexto(document.getElementById("coordinador")?.value, "coordinador", clear_fields),

            cui: procesarCampoTexto(document.getElementById("cui")?.value, "cui", clear_fields),
            estado: procesarCampoTexto(document.getElementById("estado")?.value, "estado", clear_fields),
            modalidad: procesarCampoTexto(document.getElementById("modalidad")?.value, "modalidad", clear_fields),

            // 🔥 FECHAS
            fecha_inicio_programado: fInicio,
            fecha_fin_programado: fFin,
            fecha_conclusion_real: fConclusion,

            // 🔥 NÚMEROS
            presupuesto_programado: procesarNumero(document.getElementById("presupuestoA")?.value, "presupuesto_programado", clear_fields),
            presupuesto_actualizado: procesarNumero(document.getElementById("presupuestoAct")?.value, "presupuesto_actualizado", clear_fields),

            avance_programado: procesarNumero(document.getElementById("avancePlan")?.value, "avance_programado", clear_fields),
            avance_fisico: procesarNumero(document.getElementById("avanceReal")?.value, "avance_fisico", clear_fields),

            avance_financiero_programado: procesarNumero(document.getElementById("avanceFinPlan")?.value, "avance_financiero_programado", clear_fields),
            avance_financiero_real: procesarNumero(document.getElementById("avanceFinReal")?.value, "avance_financiero_real", clear_fields),

            _clear_fields: clear_fields
        };

        // =====================================================
        // 🔥 ENVOLVER DATA (NUEVO ENDPOINT)
        // =====================================================
        const payload = {
            proyecto_id: data.proyecto_id,
            fecha_corte: data.fecha_corte,
            reporte: data,
            arcs: (data && data.length > 0) ? data : (window.data || []),
            campos_finales: {
                acuerdos: document.getElementById("acuerdos")?.value,
                otros: document.getElementById("otros")?.value,
                urgentes: document.getElementById("urgentes")?.value
            },
            firmas: {
                cargo1: document.getElementById("cargo1")?.value,
                nombre1: document.getElementById("nombre1")?.value,
                cargo2: document.getElementById("cargo2")?.value,
                nombre2: document.getElementById("nombre2")?.value,
                cargo3: document.getElementById("cargo3")?.value,
                nombre3: document.getElementById("nombre3")?.value
            },
            _clear_fields: data._clear_fields || []
        };

        // =====================================================
        // ENVÍO REAL AL BACKEND
        // =====================================================
        const res = await fetch("/api/guardar-todo", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if(!res.ok){
            throw new Error("Error en respuesta del servidor");
        }

        const r = await res.json();

        console.log("Guardado:", r);

        mostrarMensaje("Información actualizada correctamente");

        // =====================================================
        // REFRESH CONTROLADO
        // =====================================================
        await cargarDatos();

        // 🔥 IMPORTANTE
        fechaGlobal = null;

    }catch(e){
        console.error(e);
        mostrarMensaje("Error al guardar: " + e.message, true);
    }
}

// =====================================================
// MENSAJE VISUAL (UX PRO)
// =====================================================

function mostrarMensaje(texto, error=false){

    const msg = document.createElement("div");

    msg.innerText = texto;

    msg.style.position = "fixed";
    msg.style.top = "20px";
    msg.style.right = "20px";
    msg.style.padding = "10px 15px";
    msg.style.borderRadius = "8px";
    msg.style.color = "#fff";
    msg.style.fontSize = "13px";
    msg.style.zIndex = "9999";

    msg.style.background = error ? "#c62828" : "#2e7d32";

    document.body.appendChild(msg);

    setTimeout(()=>{
        msg.remove();
    }, 3000);
}

// =====================================================
// 📄 EXPORTAR PDF
// =====================================================
function exportarPDF(){
    window.print();
}

// =====================================================
// 📅 OBTENER FECHA (VERSIÓN FINAL REAL)
// =====================================================
function getFecha(id){
    const el = document.getElementById(id);
    if(!el) return null;

    let val = el.value;

    // 🔥 limpiar
    if(!val || val.trim() === ""){
        return null;
    }

    val = val.trim();

    // 🔥 evitar fechas basura
    if(val === "0001-01-01" || val.startsWith("0001-01-01")){
        return null;
    }

    return val; // formato YYYY-MM-DD
}

// =====================================================
// 🔥 GUARDAR ESTADO
// =====================================================
async function guardarEstado(index, fila){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = fechaGlobal || document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha) return;

    const estado = fila.querySelector(".estado-select")?.value;

    const arc = {
        codigo_arc: data[index].codigo_arc,
        estado_arc: estado   // 🔥 FIX REAL
    };

    try{

        await fetch("/api/guardar-todo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                proyecto_id: parseInt(proyecto_id),
                fecha_corte: fecha,
                arcs: [arc]
            })
        });

        // 🔥 actualizar local
        if(data[index]){
            data[index].estado = estado;
        }

    }catch(e){
        console.error("Error estado", e);
    }
}

// =====================================================
// 🔥 GUARDAR CAMPOS FINALES (VERSIÓN FINAL PRO)
// =====================================================
async function guardarCamposFinales(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha) return;

    let acuerdos = document.getElementById("acuerdos")?.value?.trim();
    let otros = document.getElementById("otros")?.value?.trim();
    let urgentes = document.getElementById("urgentes")?.value?.trim();

    const clear_fields = [];

    // =====================================================
    // 🔥 BORRADO INTENCIONAL
    // =====================================================
    if(acuerdos === "-"){
        acuerdos = null;
        clear_fields.push("acuerdos");
    }else if(acuerdos === ""){
        acuerdos = undefined;
    }

    if(otros === "-"){
        otros = null;
        clear_fields.push("otros");
    }else if(otros === ""){
        otros = undefined;
    }

    if(urgentes === "-"){
        urgentes = null;
        clear_fields.push("urgentes");
    }else if(urgentes === ""){
        urgentes = undefined;
    }

    const payload = {
        proyecto_id: parseInt(proyecto_id),
        fecha_corte: fecha,
        _clear_fields: clear_fields
    };

    // 🔥 SOLO ENVÍA SI EXISTE (NO SOBREESCRIBE CON VACÍO)
    if(acuerdos !== undefined) payload.acuerdos = acuerdos;
    if(otros !== undefined) payload.otros = otros;
    if(urgentes !== undefined) payload.urgentes = urgentes;

    try{
        await fetch("/api/guardar-todo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        console.log("Campos finales guardados");

        // 🔥 CLAVE: refrescar desde BD (evita datos “pegados”)
        await cargarCamposFinales();

    }catch(e){
        console.error("Error campos finales", e);
    }
}


// =====================================================
// 🔥 CARGAR CAMPOS FINALES (DESDE BACKEND)
// =====================================================
async function cargarCamposFinales(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha) return;

    try{

        const res = await fetch(`/api/campos-finales/${proyecto_id}?fecha=${fecha}`);
        const data = await res.json();

        renderCamposFinales(data);

    }catch(e){
        console.error("Error cargando campos finales", e);
    }
}


// =====================================================
// 🔥 RENDER CAMPOS FINALES
// =====================================================
function renderCamposFinales(data){

    document.getElementById("acuerdos").value = data?.acuerdos ?? "";
    document.getElementById("otros").value = data?.otros ?? "";
    document.getElementById("urgentes").value = data?.urgentes ?? "";
}


// =====================================================
// 🔥 INIT CAMPOS FINALES
// =====================================================
function initCamposFinales(){

    ["acuerdos","otros","urgentes"].forEach(id=>{

        const el = document.getElementById(id);
        if(!el) return;

        let timeout;

        el.addEventListener("input", ()=>{

            clearTimeout(timeout);

            timeout = setTimeout(()=>{
                guardarCamposFinales();
            }, 800);

        });

    });
}

// =====================================================
// 🔥 CLICK INPUT FILE
// =====================================================
function clickFirma(i){
    console.log("CLICK FIRMA", i);
    document.getElementById("fileFirma"+i).click();
}

// =====================================================
// 🔥 SUBIR FIRMA (FINAL PRO)
// =====================================================
async function subirFirma(event, i){

    console.log("ENTRO A SUBIR FIRMA", i);

    const file = event.target.files[0];

    if(!file){
        console.warn("No hay archivo");
        return;
    }

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha){
        console.warn("Faltan filtros");
        alert("Selecciona proyecto y fecha");
        return;
    }

    document.activeElement.blur();

    // 🔥 INPUTS
    const cargoInput = document.getElementById("cargo"+i);
    const nombreInput = document.getElementById("nombre"+i);

    let cargo = cargoInput ? cargoInput.value.trim() : "";
    let nombre = nombreInput ? nombreInput.value.trim() : "";

    // 🔥 NUEVO (IGUAL QUE ARC)
    if(cargo === "-") cargo = null;
    if(nombre === "-") nombre = null;

    console.log(">>> cargo:", cargo);
    console.log(">>> nombre:", nombre);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("proyecto_id", proyecto_id);
    formData.append("fecha_corte", fecha);
    formData.append("firma_num", i);
    formData.append("cargo", cargo);
    formData.append("nombre", nombre);

    try{

        console.log("LLAMANDO API /api/subir-firma");

        const res = await fetch("/api/subir-firma", {
            method: "POST",
            body: formData
        });

        console.log("STATUS:", res.status);

        if(!res.ok){
            const txt = await res.text();
            console.error("ERROR BACKEND:", txt);
            throw new Error("Error en servidor");
        }

        const data = await res.json();

        console.log("RESPUESTA:", data);

        const img = document.getElementById("imgFirma"+i);
        if(img){
            img.src = data.url + "?t=" + new Date().getTime();
        }

        event.target.value = "";

    }catch(e){
        console.error("💣 Error subiendo firma", e);
        alert("Error al subir firma");
    }
}

// =====================================================
// 🔥 GUARDAR SOLO TEXTOS (CLAVE 🔥)
// =====================================================
async function guardarFirmasTexto(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha) return;

    const payload = {
        proyecto_id: parseInt(proyecto_id),
        fecha_corte: fecha,

        cargo1: document.getElementById("cargo1")?.value || null,
        nombre1: document.getElementById("nombre1")?.value || null,

        cargo2: document.getElementById("cargo2")?.value || null,
        nombre2: document.getElementById("nombre2")?.value || null,

        cargo3: document.getElementById("cargo3")?.value || null,
        nombre3: document.getElementById("nombre3")?.value || null
    };

    try{
        await fetch("/api/guardar-todo", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify(payload)
        });

        console.log("✅ Textos firmas guardados");

    }catch(e){
        console.error("Error guardando textos firmas", e);
    }
}

// =====================================================
// 🔥 CARGAR FIRMAS (FINAL PRO)
// =====================================================
async function cargarFirmas(){

    const proyecto_id = document.getElementById("selectProyecto")?.value;
    const fecha = document.getElementById("fechaCorte")?.value;

    if(!proyecto_id || !fecha) return;

    try{

        const res = await fetch(`/api/firmas/${proyecto_id}?fecha=${fecha}`);
        if(!res.ok){
            console.warn("No se pudo cargar firmas");
            return;
        }

        const data = await res.json();

        ["cargo1","nombre1","cargo2","nombre2","cargo3","nombre3"].forEach(id=>{
            const el = document.getElementById(id);
            if(el){
                el.value = data[id] ?? "";
            }
        });

        for(let i=1;i<=3;i++){

            const img = document.getElementById("imgFirma"+i);

            if(!img) continue;

            if(data["firma"+i]){
                img.src = data["firma"+i] + "?t=" + new Date().getTime();
            }else{
                img.src = "";
            }
        }

    }catch(e){
        console.error("Error cargando firmas", e);
    }
}

// =====================================================
// 🔥 FIX EVENTO INPUT FILE
// =====================================================
document.addEventListener("DOMContentLoaded", () => {

    [1,2,3].forEach(i => {

        const input = document.getElementById("fileFirma"+i);

        if(!input) return;

        input.addEventListener("change", (e) => {

            console.log("🔥 CHANGE DETECTADO", i);

            subirFirma(e, i);
        });

    });

    // 🔥 AUTO GUARDADO DE TEXTOS (CLAVE 🔥)
    ["cargo1","nombre1","cargo2","nombre2","cargo3","nombre3"].forEach(id=>{

        const el = document.getElementById(id);
        if(!el) return;

        let t;

        el.addEventListener("input", ()=>{
            clearTimeout(t);
            t = setTimeout(()=> guardarFirmasTexto(), 800);
        });

    });

});