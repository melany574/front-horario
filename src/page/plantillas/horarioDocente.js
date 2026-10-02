/**
 * horarioDocente.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla horarioDocente.html.
 * Esta pantalla es la FUENTE del horario semanal recurrente: aquí se
 * crea/edita/borra cada clase, y de acá leen horarioGeneral.html y
 * reportes_exportacion.html.
 *
 * Cambios respecto a la versión anterior (localStorage):
 *  - Los <select> de profesor ya no están hardcodeados: se llenan
 *    desde GET /profesores (según profesoresMaterias.js).
 *  - La celda de materia pasó de texto libre (contenteditable) a un
 *    <select> con las materias asignadas al profesor (tabla
 *    profesor_materia), para no guardar texto suelto sin control.
 *  - La tabla ya no mezcla mañana+tarde para todos: solo muestra los
 *    bloques de la jornada del profesor (o ambas, si jornada="ambas").
 *  - La validación de choques (mismo profesor o mismo grupo dos veces
 *    a la misma hora) la hace ahora el backend mediante los @@unique
 *    de HorarioClase; el script solo muestra el error que devuelva.
 *
 * Rutas asumidas (ver script/api.js):
 *   GET  /profesores
 *   GET  /grupos
 *   GET  /bloques-horario
 *   GET  /horario-clases/profesor/:profesorId  (se filtra por día en el cliente)
 *   GET  /horario-clases                       (solo para "Borrar todos los horarios")
 *   POST /horario-clases        { profesorId, materiaId, grupoId, bloqueHorarioId, diaSemana }
 *   PUT  /horario-clases/:id    { profesorId, materiaId, grupoId, bloqueHorarioId, diaSemana }
 *   DELETE /horario-clases/:id
 * ------------------------------------------------------------------
 */

let profesores = [];
let grupos = [];
let bloquesManana = [];
let bloquesTarde = [];

let profesorSeleccionado = null; // objeto profesor completo, no solo el id
let jornadaOrigenSeleccion = "";  // "manana" o "tarde": de qué select se eligió
let avisoLimiteMostradoPara = null;
let verificandoLimiteHoras = false;

const dia = document.getElementById("dia");
const fecha = document.getElementById("fecha");

/* ============================= */
/*            CARGA INICIAL       */
/* ============================= */

async function iniciar() {

    try {

        const [profesoresApi, gruposApi, bloquesApi] = await Promise.all([
            api.get("/profesores"),
            api.get("/grupos"),
            api.get("/bloques-horario")
        ]);

        profesores = profesoresApi;
        grupos = gruposApi;

        bloquesManana = bloquesApi
            .filter(bloque => bloque.jornada === "manana" && !bloque.esDescanso)
            .sort((a, b) => a.orden - b.orden);

        bloquesTarde = bloquesApi
            .filter(bloque => bloque.jornada === "tarde" && !bloque.esDescanso)
            .sort((a, b) => a.orden - b.orden);

        poblarSelectsProfesor();
        ponerFechaActual();

    } catch (error) {
        alert("No se pudieron cargar los datos iniciales (profesores/grupos/horas).\n" + error.message);
    }
}

function poblarSelectsProfesor() {

    const selectManana = document.getElementById("profesorManana");
    const selectTarde = document.getElementById("profesorTarde");

    selectManana.innerHTML = '<option value="">Seleccione un profesor</option>';
    selectTarde.innerHTML = '<option value="">Seleccione un profesor</option>';

    console.log("PROFESORES:", profesores);

    profesores.forEach(profesor => {

        if (profesor.jornada === "manana" || profesor.jornada === "ambas") {
            selectManana.appendChild(crearOpcionProfesor(profesor));

        }

        if (profesor.jornada === "tarde" || profesor.jornada === "ambas") {
            selectTarde.appendChild(crearOpcionProfesor(profesor));
        }
    });
}

function crearOpcionProfesor(profesor) {
    const opcion = document.createElement("option");
    opcion.value = profesor.id;
    opcion.textContent = profesor.nombre;
    return opcion;
}

/* ============================= */
/*         FECHA Y DÍA            */
/* ============================= */

function ponerFechaActual() {

    const hoy = new Date();

    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const diaActual = String(hoy.getDate()).padStart(2, "0");

    fecha.value = `${año}-${mes}-${diaActual}`;

    establecerDiaDesdeFecha();
}

function establecerDiaDesdeFecha() {

    if (!fecha.value) return;

    const fechaSeleccionada = new Date(fecha.value + "T00:00:00");

    const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

    const nombreDia = dias[fechaSeleccionada.getDay()];

    if (["lunes", "martes", "miercoles", "jueves", "viernes"].includes(nombreDia)) {
        dia.value = nombreDia;
    }
}

fecha.addEventListener("change", () => {
    establecerDiaDesdeFecha();
    cargarHorario();
});

dia.addEventListener("change", cargarHorario);

// Avisar mientras se arma el horario, sin bloquear ni impedir guardar clases.
document.getElementById("tablaBody").addEventListener("change", verificarLimiteDuranteEdicion);

