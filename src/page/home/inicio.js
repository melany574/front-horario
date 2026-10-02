/**
 * inicio.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla Inicio.html.
 * Muestra en las tres tarjetas el último aviso, evento y estado
 * registrados (las mismas tablas que editan avisos.js, eventos.js
 * y estado.js).
 *
 * Rutas asumidas (ver script/api.js):
 *   GET /eventos/ultimo         -> { contenido } | null
 *   GET /avisos/ultimo          -> { contenido } | null
 *   GET /estados-colegio/ultimo -> { contenido } | null
 * ------------------------------------------------------------------
 */

async function cargarTarjeta(ruta, idElemento, textoVacio) {

    const elemento = document.getElementById(idElemento);

    try {
        const ultimo = await api.get(ruta);
        elemento.textContent = ultimo ? ultimo.contenido : textoVacio;
    } catch (error) {
        elemento.textContent = "No se pudo cargar.";
        console.error(error);
    }
}

async function cargarInicio() {

    await Promise.all([
        cargarTarjeta("/eventos/ultimo", "eventos", "No hay eventos"),
        cargarTarjeta("/avisos/ultimo", "Avisos", "No hay avisos"),
        cargarTarjeta("/estados-colegio/ultimo", "Estado", "No hay Estado")
    ]);
}

cargarInicio();
