const filasContainer = document.getElementById("filas");
const addColBtn = document.getElementById("addCol");
const encabezado = document.getElementById("encabezado");

let columnas = 1;
let filas = 0;
let lineas = [];

// 🔥 COLORES
const colores = [
    "#5499C7", // azul
    "#45B39D", // verde agua
    "#52BE80", // verde
    "#EB984E", // naranja
    "#A569BD", // morado
    "#E74C3C", // rojo suave
    "#73BFB8", // turquesa
    "#F4D03F", // amarillo
    "#7FB3D5", // celeste
    "#A77DC2", // lila
    "#EC7063", // rosado
    "#6FA8DC", // azul gris

    "#5D6D7E", // gris azulado
    "#117A65", // verde oscuro elegante
    "#148F77", // teal fuerte
    "#B9770E", // naranja oscuro
    "#7D3C98", // púrpura fuerte
    "#922B21", // rojo vino
    "#1F618D", // azul profundo
    "#566573"  // gris moderno
];
let colorIndex = 0;

function irTablero() {
    window.location.href = "/tablero";
}

/* ================= AGREGAR FILA ================= */
function agregarFila() {
    filas++;

    const fila = document.createElement("div");
    fila.className = "fila";

    // 🔥 HEREDAR ESTADO DE CARGA
    if (filasContainer.dataset.cargando === "true") {
        fila.dataset.cargando = "true";
    }

    const num = document.createElement("div");
    num.className = "celda numero";
    num.innerText = filas;
    fila.appendChild(num);

    for (let i = 0; i < columnas; i++) {
        fila.appendChild(crearCelda(i, fila));
    }

    filasContainer.appendChild(fila);
    actualizarColumnasGrid();
}

/* ================= CREAR CELDA ================= */
function crearCelda(colIndex, filaDOM) {
    const celda = document.createElement("div");
    celda.className = "celda";

    const container = document.createElement("div");
    container.className = "nodos-container";

   if (colIndex === 0) {
        container.appendChild(crearNodo(colIndex, filaDOM));
    }

    celda.appendChild(container);
    return celda;
}

