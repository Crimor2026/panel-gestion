/* =======================================================
   VARIABLES GLOBALES
======================================================= */

// 🔥 CONTENEDORES PRINCIPALES
const tabsContent = document.getElementById("tabsContent");
const tabsContainer = document.getElementById("tabsContainer");

// 🔥 TAB ACTIVA
let tabActual = "principal";

// 🔥 CONTROL GENERAL
let ultimaCargaId = 0;

// 🔥 LEADER LINES
let lineas = [];
let lineasMap = new Map();

// 🔥 OBSERVER
let observer;

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

/* =======================================================
   HELPERS TAB ACTIVA
======================================================= */

// 🔥 PANEL ACTIVO
function getTabPanel() {

    return document.querySelector(
        `.tab-panel[data-tab="${tabActual}"]`
    );
}

// 🔥 FILAS DE TAB ACTIVA
function getFilasContainer() {

    return getTabPanel().querySelector(".filas");
}

// 🔥 ENCABEZADO TAB ACTIVA
function getEncabezado() {

    return getTabPanel().querySelector(".fila.encabezado");
}

// 🔥 BOTÓN ADD COL TAB ACTIVA
function getAddColBtn() {

    return getTabPanel().querySelector(".addCol");
}

// 🔥 COLUMNAS TAB ACTIVA
function getColumnas() {

    return getTabPanel()
        .querySelectorAll(".celda.columna");
}

// 🔥 FILAS TAB ACTIVA
function getFilas() {

    return getTabPanel()
        .querySelectorAll(".fila");
}

// 🔥 NODOS TAB ACTIVA
function getNodos() {

    return getTabPanel()
        .querySelectorAll(".nodo-wrapper");
}

/* ================= PESTAÑAS ================= */

function crearTab(
    nombre,
    id = null,
    activar = true
) {

    // 🔥 ID REAL TAB
    const tabId = id || crypto.randomUUID();

    /* =========================================
       🔥 EVITAR DUPLICADOS
    ========================================= */

    const existe = document.querySelector(
        `.tab[data-tab="${tabId}"]`
    );

    if (existe) {

        console.warn(
            "⚠️ TAB DUPLICADA:",
            tabId
        );

        return existe;
    }

    /* =========================================
       BOTÓN TAB
    ========================================= */

    const tab = document.createElement("div");

    tab.className = "tab";

    tab.innerText = nombre;

    tab.dataset.nombre = nombre;

    tab.dataset.tab = tabId;

    tab.onclick = () => cambiarTab(tab);

    tabsContainer.appendChild(tab);

    /* =========================================
       🔥 GUARDAR TAB EN BD
    ========================================= */

    if (
        !window.cargandoTabs &&
        !window.inicializando
    ) {

        console.error("🔥 GUARDANDO TAB");

        console.log({
            nombre,
            tabId,
            cargandoTabs: window.cargandoTabs,
            inicializando: window.inicializando
        });

        fetch("/api/tablero/tab", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                id: tabId,

                nombre: nombre,

                proyecto_id: 1

            })

        })
        .then(r => r.json())
        .then(data => {

            console.log(
                "💾 TAB GUARDADA",
                data
            );

        })
        .catch(err => {

            console.error(
                "❌ ERROR GUARDANDO TAB",
                err
            );

        });

    }

    /* =========================================
       PANEL REAL TAB
    ========================================= */

    const panel = document.createElement("div");

    panel.className = "tab-panel";

    panel.dataset.tab = tabId;

    panel.style.display = "none";

    panel.innerHTML = `
        <div class="tabla">

            <div class="fila encabezado">

                <div class="celda numero">
                    N°
                </div>

                <div class="celda columna">

                    <div class="header-col">

                        <input
                            class="titulo-col"
                            placeholder="Campo A">

                        <input
                            class="filtro-col"
                            placeholder="Filtrar...">

                    </div>

                </div>

                <div class="celda control-columnas">

                    <div class="agregar-columna addCol">
                        +
                    </div>

                    <div class="eliminar-columna removeCol">
                        -
                    </div>

                </div>

            </div>

            <div class="filas"></div>

            <div class="control-filas">

                <div class="agregar-fila addFila">
                    +
                </div>

                <div class="eliminar-fila removeFila">
                    -
                </div>

            </div>

        </div>
    `;

    tabsContent.appendChild(panel);

    /* =========================================
       🔥 INICIALIZAR TAB
    ========================================= */

    if (activar) {

        agregarFila(panel);

        if (
            !window.inicializando &&
            !window.cargandoTabs
        ) {

            window.creandoTab = true;

            cambiarTab(tab)
                .finally(() => {

                    window.creandoTab = false;

                });

        }

    }

    return tab;
}

async function cambiarTab(tab) {

    console.error("========== cambiarTab ==========");

    console.log("TAB RECIBIDA:", tab);

    console.log("DATASET TAB:", tab?.dataset?.tab);

    console.log("TAB ACTUAL ANTES:", tabActual);

    console.warn("🟡 CAMBIANDO TAB");

    /* ========================================= */
    /* 🔥 GUARDAR TAB ACTUAL ANTES DE CAMBIAR */
    /* ========================================= */

    try {

        const fechaInput =
            document.getElementById("fecha");

        let fechaActual =
            fechaInput.value;

        if (
            fechaActual &&
            tabActual &&
            !window.creandoTab &&
            !window.cargandoTabs &&
            !window.inicializando
        ) {

            fechaActual = fechaActual
                .split("/")
                .reverse()
                .join("-");

            console.log(
                "💾 AUTO GUARDADO:",
                tabActual,
                fechaActual
            );

            const oldTab = tabActual;

            const oldPanel = document.querySelector(
                `.tab-panel[data-tab="${oldTab}"]`
            );

            if (oldPanel) {

                await guardarTablero(
                    fechaActual,
                    oldPanel,
                    oldTab
                );

            }

        }

    } catch (e) {

        console.error(
            "❌ ERROR AUTOGUARDADO",
            e
        );

    }

    /* ========================================= */
    /* 🔥 TAB ANTERIOR */
    /* ========================================= */

    const tabAnterior = tabActual;

    /* ========================================= */
    /* 🔥 DESACTIVAR TABS */
    /* ========================================= */

    document.querySelectorAll(".tab")
        .forEach(t => {

            t.classList.remove("activo");

        });

    /* ========================================= */
    /* 🔥 OCULTAR PANELES */
    /* ========================================= */

    document.querySelectorAll(".tab-panel")
        .forEach(p => {

            p.style.display = "none";

            p.classList.remove("activo");

        });

    /* ========================================= */
    /* 🔥 ACTIVAR TAB */
    /* ========================================= */

    tab.classList.add("activo");

    tabActual = tab.dataset.tab;

    /* ========================================= */
    /* 🔥 VALIDAR PANEL */
    /* ========================================= */

    const panel = document.querySelector(
        `.tab-panel[data-tab="${tabActual}"]`
    );

    if (!panel) {

        console.error(
            "❌ PANEL NO EXISTE:",
            tabActual
        );

        /* =====================================
           🔥 RESTAURAR TAB ANTERIOR
        ===================================== */

        const tabRestaurar = document.querySelector(
            `.tab[data-tab="${tabAnterior}"]`
        );

        if (tabRestaurar) {

            tabRestaurar.classList.add(
                "activo"
            );

            const panelAnterior =
                document.querySelector(
                    `.tab-panel[data-tab="${tabAnterior}"]`
                );

            if (panelAnterior) {

                panelAnterior.style.display =
                    "block";

                panelAnterior.classList.add(
                    "activo"
                );

            }

            tabActual = tabAnterior;

        } else {

            tabActual = "principal";

        }

        return;
    }

    console.log(
        "✅ TAB ACTUAL NUEVA:",
        tabActual
    );

    /* ========================================= */
    /* 🔥 MOSTRAR PANEL */
    /* ========================================= */

    panel.style.display = "block";

    panel.classList.add("activo");

    /* ========================================= */
    /* 🔥 LIMPIAR LINEAS */
    /* ========================================= */

    document.querySelectorAll(".leader-line")
        .forEach(el => {

            el.remove();

        });

    lineasMap.forEach((l) => {

        try {

            l.remove();

        } catch {}

    });

    /* ========================================= */
    /* 🔥 CARGAR DATA TAB */
    /* ========================================= */

    const fechaInput =
        document.getElementById("fecha");

    let fecha =
        fechaInput.value;

    if (fecha) {

        fecha = fecha
            .split("/")
            .reverse()
            .join("-");

        console.log(
            "📥 CARGANDO TAB:",
            tabActual,
            fecha
        );

        await cargarTablero(
            fecha,
            tabActual,
            panel
        );

    }

    /* ========================================= */
    /* 🔥 RECALCULAR */
    /* ========================================= */

    setTimeout(() => {

        recalcularTodo(panel);

    }, 50);

    console.warn("🟢 TAB LISTA");
}

