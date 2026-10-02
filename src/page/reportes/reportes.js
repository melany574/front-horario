/**
 * reportes.js
 * ------------------------------------------------------------------
 * Consume la API para la pantalla reportes_exportacion.html.
 *
 * La versión anterior, para "Por profesor" y "Por materia", recorría
 * el localStorage de cada profesor (hasta ~30) por cada uno de los
 * 5 días de la semana: hasta 150 lecturas por reporte. Acá se trae
 * el horario completo de la semana en UNA sola llamada y se agrupa
 * en el cliente por profesor o por materia.
 *
 * También se optimizó: antes "Actualizar" (y cada vez que la
 * pestaña recuperaba el foco) regeneraba los 6 tipos de reporte
 * aunque solo uno estuviera visible. Ahora solo se recarga el que
 * está siendo mostrado.
 *
 * Rutas asumidas (ver script/api.js):
 *   GET /grupos
 *   GET /profesores
 *   GET /bloques-horario
 *   GET /horario-clases                   -> TODA la semana, todos los profesores
 *   GET /horario-clases/dia/:diaSemana    -> solo ese día (para "Horario por día")
 *       -> se asume que cada elemento viene con los nombres y bloques
 *          relacionados incluidos, ej:
 *          { id, diaSemana, grupoId, bloqueHorarioId,
 *            materia: { nombre }, profesor: { nombre },
 *            grupo: { nombre }, bloqueHorario: { jornada, orden, horaInicio } }
 *   GET /avisos/ultimo | /eventos/ultimo | /estados-colegio/ultimo
 * ------------------------------------------------------------------
 */

let grupos = [];
let profesores = [];
let materias = [];
let bloquesManana = [];
let bloquesTarde = [];

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"];

const NOMBRES_DIAS = {
    lunes: "Lunes",
    martes: "Martes",
    miercoles: "Miércoles",
    jueves: "Jueves",
    viernes: "Viernes"
};


/* =========================================================
   INICIO
========================================================= */

async function iniciarReportes() {

    try {

        const [
            gruposApi,
            profesoresApi,
            materiasApi,
            bloquesApi
        ] = await Promise.all([
            api.get("/grupos"),
            api.get("/profesores"),
            api.get("/materias"),
            api.get("/bloques-horario")
        ]);

        grupos = gruposApi || [];
        profesores = profesoresApi || [];
        materias = materiasApi || [];

        bloquesManana = (bloquesApi || [])
            .filter(b => b.jornada === "manana")
            .sort((a, b) => a.orden - b.orden);

        bloquesTarde = (bloquesApi || [])
            .filter(b => b.jornada === "tarde")
            .sort((a, b) => a.orden - b.orden);

        mostrarReporte(
            document.getElementById("tipoReporte")?.value || "completo"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudieron cargar los datos de los reportes.\n" +
            error.message
        );
    }
}


/* =========================================================
   CAMBIAR REPORTE
========================================================= */