/* ================= CREAR NODO ================= */
function crearNodo(colIndex, filaDOM) {

    const filasContainer = document.getElementById("filas");

    // 🔥 BLOQUEAR CREACIÓN AUTOMÁTICA EN CARGA
    if (filasContainer.dataset.cargando === "true") {
        // SOLO crear nodo base, sin lógica adicional
    }
        
    const wrapper = document.createElement("div");
    wrapper.className = "nodo-wrapper";

    // 🔥 ID + COLOR
    wrapper.dataset.id = Math.random().toString(36).substr(2, 9);
    wrapper.dataset.color = colores[colorIndex % colores.length];
    colorIndex++;

    const input = document.createElement("textarea");
    input.className = "nodo-input";

    // 🔥 aplicar color
    aplicarColor(wrapper, input);

    input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = input.scrollHeight + "px";
        lineas.forEach(l => l.position());
    });

    /* ================= CONTROLES ================= */
    const controles = document.createElement("div");
    controles.className = "nodo-controles";

    // ➕ botón
    const btnAdd = document.createElement("div");
    btnAdd.className = "nodo";
    btnAdd.innerText = "+";

    // ➖ botón
    const btnRemove = document.createElement("div");
    btnRemove.className = "nodo eliminar";
    btnRemove.innerText = "-";

    /* ================= ADD ================= */
    btnAdd.onclick = () => {

        const nextIndex = colIndex + 1;

        if (nextIndex >= columnas) {
            addColBtn.click();
        }

        const celdaDestino = filaDOM.children[nextIndex + 1];
        const containerDestino = celdaDestino.querySelector(".nodos-container");

        const nuevoNodo = crearNodo(nextIndex, filaDOM);

        // 🔥 RELACIÓN + COLOR
        wrapper.classList.add("padre");
        nuevoNodo.classList.add("hijo");

        nuevoNodo.dataset.parentId = wrapper.dataset.id;

        // 🔥 CLAVE: diferenciar ramas
        if (!wrapper.dataset.parentId) {
            nuevoNodo.dataset.color = colores[colorIndex % colores.length];
            colorIndex++;
        } else {
            nuevoNodo.dataset.color = wrapper.dataset.color;
        }

        const inputHijo = nuevoNodo.querySelector(".nodo-input");
        aplicarColor(nuevoNodo, inputHijo);

        containerDestino.classList.add("tiene-hijos");

        // 🔥 INSERTAR POR NIVEL (CLAVE)
        const nivelNuevo = calcularNivel(nuevoNodo);
        const parentIndex = Array.from(containerDestino.children)
            .findIndex(n => n.dataset.id === wrapper.dataset.id);

        if (parentIndex !== -1) {
            containerDestino.insertBefore(
                nuevoNodo,
                containerDestino.children[parentIndex + 1] || null
            );
        } else {
            containerDestino.appendChild(nuevoNodo);
        }

        // 🔥 ORDEN CORRECTO (FIX REAL)
        requestAnimationFrame(() => {

            alinearFilasGlobal();

            requestAnimationFrame(() => {

                recalcularTodo();

                // 🔥 LINEA CON COLOR (DESPUÉS de TODO)
                const linea = new LeaderLine(
                    input,
                    nuevoNodo.querySelector(".nodo-input"),
                    {
                        path: "grid",
                        startSocket: "right",
                        endSocket: "left",

                        startSocketGravity: [0, 0],
                        endSocketGravity: [0, 0],

                        color: padre.dataset.color,
                        size: 2,
                        dash: { len: 4, gap: 4 }
                    }
                );

                linea.fila = filaDOM;

                linea.hide("none");
                linea.show("draw");

                lineas.push(linea);

                requestAnimationFrame(() => {
                    lineas.forEach(l => l.position());
                });

            });

        });

    };
    /* ================= REMOVE ================= */
    btnRemove.onclick = () => {

        const inputActual = wrapper.querySelector(".nodo-input");

        // 🔥 eliminar líneas relacionadas
        lineas = lineas.filter(linea => {

            const eliminar =
                linea.start === inputActual ||
                linea.end === inputActual;

            if (eliminar) linea.remove();

            return !eliminar;
        });

        // 🔥 eliminar nodo
        wrapper.remove();
        recalcularTodo();

        // 🔥 reajustar líneas
        setTimeout(() => {
            lineas.forEach(l => l.position());
        }, 50);
    };

    /* ================= APPEND ================= */
    controles.appendChild(btnAdd);
    controles.appendChild(btnRemove);

    wrapper.appendChild(input);
    wrapper.appendChild(controles);

    return wrapper;
}

/* ================= COLOR ================= */
function aplicarColor(nodo, input) {
    const color = nodo.dataset.color;

    // ❌ quitar borde
    input.style.border = "none";

    // ✅ dejar solo color limpio
    input.style.boxShadow = "0 0 0 2px transparent";

    // opcional fondo suave
    input.style.background = color + "15";
}

/* ================= AGREGAR COLUMNA ================= */
addColBtn.onclick = () => {
    columnas++;

    const nuevaCol = document.createElement("div");
    nuevaCol.className = "celda columna";

    nuevaCol.innerHTML = `
        <div class="header-col">
            <input class="titulo-col" placeholder="Campo ${columnas}">
            <input class="filtro-col" placeholder="Filtrar...">
        </div>
    `;

    encabezado.insertBefore(nuevaCol, document.querySelector(".control-columnas"));

    document.querySelectorAll("#filas .fila").forEach(fila => {
        fila.appendChild(crearCelda(columnas - 1, fila));
    });

    actualizarColumnasGrid();
    activarFiltros();

    // 🔥 🔥 🔥 AGREGA ESTO
    setTimeout(() => {
        recalcularTodo();
    }, 80);
};

/* ================= ORDEN COLOR ================= */

function ordenarPorColor(container) {

    const nodos = Array.from(container.children);

    nodos.sort((a, b) => {
        return (a.dataset.color || "").localeCompare(b.dataset.color || "");
    });

    nodos.forEach(n => container.appendChild(n));
}

