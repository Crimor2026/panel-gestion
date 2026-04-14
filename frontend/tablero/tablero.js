const filasContainer = document.getElementById("filas");
const addColBtn = document.getElementById("addCol");
const encabezado = document.getElementById("encabezado");

let columnas = 1;
let filas = 0;
let lineas = [];

// 🔥 COLORES
const colores = ["#3498db","#2ecc71","#e67e22","#9b59b6","#e74c3c","#1abc9c"];
let colorIndex = 0;

function irTablero() {
    window.location.href = "/tablero";
}

/* ================= AGREGAR FILA ================= */
function agregarFila() {
    filas++;

    const fila = document.createElement("div");
    fila.className = "fila";

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

        // ✅ AGREGAR NORMAL
        containerDestino.appendChild(nuevoNodo);

        // ✅ ORDEN GLOBAL POR COLOR
        ordenarPorColor(containerDestino);

        // 🔥 LINEA CON COLOR
        setTimeout(() => {

            const linea = new LeaderLine(
                input,
                nuevoNodo.querySelector(".nodo-input"),
                {
                    path: "grid",
                    startSocket: "right",
                    endSocket: "left",
                    color: wrapper.dataset.color,
                    size: 2,
                    dash: { len: 4, gap: 4 }
                }
            );

            // 🔥 FIX: asociar línea a la fila
            linea.fila = filaDOM;

            linea.hide("none");
            linea.show("draw");

            lineas.push(linea);

            setTimeout(() => {
                lineas.forEach(l => l.position());
            }, 100);

        }, 50);

        ajustarColumnas();
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

    const filtros = document.querySelectorAll(".filtro-col");
    const filas = document.querySelectorAll("#filas .fila");

    filas.forEach(fila => {

        let cumpleTodos = true;

        filtros.forEach((inputFiltro, colIndex) => {

            const textoFiltro = inputFiltro.value.toLowerCase().trim();

            const celda = fila.children[colIndex + 1];
            if (!celda) return;

            const nodos = celda.querySelectorAll(".nodo-wrapper");

            // 🔥 sin filtro → mostrar todo
            if (textoFiltro === "") {
                nodos.forEach(n => n.style.display = "flex");
                return;
            }

            let matchEnColumna = false;

            nodos.forEach(nodo => {

                const input = nodo.querySelector(".nodo-input");
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

    // 🔥 eliminar líneas asociadas
    lineas.forEach(l => l.remove());
    lineas = [];

    ultimaFila.remove();
    filas--;

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

                    const ultima = fechas[0];

                    console.log("USANDO:", ultima);

                    // 🔥 CLAVE: usar instance (flatpickr ya listo)
                    instance.setDate(ultima, true);

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

    // 🔥 columnas
    document.querySelectorAll(".titulo-col").forEach(col => {
        data.columnas.push(col.value);
    });

    // 🔥 filas
    document.querySelectorAll("#filas .fila").forEach(fila => {

        const filaData = [];

        const celdas = fila.querySelectorAll(".celda");

        celdas.forEach((celda, i) => {
            if (i === 0) return;

            const nodos = celda.querySelectorAll(".nodo-wrapper");

            const nodosData = [];

            nodos.forEach(nodo => {
                const input = nodo.querySelector(".nodo-input");

                nodosData.push({
                    texto: input.value,
                    color: nodo.dataset.color,
                    parentId: nodo.dataset.parentId || null,
                    id: nodo.dataset.id
                });
            });

            filaData.push(nodosData);
        });

        data.filas.push(filaData);
    });

    fetch("/api/tablero/guardar", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            fecha: fecha,
            data: data
        })
    })
    .then(res => res.json())
    .then(() => {

        // 🔥 IMPORTANTE: refrescar puntitos
        actualizarFechasConData();

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

    const fecha = await pedirFecha();
    if (!fecha) return;

    await guardarTablero(fecha);

    // 🔥 CLAVE 1: recargar tablero con la fecha guardada
    cargarTablero(fecha);

    // 🔥 CLAVE 2: actualizar el calendario visual
    const fp = document.getElementById("fecha")._flatpickr;
    if (fp) {
        fp.setDate(fecha, true);
    }

    // 🔥 CLAVE 3: refrescar puntos del calendario
    actualizarFechasConData();
};


/* ================= CARGAR TABLERO ================= */
function cargarTablero(fecha) {

    fetch(`/api/tablero/${fecha}`)
        .then(res => res.json())
        .then(resp => {

            const data = resp.data;

            // 🔥 LIMPIAR SIEMPRE
            document.getElementById("filas").innerHTML = "";
            lineas.forEach(l => l.remove());
            lineas = [];
            filas = 0;

            if (!data) {
                agregarFila();
                return;
            }

            const parsed = typeof data === "string" ? JSON.parse(data) : data;

            // 🔥 asegurar columnas
            const columnasGuardadas = parsed.columnas.length;

            while (document.querySelectorAll(".columna").length < columnasGuardadas) {
                addColBtn.click();
            }

            parsed.filas.forEach(filaData => {

                agregarFila();

                const filaDOM = document.querySelectorAll("#filas .fila")[filas - 1];

                filaData.forEach((celdaData, colIndex) => {

                    const celda = filaDOM.children[colIndex + 1];
                    if (!celda) return;

                    const container = celda.querySelector(".nodos-container");
                    if (!container) return;

                    celdaData.forEach(nodoData => {

                        const nodo = crearNodo(colIndex, filaDOM);

                        nodo.dataset.id = nodoData.id;
                        nodo.dataset.color = nodoData.color;
                        nodo.dataset.parentId = nodoData.parentId;

                        const input = nodo.querySelector(".nodo-input");
                        input.value = nodoData.texto;

                        aplicarColor(nodo, input);

                        container.appendChild(nodo);
                    });

                });

            });

            // 🔥 🔥 🔥 ORDEN CORRECTO (CLAVE REAL)

            // 1️⃣ Primero deja que el layout se acomode
            setTimeout(() => {

                actualizarColumnasGrid();

                // 2️⃣ Luego crear líneas
                const todosLosNodos = document.querySelectorAll(".nodo-wrapper");

                todosLosNodos.forEach(nodo => {

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
                            color: padre.dataset.color,
                            size: 2,
                            dash: { len: 4, gap: 4 }
                        }
                    );

                    linea.fila = nodo.closest(".fila");

                    linea.hide("none");
                    linea.show("draw");

                    lineas.push(linea);

                });

                // 3️⃣ 🔥 REAJUSTE FINAL (EL FIX REAL)
                setTimeout(() => {
                    lineas.forEach(l => l.position());
                }, 150);

            }, 120);

        });
}

/* ================= CUANDO CAMBIA FECHA ================= */
document.getElementById("fecha").addEventListener("change", () => {

    const inputFecha = document.getElementById("fecha");

    if (!inputFecha.value) return;

    const fecha = flatpickr.parseDate(inputFecha.value, "d/m/Y");
    const fechaKey = fecha.toISOString().split("T")[0];

    cargarTablero(fechaKey);
});

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

    // 🔥 recalcular grid
    actualizarColumnasGrid();

    // 🔥 reconstruir líneas
    setTimeout(() => {

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
                    color: padre.dataset.color,
                    size: 2,
                    dash: { len: 4, gap: 4 }
                }
            );

            linea.fila = nodo.closest(".fila");
            lineas.push(linea);

        });

        setTimeout(() => {
            lineas.forEach(l => l.position());
        }, 100);

    }, 120);
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

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {

    // 🔥 calendario
    actualizarFechasConData();

    // 🔥 inicial tablero
    agregarFila();
    activarFiltros();

    // 🔥 layout columnas
    actualizarColumnasGrid();

});