/* ============================= */
/*      SELECCIONAR PROFESOR      */
/* ============================= */

function seleccionarProfesor(origen) {

    jornadaOrigenSeleccion = origen;

    const idSeleccionado =
        origen === "manana"
            ? document.getElementById("profesorManana").value
            : document.getElementById("profesorTarde").value;

    if (origen === "manana") {
        document.getElementById("profesorTarde").value = "";
    } else {
        document.getElementById("profesorManana").value = "";
    }

    profesorSeleccionado =
        profesores.find(profesor => String(profesor.id) === idSeleccionado) || null;

    cargarHorario();
}

/* ============================= */
/*          CREAR TABLA           */
/* ============================= */

function obtenerBloquesDelProfesor(profesor) {

    if (profesor.jornada === "manana") return bloquesManana;
    if (profesor.jornada === "tarde") return bloquesTarde;

    return [...bloquesManana, ...bloquesTarde]; // jornada === "ambas"
}

function formatearHora(valor) {

    if (!valor) return "";

    const fechaHora = new Date(valor);

    if (!isNaN(fechaHora)) {
        return fechaHora.toISOString().substring(11, 16);
    }

    return String(valor).substring(0, 5);
}

function crearTabla() {

    const tbody = document.getElementById("tablaBody");
    tbody.innerHTML = "";

    if (!profesorSeleccionado) return;

    const bloques = obtenerBloquesDelProfesor(profesorSeleccionado);

    // GET /profesores trae [{ materiaId, materia: { id, nombre } }]
    const materiasDelProfesor = (profesorSeleccionado.materias || []).map(pm => pm.materia);

    bloques.forEach(bloque => {

        const fila = document.createElement("tr");
        fila.dataset.bloqueId = bloque.id;

        const gruposDeLaJornada = grupos.filter(grupo => grupo.jornada === bloque.jornada);

        const opcionesGrupo = gruposDeLaJornada
            .map(grupo => `<option value="${grupo.id}">${grupo.nombre}</option>`)
            .join("");

        const opcionesMateria = materiasDelProfesor
            .map(materia => `<option value="${materia.id}">${materia.nombre}</option>`)
            .join("");

        fila.innerHTML = `
            <td>${formatearHora(bloque.horaInicio)} - ${formatearHora(bloque.horaFin)}</td>
            <td>${bloque.jornada === "manana" ? "Mañana" : "Tarde"}</td>
            <td>
                <select class="grupo">
                    <option value="">Seleccione</option>
                    ${opcionesGrupo}
                </select>
            </td>
            <td>
                <select class="materia">
                    <option value="">Seleccione</option>
                    ${opcionesMateria || '<option value="" disabled>Sin materias asignadas</option>'}
                </select>
            </td>
        `;

        tbody.appendChild(fila);
    });
}

/* ============================= */
/*       CARGAR HORARIO GUARDADO  */
/* ============================= */

async function cargarHorario() {

    crearTabla();

    if (!profesorSeleccionado || !dia.value) return;

    try {

        const clasesDelProfesor = await api.get(`/horario-clases/profesor/${profesorSeleccionado.id}`);
        const asignaciones = clasesDelProfesor.filter(clase => clase.diaSemana === dia.value);

        asignaciones.forEach(asignacion => {

            const fila = document.querySelector(
                `#tablaBody tr[data-bloque-id="${asignacion.bloqueHorarioId}"]`
            );

            if (!fila) return;

            fila.dataset.horarioClaseId = asignacion.id;
            fila.querySelector(".grupo").value = asignacion.grupoId;
            fila.querySelector(".materia").value = asignacion.materiaId;
        });

    } catch (error) {
        alert("No se pudo cargar el horario guardado de este profesor.\n" + error.message);
    }
}


/* ============================= */
/*       AVISO LÍMITE 22 HORAS    */
/* ============================= */

async function verificarLimiteDuranteEdicion() {
    if (!profesorSeleccionado || verificandoLimiteHoras) return;

    verificandoLimiteHoras = true;
    try {
        // Cuenta las clases ya guardadas en otros días de la semana.
        const clasesGuardadas = await api.get(`/horario-clases/profesor/${profesorSeleccionado.id}`);
        const otrasDias = clasesGuardadas.filter(clase => clase.diaSemana !== dia.value);
        const bloquesContados = new Set(
            otrasDias.map(clase => `${clase.diaSemana}-${clase.bloqueHorarioId}`)
        );

        // Para el día que se está editando, cuenta lo que está actualmente
        // seleccionado en pantalla (incluye cambios aún no guardados).
        document.querySelectorAll("#tablaBody tr").forEach(fila => {
            const grupoId = fila.querySelector(".grupo")?.value;
            const materiaId = fila.querySelector(".materia")?.value;
            if (grupoId && materiaId) {
                bloquesContados.add(`${dia.value}-${fila.dataset.bloqueId}`);
            }
        });

        const totalHoras = bloquesContados.size;
        const claveProfesor = String(profesorSeleccionado.id);

        if (totalHoras >= 22 && avisoLimiteMostradoPara !== claveProfesor) {
            avisoLimiteMostradoPara = claveProfesor;
            alert(`Aviso de límite de horas\n\nEl profesor ${profesorSeleccionado.nombre} ya cumple las 22 horas semanales (${totalHoras} horas asignadas).\n\nPuede seguir copiando y guardando el horario normalmente.`);
        } else if (totalHoras < 22 && avisoLimiteMostradoPara === claveProfesor) {
            avisoLimiteMostradoPara = null;
        }
    } catch (error) {
        console.error("No se pudo verificar el límite de horas:", error);
    } finally {
        verificandoLimiteHoras = false;
    }
}

