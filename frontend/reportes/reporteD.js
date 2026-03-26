// =====================================================
// VARIABLES GLOBALES
// =====================================================
let data = []; // 🔥 aquí se guarda todo el cronograma


// =====================================================
// INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {

    await cargarDatos();

    renderARC();
    renderTablaARC();
    renderGantt();

    renderSeguimiento();
    renderNoRealizado();
    renderProximo();

    initCamposFinales();

});


// =====================================================
// 🔄 CARGAR DATA DESDE BACKEND
// =====================================================
async function cargarDatos(){

    try{

        const res = await fetch("/api/cronograma");
        data = await res.json();

        console.log("DATA:", data);

    }catch(e){
        console.error("Error cargando cronograma", e);
    }

}


// =====================================================
// ARC LINEA SUPERIOR (FILA 5 VISUAL)
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
// TABLA ARC EDITABLE (FILA 5)
// =====================================================
function renderTablaARC(){

    const cont = document.getElementById("tablaARC");
    if(!cont) return;

    cont.innerHTML = "";

    data.forEach((d, i)=>{

        const fila = document.createElement("div");
        fila.className = "fila-arc";

        fila.innerHTML = `
            <div>${d.codigo || "ARC-"+(i+1)}</div>

            <div>
                <textarea onchange="updateARC(${i}, 'descripcion', this.value)">
${d.descripcion || ""}
                </textarea>
            </div>

            <div>
                <input type="date"
                    value="${formatoInputFecha(d.prog_inicio)}"
                    onchange="updateARC(${i}, 'prog_inicio', this.value)">
            </div>

            <div>
                <input type="date"
                    value="${formatoInputFecha(d.prog_fin)}"
                    onchange="updateARC(${i}, 'prog_fin', this.value)">
            </div>

            <div>
                <input type="date"
                    value="${formatoInputFecha(d.nueva_fecha)}"
                    onchange="updateARC(${i}, 'nueva_fecha', this.value)">
            </div>

            <div>
                <input type="text"
                    value="${d.riesgo || ""}"
                    onchange="updateARC(${i}, 'riesgo', this.value)">
            </div>
        `;

        cont.appendChild(fila);
    });
}


// =====================================================
// ✏️ ACTUALIZAR ARC (EDITABLE)
// =====================================================
function updateARC(index, campo, valor){

    data[index][campo] = valor;

    console.log("Actualizado:", data[index]);

    // 🔥 re-render visual
    renderGantt();

    // 🔥 guardar en backend
    guardarARC(data[index]);
}


// =====================================================
// 💾 GUARDAR EN BACKEND
// =====================================================
async function guardarARC(arc){

    try{

        await fetch("/api/arc", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(arc)
        });

    }catch(e){
        console.error("Error guardando ARC", e);
    }
}


// =====================================================
// 📊 GANTT DINÁMICO
// =====================================================
function renderGantt(){

    const cont = document.getElementById("ganttGrid");
    const header = document.getElementById("ganttHeader");

    if(!cont || !header) return;

    cont.innerHTML = "";
    header.innerHTML = "";

    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

    // 🔹 HEADER
    for(let year = 2026; year <= 2028; year++){

        meses.forEach((m,i)=>{

            const div = document.createElement("div");
            div.className = "mes";

            div.style.left = ((year-2026)*12*80 + i*80) + "px";
            div.innerText = m;

            header.appendChild(div);
        });
    }

    // 🔹 BARRAS
    data.forEach((d,i)=>{

        if(!d.prog_inicio || !d.prog_fin) return;

        const ini = new Date(d.prog_inicio);
        const fin = new Date(d.prog_fin);

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
// 📅 FORMATEAR FECHA INPUT
// =====================================================
function formatoInputFecha(fecha){

    if(!fecha) return "";

    const f = new Date(fecha);

    return f.toISOString().split("T")[0];
}


// =====================================================
// ✍️ PREVIEW FIRMA
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
// 🆕 SEGUIMIENTO ARC (FILA 6)
// =====================================================
function renderSeguimiento(){

    const cont = document.getElementById("tablaSeguimiento");
    if(!cont) return;

    cont.innerHTML = "";

    data.forEach((d, i)=>{

        const fila = document.createElement("div");
        fila.className = "fila-seg";

        fila.innerHTML = `
            <div>ARC.${(i+1).toString().padStart(2,"0")}</div>

            <div>
                <textarea 
                    placeholder="Describe las actividades realizadas este mes..."
                    onchange="updateSeguimiento(${i}, this.value)"
                >${d.actividades_mes || ""}</textarea>
            </div>
        `;

        cont.appendChild(fila);
    });

}

// =====================================================
// 💾 GUARDAR SEGUIMIENTO
// =====================================================
function updateSeguimiento(index, valor){

    data[index].actividades_mes = valor;

    console.log("Seguimiento actualizado:", data[index]);

    fetch("/api/seguimiento_arc", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            arc_id: data[index].id,
            actividades_mes: valor
        })
    });

}

