/**
 * auth.js
 * ------------------------------------------------------------------
 * Guardia de sesión, compartida por TODAS las pantallas protegidas
 * (todas menos Inicio_sesion.html y la landing pública
 * index/Horario.html). Al cargar la página, valida la sesión contra
 * GET /auth/me; si no hay sesión válida, redirige al login.
 *
 * Depende de api.js, así que en cada HTML debe incluirse en este
 * orden:
 *   <script src="../../script/api.js"></script>
 *   <script src="../../script/auth.js"></script>
 *   <script src="miPantalla.js"></script>   <!-- si la pantalla tiene una -->
 *
 * El backend maneja la sesión con JWT en una cookie httpOnly (por
 * eso api.js manda credentials: "include" en cada petición), así
 * que acá no se cachea nada del usuario en el navegador: cada carga
 * de página vuelve a preguntarle a la API si la cookie sigue siendo
 * válida.
 *
 * IMPORTANTE: esto es una guardia del LADO DEL CLIENTE, pensada para
 * la experiencia de usuario (evitar que alguien vea una pantalla sin
 * sesión). No reemplaza la validación real: el backend debe exigir
 * la misma cookie en cada endpoint (/profesores, /horario-clases,
 * etc.) y responder 401 si falta, porque esta comprobación se puede
 * saltar editando el HTML/JS en el navegador.
 *
 * También agrega el botón "Cerrar sesión" al menú (.ini3 nav) de
 * cada pantalla protegida.
 *
 * Rutas:
 *   GET  /auth/me     -> 200 si la cookie de sesión es válida
 *                     -> 401 si no hay sesión
 *   POST /auth/logout -> borra la cookie de sesión
 * ------------------------------------------------------------------
 */

(async function validarSesion() {

    try {
        await api.get("/auth/me");
    } catch (error) {
        window.location.href = "../login/Inicio_sesion.html";
    }

})();

async function cerrarSesion() {

    try {
        await api.post("/auth/logout", {});
    } catch (error) {
        console.error(error);
    }

    window.location.href = "../login/Inicio_sesion.html";
}

(function agregarBotonCerrarSesion() {

    const nav = document.querySelector(".ini3 nav");
    if (!nav) return;

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "cerrar-sesion";
    boton.title = "Cerrar sesión";
    boton.innerHTML = '<img src="../../public/Img/cerrar-sesion.png" alt=""> Cerrar sesión';
    boton.addEventListener("click", cerrarSesion);

    nav.appendChild(boton);
})();