function mostrarReporte(tipo) {

    const elementos = [
        "reporteCompleto",
        "reporteEspecial",
        "reporteProfesor",
        "reporteMateria",
        "reporteAvisos",
        "reporteEventos",
        "reporteEstado"
    ];

    elementos.forEach(id => {

        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.hidden = true;
        }
    });


    /*
       Tu HTML tenía Horario Especial con value="completo".
       Por eso también revisamos el texto de la opción.
    */

    const selector = document.getElementById("tipoReporte");

    if (selector) {

        const opcion =
            selector.options[selector.selectedIndex];

        if (
            opcion &&
            opcion.textContent
                .trim()
                .toLowerCase() === "horario especial"
        ) {
            tipo = "especial";
        }
    }


    if (tipo === "completo") {

        const reporte =
            document.getElementById("reporteCompleto");

        if (reporte) {
            reporte.hidden = false;
        }

        generarHorarioDia();
        return;
    }


    if (tipo === "especial") {

        prepararReporteEspecial();

        const reporte =
            document.getElementById("reporteEspecial");

        if (reporte) {
            reporte.hidden = false;
        }

        generarEspecial();
        return;
    }


    if (tipo === "profesor") {

        const reporte =
            document.getElementById("reporteProfesor");

        if (reporte) {
            reporte.hidden = false;
        }

        generarProfesores();
        return;
    }


    if (tipo === "materia") {

        const reporte =
            document.getElementById("reporteMateria");

        if (reporte) {
            reporte.hidden = false;
        }

        generarMaterias();
        return;
    }


    if (tipo === "avisos") {

        const reporte =
            document.getElementById("reporteAvisos");

        if (reporte) {
            reporte.hidden = false;
        }

        cargarAvisos();
        return;
    }


    if (tipo === "eventos") {

        const reporte =
            document.getElementById("reporteEventos");

        if (reporte) {
            reporte.hidden = false;
        }

        cargarEventos();
        return;
    }


    if (tipo === "estado") {

        const reporte =
            document.getElementById("reporteEstado");

        if (reporte) {
            reporte.hidden = false;
        }

        cargarEstado();
    }
}


/* =========================================================
   ACTUALIZAR
========================================================= */

function actualizarTodo() {

    const selector =
        document.getElementById("tipoReporte");

    if (!selector) return;

    mostrarReporte(selector.value);
}


/* =========================================================
   HORARIO GENERAL
========================================================= */

async function generarHorarioDia() {

    const selector =
        document.getElementById("diaReporte");

    if (!selector) return;

    const dia = selector.value;

    try {

        const clases =
            await api.get(`/horario-clases/dia/${dia}`);

        const fechaReporte =
            document.getElementById("fechaReporte");

        if (fechaReporte) {

            fechaReporte.textContent =
                NOMBRES_DIAS[dia] || dia;
        }


        generarTablaHorario(
            "tablaManana",
            bloquesManana,
            grupos.filter(g => g.jornada === "manana"),
            clases || [],
            "LA JORNADA DE LA MAÑANA"
        );


        generarTablaHorario(
            "tablaTarde",
            bloquesTarde,
            grupos.filter(g => g.jornada === "tarde"),
            clases || [],
            "LA JORNADA DE LA TARDE"
        );

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo cargar el horario general.\n" +
            error.message
        );
    }
}


function generarTablaHorario(
    idTabla,
    bloques,
    listaGrupos,
    clases,
    titulo
) {

    const tabla =
        document.getElementById(idTabla);

    if (!tabla) return;

    let html = "";

    html += `
        <tr>
            <td colspan="${bloques.length + 1}" align="center">
                <b>${titulo}</b>
            </td>
        </tr>
    `;


    html += `
        <tr>
            <td align="center">
                <b>Grupo</b>
            </td>
    `;


    bloques.forEach(bloque => {

        html += `
            <td align="center">
                <b>
                    ${
                        bloque.esDescanso
                            ? "Descanso"
                            : formatearHora(
                                bloque.horaInicio
                            )
                    }
                </b>
            </td>
        `;
    });


    html += "</tr>";


    ordenarGrupos(listaGrupos)
        .forEach(grupo => {

            html += `
                <tr>
                    <td align="center">
                        <b>
                            ${escapar(grupo.nombre)}
                        </b>
                    </td>
            `;


            bloques.forEach(bloque => {

                if (bloque.esDescanso) {

                    html += `
                        <td align="center">
                            <b>Descanso</b>
                        </td>
                    `;

                    return;
                }


                const clase =
                    clases.find(c =>
                        Number(c.grupoId) === Number(grupo.id) &&
                        Number(c.bloqueHorarioId) ===
                        Number(bloque.id)
                    );


                if (!clase) {

                    html += `
                        <td align="center">
                            -
                        </td>
                    `;

                    return;
                }


                html += `
                    <td align="center">
                        <b>
                            ${escapar(
                                clase.materia?.nombre || "-"
                            )}
                        </b>

                        <br>

                        ${escapar(
                            clase.profesor?.nombre || "-"
                        )}
                    </td>
                `;
            });


            html += "</tr>";
        });


    tabla.innerHTML = html;
}


