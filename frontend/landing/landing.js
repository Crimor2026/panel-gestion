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
        window.location.href="/static/reportes/reportes.html";
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

document.addEventListener("DOMContentLoaded", animarLanding);
window.addEventListener("pageshow", animarLanding);


// ======================================
// BACK BUTTON FIX
// ======================================

window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
        window.location.reload();
    }
});


// ======================================
// FORMATEAR FECHA
// ======================================

function formatearFecha(fecha) {
    if (!fecha) return "Primera vez";

    const f = new Date(fecha);

    return f.toLocaleDateString("es-PE") + " " +
           f.toLocaleTimeString("es-PE");
}


// ======================================
// DOM LISTO (AQUÍ VA TODO LO IMPORTANTE)
// ======================================

window.onload = () => {

    const form = document.getElementById("loginForm");
    const mensajeError = document.getElementById("mensaje");

    if (!form) return;

    // LOGIN
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        mensajeError.textContent = "";

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

            const popup = document.getElementById("popupBienvenida");
            const mensajePopup = document.getElementById("popupMensaje");

            mensajePopup.innerHTML = `
                Bienvenido <b>${data.nombre || email}</b><br>
                <small>Última conexión: ${formatearFecha(data.ultima_conexion)}</small>
            `;

            popup.style.display = "block";

            setTimeout(()=> popup.style.opacity = "1", 50);

            setTimeout(()=>{
                popup.style.opacity = "0";
                setTimeout(()=> popup.style.display = "none", 500);
            },5000);

        } catch (error) {
            mensajeError.textContent = error.message;
        }
    });

    // =========================
    // 👁️ OJITO CONTRASEÑA
    // =========================
    const toggle = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");

    if (toggle && passwordInput) {

        toggle.addEventListener("click", () => {

            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                toggle.textContent = "🔒";
            } else {
                passwordInput.type = "password";
                toggle.textContent = "👁️";
            }

        });

    }

};