function exportarTableroActual() {

    const panel = getTabPanel();

    if (!panel) {

        console.error("❌ PANEL NO ENCONTRADO");

        return null;
    }

    const data = {
        columnas: [],
        filas: []
    };

    // 🔥 COLUMNAS SOLO DE ESTA TAB
    panel.querySelectorAll(".titulo-col")
        .forEach(col => {

            data.columnas.push(col.value);

        });

    // 🔥 FILAS SOLO DE ESTA TAB
    panel.querySelectorAll(".filas .fila")
        .forEach(fila => {

            const filaData = [];

            const celdas = fila.querySelectorAll(".celda");

            celdas.forEach((celda, i) => {

                if (i === 0) return;

                const nodos = Array.from(
                    celda.querySelectorAll(".nodo-wrapper")
                ).filter(n =>
                    !n.classList.contains("invisible")
                );

                const nodosData = [];

                nodos.forEach(nodo => {

                    const input =
                        nodo.querySelector(".nodo-input");

                    nodosData.push({
                        texto: input ? input.value : "",
                        color: nodo.dataset.color,
                        parentId:
                            nodo.dataset.parentId || null,
                        id: nodo.dataset.id
                    });

                });

                filaData.push(nodosData);

            });

            data.filas.push(filaData);

        });

    return data;
}

function restaurarTablero(data, panel = null) {

    panel = panel || getTabPanel();

    if (!panel) {
        console.error("❌ PANEL NO ENCONTRADO");
        return;
    }

    const filasContainer =
        panel.querySelector(".filas");

    filasContainer.innerHTML = "";

    // 🔥 limpiar líneas
    lineasMap.forEach(l => {
        try { l.remove(); } catch {}
    });

    lineasMap.clear();

    document.querySelectorAll(".leader-line")
        .forEach(el => {
            el.remove();
        });

    // 🔥 columnas actuales
    let columnasActuales =
        panel.querySelectorAll(".celda.columna").length;

    // 🔥 crear columnas faltantes
    const encabezado =
        panel.querySelector(".fila.encabezado");

    while (columnasActuales < data.columnas.length) {

        const nuevaCol = document.createElement("div");

        nuevaCol.className = "celda columna";

        nuevaCol.innerHTML = `
            <div class="header-col">

                <input
                    class="titulo-col"
                    placeholder="Campo">

                <input
                    class="filtro-col"
                    placeholder="Filtrar...">

            </div>
        `;

        encabezado.insertBefore(
            nuevaCol,
            encabezado.querySelector(".control-columnas")
        );

        columnasActuales++;
    }

    // 🔥 restaurar nombres columnas
    panel.querySelectorAll(".titulo-col")
        .forEach((col, i) => {

            col.value = data.columnas[i] || "";

        });

    // 🔥 filas
    data.filas.forEach(filaData => {

        agregarFila(panel);

        const filasDOM =
            panel.querySelectorAll(".filas .fila");

        const filaDOM =
            filasDOM[filasDOM.length - 1];

        filaData.forEach((celdaData, colIndex) => {

            const celda = filaDOM.children[colIndex + 1];

            if (!celda) return;

            const container =
                celda.querySelector(".nodos-container");

            if (!container) return;

            container.innerHTML = "";

            celdaData.forEach(nodoData => {

                const nodo =
                    crearNodo(colIndex, filaDOM, panel);

                nodo.dataset.id = nodoData.id;

                nodo.dataset.color =
                    nodoData.color || "#52BE80";

                if (nodoData.parentId) {

                    nodo.dataset.parentId =
                        nodoData.parentId;
                }

                const input =
                    nodo.querySelector(".nodo-input");

                input.value =
                    nodoData.texto || "";

                aplicarColor(nodo, input);

                container.appendChild(nodo);

            });

        });

    });

    requestAnimationFrame(() => {

        alinearFilasGlobal(panel);

        setTimeout(() => {

            recalcularTodo(panel);

        }, 0);

    });
}

/* ================= IR TABLERO ================= */

function irTablero() {

    window.location.href = "/tablero";
}

/* ================= AGREGAR FILA ================= */

function agregarFila(panel = null) {

    panel = panel || getTabPanel();

    if (!panel) {
        console.error("❌ PANEL NO ENCONTRADO");
        return;
    }

    const filasContainer =
        panel.querySelector(".filas");

    const columnas =
        panel.querySelectorAll(".celda.columna").length;

    const totalFilas =
        filasContainer.querySelectorAll(".fila").length;

    const filaNumero = totalFilas + 1;

    const fila = document.createElement("div");

    fila.className = "fila";

    // 🔥 número
    const num = document.createElement("div");

    num.className = "celda numero";

    num.innerText = filaNumero;

    fila.appendChild(num);

    // 🔥 columnas
    for (let i = 0; i < columnas; i++) {

        fila.appendChild(
            crearCelda(i, fila, panel)
        );
    }

    filasContainer.appendChild(fila);

    actualizarColumnasGrid(panel);

    return fila;
}

/* ================= CREAR CELDA ================= */

function crearCelda(colIndex, filaDOM, panel = null) {

    const celda = document.createElement("div");

    celda.className = "celda";

    const container = document.createElement("div");

    container.className = "nodos-container";

    // 🔥 primera columna crea nodo raíz
    if (colIndex === 0) {

        container.appendChild(
            crearNodo(colIndex, filaDOM, panel)
        );
    }

    celda.appendChild(container);

    return celda;
}

/* ================= CREAR NODO ================= */

