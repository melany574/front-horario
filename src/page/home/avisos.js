/**
 * avisos.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla Avisos.html.
 *
 * Antes esto era un solo textarea que sobreescribía siempre la misma
 * clave de localStorage ("Avisos"), perdiendo el historial. En
 * schema.prisma, `avisos` quedó como tabla de historial: cada
 * "Guardar" crea una fila nueva y esta pantalla siempre carga la más
 * reciente para seguir editando desde ahí (Inicio.html también
 * muestra ese último aviso en su tarjeta).
 *
 * Rutas asumidas (ver script/api.js):
 *   GET  /avisos/ultimo   -> { id, contenido, creadoEn } | null
 *   POST /avisos          { contenido }
 * ------------------------------------------------------------------
 */

const textarea = document.getElementById("texto");

async function cargarUltimoAviso() {

    try {
        const ultimo = await api.get("/avisos/ultimo");
        textarea.value = ultimo ? ultimo.contenido : "";
    } catch (error) {
        alert("No se pudo cargar el último aviso.\n" + error.message);
    }
}

async function guardar() {

    try {
        await api.post("/avisos", { contenido: textarea.value });
        alert("Avisos guardados");
    } catch (error) {
        alert("No se pudo guardar el aviso.\n" + error.message);
    }
}

cargarUltimoAviso();