/* =========================================================
   HORARIO ESPECIAL
========================================================= */

function prepararReporteEspecial() {

    let contenedor =
        document.getElementById("reporteEspecial");


    if (!contenedor) {

        contenedor =
            document.createElement("div");

        contenedor.id =
            "reporteEspecial";


        const reporteCompleto =
            document.getElementById("reporteCompleto");


        if (
            reporteCompleto &&
            reporteCompleto.parentNode
        ) {

            reporteCompleto.parentNode.insertBefore(
                contenedor,
                reporteCompleto.nextSibling
            );

        } else {

            document.body.appendChild(
                contenedor
            );
        }
    }


    if (
        !document.getElementById(
            "fechaEspecialReporte"
        )
    ) {

        contenedor.innerHTML = `

            <table
                width="95%"
                align="center"
                border="1"
                cellpadding="8"
                cellspacing="0"
            >

                <tr>

                    <td
                        colspan="10"
                        align="center"
                    >

                        <b>
                            HORARIO ESPECIAL
                        </b>

                    </td>

                </tr>


                <tr>

                    <td
                        colspan="10"
                        align="center"
                    >

                        <label
                            for="fechaEspecialReporte"
                        >
                            Fecha:
                        </label>


                        <input
                            type="date"
                            id="fechaEspecialReporte"
                            onchange="generarEspecial()"
                        >


                        <br><br>


                        <b
                            id="fechaEspecialTitulo"
                        ></b>

                    </td>

                </tr>

            </table>


            <br>


            <table
                id="tablaEspecialManana"
                width="95%"
                align="center"
                border="1"
                cellpadding="5"
                cellspacing="0"
            ></table>


            <br>


            <table
                id="tablaEspecialTarde"
                width="95%"
                align="center"
                border="1"
                cellpadding="5"
                cellspacing="0"
            ></table>
        `;
    }


    const fecha =
        document.getElementById(
            "fechaEspecialReporte"
        );


    if (
        fecha &&
        !fecha.value
    ) {

        const hoy = new Date();

        const año =
            hoy.getFullYear();

        const mes =
            String(
                hoy.getMonth() + 1
            ).padStart(2, "0");

        const dia =
            String(
                hoy.getDate()
            ).padStart(2, "0");


        fecha.value =
            `${año}-${mes}-${dia}`;
    }
}


async function generarEspecial() {

    prepararReporteEspecial();


    const fechaInput =
        document.getElementById(
            "fechaEspecialReporte"
        );


    if (
        !fechaInput ||
        !fechaInput.value
    ) {
        return;
    }


    const fecha =
        fechaInput.value;


    const diaSemana =
        obtenerDiaSemana(fecha);


    const titulo =
        document.getElementById(
            "fechaEspecialTitulo"
        );


    if (titulo) {

        titulo.textContent =
            formatearFecha(fecha);
    }


    if (
        diaSemana === "sabado" ||
        diaSemana === "domingo"
    ) {

        generarTablaEspecial(
            "tablaEspecialManana",
            bloquesManana,
            grupos.filter(
                g => g.jornada === "manana"
            ),
            [],
            [],
            "LA JORNADA DE LA MAÑANA"
        );


        generarTablaEspecial(
            "tablaEspecialTarde",
            bloquesTarde,
            grupos.filter(
                g => g.jornada === "tarde"
            ),
            [],
            [],
            "LA JORNADA DE LA TARDE"
        );

        return;
    }


    try {

        const [
            clasesGenerales,
            especiales
        ] = await Promise.all([

            api.get(
                `/horario-clases/dia/${diaSemana}`
            ),

            api.get(
                `/horarios-especiales/fecha/${fecha}`
            )
        ]);


        generarTablaEspecial(
            "tablaEspecialManana",
            bloquesManana,
            grupos.filter(
                g => g.jornada === "manana"
            ),
            clasesGenerales || [],
            especiales || [],
            "LA JORNADA DE LA MAÑANA"
        );


        generarTablaEspecial(
            "tablaEspecialTarde",
            bloquesTarde,
            grupos.filter(
                g => g.jornada === "tarde"
            ),
            clasesGenerales || [],
            especiales || [],
            "LA JORNADA DE LA TARDE"
        );


    } catch (error) {

        console.error(error);

        alert(
            "No se pudo cargar el Horario Especial.\n" +
            error.message
        );
    }
}


