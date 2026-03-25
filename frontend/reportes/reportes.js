function irReporte(tipo) {

    const rutas = {
        A: "/static/reportes/reporteA.html",
        B: "/static/reportes/reporteB.html",
        C: "/static/reportes/reporteC.html",
        D: "/static/reportes/reporteD.html",
        E: "/static/reportes/reporteE.html",
        F: "/static/reportes/reporteF.html"
    };

    const ruta = rutas[tipo];

    if (ruta) {
        window.location.href = ruta;
    } else {
        console.error("Reporte no válido:", tipo);
    }

}