/**
 * horarioEspecial.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla HorarioEspecial.html.
 *
 * A diferencia de horarioDocente.js (horario recurrente semanal, por
 * día de la semana), esta pantalla guarda programaciones puntuales
 * por FECHA exacta — eventos, salidas, reemplazos de un solo día —
 * por eso las celdas siguen siendo texto libre (contenteditable) en
 * vez de <select> de materia/profesor: no todo lo que se anota acá
 * es una clase normal (ej. "Izada de bandera").
 *
 * Antes esto se guardaba como UN blob por fecha bajo la clave
 * "horario_" + fecha, la misma que usaba horarioGeneral.html (se
 * pisaban entre sí). Ahora cada celda es una fila independiente en
 * `horario_especial`, con su propio autoguardado.
 *
 * Rutas asumidas (ver script/api.js):
 *   GET  /grupos
 *   GET  /bloques-horario
 *   GET  /horarios-especiales/fecha/YYYY-MM-DD
 *   POST /horarios-especiales      { fecha, grupoId, bloqueHorarioId, descripcion }
 *   PUT  /horarios-especiales/:id  { descripcion }
 *   DELETE /horarios-especiales/:id
 *   ("Limpiar día" borra una por una las entradas de esa fecha)
 * ------------------------------------------------------------------
 */

let grupos = [];
let bloquesManana = [];
let bloquesTarde = [];

function clavesOrdenGrado(nombre) {
    const numeros = nombre.match(/\d+/g) || ["0", "0"];
    return [
        Number(numeros[0]),
        Number(numeros[1] || 0)
    ];
}

function ordenarGrados(listaGrupos) {
    return [...listaGrupos].sort((a, b) => {
        const [nivelA, seccionA] = clavesOrdenGrado(a.nombre);
        const [nivelB, seccionB] = clavesOrdenGrado(b.nombre);
        return nivelA - nivelB || seccionA - seccionB;
    });
}

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

    const opciones = {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    };

    let texto = fechaObjeto.toLocaleDateString("es-CO", opciones);

    texto = texto.charAt(0).toUpperCase() + texto.slice(1);

    document.getElementById("fechaTitulo").textContent = texto;
}