function generarTablaEspecial(
    idTabla,
    bloques,
    listaGrupos,
    clasesGenerales,
    especiales,
    titulo
) {

    const tabla =
        document.getElementById(idTabla);

    if (!tabla) return;


    let html = "";


    html += `
        <tr>

            <td
                colspan="${bloques.length + 1}"
                align="center"
            >

                <b>${titulo}</b>

            </td>

        </tr>
    `;


    html += `
        <tr>

            <td align="center">
                <b>Grupo</b>
            </td>
    `;


    bloques.forEach(bloque => {

        html += `
            <td align="center">

                <b>

                    ${
                        bloque.esDescanso
                            ? "Descanso"
                            : formatearHora(
                                bloque.horaInicio
                            )
                    }

                </b>

            </td>
        `;
    });


    html += "</tr>";


    ordenarGrupos(listaGrupos)
        .forEach(grupo => {

            html += `
                <tr>

                    <td align="center">

                        <b>
                            ${escapar(
                                grupo.nombre
                            )}
                        </b>

                    </td>
            `;


            bloques.forEach(bloque => {

                if (
                    bloque.esDescanso
                ) {

                    html += `
                        <td align="center">
                            <b>Descanso</b>
                        </td>
                    `;

                    return;
                }


                const especial =
                    especiales.find(
                        entrada =>
                            Number(
                                entrada.grupoId
                            ) === Number(
                                grupo.id
                            ) &&

                            Number(
                                entrada.bloqueHorarioId
                            ) === Number(
                                bloque.id
                            )
                    );


                if (especial) {

                    html += `
                        <td align="center">

                            ${escapar(
                                especial.descripcion || ""
                            )}

                        </td>
                    `;

                    return;
                }


                const clase =
                    clasesGenerales.find(
                        c =>
                            Number(
                                c.grupoId
                            ) === Number(
                                grupo.id
                            ) &&

                            Number(
                                c.bloqueHorarioId
                            ) === Number(
                                bloque.id
                            )
                    );


                if (!clase) {

                    html += `
                        <td align="center">
                            -
                        </td>
                    `;

                    return;
                }


                html += `
                    <td align="center">

                        <b>
                            ${escapar(
                                clase.materia?.nombre ||
                                "-"
                            )}
                        </b>

                        <br>

                        ${escapar(
                            clase.profesor?.nombre ||
                            "-"
                        )}

                    </td>
                `;
            });


            html += "</tr>";
        });


    tabla.innerHTML = html;
}


/* =========================================================
   PROFESORES
========================================================= */

