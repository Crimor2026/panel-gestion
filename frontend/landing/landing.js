// ======================================
// PANEL LATERAL
// ======================================

function abrirPanel() {
    document.getElementById("panel").classList.add("activo");
    document.getElementById("blur").classList.add("activo");
}

function cerrarPanel() {
    document.getElementById("panel").classList.remove("activo");
    document.getElementById("blur").classList.remove("activo");
}


// ======================================
// LOGIN
// ======================================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");
    const mensaje = document.getElementById("mensaje");

    if (!form) return;

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        mensaje.textContent = "";

        try {

            const response = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Error en login");
            }

            sessionStorage.setItem("token", data.access_token);
            sessionStorage.setItem("rol", data.rol);

            document.body.classList.add("pageFadeOut");

            setTimeout(()=>{
                window.location.href = "/dashboard";
            },350);

        } catch (error) {

            mensaje.textContent = error.message;

        }

    });

});


// ======================================
// TRANSICIÓN BOTONES LANDING
// ======================================

function irDashboard(){

    document.body.classList.add("pageFadeOut");

    setTimeout(()=>{
        window.location.href="/dashboard";
    },350);

}

function irReportes(){

    document.body.classList.add("pageFadeOut");

    setTimeout(()=>{
        window.location.href="https://atugobpe.sharepoint.com/sites/DOCUMENTOSEXTERNOSDSP/Documentos%20compartidos/Forms/AllItems.aspx?id=%2Fsites%2FDOCUMENTOSEXTERNOSDSP%2FDocumentos%20compartidos%2F006%5FCoordinaci%C3%B3n%2DProyectos%2F001%5FRegistro%2DReportes&viewid=b398b0bd%2Dc2c3%2D4d32%2Db67f%2D5d22ac4a0739&p=true";
    },350);

}


// ======================================
// ANIMACIÓN LANDING
// ======================================

function animarLanding(){

    const botones = document.querySelector(".fadeLanding");

    if(!botones) return;

    botones.style.opacity = "0";
    botones.style.transform = "translateY(40px)";

    setTimeout(()=>{

        botones.style.transition = "all 0.8s ease";
        botones.style.opacity = "1";
        botones.style.transform = "translateY(0px)";

    },50);

}


// animación al cargar
document.addEventListener("DOMContentLoaded", animarLanding);

// animación al volver atrás
window.addEventListener("pageshow", animarLanding);


// ======================================
// SOLUCIÓN DEFINITIVA BACK BUTTON
// ======================================

window.addEventListener("pageshow", function (event) {

    if (event.persisted) {
        window.location.reload();
    }

});