function crearNodo(colIndex, filaDOM, panel = null) {

    panel = panel || getTabPanel();

    const wrapper = document.createElement("div");

    wrapper.className = "nodo-wrapper";

    wrapper.dataset.id =
        Math.random().toString(36).substr(2, 9);

    wrapper.dataset.color =
        colores[colorIndex % colores.length];

    colorIndex++;

    const input = document.createElement("textarea");

    input.className = "nodo-input";

    aplicarColor(wrapper, input);

    // 🔥 autosize
    input.addEventListener("input", () => {

        input.style.height = "auto";

        input.style.height =
            input.scrollHeight + "px";

        recalcularTodo(panel);

    });

    /* ================= CONTROLES ================= */

    const controles = document.createElement("div");

    controles.className = "nodo-controles";

    // ➕
    const btnAdd = document.createElement("div");

    btnAdd.className = "nodo";

    btnAdd.innerText = "+";

    // ➖
    const btnRemove = document.createElement("div");

    btnRemove.className = "nodo eliminar";

    btnRemove.innerText = "-";

    /* ================= ADD ================= */

    btnAdd.onclick = () => {

        const columnas =
            panel.querySelectorAll(".celda.columna").length;

        const nextIndex = colIndex + 1;

        // 🔥 crear columna si falta
        if (nextIndex >= columnas) {

            const addBtn =
                panel.querySelector(".addCol");

            if (addBtn) {
                addBtn.click();
            }
        }

        const celdaDestino =
            filaDOM.children[nextIndex + 1];

        if (!celdaDestino) return;

        const containerDestino =
            celdaDestino.querySelector(".nodos-container");

        if (!containerDestino) return;

        const nuevoNodo =
            crearNodo(nextIndex, filaDOM, panel);

        // 🔥 relación
        nuevoNodo.dataset.parentId =
            wrapper.dataset.id;

        // 🔥 color rama
        if (!wrapper.dataset.parentId) {

            nuevoNodo.dataset.color =
                colores[colorIndex % colores.length];

            colorIndex++;

        } else {

            nuevoNodo.dataset.color =
                wrapper.dataset.color;
        }

        const inputHijo =
            nuevoNodo.querySelector(".nodo-input");

        aplicarColor(nuevoNodo, inputHijo);

        containerDestino.appendChild(nuevoNodo);

        requestAnimationFrame(() => {

            alinearFilasGlobal(panel);

            setTimeout(() => {

                recalcularTodo(panel);

            }, 0);

        });
    };

    /* ================= REMOVE ================= */

    btnRemove.onclick = () => {

        wrapper.remove();

        requestAnimationFrame(() => {

            alinearFilasGlobal(panel);

            setTimeout(() => {

                recalcularTodo(panel);

            }, 0);

        });
    };

    controles.appendChild(btnAdd);

    controles.appendChild(btnRemove);

    wrapper.appendChild(input);

    wrapper.appendChild(controles);

    return wrapper;
}

/* ================= COLOR ================= */

function aplicarColor(nodo, input) {

    const color =
        nodo.dataset.color || "#52BE80";

    // 🔥 limpiar estilos viejos
    input.style.border = "none";

    input.style.outline = "none";

    // 🔥 borde elegante
    input.style.boxShadow =
        `0 0 0 2px ${color}`;

    // 🔥 fondo suave transparente
    input.style.background =
        color + "15";

    // 🔥 transición suave
    input.style.transition =
        "all 0.15s ease";
}

/* ================= AGREGAR COLUMNA ================= */

function agregarColumna(panel = null) {

    panel = panel || getTabPanel();

    if (!panel) {

        console.error("❌ PANEL NO ENCONTRADO");

        return;
    }

    const encabezado =
        panel.querySelector(".fila.encabezado");

    const filas =
        panel.querySelectorAll(".filas .fila");

    const columnasActuales =
        encabezado.querySelectorAll(".columna").length;

    const nuevaCol = document.createElement("div");

    nuevaCol.className = "celda columna";

    nuevaCol.innerHTML = `
        <div class="header-col">

            <input
                class="titulo-col"
                placeholder="Campo ${columnasActuales + 1}">

            <input
                class="filtro-col"
                placeholder="Filtrar...">

        </div>
    `;

    encabezado.insertBefore(
        nuevaCol,
        encabezado.querySelector(".control-columnas")
    );

    filas.forEach(fila => {

        fila.appendChild(
            crearCelda(columnasActuales, fila, panel)
        );

    });

    actualizarColumnasGrid(panel);

    activarFiltros(panel);

    setTimeout(() => {

        recalcularTodo(panel);

    }, 0);
}

/* ================= ORDEN COLOR ================= */

function ordenarPorColor(container) {

    if (!container) return;

    const nodos = Array.from(container.children);

    nodos.sort((a, b) => {

        return (a.dataset.color || "")
            .localeCompare(b.dataset.color || "");

    });

    nodos.forEach(n => {

        container.appendChild(n);

    });
}

/* ================= FILTRO ================= */

function aplicarFiltro(panel = null) {

    panel = panel || getTabPanel();

    if (!panel) {

        console.error("❌ PANEL NO ENCONTRADO");

        return;
    }

    // 🔥 resetear visibilidad SOLO de esta tab
    panel.querySelectorAll(".nodo-wrapper")
        .forEach(n => {

            n.style.display = "flex";

        });

    const filtros =
        panel.querySelectorAll(".filtro-col");

    const filas =
        panel.querySelectorAll(".filas .fila");

    filas.forEach(fila => {

        let cumpleTodos = true;

        filtros.forEach((inputFiltro, colIndex) => {

            const textoFiltro =
                inputFiltro.value
                    .toLowerCase()
                    .trim();

            const celda =
                fila.children[colIndex + 1];

            if (!celda) return;

            const nodos =
                celda.querySelectorAll(".nodo-wrapper");

            // 🔥 filtro vacío
            if (textoFiltro === "") {

                nodos.forEach(n => {

                    n.style.display = "flex";

                });

                return;
            }

            let matchEnColumna = false;

            nodos.forEach(nodo => {

                const input =
                    nodo.querySelector(".nodo-input");

                if (!input) {

                    nodo.style.display = "none";

                    return;
                }

                const texto =
                    input.value.toLowerCase();

                const coincide =
                    texto.includes(textoFiltro);

                nodo.style.display =
                    coincide ? "flex" : "none";

                if (coincide) {

                    matchEnColumna = true;

                }

            });

            if (!matchEnColumna) {

                cumpleTodos = false;

            }

        });

        // 🔥 mostrar/ocultar fila
        fila.style.display =
            cumpleTodos ? "grid" : "none";

    });

    // 🔥 refrescar líneas SOLO visualmente
    requestAnimationFrame(() => {

        lineasMap.forEach((linea, key) => {

            try {

                const origenVisible =
                    linea.start?.offsetParent !== null;

                const destinoVisible =
                    linea.end?.offsetParent !== null;

                if (
                    origenVisible &&
                    destinoVisible
                ) {

                    linea.show("none");

                    linea.position();

                } else {

                    linea.hide("none");

                }

            } catch (e) {

                console.warn(
                    "💀 línea inválida removida",
                    key
                );

                try { linea.remove(); } catch {}

                lineasMap.delete(key);
            }

        });

    });
}

/* ================= ACTIVAR FILTROS ================= */

function activarFiltros(panel = null) {

    panel = panel || getTabPanel();

    if (!panel) {

        console.error("❌ PANEL NO ENCONTRADO");

        return;
    }

    panel.querySelectorAll(".filtro-col")
        .forEach(input => {

            // 🔥 evitar listeners duplicados
            input.removeEventListener(
                "input",
                input._filtroHandler
            );

            // 🔥 guardar referencia handler
            input._filtroHandler = () => {

                aplicarFiltro(panel);

            };

            input.addEventListener(
                "input",
                input._filtroHandler
            );

        });
}

/* ================= ELIMINAR FILA ================= */

function eliminarFila(panel = null) {

    panel = panel || getTabPanel();

    if (!panel) {

        console.error("❌ PANEL NO ENCONTRADO");

        return;
    }

    const filasDOM =
        panel.querySelectorAll(".filas .fila");

    if (filasDOM.length === 0) return;

    const ultimaFila =
        filasDOM[filasDOM.length - 1];

    // 🔥 limpiar líneas reales
    lineasMap.forEach((l, key) => {

        try { l.remove(); } catch {}

    });

    lineasMap.clear();

    document.querySelectorAll(".leader-line")
        .forEach(el => el.remove());

    // 🔥 eliminar fila
    ultimaFila.remove();

    requestAnimationFrame(() => {

        document.body.offsetHeight;

        alinearFilasGlobal(panel);

        requestAnimationFrame(() => {

            recalcularTodo(panel);

        });

    });
}