// =====================================================
// 🆕 FILA 7 - NO REALIZADO
// =====================================================
function renderNoRealizado(){

    const cont = document.getElementById("tablaNoRealizado");
    if(!cont) return;

    cont.innerHTML = "";

    data.forEach((d, i)=>{

        const fila = document.createElement("div");
        fila.className = "fila-simple";

        fila.innerHTML = `
            <div>ARC.${(i+1).toString().padStart(2,"0")}</div>

            <div>
                <textarea 
                    placeholder="Actividad no realizada..."
                    onchange="updateNoRealizado(${i}, this.value)"
                >${d.no_realizado || ""}</textarea>
            </div>
        `;

        cont.appendChild(fila);
    });

}


function updateNoRealizado(index, valor){

    data[index].no_realizado = valor;

    fetch("/api/no_realizado", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            arc_id: data[index].id,
            descripcion: valor
        })
    });

}


// =====================================================
// 🆕 FILA 8 - PRÓXIMO MES
// =====================================================
function renderProximo(){

    const cont = document.getElementById("tablaProximo");
    if(!cont) return;

    cont.innerHTML = "";

    data.forEach((d, i)=>{

        const fila = document.createElement("div");
        fila.className = "fila-simple";

        fila.innerHTML = `
            <div>ARC.${(i+1).toString().padStart(2,"0")}</div>

            <div>
                <textarea 
                    placeholder="Actividad programada..."
                    onchange="updateProximo(${i}, this.value)"
                >${d.proximo_mes || ""}</textarea>
            </div>
        `;

        cont.appendChild(fila);
    });

}


function updateProximo(index, valor){

    data[index].proximo_mes = valor;

    fetch("/api/proximo_mes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            arc_id: data[index].id,
            descripcion: valor
        })
    });

}

// =====================================================
// 🆕 GUARDAR TEXTO FINAL
// =====================================================
function initCamposFinales(){

    const acuerdos = document.getElementById("acuerdos");
    const otros = document.getElementById("otrosTemas");
    const urgente = document.getElementById("atencionInmediata");

    if(acuerdos){
        acuerdos.addEventListener("change", ()=>{
            guardarTexto("acuerdos", acuerdos.value);
        });
    }

    if(otros){
        otros.addEventListener("change", ()=>{
            guardarTexto("otros", otros.value);
        });
    }

    if(urgente){
        urgente.addEventListener("change", ()=>{
            guardarTexto("urgente", urgente.value);
        });
    }

}


// =====================================================
// 💾 GUARDAR EN BACKEND
// =====================================================
function guardarTexto(tipo, valor){

    fetch("/api/reporte_texto", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            tipo: tipo,
            contenido: valor
        })
    });

}

// ================= FIRMA =================
function previewFirma(event, index){

    const file = event.target.files[0];
    if(!file) return;

    const reader = new FileReader();

    reader.onload = function(e){
        document.getElementById("imgFirma"+index).src = e.target.result;
    }

    reader.readAsDataURL(file);
}