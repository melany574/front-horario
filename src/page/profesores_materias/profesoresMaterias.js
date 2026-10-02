/**
 * profesoresMaterias.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla Profesores_y_materias.html.
 * Reemplaza la versión anterior que guardaba todo directo en el DOM
 * (sin persistencia real) por llamadas a las tablas `profesores`,
 * `profesor_dia_disponible`, `materias` y `profesor_materia` del
 * schema.prisma.
 *
 * Rutas (ver script/api.js):
 *   GET    /profesores
 *       -> [{ id, nombre, jornada,
 *             materias: [{ profesorId, materiaId, materia: { id, nombre, aula } }],
 *             diasDisponibles: [{ profesorId, diaSemana }] }]
 *   POST   /profesores      { nombre, jornada }
 *   PUT    /profesores/:id  { nombre, jornada }
 *   DELETE /profesores/:id
 *
 *   La materia y los días del profesor son tablas aparte, así que al
 *   guardar se sincronizan fila por fila:
 *   POST   /profesor-materia                         { profesorId, materiaId }
 *   DELETE /profesor-materia/:profesorId/:materiaId
 *   POST   /profesor-dias-disponibles                { profesorId, diaSemana }
 *   DELETE /profesor-dias-disponibles/:profesorId/:diaSemana
 *
 *   GET    /materias
 *   POST   /materias        { nombre, aula }
 *   PUT    /materias/:id    { nombre, aula }
 *   DELETE /materias/:id
 * ------------------------------------------------------------------
 */

const DIAS_VALIDOS = ["lunes", "martes", "miercoles", "jueves", "viernes"];

const NOMBRES_DIA = {
    lunes: "Lunes",
    martes: "Martes",
    miercoles: "Miércoles",
    jueves: "Jueves",
    viernes: "Viernes"
};

const NOMBRES_JORNADA = {
    manana: "Mañana",
    tarde: "Tarde",
    ambas: "Ambas"
};

const listaProfesores = document.getElementById("listaProfesores");
const listaMaterias = document.getElementById("listaMaterias");

/* ============================= */
/*            UTILES              */
/* ============================= */

function soloLetras(texto) {
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(texto);
}