/* ================= ELIMINAR COLUMNA ================= */

function eliminarColumna(panel = null) {

    panel = panel || getTabPanel();

    if (!panel) {

        console.error("❌ PANEL NO ENCONTRADO");

        return;
    }

    const encabezado =
        panel.querySelector(".fila.encabezado");

    const columnas =
        encabezado.querySelectorAll(".columna");

    // 🔥 evitar borrar la última
    if (columnas.length <= 1) return;

    const ultimaCol =
        columnas[columnas.length - 1];

    if (ultimaCol) {

        ultimaCol.remove();

    }

    // 🔥 eliminar celdas de filas
    panel.querySelectorAll(".filas .fila")
        .forEach(fila => {

            if (fila.children.length > 1) {

                fila.removeChild(
                    fila.lastChild
                );

            }

        });

    // 🔥 limpiar líneas
    lineasMap.forEach((l, key) => {

        try { l.remove(); } catch {}

    });

    lineasMap.clear();

    document.querySelectorAll(".leader-line")
        .forEach(el => el.remove());

    actualizarColumnasGrid(panel);

    requestAnimationFrame(() => {

        document.body.offsetHeight;

        alinearFilasGlobal(panel);

        requestAnimationFrame(() => {

            recalcularTodo(panel);

        });

    });
}

/* ================= EVENTOS GLOBALES ================= */

document.addEventListener("click", e => {

    const panel = getTabPanel();

    if (!panel) return;

    // ➕ agregar fila
    if (
        e.target.classList.contains("addFila")
    ) {

        agregarFila(panel);

        activarFiltros(panel);

        setTimeout(() => {

            recalcularTodo(panel);

        }, 0);
    }

    // ➖ eliminar fila
    if (
        e.target.classList.contains("removeFila")
    ) {

        eliminarFila(panel);

    }

    // ➕ agregar columna
    if (
        e.target.classList.contains("addCol")
    ) {

        agregarColumna(panel);

    }

    // ➖ eliminar columna
    if (
        e.target.classList.contains("removeCol")
    ) {

        eliminarColumna(panel);

    }

});

/* ================= CALENDARIO ================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        flatpickr("#fecha", {

            dateFormat: "d/m/Y",

            locale: "es",

            allowInput: true,

            /* ================= READY ================= */

            onReady: async function (
                selectedDates,
                dateStr,
                instance
            ) {

                try {

                    const res =
                        await fetch(
                            "/api/tablero/fechas"
                        );

                    const fechas =
                        await res.json();

                    console.log(
                        "FECHAS BACK:",
                        fechas
                    );

                    // 🔥 NO CARGAR ÚLTIMA FECHA
                    // 🔥 INICIAR VACÍO

                    instance.clear();

                    // 🔥 LIMPIAR FILAS
                    const panel =
                        getTabPanel();

                    const filasContainer =
                        panel.querySelector(".filas");

                    filasContainer.innerHTML = "";

                    // 🔥 LIMPIAR LINEAS
                    lineasMap.forEach((l) => {

                        try {

                            l.remove();

                        } catch {}

                    });

                    lineasMap.clear();

                    document.querySelectorAll(".leader-line")
                        .forEach(el => {

                            el.remove();

                        });

                    // 🔥 DEJAR SOLO 1 COLUMNA
                    const encabezado =
                        panel.querySelector(
                            ".fila.encabezado"
                        );

                    while (
                        encabezado.querySelectorAll(
                            ".columna"
                        ).length > 1
                    ) {

                        encabezado.querySelectorAll(
                            ".columna"
                        )[
                            encabezado.querySelectorAll(
                                ".columna"
                            ).length - 1
                        ].remove();

                    }

                    actualizarColumnasGrid(panel);

                    // 🔥 CREAR FILA VACÍA
                    agregarFila(panel);

                    // 🔥 MARCADORES ROJOS
                    setTimeout(() => {

                        instance.redraw();

                        requestAnimationFrame(() => {

                            actualizarFechasConData();

                        });

                    }, 300);

                } catch (err) {

                    console.error(
                        "❌ Error fechas:",
                        err
                    );

                    agregarFila(
                        getTabPanel()
                    );

                }

            },

            /* ================= OPEN ================= */

            onOpen(
                selectedDates,
                dateStr,
                instance
            ) {

                setTimeout(() => {

                    instance.redraw();

                    requestAnimationFrame(() => {

                        actualizarFechasConData();

                    });

                }, 50);

            },

            /* ================= MONTH CHANGE ================= */

            onMonthChange(
                selectedDates,
                dateStr,
                instance
            ) {

                setTimeout(() => {

                    instance.redraw();

                    requestAnimationFrame(() => {

                        actualizarFechasConData();

                    });

                }, 50);

            },

            /* ================= YEAR CHANGE ================= */

            onYearChange(
                selectedDates,
                dateStr,
                instance
            ) {

                setTimeout(() => {

                    instance.redraw();

                    requestAnimationFrame(() => {

                        actualizarFechasConData();

                    });

                }, 50);

            },

            /* ================= CHANGE ================= */

            onChange: async function(selectedDates) {

                if (window.inicializando) {
                    return;
                }

                const fecha =
                    selectedDates[0];

                if (!fecha) return;

                const fechaKey =
                    fecha.getFullYear() + "-" +
                    String(
                        fecha.getMonth() + 1
                    ).padStart(2, "0") + "-" +
                    String(
                        fecha.getDate()
                    ).padStart(2, "0");

                console.warn(
                    "📅 CAMBIO FECHA:",
                    fechaKey
                );

                await cargarTabsGuardadas(
                    fechaKey
                );

                await cargarTablero(
                    fechaKey,
                    tabActual,
                    getTabPanel()
                );

                // 🔥 REFRESCAR MARCADORES ROJOS
                setTimeout(() => {

                    actualizarFechasConData();

                }, 100);

            }

        });

    }
);

/* ================= GUARDAR TABLERO ================= */

