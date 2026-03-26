function irReporte(tipo) {

    const rol = sessionStorage.getItem("rol");

    // 🔒 VALIDACIÓN LOGIN
    if (!rol) {
        alert("Debes iniciar sesión");
        window.location.href = "/";
        return;
    }

    // 🔒 SOLO ADMIN accede a F
    if (tipo === "F" && rol !== "admin") {
        alert("No tienes acceso");
        return;
    }

    // ✅ RUTA DINÁMICA
    window.location.href = `/reportes/${tipo}`;
}


// 🔥 SE EJECUTA CUANDO CARGA LA PÁGINA
document.addEventListener("DOMContentLoaded", () => {

    const rol = sessionStorage.getItem("rol");

    if (rol) {
        document.getElementById("cardLlenado")?.classList.remove("hidden");
    }

});