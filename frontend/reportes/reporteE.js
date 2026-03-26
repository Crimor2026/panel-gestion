// =====================================================
// DATA (SIMULACIÓN - luego reemplazas por API)
// =====================================================

let data = [
    {
        codigo: "ARC-001",
        descripcion: "Estudio de demanda",
        direccion: "DGC",
        prog_inicio: "2026-01-01",
        prog_fin: "2026-03-01",
        ejec_inicio: null,
        ejec_fin: null,
        avance: 20
    },
    {
        codigo: "ARC-002",
        descripcion: "Diseño de proyecto",
        direccion: "DGI",
        prog_inicio: "2026-03-01",
        prog_fin: "2026-06-01",
        ejec_inicio: null,
        ejec_fin: null,
        avance: 10
    }
];


// =====================================================
// INIT
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    renderARC();
    renderTabla();
    renderGantt();
});


// =====================================================
// FILA 5 - TIMELINE ARC
// =====================================================

function renderARC(){

    const cont = document.getElementById("timeline");
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
// FILA 6 - TABLA CRONOGRAMA (GRID PRO)
// =====================================================

function renderTabla(){

    const cont = document.getElementById("tablaBody");
    if(!cont) return;

    cont.innerHTML = "";

    data.forEach(d=>{

        const fila = document.createElement("div");
        fila.className = "fila-tabla";

        fila.innerHTML = `
            <div>${d.codigo}</div>
            <div>${d.descripcion}</div>
            <div>${d.direccion}</div>
            <div>${formatearFecha(d.prog_inicio)}</div>
            <div>${formatearFecha(d.prog_fin)}</div>
            <div>${formatearFecha(d.ejec_inicio)}</div>
            <div>${formatearFecha(d.ejec_fin)}</div>
            <div>${d.avance}%</div>
        `;

        cont.appendChild(fila);

    });

}


// =====================================================
// FILA 6 - GANTT PROFESIONAL
// =====================================================

function renderGantt(){

    const cont = document.getElementById("ganttGrid");
    const header = document.getElementById("ganttHeader");

    if(!cont || !header) return;

    cont.innerHTML = "";
    header.innerHTML = "";

    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

    const baseYear = 2026;

    // 🔹 HEADER (MESES)
    for(let year = baseYear; year <= baseYear + 2; year++){

        meses.forEach((m,i)=>{

            const div = document.createElement("div");
            div.className = "mes";
            div.style.left = ((year-baseYear)*12*80 + i*80) + "px";
            div.innerText = m;

            header.appendChild(div);
        });
    }

    // 🔹 BARRAS
    data.forEach((d,i)=>{

        const ini = new Date(d.prog_inicio || d.inicio);
        const fin = new Date(d.prog_fin || d.fin);

        const x1 = ((ini.getFullYear()-baseYear)*12 + ini.getMonth()) * 80;
        const x2 = ((fin.getFullYear()-baseYear)*12 + fin.getMonth()) * 80;

        const barra = document.createElement("div");
        barra.className = "barra";

        barra.style.left = x1 + "px";
        barra.style.width = (x2 - x1 + 80) + "px";
        barra.style.top = (i * 35 + 40) + "px";

        cont.appendChild(barra);

    });

}


// =====================================================
// UTILIDADES
// =====================================================

function formatearFecha(fecha){

    if(!fecha) return "";

    const f = new Date(fecha);

    return f.toLocaleDateString("es-PE");
}


// =====================================================
// FILA 8 - FIRMA
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
// FUTURO (LISTO PARA BACKEND)
// =====================================================

// ejemplo:
// async function cargarProyecto(id){
//     const res = await fetch(`/api/proyecto/${id}`);
//     data = await res.json();
//
//     renderARC();
//     renderTabla();
//     renderGantt();
// }