async function guardarTablero(
    fecha,
    panel = null,
    tabId = null
) {

    panel = panel || getTabPanel();

    /* =========================================
       🔥 VALIDAR PANEL REAL
    ========================================= */

    const tabObjetivo =
        tabId || tabActual;

    console.error(
        "======== VALIDACION TAB ========"
    );

    console.log({

        tabActual,

        tabIdRecibido: tabId,

        panelDataset:
            panel?.dataset?.tab,

        mismoPanel:
            tabObjetivo ===
            panel?.dataset?.tab
    });

    // 🔥 FIX REAL
    if (
        !panel ||
        panel.dataset.tab !== tabObjetivo
    ) {

        console.error(
            "💀 PANEL INCORRECTO"
        );

        console.log({

            esperado:
                tabObjetivo,

            recibido:
                panel?.dataset?.tab
        });

        panel = document.querySelector(
            `.tab-panel[data-tab="${tabObjetivo}"]`
        );

        console.warn(
            "🔥 PANEL CORREGIDO:",
            panel
        );
    }

    if (!panel) {

        console.error(
            "❌ PANEL NO ENCONTRADO"
        );

        return;
    }

    console.error(
        "======== DEBUG GUARDAR ========"
    );

    console.log(
        "TAB ACTUAL:",
        tabActual
    );

    console.log(
        "TAB OBJETIVO:",
        tabObjetivo
    );

    console.log(
        "PANEL:",
        panel
    );

    console.log(
        "FILAS:",
        panel.querySelectorAll(".fila").length
    );

    console.log(
        "NODOS:",
        panel.querySelectorAll(".nodo-wrapper").length
    );

    console.log(
        "HTML:",
        panel.innerHTML.slice(0, 1000)
    );

    const data = {
        columnas: [],
        filas: []
    };

    // 🔥 DEBUG
    console.log(
        "💾 GUARDANDO TAB:",
        tabObjetivo
    );

    console.log(
        "📦 NODOS:",
        panel.querySelectorAll(".nodo-wrapper").length
    );

    /* ================= COLUMNAS ================= */

    panel.querySelectorAll(".titulo-col")
        .forEach(col => {

            data.columnas.push(
                col.value
            );

        });

    /* ================= FILAS ================= */

    // 🔥 FIX FILAS OCULTAS
    const filas = Array.from(
        panel.querySelectorAll(
            ".filas .fila"
        )
    ).filter(fila =>
        fila.style.display !== "none"
    );

    filas.forEach(fila => {

        const filaData = [];

        const celdas =
            fila.querySelectorAll(
                ".celda"
            );

        celdas.forEach((celda, i) => {

            if (i === 0) return;

            const nodos = Array.from(
                celda.querySelectorAll(
                    ".nodo-wrapper"
                )
            ).filter(n =>

                !n.classList.contains(
                    "invisible"
                ) &&

                n.style.display !== "none"
            );

            const nodosData = [];

            nodos.forEach(nodo => {

                const input =
                    nodo.querySelector(
                        ".nodo-input"
                    );

                nodosData.push({

                    texto:
                        input
                            ? input.value
                            : "",

                    color:
                        nodo.dataset.color,

                    parentId:
                        nodo.dataset.parentId || null,

                    id:
                        nodo.dataset.id

                });

            });

            filaData.push(
                nodosData
            );

        });

        data.filas.push(
            filaData
        );

    });

    console.log(
        "📄 JSON:",
        JSON.stringify(
            data,
            null,
            2
        )
    );

    try {

        const res = await fetch(
            "/api/tablero/guardar",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    fecha,

                    data,

                    proyecto_id: 1,

                    // 🔥 FIX TAB REAL
                    tab: tabObjetivo
                })
            }
        );

        if (!res.ok) {

            const text =
                await res.text();

            console.error(
                "❌ ERROR BACK:",
                text
            );

            throw new Error(
                "Error guardando tablero"
            );
        }

        const json =
            await res.json();

        console.log(
            "✅ GUARDADO OK",
            json
        );

        actualizarFechasConData();

        return json;

    } catch (err) {

        console.error(
            "🔥 ERROR GUARDANDO:",
            err
        );

        throw err;
    }
}

/* ================= MARCAR FECHAS ================= */

function actualizarFechasConData() {

    fetch(`/api/tablero/fechas`)
        .then(res => res.json())
        .then(response => {

            // 🔥 FIX REAL
            const fechas = Array.isArray(response)
                ? response
                : [];

            console.log("📅 FECHAS:", fechas);

            const fp =
                document.getElementById(
                    "fecha"
                )._flatpickr;

            if (!fp) return;

            requestAnimationFrame(() => {

                const days =
                    fp.calendarContainer
                        .querySelectorAll(
                            ".flatpickr-day"
                        );

                days.forEach(day => {

                    day.classList.remove(
                        "tiene-data"
                    );

                    if (!day.dateObj) return;

                    const f =
                        day.dateObj.getFullYear()
                        + "-"
                        + String(
                            day.dateObj.getMonth() + 1
                        ).padStart(2, "0")
                        + "-"
                        + String(
                            day.dateObj.getDate()
                        ).padStart(2, "0");

                    if (fechas.includes(f)) {

                        day.classList.add(
                            "tiene-data"
                        );

                    }

                });

            });

        })
        .catch(err => {

            console.error(
                "❌ ERROR FECHAS:",
                err
            );

        });
}

/* ================= BOTÓN GUARDAR ================= */

document.getElementById("guardar")
.onclick = async () => {

    try {

        const fecha =
            await pedirFecha();

        if (!fecha) return;

        modoCarga = true;

        /* =====================================
           🔥 GUARDAR TODAS LAS TABS
        ===================================== */

        const tabs =
            document.querySelectorAll(".tab");

        for (const tab of tabs) {

            const tabId =
                tab.dataset.tab;

            const panel =
                document.querySelector(
                    `.tab-panel[data-tab="${tabId}"]`
                );

            if (!panel) {

                console.warn(
                    "⚠️ PANEL NO EXISTE",
                    tabId
                );

                continue;
            }

            console.log(
                "💾 GUARDANDO TAB:",
                tabId
            );

            await guardarTablero(
                fecha,
                panel,
                tabId
            );

        }

        modoCarga = false;

        console.log(
            "✔ TODAS LAS TABS GUARDADAS"
        );

        const fp =
            document.getElementById(
                "fecha"
            )._flatpickr;

        if (fp) {

            fp.setDate(
                fecha,
                false
            );

        }

        await cargarTablero(
            fecha,
            tabActual,
            getTabPanel()
        );

        actualizarFechasConData();

    } catch (e) {

        console.error(
            "❌ Error guardar:",
            e
        );

        modoCarga = false;
    }

};

let cargandoTablero = false;

let modoCarga = false;

/* ================= CARGAR TABLERO ================= */