/* ================= FILTRO ================= */
function aplicarFiltro() {

    // 🔥 resetear TODO antes de filtrar
    document.querySelectorAll(".nodo-wrapper").forEach(n => {
        n.style.display = "flex";
    });
    
    const filtros = document.querySelectorAll(".filtro-col");
    const filas = document.querySelectorAll("#filas .fila");

    filas.forEach(fila => {

        let cumpleTodos = true;

        filtros.forEach((inputFiltro, colIndex) => {

            const textoFiltro = inputFiltro.value.toLowerCase().trim();

            const celda = fila.children[colIndex + 1];
            if (!celda) return;

            const nodos = celda.querySelectorAll(".nodo-wrapper");

            if (textoFiltro === "") {
                return; // 🔥 NO tocar visibilidad aquí
            }

            let matchEnColumna = false;

            nodos.forEach(nodo => {

                const input = nodo.querySelector(".nodo-input");

                if (!input) {
                    nodo.style.display = "none"; // 🔥 o "flex" si quieres ignorarlo
                    return;
                }

                const texto = input.value.toLowerCase();

                if (texto.includes(textoFiltro)) {
                    nodo.style.display = "flex";
                    matchEnColumna = true;
                } else {
                    nodo.style.display = "none";
                }
            });

            if (!matchEnColumna) {
                cumpleTodos = false;
            }
        });

        // 🔥 ocultar fila completa
        fila.style.display = cumpleTodos ? "grid" : "none";

    });

    // 🔥 🔥 FIX REAL: controlar visibilidad + posición de líneas
    setTimeout(() => {

        lineas.forEach(linea => {

            const origenVisible = linea.start?.offsetParent !== null;
            const destinoVisible = linea.end?.offsetParent !== null;

            if (origenVisible && destinoVisible) {
                linea.show("none");
                linea.position();
            } else {
                linea.hide("none");
            }

        });

    }, 50);
}

function activarFiltros() {
    document.querySelectorAll(".filtro-col").forEach(input => {
        input.removeEventListener("input", aplicarFiltro); // evitar duplicados
        input.addEventListener("input", aplicarFiltro);
    });
}

const removeFilaBtn = document.getElementById("removeFila");

removeFilaBtn.onclick = () => {

    const filasDOM = document.querySelectorAll("#filas .fila");

    if (filasDOM.length === 0) return;

    const ultimaFila = filasDOM[filasDOM.length - 1];

    // 🔥 eliminar líneas actuales
    lineas.forEach(l => l.remove());
    lineas = [];

    // 🔥 eliminar fila
    ultimaFila.remove();
    filas--;

    // 🔥 🔥 CLAVE: reconstruir layout + líneas
    setTimeout(() => {
        recalcularTodo();
    }, 80);
};

const removeColBtn = document.getElementById("removeCol");

removeColBtn.onclick = () => {

    if (columnas <= 1) return; // 🔥 evitar borrar la última

    columnas--;

    // 🔥 eliminar encabezado (antes del +)
    const cols = document.querySelectorAll("#encabezado .columna");
    const ultimaCol = cols[cols.length - 1];
    if (ultimaCol) ultimaCol.remove();

    // 🔥 eliminar celdas de cada fila
    document.querySelectorAll("#filas .fila").forEach(fila => {
        if (fila.children.length > 1) {
            fila.removeChild(fila.lastChild);
        }
    });

    // 🔥 limpiar líneas actuales
    lineas.forEach(l => l.remove());
    lineas = [];

    // 🔥 recalcular grid
    actualizarColumnasGrid();

    // 🔥 🔥 🔥 RECONSTRUIR TODO (CLAVE)
    setTimeout(() => {
        recalcularTodo();
    }, 100);
};

const addFilaBtn = document.getElementById("addFila");

addFilaBtn.onclick = () => {
    agregarFila();
    activarFiltros(); // 🔥 importante
};

