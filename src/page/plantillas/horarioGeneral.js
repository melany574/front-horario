/**
 * horarioGeneral.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla horarioGeneral.html.
 *
 * Esta pantalla pasó a ser de SOLO LECTURA: antes reconstruía la
 * tabla recorriendo el localStorage de cada profesor (uno por uno,
 * de una lista hardcodeada) y encima tenía un botón "Guardar
 * horario" que escribía un snapshot bajo la misma clave
 * "horario_" + fecha que usaba HorarioEspecial.html (se pisaban
 * entre sí). Ahora la tabla se arma en cada carga con una sola
 * consulta a /horario-clases filtrando por día de semana — la
 * fuente real sigue siendo lo que se edita en horarioDocente.html.
 *
 * Rutas asumidas (ver script/api.js):
 *   GET /grupos
 *   GET /bloques-horario
 *   GET /horario-clases/dia/:diaSemana
 *       -> cada elemento viene con las relaciones incluidas:
 *          { id, grupoId, bloqueHorarioId, diaSemana,
 *            materia: { nombre }, profesor: { nombre }, grupo, bloqueHorario }
 * ------------------------------------------------------------------
 */

let grupos = [];
let bloquesManana = [];
let bloquesTarde = [];

/* ============================= */
/*        ORDEN NATURAL DE GRADO  */
/* ============================= */

/** "9°1" -> [9, 1], para poder ordenar 9°1, 9°2, 10°1... correctamente */
function clavesOrdenGrado(nombre) {
    const numeros = nombre.match(/\d+/g) || ["0", "0"];
    return [Number(numeros[0]), Number(numeros[1] || 0)];
}

function ordenarGrados(listaGrupos) {
    return [...listaGrupos].sort((a, b) => {
        const [nivelA, seccionA] = clavesOrdenGrado(a.nombre);
        const [nivelB, seccionB] = clavesOrdenGrado(b.nombre);
        return nivelA - nivelB || seccionA - seccionB;
    });
}

/* ============================= */
/*            CARGA INICIAL       */
/* ============================= */

async function iniciar() {

    try {

        const [gruposApi, bloquesApi] = await Promise.all([
            api.get("/grupos"),
            api.get("/bloques-horario")
        ]);

        grupos = gruposApi;

        bloquesManana = bloquesApi
            .filter(bloque => bloque.jornada === "manana")
            .sort((a, b) => a.orden - b.orden);

        bloquesTarde = bloquesApi
            .filter(bloque => bloque.jornada === "tarde")
            .sort((a, b) => a.orden - b.orden);

        pintarCabeceras();

        document.getElementById("fecha").value = fechaHoy();

        await cargarHorario();

    } catch (error) {
        alert("No se pudieron cargar los datos iniciales (grupos/horas).\n" + error.message);
    }
}

function formatearHora(valor) {

    if (!valor) return "";

    const fechaHora = new Date(valor);

    if (!isNaN(fechaHora)) {
        return fechaHora.toISOString().substring(11, 16);
    }

    return String(valor).substring(0, 5);
}

function pintarCabeceras() {

    const cabeceraManana = document.getElementById("cabeceraManana");
    const cabeceraTarde = document.getElementById("cabeceraTarde");

    bloquesManana.forEach(bloque => {
        cabeceraManana.innerHTML += `<th>${textoEncabezadoBloque(bloque)}</th>`;
    });

    bloquesTarde.forEach(bloque => {
        cabeceraTarde.innerHTML += `<th>${textoEncabezadoBloque(bloque)}</th>`;
    });
}

function textoEncabezadoBloque(bloque) {
    return bloque.esDescanso
        ? "Descanso"
        : `${formatearHora(bloque.horaInicio)} - ${formatearHora(bloque.horaFin)}`;
}

/* ============================= */
/*         FECHA Y NAVEGACIÓN     */
/* ============================= */

function fechaHoy() {

    const hoy = new Date();

    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");

    return `${año}-${mes}-${dia}`;
}

