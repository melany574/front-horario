/**
 * login.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla Inicio_sesion.html.
 *
 * Antes el botón "Iniciar Sesion" era un <a href> que redirigía a
 * Inicio.html sin validar nada (con cualquier usuario/contraseña,
 * o ninguno, entraba igual). Ahora valida contra `usuarios` en el
 * backend.
 *
 * El backend maneja la sesión con JWT en una cookie httpOnly (por
 * eso api.js manda credentials: "include" en cada petición), así
 * que acá no se guarda nada del usuario en el navegador — cualquier
 * pantalla que necesite saber quién está logueado consulta
 * GET /auth/me (ver script/auth.js), no algo cacheado en el cliente.
 *
 * Ruta asumida (ver script/api.js):
 *   POST /auth/login { nombreUsuario, contrasena } -> 200 si la cookie quedó seteada
 * ------------------------------------------------------------------
 */

const formulario = document.getElementById("formLogin");
const inputUsuario = document.getElementById("usuario");
const inputContrasena = document.getElementById("contrasena");

formulario.addEventListener("submit", async evento => {

    evento.preventDefault();

    const nombreUsuario = inputUsuario.value.trim();
    const contrasena = inputContrasena.value;

    if (!nombreUsuario || !contrasena) {
        alert("Ingrese usuario y contraseña.");
        return;
    }

    try {

        await api.post("/auth/login", { nombreUsuario, contrasena });

        window.location.href = "../home/Inicio.html";

    } catch (error) {
        alert("Usuario o contraseña incorrectos.\n" + error.message);
    }
});