function quitarTildes(texto) {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Convierte "Lunes, martes y viernes" -> ["lunes","martes","viernes"] */
function parsearDias(texto) {
    const normalizado = quitarTildes(texto.toLowerCase());
    const partes = normalizado.split(/,| y /).map(p => p.trim()).filter(Boolean);

    const dias = [];

    partes.forEach(parte => {
        const encontrado = DIAS_VALIDOS.find(dia => parte.includes(dia));
        if (encontrado && !dias.includes(encontrado)) {
            dias.push(encontrado);
        }
    });

    return dias;
}

/** Convierte ["lunes","martes","viernes"] -> "Lunes, martes y viernes" */
function formatearDias(dias) {
    if (!dias || dias.length === 0) return "Sin definir";

    const etiquetas = dias.map(dia => NOMBRES_DIA[dia] || dia);

    if (etiquetas.length === 1) return etiquetas[0];

    return etiquetas.slice(0, -1).join(", ") + " y " + etiquetas[etiquetas.length - 1];
}

/** [{ diaSemana: "lunes" }, ...] -> ["lunes", ...] en el orden de la semana */
function diasDelProfesor(profesor) {
    const dias = (profesor.diasDisponibles || []).map(d => d.diaSemana);
    return DIAS_VALIDOS.filter(dia => dias.includes(dia));
}

/* ============================= */
/*         CARGA INICIAL          */
/* ============================= */

async function cargarProfesores() {
    try {
        const profesores = await api.get("/profesores");
        pintarProfesores(profesores);
    } catch (error) {
        alert("No se pudieron cargar los profesores.\n" + error.message);
    }
}

async function cargarMaterias() {
    try {
        const materias = await api.get("/materias");
        pintarMaterias(materias);
    } catch (error) {
        alert("No se pudieron cargar las materias.\n" + error.message);
    }
}

function pintarProfesores(profesores) {

    listaProfesores.innerHTML = "";

    profesores.forEach(profesor => {

        const contenedor = document.createElement("p");

        const materia = profesor.materias?.[0]?.materia;
        const dias = diasDelProfesor(profesor);

        contenedor.dataset.id = profesor.id;
        contenedor.dataset.nombre = profesor.nombre;
        contenedor.dataset.jornada = profesor.jornada;
        contenedor.dataset.materia = materia?.nombre || "";
        contenedor.dataset.materiaId = materia?.id || "";
        contenedor.dataset.dias = dias.join(",");

        contenedor.innerHTML = `
            <b>${profesor.nombre}</b><br>
            Materia: ${contenedor.dataset.materia || "Sin materia asignada"}<br>
            Jornada: ${NOMBRES_JORNADA[profesor.jornada] || profesor.jornada}<br>
            Días disponibles: ${formatearDias(dias)}<br>
            <button class="editar">Editar</button>
            <button class="eliminar">Eliminar</button>
        `;

        listaProfesores.appendChild(contenedor);
    });

    vincularBotones();
}

function pintarMaterias(materias) {

    listaMaterias.innerHTML = "";

    materias.forEach(materia => {

        const contenedor = document.createElement("p");

        contenedor.dataset.id = materia.id;
        contenedor.dataset.materia = materia.nombre;
        contenedor.dataset.aula = materia.aula || "";

        contenedor.innerHTML = `
            ${materia.nombre} - Aula ${materia.aula || "sin asignar"}<br>
            <button class="editar">Editar</button>
            <button class="eliminar">Eliminar</button>
        `;

        listaMaterias.appendChild(contenedor);
    });

    vincularBotones();
}

/* ============================= */
/*         MODAL PROFESOR         */
/* ============================= */

const modalProfesor = document.getElementById("modalProfesor");
const tituloModalProfesor = document.getElementById("tituloModalProfesor");
const inputNombreProfesor = document.getElementById("nombreProfesor");
const inputMateriaProfesor = document.getElementById("materiaProfesor");
const inputJornadaProfesor = document.getElementById("jornadaProfesor");
const inputDiasProfesor = document.getElementById("diasProfesor");

let profesorEnEdicion = null;

function abrirModalAgregarProfesor() {
    profesorEnEdicion = null;
    tituloModalProfesor.textContent = "Agregar profesor";
    inputNombreProfesor.value = "";
    inputMateriaProfesor.value = "";
    inputJornadaProfesor.value = "manana";
    inputDiasProfesor.value = "";
    modalProfesor.classList.add("activo");
    inputNombreProfesor.focus();
}

function abrirModalEditarProfesor(contenedor) {
    profesorEnEdicion = contenedor;
    tituloModalProfesor.textContent = "Editar profesor";
    inputNombreProfesor.value = contenedor.dataset.nombre;
    inputMateriaProfesor.value = contenedor.dataset.materia;
    inputJornadaProfesor.value = contenedor.dataset.jornada || "manana";
    inputDiasProfesor.value = formatearDias(
        contenedor.dataset.dias ? contenedor.dataset.dias.split(",") : []
    );
    modalProfesor.classList.add("activo");
    inputNombreProfesor.focus();
}

function cerrarModalProfesor() {
    modalProfesor.classList.remove("activo");
    profesorEnEdicion = null;
}

async function guardarProfesor() {

    const nombre = inputNombreProfesor.value.trim();
    const materia = inputMateriaProfesor.value.trim();
    const jornada = inputJornadaProfesor.value;
    const diasTexto = inputDiasProfesor.value.trim();

    if (!soloLetras(nombre)) {
        alert("Error: El nombre solo puede contener letras.");
        return;
    }

    if (!soloLetras(materia)) {
        alert("Error: La materia solo puede contener letras.");
        return;
    }

    if (diasTexto === "") {
        alert("Ingrese los días disponibles.");
        return;
    }

    const dias = parsearDias(diasTexto);

    if (dias.length === 0) {
        alert("No reconocí ningún día válido. Use nombres como: Lunes, martes y viernes.");
        return;
    }

    const payload = { nombre, jornada };
    const materiaAnteriorId = profesorEnEdicion ? Number(profesorEnEdicion.dataset.materiaId) || null : null;

    try {

        const materiaId = await obtenerOCrearMateria(materia);

        const profesor = profesorEnEdicion
            ? await api.put(`/profesores/${profesorEnEdicion.dataset.id}`, payload)
            : await api.post("/profesores", payload);

        await sincronizarMateria(profesor, materiaId, materiaAnteriorId);
        await sincronizarDias(profesor, dias);

        await Promise.all([cargarProfesores(), cargarMaterias()]);
        cerrarModalProfesor();

    } catch (error) {
        alert("No se pudo guardar el profesor.\n" + error.message);
    }
}

/** Devuelve el id de la materia con ese nombre; si no existe, la crea. */
async function obtenerOCrearMateria(nombre) {

    const clave = quitarTildes(nombre.toLowerCase());
    const materias = await api.get("/materias");

    const existente = materias.find(m => quitarTildes(m.nombre.toLowerCase()) === clave);
    if (existente) return existente.id;

    const creada = await api.post("/materias", { nombre });
    return creada.id;
}

/** La UI maneja una sola materia por profesor: reemplaza la anterior por la nueva. */
async function sincronizarMateria(profesor, materiaId, materiaAnteriorId) {

    const asignadas = (profesor.materias || []).map(pm => pm.materiaId);

    if (materiaAnteriorId && materiaAnteriorId !== materiaId && asignadas.includes(materiaAnteriorId)) {
        await api.del(`/profesor-materia/${profesor.id}/${materiaAnteriorId}`);
    }

    if (!asignadas.includes(materiaId)) {
        await api.post("/profesor-materia", { profesorId: profesor.id, materiaId });
    }
}

/** Crea los días nuevos y borra los que se quitaron. */
async function sincronizarDias(profesor, dias) {

    const actuales = diasDelProfesor(profesor);

    await Promise.all([
        ...dias
            .filter(dia => !actuales.includes(dia))
            .map(diaSemana => api.post("/profesor-dias-disponibles", { profesorId: profesor.id, diaSemana })),
        ...actuales
            .filter(dia => !dias.includes(dia))
            .map(dia => api.del(`/profesor-dias-disponibles/${profesor.id}/${dia}`))
    ]);
}

/* ============================= */
/*         MODAL MATERIA          */
/* ============================= */

const modalMateria = document.getElementById("modalMateria");
const tituloModalMateria = document.getElementById("tituloModalMateria");
const inputNombreMateria = document.getElementById("nombreMateria");
const inputAulaMateria = document.getElementById("aulaMateria");

let materiaEnEdicion = null;

function abrirModalAgregarMateria() {
    materiaEnEdicion = null;
    tituloModalMateria.textContent = "Agregar materia";
    inputNombreMateria.value = "";
    inputAulaMateria.value = "";
    modalMateria.classList.add("activo");
    inputNombreMateria.focus();
}

function abrirModalEditarMateria(contenedor) {
    materiaEnEdicion = contenedor;
    tituloModalMateria.textContent = "Editar materia";
    inputNombreMateria.value = contenedor.dataset.materia;
    inputAulaMateria.value = contenedor.dataset.aula;
    modalMateria.classList.add("activo");
    inputNombreMateria.focus();
}

function cerrarModalMateria() {
    modalMateria.classList.remove("activo");
    materiaEnEdicion = null;
}

async function guardarMateria() {

    const materia = inputNombreMateria.value.trim();
    const aula = inputAulaMateria.value.trim();

    if (!soloLetras(materia)) {
        alert("Error: La materia solo puede contener letras.");
        return;
    }

    if (aula === "") {
        alert("Ingrese el aula.");
        return;
    }

    const payload = { nombre: materia, aula };

    try {

        if (materiaEnEdicion) {
            await api.put(`/materias/${materiaEnEdicion.dataset.id}`, payload);
        } else {
            await api.post("/materias", payload);
        }

        await cargarMaterias();
        cerrarModalMateria();

    } catch (error) {
        alert("No se pudo guardar la materia.\n" + error.message);
    }
}

/* ============================= */
/*   EDITAR / ELIMINAR (común)    */
/* ============================= */

function vincularBotones() {

    document.querySelectorAll(".editar").forEach(boton => {
        boton.onclick = () => {

            const contenedor = boton.parentElement;

            if (contenedor.hasAttribute("data-nombre")) {
                abrirModalEditarProfesor(contenedor);
            } else {
                abrirModalEditarMateria(contenedor);
            }
        };
    });

    document.querySelectorAll(".eliminar").forEach(boton => {
        boton.onclick = async () => {

            if (!confirm("¿Desea eliminar este registro?")) return;

            const contenedor = boton.parentElement;
            const id = contenedor.dataset.id;

            try {

                if (contenedor.hasAttribute("data-nombre")) {
                    await api.del(`/profesores/${id}`);
                    await cargarProfesores();
                } else {
                    await api.del(`/materias/${id}`);
                    await cargarMaterias();
                }

            } catch (error) {
                alert("No se pudo eliminar el registro.\n" + error.message);
            }
        };
    });
}

/* ============================= */
/*      CERRAR MODALES (común)    */
/* ============================= */

[modalProfesor, modalMateria].forEach(modal => {
    modal.addEventListener("click", evento => {
        if (evento.target === modal) {
            modal.classList.remove("activo");
        }
    });
});

document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
        modalProfesor.classList.remove("activo");
        modalMateria.classList.remove("activo");
    }
});

/* ============================= */
/*            INICIAR              */
/* ============================= */

cargarProfesores();
cargarMaterias();