async function generarProfesores() {

    const contenedor =
        document.getElementById(
            "contenidoProfesores"
        );

    if (!contenedor) return;


    try {

        const clases =
            await api.get(
                "/horario-clases"
            );


        let html = "";


        profesores.forEach(profesor => {

            const clasesProfesor =
                (clases || [])
                    .filter(
                        clase =>
                            Number(
                                clase.profesorId
                            ) === Number(
                                profesor.id
                            )
                    )
                    .sort(
                        (a, b) =>
                            DIAS.indexOf(
                                a.diaSemana
                            ) -
                            DIAS.indexOf(
                                b.diaSemana
                            )
                    );


            html += `

                <table
                    width="95%"
                    align="center"
                    border="1"
                    cellpadding="6"
                    cellspacing="0"
                >

                    <tr>

                        <td
                            colspan="6"
                            align="center"
                        >

                            <b>
                                ${escapar(
                                    profesor.nombre
                                )}
                            </b>

                        </td>

                    </tr>


                    <tr>

                        <td><b>Día</b></td>
                        <td><b>Jornada</b></td>
                        <td><b>Hora</b></td>
                        <td><b>Grupo</b></td>
                        <td><b>Materia</b></td>

                    </tr>
            `;


            if (
                clasesProfesor.length === 0
            ) {

                html += `

                    <tr>

                        <td
                            colspan="5"
                            align="center"
                        >

                            No hay clases registradas.

                        </td>

                    </tr>
                `;

            } else {

                clasesProfesor.forEach(
                    clase => {

                        html += `

                            <tr>

                                <td>
                                    ${
                                        NOMBRES_DIAS[
                                            clase.diaSemana
                                        ] || "-"
                                    }
                                </td>

                                <td>
                                    ${
                                        clase.bloqueHorario?.jornada ===
                                        "manana"
                                            ? "Mañana"
                                            : "Tarde"
                                    }
                                </td>

                                <td>
                                    ${
                                        formatearHora(
                                            clase
                                                .bloqueHorario
                                                ?.horaInicio
                                        ) || "-"
                                    }
                                </td>

                                <td>
                                    ${escapar(
                                        clase.grupo
                                            ?.nombre ||
                                        "-"
                                    )}
                                </td>

                                <td>
                                    ${escapar(
                                        clase.materia
                                            ?.nombre ||
                                        "-"
                                    )}
                                </td>

                            </tr>
                        `;
                    }
                );
            }


            html += `
                </table>
                <br>
            `;
        });


        contenedor.innerHTML =
            html;


    } catch (error) {

        console.error(error);

        contenedor.innerHTML =
            "<p>No se pudo cargar la información.</p>";
    }
}


/* =========================================================
   MATERIAS
========================================================= */

async function generarMaterias() {

    const contenedor =
        document.getElementById(
            "contenidoMaterias"
        );

    if (!contenedor) return;


    try {

        const clases =
            await api.get(
                "/horario-clases"
            );


        let html = `

            <table
                width="95%"
                align="center"
                border="1"
                cellpadding="6"
                cellspacing="0"
            >

                <tr>

                    <td><b>Materia</b></td>
                    <td><b>Profesor</b></td>
                    <td><b>Día</b></td>
                    <td><b>Jornada</b></td>
                    <td><b>Hora</b></td>
                    <td><b>Grupo</b></td>

                </tr>
        `;


        (clases || []).forEach(
            clase => {

                html += `

                    <tr>

                        <td>
                            ${escapar(
                                clase.materia
                                    ?.nombre ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${escapar(
                                clase.profesor
                                    ?.nombre ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${
                                NOMBRES_DIAS[
                                    clase.diaSemana
                                ] || "-"
                            }
                        </td>

                        <td>
                            ${
                                clase.bloqueHorario
                                    ?.jornada ===
                                "manana"
                                    ? "Mañana"
                                    : "Tarde"
                            }
                        </td>

                        <td>
                            ${
                                formatearHora(
                                    clase
                                        .bloqueHorario
                                        ?.horaInicio
                                ) || "-"
                            }
                        </td>

                        <td>
                            ${escapar(
                                clase.grupo
                                    ?.nombre ||
                                "-"
                            )}
                        </td>

                    </tr>
                `;
            }
        );


        html += "</table>";


        contenedor.innerHTML =
            html;


    } catch (error) {

        console.error(error);

        contenedor.innerHTML =
            "<p>No se pudo cargar la información.</p>";
    }
}


/* =========================================================
   AVISOS
========================================================= */