async function cargarTablero(
    fecha,
    tabId,
    panel = null
) {

    panel = panel || getTabPanel();

    if (!panel) {

        console.error(
            "❌ PANEL NO ENCONTRADO"
        );

        return;
    }

    /* ================= TOKEN CARGA ================= */

    const cargaId = ++ultimaCargaId;

    modoCarga = true;

    cargandoTablero = true;

    const filasContainer =
        panel.querySelector(".filas");

    filasContainer.dataset.cargando =
        "true";

    try {

        const res = await fetch(
            `/api/tablero/${fecha}?proyecto_id=1&tab=${tabId}`
        );

        if (cargaId !== ultimaCargaId)
            return;

        if (!res.ok) {

            throw new Error(
                "HTTP " + res.status
            );
        }

        const resp =
            await res.json();

        if (cargaId !== ultimaCargaId)
            return;

        console.log(
            "📥 RESPUESTA:",
            resp
        );

        let data = resp.data;

        /* ================= DATA VACÍA ================= */

        if (!data) {

            console.warn("⚠️ DATA VACÍA");

            // 🔥 LIMPIAR FILAS
            filasContainer.innerHTML = "";

            // 🔥 LIMPIAR LINEAS
            lineasMap.forEach((l) => {

                try {

                    l.remove();

                } catch {}

            });

            lineasMap.clear();

            document.querySelectorAll(".leader-line")
                .forEach(el => {

                    el.remove();

                });

            // 🔥 RESETEAR COLORES
            colorIndex = 0;

            // 🔥 RESET COLUMNAS
            columnasActuales = 1;

            const encabezado =
                panel.querySelector(
                    ".fila.encabezado"
                );

            // 🔥 ELIMINAR COLUMNAS SOBRANTES
            while (
                encabezado.querySelectorAll(
                    ".columna"
                ).length > 1
            ) {

                encabezado.querySelectorAll(
                    ".columna"
                )[
                    encabezado.querySelectorAll(
                        ".columna"
                    ).length - 1
                ].remove();

            }

            // 🔥 GRID RESET
            actualizarColumnasGrid(panel);

            // 🔥 CREAR FILA VACÍA
            agregarFila(panel);

            requestAnimationFrame(() => {

                alinearFilasGlobal(panel);

                setTimeout(() => {

                    recalcularTodo(panel);

                }, 0);

            });

            return;
        }

        /* ================= PARSE ================= */

        try {

            if (typeof data === "string") {

                data = JSON.parse(data);

            }

            if (typeof data === "string") {

                data = JSON.parse(data);

            }

        } catch (e) {

            console.error(
                "❌ ERROR JSON:",
                e
            );

            return;
        }

        console.log(
            "📦 DATA FINAL:",
            data
        );

        /* ================= LIMPIAR ================= */

        filasContainer.innerHTML = "";

        lineasMap.forEach((l, key) => {

            try { l.remove(); } catch {}

        });

        lineasMap.clear();

        document.querySelectorAll(
            ".leader-line"
        ).forEach(el => {

            el.remove();

        });

        colorIndex = 0;

        /* ================= COLUMNAS ================= */

        const encabezado =
            panel.querySelector(
                ".fila.encabezado"
            );

        const columnasGuardadas =
            data.columnas?.length || 1;

        // 🔥 limpiar columnas extras
        while (
            encabezado.querySelectorAll(
                ".columna"
            ).length > columnasGuardadas
        ) {

            const cols =
                encabezado.querySelectorAll(
                    ".columna"
                );

            if (cols.length <= 1)
                break;

            cols[
                cols.length - 1
            ].remove();
        }

        // 🔥 agregar columnas faltantes
        while (
            encabezado.querySelectorAll(
                ".columna"
            ).length < columnasGuardadas
        ) {

            agregarColumna(panel);
        }

        // 🔥 títulos
        panel.querySelectorAll(
            ".titulo-col"
        ).forEach((input, i) => {

            input.value =
                data.columnas[i]
                || `Campo ${i + 1}`;

        });

        /* ================= FILAS ================= */

        data.filas.forEach(filaData => {

            agregarFila(panel);

            const filasDOM =
                panel.querySelectorAll(
                    ".filas .fila"
                );

            const filaDOM =
                filasDOM[
                    filasDOM.length - 1
                ];

            filaData.forEach(
                (celdaData, colIndex) => {

                const celda =
                    filaDOM.children[
                        colIndex + 1
                    ];

                if (!celda) return;

                const container =
                    celda.querySelector(
                        ".nodos-container"
                    );

                if (!container) return;

                container.innerHTML = "";

                if (
                    !celdaData ||
                    celdaData.length === 0
                ) {
                    return;
                }

                celdaData.forEach(
                    nodoData => {

                    const nodo =
                        crearNodo(
                            colIndex,
                            filaDOM,
                            panel
                        );

                    nodo.dataset.id =
                        String(
                            nodoData.id
                        );

                    nodo.dataset.color =
                        nodoData.color
                        || "#52BE80";

                    if (
                        nodoData.parentId !==
                        null &&
                        nodoData.parentId !==
                        undefined
                    ) {

                        nodo.dataset.parentId =
                            String(
                                nodoData.parentId
                            );

                    }

                    const input =
                        nodo.querySelector(
                            ".nodo-input"
                        );

                    if (input) {

                        input.value =
                            nodoData.texto || "";

                    }

                    aplicarColor(
                        nodo,
                        input
                    );

                    container.appendChild(
                        nodo
                    );

                });

            });

        });

        /* ================= FINAL ================= */

        requestAnimationFrame(() => {

            alinearFilasGlobal(panel);

            limpiarFilasVacias(panel);

            requestAnimationFrame(() => {

                recalcularTodo(panel);

            });

        });

    } catch (err) {

        console.error(
            "🔥 ERROR CARGA:",
            err
        );

    } finally {

        modoCarga = false;

        cargandoTablero = false;

        delete filasContainer.dataset.cargando;
    }
}

/* ================= PEDIR FECHA ================= */

function pedirFecha() {

    return new Promise(resolve => {

        const overlay =
            document.createElement("div");

        overlay.className =
            "modal-overlay";

        const modal =
            document.createElement("div");

        modal.className =
            "modal-box";

        modal.innerHTML = `
            <div class="modal-title">
                ¿En qué fecha deseas guardar este reporte?
            </div>

            <input
                type="date"
                class="modal-input">

            <div class="modal-actions">

                <button class="btn-cancel">
                    Cancelar
                </button>

                <button class="btn-ok">
                    Aceptar
                </button>

            </div>
        `;

        overlay.appendChild(modal);

        document.body.appendChild(overlay);

        const input =
            modal.querySelector(".modal-input");

        const hoy = new Date();

        const yyyy = hoy.getFullYear();

        const mm = String(
            hoy.getMonth() + 1
        ).padStart(2, "0");

        const dd = String(
            hoy.getDate()
        ).padStart(2, "0");

        input.value = `${yyyy}-${mm}-${dd}`;

        // 🔥 cancelar
        modal.querySelector(".btn-cancel")
            .onclick = () => {

                overlay.remove();

                resolve(null);

            };

        // 🔥 aceptar
        modal.querySelector(".btn-ok")
            .onclick = () => {

                if (!input.value) {

                    alert(
                        "Selecciona una fecha"
                    );

                    return;
                }

                overlay.remove();

                resolve(input.value);

            };

    });
}

/* ================= GRID COLUMNAS ================= */

function actualizarColumnasGrid(
    panel = null
) {

    panel = panel || getTabPanel();

    if (!panel) {

        console.error(
            "❌ PANEL NO ENCONTRADO"
        );

        return;
    }

    const total =
        panel.querySelectorAll(
            ".columna"
        ).length;

    panel.querySelectorAll(".fila")
        .forEach(fila => {

            fila.style.setProperty(
                "--cols",
                total
            );

        });
}

/* ================= DEBUG NODOS ================= */

function debugNodos(panel = null) {

    panel = panel || getTabPanel();

    if (!panel) return;

    console.log(
        "===== DEBUG NODOS ====="
    );

    panel.querySelectorAll(
        ".nodo-wrapper"
    ).forEach(n => {

        console.log({

            id:
                n.dataset.id,

            parent:
                n.dataset.parentId,

            color:
                n.dataset.color,

            visible:
                n.offsetParent !== null,

            conectado:
                n.isConnected

        });

    });
}

/* ================= DEBUG LINEAS ================= */

window.debugRecalcular = 0;

/* ================= RECALCULAR ================= */