/* ============================= */
/*            GUARDAR             */
/* ============================= */

async function guardar() {

    if (!profesorSeleccionado) {
        alert("Seleccione un profesor.");
        return;
    }

    if (!dia.value) {
        alert("Seleccione un día.");
        return;
    }

    if (!fecha.value) {
        alert("Seleccione una fecha.");
        return;
    }

    const filas = document.querySelectorAll("#tablaBody tr");
    const errores = [];

    for (const fila of filas) {

        const horaTexto = fila.cells[0].textContent.trim();
        const grupoId = fila.querySelector(".grupo").value;
        const materiaId = fila.querySelector(".materia").value;
        const bloqueHorarioId = fila.dataset.bloqueId;
        const horarioClaseId = fila.dataset.horarioClaseId;

        // Fila vacía: si antes tenía una clase guardada, se borra.
        if (!grupoId && !materiaId) {

            if (horarioClaseId) {
                try {
                    await api.del(`/horario-clases/${horarioClaseId}`);
                    delete fila.dataset.horarioClaseId;
                } catch (error) {
                    errores.push(`${horaTexto}: ${error.message}`);
                }
            }

            continue;
        }

        // Fila a medio llenar: no se puede guardar.
        if (!grupoId || !materiaId) {
            errores.push(`${horaTexto}: debe seleccionar grupo y materia, o dejar ambos vacíos.`);
            continue;
        }

        const payload = {
            profesorId: profesorSeleccionado.id,
            materiaId: Number(materiaId),
            grupoId: Number(grupoId),
            bloqueHorarioId: Number(bloqueHorarioId),
            diaSemana: dia.value
        };

        try {

            if (horarioClaseId) {
                await api.put(`/horario-clases/${horarioClaseId}`, payload);
            } else {
                const creado = await api.post("/horario-clases", payload);
                fila.dataset.horarioClaseId = creado.id;
            }

        } catch (error) {
            // Aquí llegan, por ejemplo, los choques de horario que antes
            // se validaban a mano recorriendo localStorage de todos los
            // profesores: ahora responde el backend por el @@unique.
            errores.push(`${horaTexto}: ${error.message}`);
        }
    }

    if (errores.length > 0) {
        alert("Algunas clases no se pudieron guardar:\n\n" + errores.join("\n"));
        return;
    }

    await verificarLimiteDuranteEdicion();
    alert(`Horario de ${profesorSeleccionado.nombre} guardado correctamente.`);
}

/* ============================= */
/*   BORRAR HORARIO DEL PROFESOR  */
/* ============================= */

async function borrarHorario() {

    if (!profesorSeleccionado) {
        alert("Seleccione un profesor.");
        return;
    }

    if (!dia.value) {
        alert("Seleccione un día.");
        return;
    }

    const filasConDatos = [...document.querySelectorAll("#tablaBody tr")]
        .filter(fila => fila.dataset.horarioClaseId);

    if (filasConDatos.length === 0) {
        alert(`No hay un horario guardado para ${profesorSeleccionado.nombre} en este día.`);
        return;
    }

    const confirmar = confirm(
        " ¿Está seguro de borrar el horario?\n\n" +
        "Profesor: " + profesorSeleccionado.nombre +
        "\nDía: " + dia.value
    );

    if (!confirmar) return;

    try {

        await Promise.all(
            filasConDatos.map(fila => api.del(`/horario-clases/${fila.dataset.horarioClaseId}`))
        );

        crearTabla();

        alert(` El horario de ${profesorSeleccionado.nombre} fue borrado correctamente.`);

    } catch (error) {
        alert("No se pudo borrar el horario completo.\n" + error.message);
    }
}

/* ============================= */
/*    BORRAR TODOS LOS HORARIOS   */
/* ============================= */

async function borrarTodosLosHorarios() {

    const confirmar = confirm(
        " ADVERTENCIA\n\n" +
        "¿Está seguro de borrar TODOS los horarios de TODOS los profesores?\n\n" +
        "Esta acción no se puede deshacer."
    );

    if (!confirmar) return;

    try {

        // La API no tiene un borrado masivo: se borra clase por clase.
        const todas = await api.get("/horario-clases");
        await Promise.all(todas.map(clase => api.del(`/horario-clases/${clase.id}`)));

        crearTabla();

        alert(" Todos los horarios fueron borrados correctamente.");

    } catch (error) {
        alert("No se pudo borrar todos los horarios.\n" + error.message);
    }
}

/* ============================= */
/*            INICIAR             */
/* ============================= */

iniciar();
