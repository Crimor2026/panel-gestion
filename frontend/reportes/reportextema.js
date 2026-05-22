/* ====================================== */
/* FECHAS CON DATA */
/* ====================================== */

let fechasConData = [];

/* ================= INIT ================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

    await cargarFechasConData();

    cargarTemas();

    flatpickr("#fecha", {

        locale: "es",

        dateFormat: "Y-m-d",

        allowInput: true,

        disableMobile: true,

        onDayCreate: function(
            dObj,
            dStr,
            fp,
            dayElem
        ){

            const year =
                dayElem.dateObj.getFullYear();

            const month =
                String(
                    dayElem.dateObj.getMonth() + 1
                ).padStart(2,"0");

            const day =
                String(
                    dayElem.dateObj.getDate()
                ).padStart(2,"0");

            const fecha =
                `${year}-${month}-${day}`;

            if(
                fechasConData.includes(fecha)
            ){

                dayElem.innerHTML += `

                    <span class="punto-data"></span>

                `;
            }
        },

        onChange(){

            cargarReporte();
        }
    });

});

/* ================= TEMAS ================= */

async function cargarTemas(){

    try{

        const res =
            await fetch("/api/reportextema/temas");

        const temas =
            await res.json();

        const select =
            document.getElementById("tema");

        temas.forEach(t => {

            const option =
                document.createElement("option");

            option.value = t.id;

            option.innerText = t.nombre;

            select.appendChild(option);

        });

    }catch(err){

        console.error(err);

    }
}

/* ================================================= */
/* CARGAR DATA */
/* ================================================= */

async function cargarReporte(){

    let fecha =
        document.getElementById("fecha").value;

    const tema =
        document.getElementById("tema").value;

    /* yyyy-mm-dd → dd/mm/yyyy */

    if(fecha){

        const partes =
            fecha.split("-");

        fecha =
            `${partes[2]}/${partes[1]}/${partes[0]}`;
    }

    if(!fecha || !tema){
        return;
    }

    const res = await fetch(

        `/api/reportextema/detalle?fecha=${fecha}&tema_id=${tema}`

    );

    const data = await res.json();

    /* ================= TEXTAREAS ================= */

    const descripcion =
        document.getElementById(
            "descripcion"
        );

    descripcion.value =
        data.descripcion || "";

    ajustarTextarea(
        descripcion
    );

    const encargadas =
        document.getElementById(
            "encargadas"
        );

    encargadas.value =
        data.encargadas || "";

    ajustarTextarea(
        encargadas
    );

    const apoyo =
        document.getElementById(
            "apoyo"
        );

    apoyo.value =
        data.apoyo || "";

    ajustarTextarea(
        apoyo
    );

    const estado =
        document.getElementById(
            "estado"
        );

    estado.value =
        data.estado || "";

    ajustarTextarea(
        estado
    );

    const proyectos =
        document.getElementById(
            "proyectos"
        );

    proyectos.value =
        data.proyectos || "";

    ajustarTextarea(
        proyectos
    );

    const decisiones =
        document.getElementById(
            "decisiones"
        );

    decisiones.value =
        data.decisiones || "";

    ajustarTextarea(
        decisiones
    );
}

/* ================================================= */
/* EVENTOS */
/* ================================================= */

document.getElementById("fecha")
.addEventListener(
    "change",
    cargarReporte
);

document.getElementById("tema")
.addEventListener(
    "change",
    cargarReporte
);

/* ================= GUARDAR ================= */