/* ================= CALENDARIO BONITO ================= */
document.addEventListener("DOMContentLoaded", () => {

    flatpickr("#fecha", {
        dateFormat: "d/m/Y",
        locale: "es",
        allowInput: true,

        // 🔥 FIX DEFINITIVO
        onReady: async function (selectedDates, dateStr, instance) {

            actualizarFechasConData();

            try {
                const res = await fetch("/api/tablero/fechas");
                const fechas = await res.json();

                console.log("FECHAS BACK:", fechas);

                if (fechas && fechas.length > 0) {

                    const ultima = fechas.sort((a, b) => new Date(b) - new Date(a))[0];

                    console.log("USANDO:", ultima);

                    if (ultima) {
                        instance.setDate(ultima, true);
                    } else {
                        agregarFila();
                    }

                } else {
                    agregarFila();
                }

            } catch (err) {
                console.error("Error cargando fechas:", err);
                agregarFila();
            }
        },

        onMonthChange: function () {
            actualizarFechasConData();
        },

        onOpen: function () {
            actualizarFechasConData();
        },

        onYearChange: function () {
            actualizarFechasConData();
        },

        onChange: function(selectedDates) {

            const fecha = selectedDates[0];
            if (!fecha) return;

            // 🔥 FIX timezone
            const fechaKey = fecha.getFullYear() + "-" +
                String(fecha.getMonth() + 1).padStart(2, "0") + "-" +
                String(fecha.getDate()).padStart(2, "0");

            cargarTablero(fechaKey);
        }
    });

});

/* ================= GUARDAR TABLERO ================= */
function guardarTablero(fecha) {

    const data = {
        columnas: [],
        filas: []
    };
    console.log("NODOS:", document.querySelectorAll(".nodo-wrapper").length);
    // 🔥 COLUMNAS
    document.querySelectorAll(".titulo-col").forEach(col => {
        data.columnas.push(col.value);
    });

    // 🔥 FILAS
    document.querySelectorAll("#filas .fila").forEach(fila => {

        const filaData = [];
        const celdas = fila.querySelectorAll(".celda");

        celdas.forEach((celda, i) => {
            if (i === 0) return;

            const nodos = Array.from(celda.querySelectorAll(".nodo-wrapper"))
                .filter(n => !n.classList.contains("invisible"));

            const nodosData = [];

            nodos.forEach(nodo => {

                const input = nodo.querySelector(".nodo-input");

                nodosData.push({
                    texto: input ? input.value : "",
                    color: nodo.dataset.color,
                    parentId: nodo.dataset.parentId || null,
                    id: nodo.dataset.id
                });
            });

            filaData.push(nodosData);
        });

        data.filas.push(filaData);
    });
    console.log("GUARDADO JSON LIMPIO:");
    console.log(JSON.stringify(data, null, 2));
    console.log("FECHA:", fecha);
    console.log("ENVIANDO:", data);

    return fetch("/api/tablero/guardar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            fecha: fecha,   // 🔥 CORRECTO
            data: data      // 🔥 CORRECTO
        })
    })
    .then(async res => {
        if (!res.ok) {
            const text = await res.text();
            console.error("ERROR BACK:", text);
            throw new Error("Error al guardar");
        }
        return res.json();
    })
    .then(() => {
        console.log("GUARDADO OK");
        actualizarFechasConData();
    })
    .catch(err => {
        console.error("ERROR GUARDANDO:", err);
    });
}

/* ================= MARCAR FECHAS ================= */
function actualizarFechasConData() {

    fetch("/api/tablero/fechas")
        .then(res => res.json())
        .then(fechas => {

            const fp = document.getElementById("fecha")._flatpickr;

            if (!fp) return;

            // 🔥 ESPERAR a que flatpickr termine de dibujar
            setTimeout(() => {

                const days = fp.calendarContainer.querySelectorAll(".flatpickr-day");

                days.forEach(day => {

                    day.classList.remove("tiene-data");

                    if (!day.dateObj) return;

                    // 🔥 FIX FINAL (NO usar toISOString)
                    const f = day.dateObj.getFullYear() + "-" +
                        String(day.dateObj.getMonth() + 1).padStart(2, "0") + "-" +
                        String(day.dateObj.getDate()).padStart(2, "0");

                    if (fechas.includes(f)) {
                        day.classList.add("tiene-data");
                    }

                });

            }, 150);

        });
}