function recalcularTodo(
    panel = null,
    intento = 0
) {

    panel = panel || getTabPanel();

    if (!panel) {

        console.error(
            "❌ PANEL NO ENCONTRADO"
        );

        return;
    }

    window.debugRecalcular++;

    console.warn(
        "🔄 RECALCULAR #" +
        window.debugRecalcular,
        {
            tab: tabActual,
            intento
        }
    );

    const filasContainer =
        panel.querySelector(".filas");

    if (
        !filasContainer ||
        filasContainer.children.length === 0
    ) {

        console.warn(
            "⛔ DOM VACÍO"
        );

        return;
    }

    /* ================= LIMPIEZA ================= */

    document.querySelectorAll(
        ".leader-line"
    ).forEach(el => {

        el.remove();

    });

    lineasMap.forEach((l, key) => {

        try {

            l.remove();

        } catch {}

    });

    lineasMap.clear();

    /* ================= RAF ================= */

    requestAnimationFrame(() => {

        const usadas = new Set();

        const nodos =
            panel.querySelectorAll(
                ".nodo-wrapper:not(.invisible)"
            );

        nodos.forEach(nodo => {

            let parentId =
                nodo.dataset.parentId;

            if (
                !parentId ||
                parentId === "null"
            ) {
                return;
            }

            parentId = String(parentId);

            const padre =
                panel.querySelector(
                    `.nodo-wrapper[data-id="${parentId}"]:not(.invisible)`
                );

            if (!padre) {

                console.warn(
                    "⚠️ PADRE NO EXISTE",
                    {
                        hijo:
                            nodo.dataset.id,
                        parentId
                    }
                );

                if (intento < 2) {

                    requestAnimationFrame(
                        () =>
                            recalcularTodo(
                                panel,
                                intento + 1
                            )
                    );
                }

                return;
            }

            const inputPadre =
                padre.querySelector(
                    ".nodo-input"
                );

            const inputHijo =
                nodo.querySelector(
                    ".nodo-input"
                );

            if (
                !inputPadre ||
                !inputHijo
            ) {

                console.warn(
                    "⚠️ INPUTS NO ENCONTRADOS"
                );

                return;
            }

            // 🔥 validar conexión DOM
            if (
                !inputPadre.isConnected ||
                !inputHijo.isConnected
            ) {

                console.error(
                    "💀 NODOS DESCONECTADOS"
                );

                return;
            }

            // 🔥 validar DOM REAL
            if (
                !document.body.contains(inputPadre) ||
                !document.body.contains(inputHijo)
            ) {

                console.warn(
                    "⚠️ ELEMENTOS FUERA DEL DOM"
                );

                return;
            }

            // 🔥 forzar layout
            padre.offsetHeight;

            nodo.offsetHeight;

            const r1 =
                inputPadre
                    .getBoundingClientRect();

            const r2 =
                inputHijo
                    .getBoundingClientRect();

            // 🔥 validar tamaño
            if (
                r1.width === 0 ||
                r2.width === 0
            ) {

                console.warn(
                    "⚠️ NODO SIN TAMAÑO"
                );

                if (intento < 2) {

                    requestAnimationFrame(
                        () =>
                            recalcularTodo(
                                panel,
                                intento + 1
                            )
                    );
                }

                return;
            }

            const key =
                parentId
                + "->"
                + nodo.dataset.id;

            usadas.add(key);

            const colorLinea =
                padre.dataset.color
                || nodo.dataset.color
                || "#4CAF50";

            /* ================= CREAR LINEA ================= */

            let linea;

            try {

                console.log(
                    "🟢 CREANDO LINEA",
                    key
                );

                linea = new LeaderLine(
                    inputPadre,
                    inputHijo,
                    {
                        path: "grid",

                        startSocket:
                            "right",

                        endSocket:
                            "left",

                        startSocketGravity:
                            [20, 0],

                        endSocketGravity:
                            [0, 0],

                        color:
                            colorLinea,

                        size: 2,

                        dash: {
                            len: 4,
                            gap: 4
                        },

                        appendTo:
                            document.body
                    }
                );

            } catch (e) {

                console.error(
                    "❌ ERROR LINEA",
                    {
                        key,
                        error: e
                    }
                );

                return;
            }

            linea.fila =
                nodo.closest(".fila");

            lineasMap.set(
                key,
                linea
            );

        });

        /* ================= POSITION ================= */

        requestAnimationFrame(() => {

            lineasMap.forEach(
                (l, key) => {

                try {

                    l.position();

                } catch (e) {

                    console.error(
                        "❌ ERROR POSITION",
                        {
                            key,
                            error: e
                        }
                    );

                    try {

                        l.remove();

                    } catch {}

                    lineasMap.delete(key);
                }

            });

        });

    });
}

/* ================= CARGAR ÚLTIMA FECHA ================= */

async function cargarUltimaFecha() {

    fetch("/api/tablero/fechas")

        .then(res => res.json())

        .then(async fechas => {

            if (
                !fechas ||
                fechas.length === 0
            ) {
                return;
            }

            const ultima = fechas[0];

            const fp =
                document.getElementById(
                    "fecha"
                )._flatpickr;

            // 🔥 usar calendario
            if (fp) {

                // 🔥 NO disparar onChange
                fp.setDate(
                    ultima,
                    false
                );

                // 🔥 cargar manualmente
                await cargarTablero(
                    ultima,
                    tabActual,
                    getTabPanel()
                );

            } else {

                await cargarTablero(
                    ultima,
                    tabActual,
                    getTabPanel()
                );

            }

        })

        .catch(err => {

            console.error(
                "❌ Error fechas:",
                err
            );

        });
}

/* ================= CALCULAR NIVEL ================= */

function calcularNivel(
    nodo,
    panel = null
) {

    panel = panel || getTabPanel();

    if (!panel || !nodo) return 0;

    let nivel = 0;

    let actual = nodo;

    while (
        actual &&
        actual.dataset.parentId
    ) {

        const padre =
            panel.querySelector(
                `[data-id="${actual.dataset.parentId}"]`
            );

        if (!padre) break;

        nivel++;

        actual = padre;
    }

    return nivel;
}

/* ================= OBTENER PADRE ================= */

function obtenerFilaPadre(
    nodo,
    panel = null
) {

    panel = panel || getTabPanel();

    if (
        !panel ||
        !nodo ||
        !nodo.dataset.parentId
    ) {
        return null;
    }

    return panel.querySelector(
        `[data-id="${nodo.dataset.parentId}"]`
    );
}

/* ================= CONSTRUIR FILAS ================= */

function construirFilas(fila) {

    const todos = Array.from(
        fila.querySelectorAll(
            ".nodo-wrapper"
        )
    ).filter(n => n.dataset.id);

    console.log(
        "📦 TODOS LOS NODOS"
    );

    console.table(
        todos.map(n => ({
            id: n.dataset.id,
            parentId: n.dataset.parentId
        }))
    );

    const mapa = new Map();

    let filaIndex = 0;

    function recorrer(nodo) {

        if (!nodo) return;

        if (
            mapa.has(nodo.dataset.id)
        ) {
            return;
        }

        mapa.set(
            nodo.dataset.id,
            filaIndex++
        );

        const hijos = todos.filter(
            n =>
                n.dataset.parentId ===
                nodo.dataset.id
        );

        hijos.forEach(h => {

            recorrer(h);

        });
    }

    /* ================= RAÍCES ================= */

    let raices = todos.filter(n => {

        const p =
            n.dataset.parentId;

        return (
            !p ||
            p === "null"
        );

    });

    // 🔥 nodos huérfanos
    if (raices.length === 0) {

        raices = todos.filter(n => {

            const p =
                n.dataset.parentId;

            if (!p) return true;

            const existePadre =
                todos.some(
                    x => x.dataset.id === p
                );

            return !existePadre;

        });
    }

    raices.forEach(r => {

        recorrer(r);

    });

    console.log(
        "🗺️ MAPA FINAL:",
        mapa
    );

    return mapa;
}

/* ================= ALINEAR FILAS ================= */

function alinearFilasGlobal(
    panel = null
) {

    panel = panel || getTabPanel();

    if (!panel) {

        console.error(
            "❌ PANEL NO ENCONTRADO"
        );

        return;
    }

    panel.querySelectorAll(".fila")
        .forEach((fila, filaIdx) => {

            const columnas =
                fila.querySelectorAll(
                    ".nodos-container"
                );

            // 🔥 limpiar invisibles viejos
            columnas.forEach(col => {

                col.querySelectorAll(
                    ".invisible"
                ).forEach(e => {

                    e.remove();

                });

            });

            const mapa =
                construirFilas(fila);

            /* ================= FALLBACK ================= */

            if (mapa.size === 0) {

                console.warn(
                    "⚠️ mapa vacío"
                );

                const nodos = Array.from(
                    fila.querySelectorAll(
                        ".nodo-wrapper"
                    )
                ).filter(
                    n =>
                        !n.classList.contains(
                            "invisible"
                        )
                );

                nodos.forEach((n, i) => {

                    mapa.set(
                        n.dataset.id,
                        i
                    );

                });
            }

            const valores =
                Array.from(
                    mapa.values()
                );

            // 🔥 altura real
            let maxFilas =
                valores.length > 0
                    ? Math.max(...valores) + 1
                    : 1;

            /* ================= COLUMNAS ================= */

            columnas.forEach(col => {

                const nuevaLista =
                    new Array(maxFilas)
                        .fill(null);

                Array.from(col.children)
                    .forEach(nodo => {

                    const index =
                        mapa.get(
                            nodo.dataset.id
                        );

                    if (
                        index !== undefined
                    ) {

                        nuevaLista[index] =
                            nodo;

                    }

                });

                // 🔥 llenar huecos
                for (
                    let i = 0;
                    i < maxFilas;
                    i++
                ) {

                    if (!nuevaLista[i]) {

                        const spacer =
                            document.createElement(
                                "div"
                            );

                        spacer.className =
                            "nodo-wrapper invisible";

                        nuevaLista[i] =
                            spacer;
                    }

                }

                // 🔥 limpiar orden viejo
                col.innerHTML = "";

                nuevaLista.forEach(n => {

                    if (n) {

                        col.appendChild(n);

                    }

                });

            });

        });
}