function mostrarFechaTitulo() {

    const valorFecha = document.getElementById("fecha").value;

    if (!valorFecha) return;

    const fechaObjeto = new Date(valorFecha + "T00:00:00");

    const opciones = { weekday: "long", day: "numeric", month: "long", year: "numeric" };

    let texto = fechaObjeto.toLocaleDateString("es-CO", opciones);
    texto = texto.charAt(0).toUpperCase() + texto.slice(1);

    document.getElementById("fechaTitulo").textContent = texto;
}

function obtenerDiaSemana() {

    const valorFecha = document.getElementById("fecha").value;

    if (!valorFecha) return "";

    const fechaObjeto = new Date(valorFecha + "T00:00:00");

    const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

    return dias[fechaObjeto.getDay()];
}

function cambiarDia(cantidad) {

    const input = document.getElementById("fecha");

    if (!input.value) {
        input.value = fechaHoy();
    }

    const fechaObjeto = new Date(input.value + "T00:00:00");
    fechaObjeto.setDate(fechaObjeto.getDate() + cantidad);

    const año = fechaObjeto.getFullYear();
    const mes = String(fechaObjeto.getMonth() + 1).padStart(2, "0");
    const dia = String(fechaObjeto.getDate()).padStart(2, "0");

    input.value = `${año}-${mes}-${dia}`;

    cargarHorario();
}

/* ============================= */
/*          CONSTRUIR TABLA       */
/* ============================= */

function crearFilasVacias(idTabla, bloques, listaGrupos) {

    const tabla = document.getElementById(idTabla);
    tabla.innerHTML = "";

    const gradosOrdenados = ordenarGrados(listaGrupos);

    gradosOrdenados.forEach(grupo => {

        const tr = document.createElement("tr");
        tr.dataset.grupoId = grupo.id;

        const tdGrado = document.createElement("td");
        tdGrado.textContent = grupo.nombre;
        tr.appendChild(tdGrado);

        bloques.forEach(bloque => {

            const td = document.createElement("td");
            td.dataset.bloqueId = bloque.id;

            td.textContent = bloque.esDescanso ? "DESCANSO" : "-";

            tr.appendChild(td);
        });

        tabla.appendChild(tr);
    });
}

function pintarClases(asignaciones) {

    asignaciones.forEach(clase => {

        const celda = document.querySelector(
            `tr[data-grupo-id="${clase.grupoId}"] td[data-bloque-id="${clase.bloqueHorarioId}"]`
        );

        if (!celda) return;

        const nombreMateria = clase.materia?.nombre || "Sin materia";
        const nombreProfesor = clase.profesor?.nombre || "Sin profesor";

        celda.textContent = `${nombreMateria} - ${nombreProfesor}`;
    });
}

/* ============================= */
/*        CARGAR HORARIO           */
/* ============================= */

async function cargarHorario() {

    mostrarFechaTitulo();

    const dia = obtenerDiaSemana();

    crearFilasVacias("tablaManana", bloquesManana, grupos.filter(g => g.jornada === "manana"));
    crearFilasVacias("tablaTarde", bloquesTarde, grupos.filter(g => g.jornada === "tarde"));

    if (dia === "domingo" || dia === "sabado" || !dia) {
        mostrarMensaje("No hay clases los fines de semana.");
        return;
    }

    try {

        const asignaciones = await api.get(`/horario-clases/dia/${dia}`);
        pintarClases(asignaciones);

    } catch (error) {
        mostrarMensaje("No se pudo cargar el horario de este día.");
        console.error(error);
    }
}

/* ============================= */
/*            MENSAJE             */
/* ============================= */

function mostrarMensaje(texto) {

    const mensaje = document.getElementById("mensaje");
    if (!mensaje) return;

    mensaje.textContent = texto;

    setTimeout(() => {
        mensaje.textContent = "";
    }, 2500);
}

/* ============================= */
/*            INICIAR             */
/* ============================= */

iniciar();