/* ================= BOTÓN GUARDAR ================= */
document.getElementById("guardar").onclick = async () => {

    try {

        const fecha = await pedirFecha();
        if (!fecha) return;

        // 🔥 SOLO bloquear durante guardado
        modoCarga = true;

        await guardarTablero(fecha);

        modoCarga = false; // 🔥 liberar antes de cargar

        console.log("✔ Guardado correcto");

        const fp = document.getElementById("fecha")._flatpickr;
        if (fp) {
            fp.setDate(fecha, false);
        }

        await cargarTablero(fecha);
        await actualizarFechasConData();

    } catch (e) {
        console.error("❌ Error en guardar:", e);
        modoCarga = false;
    }
};

let cargandoTablero = false;
let modoCarga = false;

/* ================= CARGAR TABLERO ================= */
async function cargarTablero(fecha) {

    // 🔥 EVITAR LLAMADAS DUPLICADAS
    if (cargandoTablero) return;
    cargandoTablero = true;

    modoCarga = true;

    try {

        const res = await fetch(`/api/tablero/${fecha}?proyecto_id=1`);

        console.log("STATUS:", res.status);

        if (!res.ok) {
            throw new Error("Error HTTP: " + res.status);
        }

        const text = await res.text();
        console.log("RESPUESTA BACK (RAW):", text);

        let resp;

        try {
            resp = JSON.parse(text);
        } catch (e) {
            console.error("ERROR PARSEANDO JSON:", e);
            return;
        }

        console.log("RESPUESTA BACK:", resp);

        let data = resp.data;
        const filasContainer = document.getElementById("filas");

        // 🔥 NO BORRAR SI VIENE VACÍO
        if (!data) {
            console.warn("DATA VACÍA IGNORADA");

            if (document.querySelectorAll(".nodo-wrapper").length > 0) {
                return;
            }

            filasContainer.innerHTML = "";
            filas = 0;
            columnas = 1;

            agregarFila();
            return;
        }

        // 🔥 parse seguro
        try {
            if (typeof data === "string") {
                data = JSON.parse(data);
            }
            if (typeof data === "string") {
                data = JSON.parse(data);
            }
        } catch (e) {
            console.error("❌ ERROR PARSEANDO DATA:", e);
            return;
        }

        console.log("DATA FINAL:", data);
        console.log("CARGADO JSON LIMPIO:");
        console.log(JSON.stringify(data, null, 2));

        /* ================= LIMPIAR ================= */
        filasContainer.innerHTML = "";
        lineas.forEach(l => l.remove());
        lineas = [];
        filas = 0;

        /* ================= COLUMNAS ================= */
        columnas = (data.columnas && data.columnas.length > 0)
            ? data.columnas.length
            : document.querySelectorAll(".columna").length;

        const columnasGuardadas = columnas;

        while (document.querySelectorAll(".columna").length > columnasGuardadas) {
            const cols = document.querySelectorAll(".columna");
            if (cols.length <= 1) break;
            cols[cols.length - 1].remove();
        }

        while (document.querySelectorAll(".columna").length < columnasGuardadas) {
            addColBtn.click();
        }

        document.querySelectorAll(".titulo-col").forEach((input, i) => {
            input.value = data.columnas[i] || `Campo ${i + 1}`;
        });

        /* ================= FILAS ================= */
        console.log("FILAS A RENDERIZAR:", data.filas);
        data.filas.forEach(filaData => {

            agregarFila();

            const filaDOM = document.querySelectorAll("#filas .fila")[filas - 1];

            filaData.forEach((celdaData, colIndex) => {

                const celda = filaDOM.children[colIndex + 1];
                if (!celda) return;

                const container = celda.querySelector(".nodos-container");
                if (!container) return;

                container.innerHTML = "";

                if (!celdaData || celdaData.length === 0) {
                    return; // ❌ NO crear nada
                }
                celdaData.forEach(nodoData => {

                    if (!nodoData.id) {
                        console.error("❌ NODO SIN ID:", nodoData);
                    }

                    if (nodoData.parentId && typeof nodoData.parentId !== "string") {
                        console.error("❌ parentId inválido:", nodoData);
                    }

                    console.log("NODO:", nodoData);

                    const nodo = document.createElement("div");
                    nodo.className = "nodo-wrapper";
                    nodo.style.height = "40px";

                    const input = document.createElement("textarea");
                    input.className = "nodo-input";
                    input.value = nodoData.texto || "";

                    nodo.appendChild(input);

                    nodo.dataset.id = nodoData.id;
                    nodo.dataset.color = nodoData.color;
                    if (nodoData.parentId) {
                        nodo.dataset.parentId = nodoData.parentId;
                    } else {
                        delete nodo.dataset.parentId; // 🔥 CLAVE
                    }

                    aplicarColor(nodo, input);

                    container.appendChild(nodo); // 🔥 SOLO UNA VEZ
                });

            });

            alinearFilasGlobal();
        });

        setTimeout(() => {
            recalcularTodo();
        }, 150);

    } catch (err) {
        console.error("🔥 ERROR EN CARGA:", err);
    } finally {
        modoCarga = false;
        cargandoTablero = false;
    }
}