/* ================= DAGRE ================= */

function layoutDagre(
    panel = null
) {

    panel = panel || getTabPanel();

    if (!panel) return;

    const g =
        new dagre.graphlib.Graph();

    g.setGraph({

        rankdir: "LR",

        nodesep: 50,

        ranksep: 120

    });

    g.setDefaultEdgeLabel(
        () => ({})
    );

    const nodos = Array.from(
        panel.querySelectorAll(
            ".nodo-wrapper"
        )
    ).filter(n => n.dataset.id);

    /* ================= NODOS ================= */

    nodos.forEach(n => {

        g.setNode(
            n.dataset.id,
            {
                width: 220,
                height: 70
            }
        );

    });

    /* ================= RELACIONES ================= */

    nodos.forEach(n => {

        if (n.dataset.parentId) {

            g.setEdge(
                n.dataset.parentId,
                n.dataset.id
            );

        }

    });

    dagre.layout(g);

    /* ================= POSICIONES ================= */

    nodos.forEach(n => {

        const pos =
            g.node(n.dataset.id);

        if (!pos) return;

        n.style.left =
            (pos.x - 110) + "px";

        n.style.top =
            (pos.y - 35) + "px";

    });
}

/* ================= LIMPIAR FILAS ================= */

function limpiarFilasVacias(
    panel = null
) {

    panel = panel || getTabPanel();

    if (!panel) return;

    panel.querySelectorAll(
        ".filas .fila"
    ).forEach(fila => {

        const nodosReales =
            fila.querySelectorAll(
                ".nodo-wrapper:not(.invisible)"
            );

        if (
            nodosReales.length === 0
        ) {

            fila.remove();

        }

    });
}

/* ================= OBSERVER ================= */

observer = new MutationObserver(
    () => {

    clearTimeout(
        window._llTimeout
    );

    window._llTimeout =
        setTimeout(() => {

        recalcularTodo(
            getTabPanel()
        );

    }, 50);

});

/* ================= ACTIVAR OBSERVER ================= */

function activarObserver(
    panel = null
) {

    panel = panel || getTabPanel();

    if (!panel) return;

    const filasContainer =
        panel.querySelector(".filas");

    if (!filasContainer) return;

    observer.disconnect();

    observer.observe(
        filasContainer,
        {
            childList: true,
            subtree: true
        }
    );
}

/* ================= INIT ================= */

window.inicializando = true;

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await actualizarFechasConData();

            /* =========================
            🔥 OBTENER FECHA ACTUAL
            ========================= */

            const fechaInput =
                document.getElementById("fecha");

            let fechaActual = null;

            if (
                fechaInput &&
                fechaInput.value
            ) {

                fechaActual =
                    fechaInput.value
                        .split("/")
                        .reverse()
                        .join("-");

            }

            /* =========================
               🔥 CARGAR TABS
            ========================= */

            if (fechaActual) {

                await cargarTabsGuardadas(
                    fechaActual
                );

            }

            // 🔥 TAB PRINCIPAL
            const tabPrincipal =
                document.querySelector(
                    '.tab[data-tab="principal"]'
                );

            // 🔥 ASIGNAR CLICK
            if (tabPrincipal) {

                tabPrincipal.onclick =
                    () => cambiarTab(
                        tabPrincipal
                    );

            }

            activarFiltros(
                getTabPanel()
            );

            actualizarColumnasGrid(
                getTabPanel()
            );

            alinearFilasGlobal(
                getTabPanel()
            );

            activarObserver(
                getTabPanel()
            );

            // 🔥 ACTIVAR TAB PRINCIPAL
            if (tabPrincipal) {

                await cambiarTab(
                    tabPrincipal
                );

            }

        } catch (e) {

            console.error(
                "❌ ERROR INIT:",
                e
            );

        } finally {

            // 🔥 FIN CARGA INICIAL
            window.inicializando = false;

            console.warn(
                "🟢 APP INICIALIZADA"
            );

        }

    }
);

async function cargarTabsGuardadas(fecha) {

    try {

        const res = await fetch(`/api/tablero/tabs/${fecha}`);

        const tabs = await res.json();

        tabs.sort((a, b) => {

            if (a.nombre === "principal") {
                return -1;
            }

            if (b.nombre === "principal") {
                return 1;
            }

            return (
                Number(a.nombre)
                - Number(b.nombre)
            );

        });

        console.log("📂 TABS BD:", tabs);

        /* =========================================
           🔥 LIMPIAR SOLO TABS DINÁMICAS
        ========================================= */

        document.querySelectorAll(".tab")
            .forEach(el => {

                if (
                    el.dataset.tab !== "principal"
                ) {

                    el.remove();

                }

            });

        document.querySelectorAll(".tab-panel")
            .forEach(el => {

                if (
                    el.dataset.tab !== "principal"
                ) {

                    el.remove();

                }

            });

        /* =========================================
           🔥 RECONSTRUIR TABS
        ========================================= */

        window.cargandoTabs = true;

        tabs.forEach(tab => {

            console.log("TAB:", tab);

            // 🔥 VALIDAR TAB
            if (
                !tab ||
                !tab.id ||
                !tab.nombre
            ) {
                return;
            }

            // 🔥 PRINCIPAL YA EXISTE EN HTML
            if (tab.id === "principal") {
                return;
            }

            crearTab(
                tab.nombre,
                tab.id,
                false
            );

        });

        window.cargandoTabs = false;

        /* =========================================
           🔥 ACTIVAR PRINCIPAL
        ========================================= */

        const principal = document.querySelector(
            '.tab[data-tab="principal"]'
        );

        if (principal) {

            tabActual = "principal";

            principal.classList.add("activo");

            const panelPrincipal = document.querySelector(
                '.tab-panel[data-tab="principal"]'
            );

            if (panelPrincipal) {

                panelPrincipal.style.display = "block";

                panelPrincipal.classList.add("activo");

            }

        }

    } catch (e) {

        window.cargandoTabs = false;

        console.error(
            "❌ ERROR CARGANDO TABS",
            e
        );

    }
}

document.addEventListener("click", e => {

    const tab = e.target.closest(".tab");

    if (!tab) return;

    console.error("========== CLICK TAB ==========");

    console.log("INNER:", tab.innerText);

    console.log("DATASET:", tab.dataset.tab);

    console.log("TAB ACTUAL ANTES:", tabActual);

});

/* ================= REPORTEXTEMA ================= */

document.getElementById("reporte")
.onclick = () => {

    window.location.href =
        "/reportextema";

};

/* ================= BOTON ADD TAB ================= */

const btnAddTab =
    document.getElementById("addTab");

if (btnAddTab) {

    btnAddTab.addEventListener(
        "click",
        () => {

            console.warn(
                "➕ CLICK ADD TAB"
            );

            const nombre = prompt(
                "Nombre de la pestaña"
            );

            if (!nombre) return;

            crearTab(nombre);

        }
    );

} else {

    console.error(
        "❌ BOTON addTab NO EXISTE"
    );

}

/* ================= VOLVER ================= */

document.getElementById("volver")
.onclick = () => {

    window.location.href = "/";

};