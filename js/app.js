// 👁️ Mostrar / ocultar contraseña
function togglePassword() {
    const input = document.getElementById("password");
    input.type = input.type === "password" ? "text" : "password";
}

function actualizarNombre() {

    let input = document.getElementById("usuario");
    let nombre = document.getElementById("nombreUsuario");
    let saludo = document.getElementById("saludo");

    if (!input || !nombre || !saludo) return;

    let user = input.value.trim().toUpperCase();

    if (user.length < 3) {
        nombre.textContent = "...";

        nombre.classList.remove("dots");
        void nombre.offsetWidth;
        nombre.classList.add("dots");

        let textoBase = "Bienvenido a Netcontact";

        if (saludo.textContent !== textoBase) {
            saludo.textContent = textoBase;

            saludo.classList.remove("fade-title");
            void saludo.offsetWidth;
            saludo.classList.add("fade-title");
        }

        return;
    }

    nombre.classList.remove("dots");

    nombre.textContent = user;
    nombre.style.animation = "none";
    setTimeout(() => {
        nombre.style.animation = "popPro 0.3s cubic-bezier(0.22, 1, 0.36, 1)";
    }, 10);

    let genero = user.endsWith("A") ? "Femenino" : "Masculino";

    localStorage.setItem("usuario", user);
    localStorage.setItem("genero", genero);

    let nuevoSaludo = genero === "Femenino"
        ? "Bienvenida a Netcontact"
        : "Bienvenido a Netcontact";
    if (saludo.textContent !== nuevoSaludo) {

        saludo.textContent = nuevoSaludo;

        saludo.classList.remove("fade-title");
        void saludo.offsetWidth;
        saludo.classList.add("fade-title");
    }
}

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("loginForm");
    const btn = document.getElementById("btnLogin");
    const loader = document.getElementById("loader");
    const input = document.getElementById("usuario");

    if (input) {
        input.addEventListener("input", actualizarNombre);
    }

    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();

            let usuario = document.getElementById("usuario").value.trim().toUpperCase();

            if (!usuario) return;

            let rol = "ASESOR";

            if (usuario.includes("SUP")) rol = "SUPERVISOR";
            else if (usuario.includes("BACK")) rol = "BACK";
            else if (usuario.includes("GRAB")) rol = "GRABACIONES";
            else if (usuario.includes("SEGU")) rol = "SEGUIMIENTO";
            else if (usuario.includes("ADMIN")) rol = "JEFATURA";

            localStorage.setItem("usuario", usuario);
            localStorage.setItem("rol", rol);

            btn.classList.add("loading");

            if (loader) loader.style.display = "flex";

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 800);
        });
    }

});
document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("usuario");
    const nombre = document.getElementById("nombreUsuario");

    if (input && nombre) {
        input.addEventListener("input", () => {

            nombre.classList.remove("typing");
            void nombre.offsetWidth;
            nombre.classList.add("typing");

        });
    }

    crearParticulas();
});