function obtenerDiaSemana(fecha) {
    const dias = [
        "domingo",
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado"
    ];

    const fechaObjeto = new Date(`${fecha}T00:00:00`);

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

function formatearHora(valor) {
    if (!valor) return "";

    const fechaHora = new Date(valor);

    if (!isNaN(fechaHora)) {
        return fechaHora.toISOString().substring(11, 16);
    }

    return String(valor).substring(0, 5);
}

function textoEncabezadoBloque(bloque) {
    if (bloque.esDescanso) {
        return "Descanso";
    }

    return `${formatearHora(bloque.horaInicio)} - ${formatearHora(bloque.horaFin)}`;
}

function pintarCabeceras() {
    const cabeceraManana = document.getElementById("cabeceraManana");
    const cabeceraTarde = document.getElementById("cabeceraTarde");

    cabeceraManana.innerHTML = "<th>Grado</th>";
    cabeceraTarde.innerHTML = "<th>Grado</th>";

    bloquesManana.forEach(bloque => {
        cabeceraManana.innerHTML += `
            <th>${textoEncabezadoBloque(bloque)}</th>
        `;
    });

    bloquesTarde.forEach(bloque => {
        cabeceraTarde.innerHTML += `
            <th>${textoEncabezadoBloque(bloque)}</th>
        `;
    });
}

function crearFilas(idTabla, bloques, listaGrupos) {
    const tabla = document.getElementById(idTabla);

    tabla.innerHTML = "";

    const gradosOrdenados = ordenarGrados(listaGrupos);

    gradosOrdenados.forEach(grupo => {
        const tr = document.createElement("tr");

        tr.dataset.grupoId = grupo.id;

        const tdGrado = document.createElement("td");

        tdGrado.className = "hora";
        tdGrado.textContent = grupo.nombre;

        tr.appendChild(tdGrado);

        bloques.forEach(bloque => {
            const td = document.createElement("td");

            td.dataset.bloqueId = bloque.id;

            if (bloque.esDescanso) {
                td.textContent = "DESCANSO";
                td.classList.add("descanso");
                td.contentEditable = "false";
            } else {
                td.textContent = "";
                td.classList.add("editable");
                td.contentEditable = "true";
            }

            tr.appendChild(td);
        });

        tabla.appendChild(tr);
    });
}

async function cargarHorarioGeneral(fecha) {
    const diaSemana = obtenerDiaSemana(fecha);

    const clases = await api.get(`/horario-clases/dia/${diaSemana}`);

    clases.forEach(clase => {
        const celda = document.querySelector(
            `tr[data-grupo-id="${clase.grupoId}"] td[data-bloque-id="${clase.bloqueHorarioId}"]`
        );

        if (!celda) return;

        if (celda.classList.contains("descanso")) {
            return;
        }

        const materia = clase.materia?.nombre || "";
        const profesor = clase.profesor?.nombre || "";

        let texto = materia;

        if (profesor) {
            texto += texto ? ` - ${profesor}` : profesor;
        }

        celda.textContent = texto;
    });
}

async function cargarHorarioEspecial(fecha) {
    const entradas = await api.get(
        `/horarios-especiales/fecha/${fecha}`
    );

    entradas.forEach(entrada => {
        const celda = document.querySelector(
            `tr[data-grupo-id="${entrada.grupoId}"] td[data-bloque-id="${entrada.bloqueHorarioId}"]`
        );

        if (!celda) return;

        if (celda.classList.contains("descanso")) {
            return;
        }

        celda.textContent = entrada.descripcion || "";

        celda.dataset.horarioEspecialId = entrada.id;
    });
}

async function cargarHorario() {
    const fecha = document.getElementById("fecha").value;

    mostrarFechaTitulo();

    crearFilas(
        "tablaManana",
        bloquesManana,
        grupos.filter(g => g.jornada === "manana")
    );

    crearFilas(
        "tablaTarde",
        bloquesTarde,
        grupos.filter(g => g.jornada === "tarde")
    );

    if (!fecha) return;

    try {
        await cargarHorarioGeneral(fecha);
        await cargarHorarioEspecial(fecha);
    } catch (error) {
        mostrarMensaje("No se pudo cargar el horario.");
        console.error(error);
    }
}

function debounce(funcion, esperaMs) {
    let temporizador = null;

    return (...args) => {
        clearTimeout(temporizador);

        temporizador = setTimeout(
            () => funcion(...args),
            esperaMs
        );
    };
}

async function guardarCelda(celda) {
    const fecha = document.getElementById("fecha").value;

    const fila = celda.closest("tr");

    if (!fila) return;

    const grupoId = Number(fila.dataset.grupoId);

    const bloqueHorarioId =
        Number(celda.dataset.bloqueId);

    const descripcion =
        celda.textContent.trim();

    const idExistente =
        celda.dataset.horarioEspecialId;

    try {
        if (!descripcion) {
            if (idExistente) {
                await api.del(
                    `/horarios-especiales/${idExistente}`
                );

                delete celda.dataset.horarioEspecialId;
            }

            mostrarMensaje(
                "Casilla borrada solo en Horario Especial ✓"
            );

            return;
        }

        if (idExistente) {
            await api.put(
                `/horarios-especiales/${idExistente}`,
                {
                    descripcion
                }
            );
        } else {
            const creado = await api.post(
                "/horarios-especiales",
                {
                    fecha,
                    grupoId,
                    bloqueHorarioId,
                    descripcion
                }
            );

            celda.dataset.horarioEspecialId =
                creado.id;
        }

        mostrarMensaje(
            "Guardado solo en Horario Especial ✓"
        );

    } catch (error) {
        mostrarMensaje(
            "No se pudo guardar esta casilla."
        );

        console.error(error);
    }
}

const guardarCeldaConDebounce =
    debounce(guardarCelda, 600);

document.addEventListener("input", evento => {
    if (
        evento.target.classList.contains(
            "editable"
        )
    ) {
        guardarCeldaConDebounce(
            evento.target
        );
    }
});

async function limpiarDia() {
    const confirmar = confirm(
        "¿Quieres borrar la programación especial de este día?\n\n" +
        "El Horario General NO se modificará."
    );

    if (!confirmar) return;

    const fecha =
        document.getElementById("fecha").value;

    try {
        const entradas = await api.get(
            `/horarios-especiales/fecha/${fecha}`
        );

        await Promise.all(
            entradas.map(
                entrada =>
                    api.del(
                        `/horarios-especiales/${entrada.id}`
                    )
            )
        );

        await cargarHorario();

        mostrarMensaje(
            "Horario Especial limpiado ✓"
        );

    } catch (error) {
        alert(
            "No se pudo borrar la programación.\n" +
            error.message
        );
    }
}

function mostrarMensaje(texto) {
    const mensaje =
        document.getElementById("mensaje");

    if (!mensaje) return;

    mensaje.textContent = texto;

    setTimeout(() => {
        mensaje.textContent = "";
    }, 2500);
}

async function iniciar() {
    try {
        const [
            gruposApi,
            bloquesApi
        ] = await Promise.all([
            api.get("/grupos"),
            api.get("/bloques-horario")
        ]);

        grupos = gruposApi;

        bloquesManana = bloquesApi
            .filter(
                bloque =>
                    bloque.jornada === "manana"
            )
            .sort(
                (a, b) =>
                    a.orden - b.orden
            );

        bloquesTarde = bloquesApi
            .filter(
                bloque =>
                    bloque.jornada === "tarde"
            )
            .sort(
                (a, b) =>
                    a.orden - b.orden
            );

        pintarCabeceras();

        document.getElementById(
            "fecha"
        ).value = fechaHoy();

        await cargarHorario();

    } catch (error) {
        alert(
            "No se pudieron cargar los datos iniciales.\n" +
            error.message
        );
    }
}

iniciar();