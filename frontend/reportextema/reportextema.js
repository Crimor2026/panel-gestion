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
                `${day}/${month}/${year}`;

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

    document.getElementById("descripcion")
    .value = data.descripcion || "";

    document.getElementById("encargadas")
    .value = data.encargadas || "";

    document.getElementById("apoyo")
    .value = data.apoyo || "";

    document.getElementById("estado")
    .value = data.estado || "";

    document.getElementById("proyectos")
    .value = data.proyectos || "";

    document.getElementById("decisiones")
    .value = data.decisiones || "";
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

        let fecha =
            document.getElementById("fecha").value;

        const tema =
            document.getElementById("tema");

        if(!fecha){

            alert("Seleccione una fecha");

            return;
        }

        if(!tema.value){

            alert("Seleccione un tema");

            return;
        }

        /* yyyy-mm-dd → dd/mm/yyyy */

        const partes =
            fecha.split("-");

        fecha =
            `${partes[2]}/${partes[1]}/${partes[0]}`;

        const temaTexto =
            tema.options[tema.selectedIndex].text;

        const confirmar = confirm(

            `¿Guardar reporte?\n\nTema: ${temaTexto}\nFecha: ${fecha}`

        );

        if(!confirmar){
            return;
        }

        const payload = {

            tema_id:
                tema.value,

            fecha:
                fecha,

            descripcion:
                document.getElementById("descripcion").value,

            encargadas:
                document.getElementById("encargadas").value,

            apoyo:
                document.getElementById("apoyo").value,

            estado:
                document.getElementById("estado").value,

            proyectos:
                document.getElementById("proyectos").value,

            decisiones:
                document.getElementById("decisiones").value
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

                    body:JSON.stringify(payload)
                }
            );

        const data =
            await res.json();

        alert("Reporte guardado");

        console.log(data);

        cargarReporte();

    }catch(err){

        console.error(err);

        alert("Error al guardar");
    }
};

/* ================= VOLVER ================= */

document.getElementById("volver")
.onclick = () => {

    window.location.href = "/tablero";

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