async function cargarAvisos() {

    const contenedor =
        document.getElementById(
            "contenidoAvisos"
        );

    if (!contenedor) return;


    try {

        const avisos =
            await api.get(
                "/avisos"
            );


        if (
            !avisos ||
            avisos.length === 0
        ) {

            contenedor.innerHTML =
                "<p>No hay avisos registrados.</p>";

            return;
        }


        let html = "";


        avisos.forEach(aviso => {

            html += `

                <div>

                    <h3>
                        ${escapar(
                            aviso.titulo ||
                            "Aviso"
                        )}
                    </h3>

                    <p>
                        ${escapar(
                            aviso.contenido ||
                            aviso.descripcion ||
                            ""
                        )}
                    </p>

                </div>
            `;
        });


        contenedor.innerHTML =
            html;


    } catch (error) {

        console.error(error);

        contenedor.innerHTML =
            "<p>No se pudieron cargar los avisos.</p>";
    }
}


/* =========================================================
   EVENTOS
========================================================= */

async function cargarEventos() {

    const contenedor =
        document.getElementById(
            "contenidoEventos"
        );

    if (!contenedor) return;


    try {

        const eventos =
            await api.get(
                "/eventos"
            );


        if (
            !eventos ||
            eventos.length === 0
        ) {

            contenedor.innerHTML =
                "<p>No hay eventos registrados.</p>";

            return;
        }


        let html = "";


        eventos.forEach(evento => {

            html += `

                <div>

                    <h3>
                        ${escapar(
                            evento.titulo ||
                            "Evento"
                        )}
                    </h3>

                    <p>
                        ${escapar(
                            evento.descripcion ||
                            ""
                        )}
                    </p>

                </div>
            `;
        });


        contenedor.innerHTML =
            html;


    } catch (error) {

        console.error(error);

        contenedor.innerHTML =
            "<p>No se pudieron cargar los eventos.</p>";
    }
}


/* =========================================================
   ESTADO
========================================================= */

async function cargarEstado() {

    const contenedor =
        document.getElementById(
            "contenidoEstado"
        );

    if (!contenedor) return;


    try {

        const estados =
            await api.get(
                "/estados-colegio"
            );


        if (
            !estados ||
            estados.length === 0
        ) {

            contenedor.innerHTML =
                "<p>No hay estado registrado.</p>";

            return;
        }


        let html = "";


        estados.forEach(estado => {

            html += `

                <div>

                    <h3>
                        Estado del colegio
                    </h3>

                    <p>
                        ${escapar(
                            estado.descripcion ||
                            estado.estado ||
                            ""
                        )}
                    </p>

                </div>
            `;
        });


        contenedor.innerHTML =
            html;


    } catch (error) {

        console.error(error);

        contenedor.innerHTML =
            "<p>No se pudo cargar el estado.</p>";
    }
}


/* =========================================================
   IMPRIMIR
========================================================= */

function imprimirReporte() {

    const tipo =
        obtenerTipoReporte();


    const ids = {

        completo:
            "reporteCompleto",

        especial:
            "reporteEspecial",

        profesor:
            "reporteProfesor",

        materia:
            "reporteMateria",

        avisos:
            "reporteAvisos",

        eventos:
            "reporteEventos",

        estado:
            "reporteEstado"
    };


    const reporte =
        document.getElementById(
            ids[tipo]
        );


    if (!reporte) {

        alert(
            "No se encontró el reporte seleccionado."
        );

        return;
    }


    const copia =
        reporte.cloneNode(true);


    copia
        .querySelectorAll(
            "input, select, button"
        )
        .forEach(elemento =>
            elemento.remove()
        );


    const ventana =
        window.open(
            "",
            "_blank"
        );


    if (!ventana) {

        alert(
            "Permite las ventanas emergentes para imprimir."
        );

        return;
    }


    ventana.document.write(`

        <!DOCTYPE html>

        <html lang="es">

        <head>

            <meta charset="UTF-8">

            <title>
                Reporte
            </title>

        </head>


        <body>

            ${copia.outerHTML}

        </body>

        </html>
    `);


    ventana.document.close();


    setTimeout(() => {

        ventana.focus();

        ventana.print();

        ventana.close();

    }, 500);
}