/* ================= PEDIR FECHA ================= */
function pedirFecha() {

    return new Promise(resolve => {

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";

        const modal = document.createElement("div");
        modal.className = "modal-box";

        modal.innerHTML = `
            <div class="modal-title">
                ¿En qué fecha deseas guardar este reporte?
            </div>

            <input type="date" class="modal-input">

            <div class="modal-actions">
                <button class="btn-cancel">Cancelar</button>
                <button class="btn-ok">Aceptar</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const input = modal.querySelector(".modal-input");

        // 🔥 fecha hoy por defecto
        input.value = new Date().toISOString().split("T")[0];

        modal.querySelector(".btn-cancel").onclick = () => {
            overlay.remove();
            resolve(null);
        };

        modal.querySelector(".btn-ok").onclick = () => {

            if (!input.value) {
                alert("Selecciona una fecha");
                return;
            }

            overlay.remove();
            resolve(input.value);
        };

    });
}

function actualizarColumnasGrid() {
    const total = document.querySelectorAll(".columna").length;

    document.querySelectorAll(".fila").forEach(fila => {
        fila.style.setProperty("--cols", total);
    });
}

function recalcularTodo() {

    // 🔥 eliminar líneas actuales
    lineas.forEach(l => l.remove());
    lineas = [];

    // 🔥 reconstruir líneas
    requestAnimationFrame(() => {

        const nodos = document.querySelectorAll(".nodo-wrapper");

        nodos.forEach(nodo => {

            const parentId = nodo.dataset.parentId;
            if (!parentId) return;

            const padre = document.querySelector(`[data-id="${parentId}"]`);
            if (!padre) return;

            const linea = new LeaderLine(
                padre.querySelector(".nodo-input"),
                nodo.querySelector(".nodo-input"),
                {
                    path: "grid",
                    startSocket: "right",
                    endSocket: "left",

                    startSocketGravity: [0, 0],
                    endSocketGravity: [0, 0],

                    color: padre.dataset.color,
                    size: 2,
                    dash: { len: 4, gap: 4 }
                }
            );

            linea.fila = nodo.closest(".fila");
            lineas.push(linea);

        });

        // 🔥 reajuste final de líneas (IMPORTANTE)
        setTimeout(() => {
            lineas.forEach(l => l.position());
        }, 100);

    });
}

/* ================= CARGAR LO ULTIMO ================= */
function cargarUltimaFecha() {

    fetch("/api/tablero/fechas")
        .then(res => res.json())
        .then(fechas => {

            if (!fechas || fechas.length === 0) return;

            const ultima = fechas[0];

            // 🔥 setear en el calendario
            const fp = document.getElementById("fecha")._flatpickr;

            if (fp) {
                fp.setDate(ultima, true); // 🔥 true = dispara onChange
            } else {
                cargarTablero(ultima);
            }

        })
        .catch(err => console.error("Error cargando fechas:", err));
}

function calcularNivel(nodo) {
    let nivel = 0;
    let actual = nodo;

    while (actual.dataset.parentId) {
        const padre = document.querySelector(`[data-id="${actual.dataset.parentId}"]`);
        if (!padre) break;
        nivel++;
        actual = padre;
    }

    return nivel;
}

function obtenerFilaPadre(nodo) {

    if (!nodo.dataset.parentId) return null;

    const padre = document.querySelector(
        `[data-id="${nodo.dataset.parentId}"]`
    );

    return padre;
}

function construirFilas(fila) {

    const todos = Array.from(fila.querySelectorAll(".nodo-wrapper"))
        .filter(n => n.dataset.id);

    console.log("TODOS LOS NODOS:");
    console.table(todos.map(n => ({
        id: n.dataset.id,
        parentId: n.dataset.parentId
    })));

    const mapa = new Map();

    let filaIndex = 0;

    function recorrer(nodo) {

        if (!nodo) return;

        if (mapa.has(nodo.dataset.id)) return;

        mapa.set(nodo.dataset.id, filaIndex++);

        const hijos = todos.filter(n => n.dataset.parentId === nodo.dataset.id);

        hijos.forEach(h => recorrer(h));
    }

    const raices = todos.filter(n => !n.dataset.parentId);

    if (raices.length === 0) {
        console.error("NO HAY RAICES → TODO SE VA A ROMPER");
    }

    raices.forEach(r => recorrer(r));

    console.log("MAPA FINAL:", mapa);

    return mapa;
}

function alinearFilasGlobal() {

    document.querySelectorAll(".fila").forEach(fila => {

        const columnas = fila.querySelectorAll(".nodos-container");

        // limpiar
        columnas.forEach(col => {
            col.querySelectorAll(".invisible").forEach(e => e.remove());
        });

        const mapa = construirFilas(fila);
        if (mapa.size === 0) {
            console.warn("mapa vacío, no alineo");
            return;
        }

        const maxFilas = Math.max(...mapa.values()) + 1;

        columnas.forEach(col => {

            const nuevaLista = new Array(maxFilas).fill(null);

            Array.from(col.children).forEach(nodo => {
                const index = mapa.get(nodo.dataset.id);
                if (index !== undefined) {
                    nuevaLista[index] = nodo;
                }
            });

            // llenar vacíos
            for (let i = 0; i < maxFilas; i++) {
                if (!nuevaLista[i]) {
                    const spacer = document.createElement("div");
                    spacer.className = "nodo-wrapper invisible";
                    nuevaLista[i] = spacer;
                }
            }

            col.innerHTML = "";
            nuevaLista.forEach(n => col.appendChild(n));
        });

    });
}

function layoutDagre() {

    const g = new dagre.graphlib.Graph();

    g.setGraph({
        rankdir: "LR", // izquierda → derecha
        nodesep: 50,
        ranksep: 120
    });

    g.setDefaultEdgeLabel(() => ({}));

    const nodos = Array.from(document.querySelectorAll(".nodo-wrapper"))
        .filter(n => n.dataset.id);

    // 🔥 registrar nodos
    nodos.forEach(n => {
        g.setNode(n.dataset.id, {
            width: 220,
            height: 70
        });
    });

    // 🔥 registrar relaciones
    nodos.forEach(n => {
        if (n.dataset.parentId) {
            g.setEdge(n.dataset.parentId, n.dataset.id);
        }
    });

    dagre.layout(g);

    // 🔥 aplicar posiciones
    nodos.forEach(n => {

        const pos = g.node(n.dataset.id);

        n.style.left = (pos.x - 110) + "px"; // centro
        n.style.top = (pos.y - 35) + "px";

    });

}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {

    // 🔥 calendario
    actualizarFechasConData();

    // 🔥 inicial tablero
    activarFiltros();

    // 🔥 layout columnas
    actualizarColumnasGrid();

    // 🔥 🔥 REDIBUJAR LÍNEAS (IMPORTANTE)
    setTimeout(() => {
        recalcularTodo();
    }, 150);

});