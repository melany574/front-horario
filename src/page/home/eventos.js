/**
 * eventos.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla Eventos.html.
 *
 * Mismo patrón que avisos.js: `eventos` quedó como tabla de
 * historial en schema.prisma, así que "Guardar" crea una fila nueva
 * y esta pantalla siempre carga la más reciente para seguir
 * editando desde ahí (Inicio.html muestra ese último evento en su
 * tarjeta).
 *
 * Rutas asumidas (ver script/api.js):
 *   GET  /eventos/ultimo   -> { id, contenido, creadoEn } | null
 *   POST /eventos          { contenido }
 * ------------------------------------------------------------------
 */

const textarea = document.getElementById("texto");

async function cargarUltimoEvento() {

    try {
        const ultimo = await api.get("/eventos/ultimo");
        textarea.value = ultimo ? ultimo.contenido : "";
    } catch (error) {
        alert("No se pudo cargar el último evento.\n" + error.message);
    }
}

async function guardar() {

    try {
        await api.post("/eventos", { contenido: textarea.value });
        alert("Información guardada");
    } catch (error) {
        alert("No se pudo guardar el evento.\n" + error.message);
    }
}

cargarUltimoEvento();