/* =========================================================
   DESCARGAR
========================================================= */

function descargarReporte() {

    const tipo =
        obtenerTipoReporte();


    const ids = {

        completo:
            "reporteCompleto",

        especial:
            "reporteEspecial",

        profesor:
            "reporteProfesor",

        materia:
            "reporteMateria",

        avisos:
            "reporteAvisos",

        eventos:
            "reporteEventos",

        estado:
            "reporteEstado"
    };


    const nombres = {

        completo:
            "horario_general",

        especial:
            "horario_especial",

        profesor:
            "horario_por_profesor",

        materia:
            "horario_por_materia",

        avisos:
            "avisos",

        eventos:
            "eventos",

        estado:
            "estado"
    };


    const reporte =
        document.getElementById(
            ids[tipo]
        );


    if (!reporte) {

        alert(
            "No se encontró el reporte seleccionado."
        );

        return;
    }


    const copia =
        reporte.cloneNode(true);


    copia
        .querySelectorAll(
            "input, select, button"
        )
        .forEach(elemento =>
            elemento.remove()
        );


    const contenido = `

        <!DOCTYPE html>

        <html lang="es">

        <head>

            <meta charset="UTF-8">

            <title>
                ${nombres[tipo]}
            </title>

        </head>


        <body>

            ${copia.outerHTML}

        </body>

        </html>
    `;


    const archivo =
        new Blob(
            [contenido],
            {
                type:
                    "text/html;charset=utf-8"
            }
        );


    const url =
        URL.createObjectURL(
            archivo
        );


    const enlace =
        document.createElement("a");


    enlace.href =
        url;


    enlace.download =
        `${nombres[tipo]}.html`;


    document.body.appendChild(
        enlace
    );


    enlace.click();


    enlace.remove();


    URL.revokeObjectURL(
        url
    );
}


/* =========================================================
   FUNCIONES AUXILIARES
========================================================= */

function obtenerTipoReporte() {

    const selector =
        document.getElementById(
            "tipoReporte"
        );


    if (!selector) {
        return "completo";
    }


    const opcion =
        selector.options[
            selector.selectedIndex
        ];


    if (
        opcion &&
        opcion.textContent
            .trim()
            .toLowerCase() ===
        "horario especial"
    ) {

        return "especial";
    }


    return selector.value;
}


function ordenarGrupos(lista) {

    return [...lista].sort(
        (a, b) => {

            const numerosA =
                String(
                    a.nombre || ""
                ).match(/\d+/g) || ["0", "0"];


            const numerosB =
                String(
                    b.nombre || ""
                ).match(/\d+/g) || ["0", "0"];


            return (
                Number(numerosA[0]) -
                Number(numerosB[0])
            ) ||

            (
                Number(
                    numerosA[1] || 0
                ) -

                Number(
                    numerosB[1] || 0
                )
            );
        }
    );
}


function formatearHora(valor) {

    if (!valor) return "";


    const fecha =
        new Date(valor);


    if (!isNaN(fecha)) {

        return fecha
            .toISOString()
            .substring(11, 16);
    }


    return String(valor)
        .substring(0, 5);
}


function obtenerDiaSemana(fecha) {

    const fechaLocal =
        new Date(
            `${fecha}T12:00:00`
        );


    const dias = [
        "domingo",
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado"
    ];


    return dias[
        fechaLocal.getDay()
    ];
}


function formatearFecha(fecha) {

    if (!fecha) return "";


    const fechaLocal =
        new Date(
            `${fecha}T12:00:00`
        );


    return fechaLocal.toLocaleDateString(
        "es-CO",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}


function escapar(texto) {

    return String(
        texto ?? ""
    )
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   INICIAR
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    iniciarReportes
);