/**
 * registro.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla Registro.html.
 *
 * Reemplaza la versión anterior, que solo escribía filas directo en
 * el DOM (sin persistencia: al recargar la página se perdía todo) y
 * dejaba "materia" y "profesor" como texto libre. Ahora:
 *  - La tabla se carga desde `registro_cambios`.
 *  - Materia y profesor son <select> alimentados por /materias y
 *    /profesores (los mismos catálogos de profesoresMaterias.js),
 *    para no guardar texto suelto sin relación con esas tablas.
 *
 * Rutas asumidas (ver script/api.js):
 *   GET    /materias
 *   GET    /profesores
 *   GET    /registro-cambios
 *       -> se asume que cada fila ya viene con los nombres
 *          relacionados incluidos, ej:
 *          { id, fecha, motivo, materia: { id, nombre }, profesor: { id, nombre } }
 *   POST   /registro-cambios      { fecha, materiaId, profesorId, motivo }
 *   PUT    /registro-cambios/:id  { fecha, materiaId, profesorId, motivo }
 *   DELETE /registro-cambios/:id
 * ------------------------------------------------------------------
 */

let añoActual = new Date().getFullYear();

/* Registro que se está editando; null = modal en modo "agregar" */
let registroEnEdicion = null;

let registros = [];

const tablaCambios = document.getElementById("tablaCambios");
const modal = document.getElementById("modalOverlay");
const inputFecha = document.getElementById("fecha");
const selectMateria = document.getElementById("materia");
const selectProfesor = document.getElementById("profesor");
const inputMotivo = document.getElementById("motivo");
const modalTitulo = document.getElementById("modalTitulo");

/* Configurar calendario para el año actual */
inputFecha.min = añoActual + "-01-01";
inputFecha.max = añoActual + "-12-31";

/* ============================= */
/*         CARGA INICIAL          */
/* ============================= */

async function iniciar() {

    try {

        const [materias, profesores] = await Promise.all([
            api.get("/materias"),
            api.get("/profesores")
        ]);

        poblarSelect(selectMateria, materias, "Seleccione una materia");
        poblarSelect(selectProfesor, profesores, "Seleccione un profesor");

        await cargarRegistros();

    } catch (error) {
        alert("No se pudieron cargar los datos iniciales.\n" + error.message);
    }
}

function poblarSelect(select, opciones, textoDefecto) {

    select.innerHTML = `<option value="">${textoDefecto}</option>`;

    opciones.forEach(opcion => {
        const elemento = document.createElement("option");
        elemento.value = opcion.id;
        elemento.textContent = opcion.nombre;
        select.appendChild(elemento);
    });
}

async function cargarRegistros() {

    try {
        registros = await api.get("/registro-cambios");
        pintarTabla();
    } catch (error) {
        alert("No se pudieron cargar los registros de cambios.\n" + error.message);
    }
}

function pintarTabla() {

    tablaCambios.innerHTML = "";

    registros.forEach(registro => {

        const fila = document.createElement("tr");
        fila.dataset.id = registro.id;

        fila.innerHTML = `
            <td>${registro.fecha.substring(0, 10)}</td>
            <td>${(registro.materia?.nombre || "-").toUpperCase()}</td>
            <td>${(registro.profesor?.nombre || "-").toUpperCase()}</td>
            <td>${registro.motivo}</td>
            <td>
                <button onclick="editarFila(this)">Editar</button>
                <button class="eliminar" onclick="eliminarFila(this)">Eliminar</button>
            </td>
        `;

        tablaCambios.appendChild(fila);
    });
}

/* ============================= */
/*             MODAL              */
/* ============================= */

function soloLetras(texto) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(texto);
}

function abrirModalAgregar() {

    registroEnEdicion = null;

    modalTitulo.textContent = "Agregar registro";

    inputFecha.value = "";
    selectMateria.value = "";
    selectProfesor.value = "";
    inputMotivo.value = "";

    modal.classList.add("activo");
    inputFecha.focus();
}

function abrirModalEditar(fila) {

    const id = Number(fila.dataset.id);
    const registro = registros.find(r => r.id === id);

    if (!registro) return;

    registroEnEdicion = registro;

    modalTitulo.textContent = "Editar registro";

    inputFecha.value = registro.fecha.substring(0, 10);
    selectMateria.value = registro.materia?.id || "";
    selectProfesor.value = registro.profesor?.id || "";
    inputMotivo.value = registro.motivo;

    modal.classList.add("activo");
    inputFecha.focus();
}

function cerrarModal() {
    modal.classList.remove("activo");
    registroEnEdicion = null;
}

/* Cerrar al hacer clic fuera de la tarjeta del modal */
modal.addEventListener("click", evento => {
    if (evento.target === modal) {
        cerrarModal();
    }
});

/* Cerrar con la tecla Escape */
document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && modal.classList.contains("activo")) {
        cerrarModal();
    }
});

/* ============================= */
/*    GUARDAR / EDITAR / BORRAR   */
/* ============================= */

async function guardarRegistro() {

    const fecha = inputFecha.value;
    const materiaId = selectMateria.value;
    const profesorId = selectProfesor.value;
    const motivo = inputMotivo.value.trim();

    if (fecha === "" || materiaId === "" || profesorId === "" || motivo === "") {
        alert("Complete todos los campos");
        return;
    }

    const año = new Date(fecha).getFullYear();

    if (año !== añoActual) {
        alert("Solo se permiten fechas del año " + añoActual + ".");
        return;
    }

    if (!soloLetras(motivo)) {
        alert("El motivo solo puede contener letras.");
        return;
    }

    const payload = {
        fecha,
        materiaId: Number(materiaId),
        profesorId: Number(profesorId),
        motivo
    };

    try {

        if (registroEnEdicion) {
            await api.put(`/registro-cambios/${registroEnEdicion.id}`, payload);
        } else {
            await api.post("/registro-cambios", payload);
        }

        await cargarRegistros();
        cerrarModal();

    } catch (error) {
        alert("No se pudo guardar el registro.\n" + error.message);
    }
}

async function eliminarFila(boton) {

    if (!confirm("¿Desea eliminar este registro?")) return;

    const fila = boton.closest("tr");
    const id = fila.dataset.id;

    try {
        await api.del(`/registro-cambios/${id}`);
        await cargarRegistros();
    } catch (error) {
        alert("No se pudo eliminar el registro.\n" + error.message);
    }
}

function editarFila(boton) {
    const fila = boton.closest("tr");
    abrirModalEditar(fila);
}

/* ============================= */
/*            INICIAR             */
/* ============================= */

iniciar();