document.getElementById("guardar")
.onclick = async () => {

    try{

        const tema =
            document.getElementById(
                "tema"
            );

        if(!tema.value){

            alert(
                "Seleccione un tema"
            );

            return;
        }

        /* ====================================== */
        /* FECHA A GUARDAR */
        /* ====================================== */

        let fecha =
            document.getElementById(
                "fecha"
            ).value;

        if(fecha){

            const partes =
                fecha.split("-");

            fecha =
                `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        let fechaGuardar = prompt(

            "¿En qué fecha deseas guardar?\n\nFormato: DD/MM/YYYY",

            fecha

        );

        if(!fechaGuardar){
            return;
        }

        fechaGuardar =
            fechaGuardar.trim();

        const temaTexto =
            tema.options[
                tema.selectedIndex
            ].text;

        const confirmar = confirm(

            `¿Guardar reporte?\n\nTema: ${temaTexto}\nFecha: ${fechaGuardar}`

        );

        if(!confirmar){
            return;
        }

        /* ====================================== */
        /* PAYLOAD */
        /* ====================================== */

        const payload = {

            tema_id:
                tema.value,

            fecha:
                fechaGuardar,

            descripcion:
                document.getElementById(
                    "descripcion"
                ).value,

            encargadas:
                document.getElementById(
                    "encargadas"
                ).value,

            apoyo:
                document.getElementById(
                    "apoyo"
                ).value,

            estado:
                document.getElementById(
                    "estado"
                ).value,

            proyectos:
                document.getElementById(
                    "proyectos"
                ).value,

            decisiones:
                document.getElementById(
                    "decisiones"
                ).value
        };

        const res =
            await fetch(
                "/api/reportextema/guardar",
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                        "application/json"
                    },

                    body:JSON.stringify(
                        payload
                    )
                }
            );

        const data =
            await res.json();

        console.log(data);

        /* ====================================== */
        /* RECARGAR */
        /* ====================================== */

        cargarReporte();

    }catch(err){

        console.error(err);

        alert(
            "Error al guardar"
        );
    }
};

/* ================= VOLVER ================= */

document.getElementById("volver")
.onclick = () => {

    window.location.href = "/reportes";

};


/* ================================================= */
/* CARGAR DATA EXCEL */
/* ================================================= */

const btnCargar =
    document.getElementById("cargarData");

const inputExcel =
    document.getElementById("excelFile");

btnCargar.onclick = () => {

    inputExcel.click();
};

inputExcel.onchange = async () => {

    try{

        if(!inputExcel.files.length){
            return;
        }

        const formData = new FormData();

        formData.append(
            "file",
            inputExcel.files[0]
        );

        const res = await fetch(
            "/api/reportextema/subir-excel",
            {
                method:"POST",
                body:formData
            }
        );

        const data = await res.json();

        alert(data.mensaje);

        console.log(data);

    }catch(err){

        console.error(err);

        alert("Error al cargar Excel");
    }
};

/* ====================================== */
/* OBTENER FECHAS CON DATA */
/* ====================================== */

async function cargarFechasConData(){

    const res =
        await fetch(
            "/api/reportextema/fechas"
        );

    fechasConData =
        await res.json();
}

/* ====================================== */
/* EXPORTAR PDF */
/* ====================================== */

document.getElementById("exportarPdf")
.onclick = async () => {

    const elemento =
        document.getElementById(
            "contenidoPDF"
        );

    // 🔥 ACTIVAR MODO PDF
    elemento.classList.add(
        "modo-pdf"
    );

    // 🔥 textarea -> div temporal
    const textareas =
        elemento.querySelectorAll(
            "textarea"
        );

    const reemplazos = [];

    textareas.forEach(textarea => {

        const div =
            document.createElement("div");

        div.className =
            "pdf-textarea";

        div.innerText =
            textarea.value;

        div.style.minHeight =
            textarea.scrollHeight + "px";

        reemplazos.push({

            original: textarea,

            reemplazo: div

        });

        textarea.parentNode.replaceChild(
            div,
            textarea
        );

    });

    const opciones = {

        margin:[10,10,10,10],

        filename:
            "informe-tematico.pdf",

        image:{
            type:"jpeg",
            quality:1
        },

        html2canvas:{

            scale:2,

            useCORS:true,

            scrollY:0

        },

        jsPDF:{

            unit:"mm",

            format:"a4",

            orientation:"portrait"

        },

        pagebreak:{

            mode:[
                "avoid-all",
                "css",
                "legacy"
            ],

            avoid:[
                ".bloque",
                ".fila-grid",
                ".pdf-textarea"
            ]

        }

    };

    await html2pdf()
        .set(opciones)
        .from(elemento)
        .save();

    // 🔥 DESACTIVAR MODO PDF
    elemento.classList.remove(
        "modo-pdf"
    );

    // 🔥 restaurar textarea
    reemplazos.forEach(item => {

        item.reemplazo.parentNode
            .replaceChild(
                item.original,
                item.reemplazo
            );

    });

};

/* ====================================== */
/* AUTO HEIGHT TEXTAREA */
/* ====================================== */

function ajustarTextarea(textarea){

    textarea.style.height = "0px";

    textarea.style.height =
        textarea.scrollHeight + "px";
}

document
.querySelectorAll("textarea")
.forEach(textarea => {

    ajustarTextarea(textarea);

    textarea.addEventListener(
        "input",
        () => ajustarTextarea(textarea)
    );

});