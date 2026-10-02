/**
 * api.js
 * ------------------------------------------------------------------
 * Cliente HTTP compartido por todas las pantallas de MontessoriFlow.
 * Centraliza la URL base de la API y el manejo de errores de fetch(),
 * para que cada script de pantalla (profesoresMaterias.js,
 * horarioDocente.js, etc.) no tenga que repetir esta lógica.
 *
 * El backend (back-end_horarios-valeria_melany) monta las rutas en la
 * raíz (/profesores, /materias, ...) y responde siempre
 * { ok: true, data } o { ok: false, mensaje }; apiRequest devuelve
 * directamente `data`.
 * ------------------------------------------------------------------
 */

const API_BASE_URL = "http://localhost:3000";

/**
 * Hace una petición a la API y devuelve el JSON ya parseado.
 * Lanza un Error con mensaje legible si la respuesta no es 2xx.
 */
async function apiRequest(ruta, opciones = {}) {

    let respuesta;

    try {
        respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            ...opciones
        });
    } catch (error) {
        throw new Error("No se pudo conectar con el servidor. ¿Está la API corriendo?");
    }

    let cuerpo = null;

    try {
        cuerpo = await respuesta.json();
    } catch (error) {
        // Respuesta sin cuerpo (ej. DELETE que responde 204 No Content)
    }

    if (!respuesta.ok) {
        const mensaje =
            (cuerpo && cuerpo.mensaje) ||
            `Error ${respuesta.status} al consultar ${ruta}`;

        throw new Error(mensaje);
    }

    // El backend envuelve todas las respuestas en { ok, data }
    return cuerpo ? cuerpo.data : null;
}

const api = {
    get:  (ruta)        => apiRequest(ruta, { method: "GET" }),
    post: (ruta, datos) => apiRequest(ruta, { method: "POST", body: JSON.stringify(datos) }),
    put:  (ruta, datos) => apiRequest(ruta, { method: "PUT", body: JSON.stringify(datos) }),
    del:  (ruta)        => apiRequest(ruta, { method: "DELETE" })
};
