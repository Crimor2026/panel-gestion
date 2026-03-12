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
        window.location.href="https://atugobpe-my.sharepoint.com/:x:/r/personal/hvillon_atu_gob_pe/_layouts/15/Doc.aspx?sourcedoc=%7BDAFC0B4C-6A12-400D-9D2F-7EFA1E9F02E4%7D&file=Registro%20de%20intervenciones.xlsx&action=default&mobileredirect=true";
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