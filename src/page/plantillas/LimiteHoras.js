const LIMITE_SEMANAL = 22;
const DIAS = [
    { clave: "lunes", nombre: "Lunes" },
    { clave: "martes", nombre: "Martes" },
    { clave: "miercoles", nombre: "Miércoles" },
    { clave: "jueves", nombre: "Jueves" },
    { clave: "viernes", nombre: "Viernes" }
];

let profesores = [];
let clases = [];

const fechaConsulta = document.getElementById("fechaConsulta");
const rangoSemana = document.getElementById("rangoSemana");
const selectProfesor = document.getElementById("profesorLimite");
const profesorSeleccionadoTexto = document.getElementById("profesorSeleccionadoTexto");
const totalHoras = document.getElementById("totalHoras");
const estadoHoras = document.getElementById("estadoHoras");
const progresoHoras = document.getElementById("progresoHoras");
const mensajeHoras = document.getElementById("mensajeHoras");
const mensajeError = document.getElementById("mensajeError");
const horasPorDia = document.getElementById("horasPorDia");

function fechaISO(fecha = new Date()) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function inicioSemana(fechaISOSeleccionada) {
    const fecha = new Date(`${fechaISOSeleccionada}T00:00:00`);
    const dia = fecha.getDay();
    fecha.setDate(fecha.getDate() + (dia === 0 ? -6 : 1 - dia));
    return fecha;
}

function fechaBonita(fecha) {
    return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(fecha);
}

function actualizarRangoSemana() {
    if (!fechaConsulta.value) return;
    const lunes = inicioSemana(fechaConsulta.value);
    const viernes = new Date(lunes);
    viernes.setDate(lunes.getDate() + 4);
    rangoSemana.textContent = `Semana del lunes ${fechaBonita(lunes)} al viernes ${fechaBonita(viernes)}`;
}

function poblarProfesores() {
    selectProfesor.innerHTML = '<option value="">Seleccione un profesor</option>';
    profesores.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).forEach(profesor => {
        const opcion = document.createElement("option");
        opcion.value = profesor.id;
        opcion.textContent = profesor.nombre;
        selectProfesor.appendChild(opcion);
    });
}

function renderizarResumen() {
    actualizarRangoSemana();
    mensajeError.textContent = "";
    const profesorId = selectProfesor.value;
    if (!profesorId) {
        profesorSeleccionadoTexto.textContent = "Selecciona un profesor";
        totalHoras.textContent = "— / 22 horas";
        estadoHoras.textContent = "Sin seleccionar";
        progresoHoras.value = 0;
        mensajeHoras.textContent = "Las horas aparecerán al seleccionar un profesor.";
        horasPorDia.innerHTML = '<tr><td colspan="2">Selecciona un profesor.</td></tr>';
        return;
    }

    const profesor = profesores.find(p => Number(p.id) === Number(profesorId));
    const conteo = Object.fromEntries(DIAS.map(d => [d.clave, 0]));
    clases.forEach(clase => {
        if (Number(clase.profesorId) === Number(profesorId) && Object.hasOwn(conteo, clase.diaSemana)) {
            conteo[clase.diaSemana] += 1;
        }
    });
    const total = Object.values(conteo).reduce((suma, cantidad) => suma + cantidad, 0);
    profesorSeleccionadoTexto.textContent = profesor ? profesor.nombre : "Profesor seleccionado";
    totalHoras.textContent = `${total} / ${LIMITE_SEMANAL} horas`;
    progresoHoras.value = Math.min(total, LIMITE_SEMANAL);

    if (total >= LIMITE_SEMANAL) {
        estadoHoras.textContent = "Límite alcanzado";
        mensajeHoras.textContent = `Aviso: este profesor tiene ${total} clases asignadas por semana. Puedes seguir asignando clases en Horario Docente.`;
    } else {
        estadoHoras.textContent = "En curso";
        mensajeHoras.textContent = `Tiene ${total} clases asignadas. Faltan ${LIMITE_SEMANAL - total} para llegar a 22.`;
    }

    horasPorDia.innerHTML = DIAS.map(dia => `<tr><td>${dia.nombre}</td><td>${conteo[dia.clave]}</td></tr>`).join("") +
        `<tr><th>Total semanal</th><th>${total}</th></tr>`;
}

async function cargarDatos() {
    try {
        const [profesoresApi, clasesApi] = await Promise.all([
            api.get("/profesores"),
            api.get("/horario-clases")
        ]);
        profesores = profesoresApi || [];
        clases = clasesApi || [];
        poblarProfesores();
        renderizarResumen();
    } catch (error) {
        mensajeError.textContent = "No se pudieron cargar los horarios. Verifica que el servidor esté funcionando y que hayas iniciado sesión.";
        console.error("Error al consultar horas semanales:", error);
    }
}

fechaConsulta.value = fechaISO();
fechaConsulta.addEventListener("change", renderizarResumen);
selectProfesor.addEventListener("change", renderizarResumen);
cargarDatos();
