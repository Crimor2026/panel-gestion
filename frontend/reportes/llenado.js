// =====================================================
// VARIABLES GLOBALES
// =====================================================
let data = [];


// =====================================================
// INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {

    await cargarProyectos();

    document.getElementById("selectProyecto")
        ?.addEventListener("change", cargarDatos);

    document.getElementById("fechaCorte")
        ?.addEventListener("change", cargarDatos);

});


// =====================================================
// 🔹 CARGAR PROYECTOS
// =====================================================
async function cargarProyectos(){

    try{
        const res = await fetch("/api/proyectos");
        const proyectos = await res.json();

        const select = document.getElementById("selectProyecto");

        select.innerHTML = "<option value=''>Seleccione...</option>";

        proyectos.forEach(p=>{
            select.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
        });

    }catch(e){
        console.error("Error cargando proyectos", e);
    }
}


// =====================================================
// 🔹 CARGAR DATOS (ARC + ACTIVIDADES)
// =====================================================
async function cargarDatos(){

    const proyecto_id = document.getElementById("selectProyecto").value;
    const fecha = document.getElementById("fechaCorte").value;

    if (!proyecto_id || !fecha) return;

    try{

        const res = await fetch(`/api/arc/${proyecto_id}?fecha=${fecha}`);
        data = await res.json();

        renderAll();

    }catch(e){
        console.error("Error cargando datos", e);
    }
}


// =====================================================
// 🔁 RENDER GENERAL
// =====================================================
function renderAll(){

    renderTablaARC();
    renderSeguimiento();
    renderNoRealizado();
    renderProximo();

}


// =====================================================
// 🧱 TABLA ARC
// =====================================================
function renderTablaARC(){

    const cont = document.getElementById("tablaARC");
    cont.innerHTML = "";

    data.forEach((d, i)=>{

        const fila = document.createElement("div");
        fila.className = "fila-arc";

        fila.innerHTML = `
            <input class="codigo" value="${d.codigo_arc}" readonly>

            <textarea class="descripcion">${d.descripcion || ""}</textarea>

            <input type="date" class="inicio" value="${formatoFecha(d.inicio_programado)}">
            <input type="date" class="fin" value="${formatoFecha(d.fin_programado)}">

            <input type="date" class="inicio_ejec" value="${formatoFecha(d.inicio_ejecutado)}">
            <input type="date" class="fin_ejec" value="${formatoFecha(d.fin_ejecutado)}">

            <input type="number" class="avance" value="${d.avance_percent || 0}">
        `;

        cont.appendChild(fila);
    });

}


// =====================================================
// 🟩 FILA 6
// =====================================================
function renderSeguimiento(){

    const cont = document.getElementById("tablaSeguimiento");
    cont.innerHTML = "";

    data.forEach((d,i)=>{

        cont.innerHTML += `
            <div class="fila-act">
                <span>${d.codigo_arc}</span>
                <textarea class="actividades_mes"
                    oninput="updateSeguimiento(${i}, this.value)">
                    ${d.actividades_mes || ""}
                </textarea>
            </div>
        `;
    });

}


// =====================================================
// 🟥 FILA 7
// =====================================================
function renderNoRealizado(){

    const cont = document.getElementById("tablaNoRealizado");
    cont.innerHTML = "";

    data.forEach((d,i)=>{

        cont.innerHTML += `
            <div class="fila-act">
                <span>${d.codigo_arc}</span>
                <textarea class="no_realizado"
                    oninput="updateNoRealizado(${i}, this.value)">
                    ${d.no_realizado || ""}
                </textarea>
            </div>
        `;
    });

}


// =====================================================
// 🟦 FILA 8
// =====================================================
function renderProximo(){

    const cont = document.getElementById("tablaProximo");
    cont.innerHTML = "";

    data.forEach((d,i)=>{

        cont.innerHTML += `
            <div class="fila-act">
                <span>${d.codigo_arc}</span>
                <textarea class="proximo_mes"
                    oninput="updateProximo(${i}, this.value)">
                    ${d.proximo_mes || ""}
                </textarea>
            </div>
        `;
    });

}


// =====================================================
// 🔄 ACTUALIZAR DATA EN MEMORIA
// =====================================================
function updateSeguimiento(index, valor){
    data[index].actividades_mes = valor;
}

function updateNoRealizado(index, valor){
    data[index].no_realizado = valor;
}

function updateProximo(index, valor){
    data[index].proximo_mes = valor;
}


// =====================================================
// 💾 GUARDAR TODO
// =====================================================
async function guardarARC() {

    const proyecto_id = document.getElementById("selectProyecto").value;
    const fecha = document.getElementById("fechaCorte").value;

    if (!proyecto_id || !fecha){
        alert("Seleccione proyecto y fecha");
        return;
    }

    const filas = document.querySelectorAll(".fila-arc");

    let arcs = [];

    filas.forEach((f, i) => {

        arcs.push({
            codigo: f.querySelector(".codigo")?.value,
            descripcion: f.querySelector(".descripcion")?.value,
            inicio: f.querySelector(".inicio")?.value,
            fin: f.querySelector(".fin")?.value,
            inicio_ejec: f.querySelector(".inicio_ejec")?.value,
            fin_ejec: f.querySelector(".fin_ejec")?.value,
            avance: f.querySelector(".avance")?.value,

            // 🔥 ACTIVIDADES
            actividades_mes: data[i].actividades_mes,
            no_realizado: data[i].no_realizado,
            proximo_mes: data[i].proximo_mes
        });

    });

    const btn = document.getElementById("btnGuardar");
    btn.disabled = true;
    btn.innerText = "Guardando...";

    try{

        await fetch("/api/guardar-arc", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                proyecto_id,
                fecha_corte: fecha,
                arcs
            })
        });

        alert("Guardado correctamente");

    }catch(e){
        console.error(e);
        alert("Error al guardar");
    }

    btn.disabled = false;
    btn.innerText = "Guardar";
}


// =====================================================
// 🗓️ FORMATO FECHA
// =====================================================
function formatoFecha(fecha){
    if(!fecha) return "";
    return new Date(fecha).toISOString().split("T")[0];
}