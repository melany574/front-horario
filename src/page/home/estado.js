/**
 * estado.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla Estado.html.
 *
 * Mismo patrón que avisos.js y eventos.js: `estados_colegio` quedó
 * como tabla de historial en schema.prisma, así que "Guardar" crea
 * una fila nueva y esta pantalla siempre carga la más reciente para
 * seguir editando desde ahí (Inicio.html muestra ese último estado
 * en su tarjeta).
 *
 * Rutas asumidas (ver script/api.js):
 *   GET  /estados-colegio/ultimo   -> { id, contenido, creadoEn } | null
 *   POST /estados-colegio          { contenido }
 * ------------------------------------------------------------------
 */

const textarea = document.getElementById("texto");

async function cargarUltimoEstado() {

    try {
        const ultimo = await api.get("/estados-colegio/ultimo");
        textarea.value = ultimo ? ultimo.contenido : "";
    } catch (error) {
        alert("No se pudo cargar el último estado.\n" + error.message);
    }
}

async function guardar() {

    try {
        await api.post("/estados-colegio", { contenido: textarea.value });
        alert("Estados guardados");
    } catch (error) {
        alert("No se pudo guardar el estado.\n" + error.message);
    }
}

cargarUltimoEstado();
