# MontessoriFlow — API y scripts del frontend

Este documento describe el contrato de API que consumen los scripts del
frontend (`page/**/*.js`) contra el modelo de datos definido en
[`schema.prisma`](./schema.prisma). Sirve como referencia para construir
el backend: qué rutas necesita cada pantalla, qué espera **enviar** y qué
espera **recibir**.

> **Conectado al backend real** (`back-end_horarios-valeria_melany`).
> El catálogo de abajo es el borrador original; las diferencias con la
> API real, ya resueltas en los scripts, son:
>
> - `API_BASE_URL` es `http://localhost:3000` (sin `/api`) y `api.js`
>   devuelve directamente el `data` de la respuesta `{ ok, data }`.
> - `POST/PUT /profesores` solo recibe `{ nombre, jornada }`; la materia y
>   los días se guardan en `/profesor-materia` y
>   `/profesor-dias-disponibles`. `GET /profesores` trae
>   `materias: [{ materia: {...} }]` y `diasDisponibles: [{ diaSemana }]`.
> - Filtros de horario: `/horario-clases/profesor/:id` y
>   `/horario-clases/dia/:dia` (no hay query params).
> - Horario especial: `/horarios-especiales` y
>   `/horarios-especiales/fecha/:fecha`.
> - No hay borrados masivos: "Borrar todos los horarios" y "Limpiar día"
>   borran fila por fila.
> - Cerrar sesión: `POST /auth/logout` (botón agregado por `auth.js`).

## Índice

- [Scripts y qué pantalla consumen](#scripts-y-qué-pantalla-consumen)
- [Consistencia con `schema.prisma`](#consistencia-con-schemaprisma)
- [Catálogo de rutas](#catálogo-de-rutas)
  - [Autenticación](#autenticación)
  - [Profesores](#profesores)
  - [Materias](#materias)
  - [Grupos y bloques de hora](#grupos-y-bloques-de-hora)
  - [Horario recurrente semanal (`horario_clases`)](#horario-recurrente-semanal-horario_clases)
  - [Horario especial (`horario_especial`)](#horario-especial-horario_especial)
  - [Registro de cambios](#registro-de-cambios)
  - [Avisos / Eventos / Estado del colegio](#avisos--eventos--estado-del-colegio)
- [Notas para el backend](#notas-para-el-backend)

---

## Scripts y qué pantalla consumen

| Pantalla (HTML) | Script | Ubicación |
|---|---|---|
| *(compartido, todas las pantallas)* | `api.js` | `script/api.js` |
| *(compartido, todas menos login e index)* | `auth.js` | `script/auth.js` |
| `login/Inicio_sesion.html` | `login.js` | `page/login/login.js` |
| `home/Inicio.html` | `inicio.js` | `page/home/inicio.js` |
| `home/Avisos.html` | `avisos.js` | `page/home/avisos.js` |
| `home/Eventos.html` | `eventos.js` | `page/home/eventos.js` |
| `home/Estado.html` | `estado.js` | `page/home/estado.js` |
| `profesores_materias/Profesores_y_materias.html` | `profesoresMaterias.js` | `page/profesores_materias/profesoresMaterias.js` |
| `plantillas/horarioDocente.html` | `horarioDocente.js` | `page/plantillas/horarioDocente.js` |
| `plantillas/horarioGeneral.html` | `horarioGeneral.js` | `page/plantillas/horarioGeneral.js` |
| `plantillas/HorarioEspecial.html` | `horarioEspecial.js` | `page/plantillas/horarioEspecial.js` |
| `registro/Registro.html` | `registro.js` | `page/registro/registro.js` |
| `reportes/reportes_exportacion.html` | `reportes.js` | `page/reportes/reportes.js` |

`plantillas/Plantillas.html` y `login/Inicio_sesion.html` no tienen script
de datos propio (son de navegación / autenticación). `index/Horario.html`
es la landing pública y no incluye ningún script de la API.

**Orden de carga en cada HTML protegido:**

```html
<script src="../../script/api.js"></script>
<script src="../../script/auth.js"></script>
<script src="miPantalla.js"></script>
```

---

## Consistencia con `schema.prisma`

El schema y los scripts están alineados en nombres de campos, tipos y
enums (`Jornada`, `DiaSemana`). Los `@@unique` de `HorarioClase` coinciden
con lo que valida el flujo de guardado de `horarioDocente.js`.

Puntos a tener presentes al implementar el backend (no son errores, son
simplificaciones deliberadas del frontend actual):

| # | Punto | Detalle |
|---|---|---|
| 1 | `ProfesorMateria` es N:M en el schema, pero la UI solo maneja **una** materia por profesor | `profesoresMaterias.js` manda `materia` (un solo nombre, texto). El backend debe buscar/crear esa `Materia` y armar la fila en `profesor_materia`. El modelo soporta más de una, pero hoy no hay forma de cargar varias desde el front. |
| 2 | `Profesor.usuarioId` no lo usa ningún script | No hay pantalla que vincule un profesor con su cuenta de login. Campo listo para el futuro, sin consumidor hoy. |
| 3 | `HorarioEspecial.profesorId` / `materiaId` siempre quedan `null` desde el front | `horarioEspecial.js` solo manda `descripcion` (texto libre). Los campos estructurados existen en el schema por si luego se quiere ligar a un profesor/materia real. |
| 4 | `creadoPor` (en `RegistroCambio`, `Aviso`, `Evento`, `EstadoColegio`) nunca se manda desde el front | El backend debe sacarlo del JWT de la cookie de sesión, no del body — el frontend no guarda nada del usuario en el navegador. |
| 5 | `Grupo` no tiene campo `orden` | El orden correcto (9°1 antes que 10°1) lo calculan los scripts en el cliente con un *natural sort* sobre `nombre`. Si el backend también ordena/pagina grupos, debe usar el mismo criterio. |

---

## Catálogo de rutas

32 rutas en total. Los objetos anidados (`materia: {...}`, `profesor:
{...}`, etc.) son el contrato que asumieron los scripts — si el backend
no los incluye en la respuesta, hay que ajustar los scripts para pedirlos
por separado.

### Autenticación

#### `POST /auth/login`
- **Envía:** `{ nombreUsuario: string, contrasena: string }`
- **Recibe:** `200` y cookie httpOnly con el JWT (sin body relevante) · `401` si las credenciales no son válidas
- **Usado en:** `login.js`

#### `GET /auth/me`
- **Envía:** nada (la cookie va sola, `api.js` manda `credentials: "include"`)
- **Recibe:** `200` si la cookie es válida (sin body relevante) · `401` si no hay sesión
- **Usado en:** `auth.js`

### Profesores

#### `GET /profesores`
- **Recibe:**
  ```json
  [{
    "id": 1,
    "nombre": "Giovana Jurado",
    "jornada": "manana",
    "materias": [{ "id": 3, "nombre": "Matemáticas" }],
    "diasDisponibles": ["lunes", "martes", "viernes"]
  }]
  ```
- **Usado en:** `profesoresMaterias.js`, `horarioDocente.js`, `registro.js`, `reportes.js`

#### `POST /profesores`
- **Envía:** `{ nombre, jornada, materia: string, dias: ["lunes","martes",...] }`
- **Recibe:** el profesor creado, mismo shape que el `GET`
- **Usado en:** `profesoresMaterias.js`

#### `PUT /profesores/:id`
- **Envía:** igual que `POST`
- **Recibe:** el profesor actualizado
- **Usado en:** `profesoresMaterias.js`

#### `DELETE /profesores/:id`
- **Recibe:** `200`/`204`
- **Usado en:** `profesoresMaterias.js`

### Materias

#### `GET /materias`
- **Recibe:** `[{ "id": 1, "nombre": "Matemáticas", "aula": "302" }]`
- **Usado en:** `profesoresMaterias.js`, `registro.js`

#### `POST /materias`
- **Envía:** `{ nombre, aula }`
- **Recibe:** la materia creada
- **Usado en:** `profesoresMaterias.js`

#### `PUT /materias/:id`
- **Envía:** `{ nombre, aula }`
- **Recibe:** la materia actualizada
- **Usado en:** `profesoresMaterias.js`

#### `DELETE /materias/:id`
- **Recibe:** `200`/`204`
- **Usado en:** `profesoresMaterias.js`

### Grupos y bloques de hora

Catálogos fijos, de solo lectura desde el frontend.

#### `GET /grupos`
- **Recibe:** `[{ "id": 1, "nombre": "9°1", "jornada": "manana" }]`
- **Usado en:** `horarioDocente.js`, `horarioGeneral.js`, `horarioEspecial.js`, `reportes.js`

#### `GET /bloques-horario`
- **Recibe:**
  ```json
  [{
    "id": 1, "jornada": "manana",
    "horaInicio": "06:00:00", "horaFin": "06:56:00",
    "orden": 1, "esDescanso": false
  }]
  ```
- **Usado en:** `horarioDocente.js`, `horarioGeneral.js`, `horarioEspecial.js`, `reportes.js`

### Horario recurrente semanal (`horario_clases`)

#### `GET /horario-clases`
También acepta `?diaSemana=lunes` y/o `?profesorId=3` como filtros opcionales.

- **Recibe:**
  ```json
  [{
    "id": 10,
    "profesorId": 3, "materiaId": 3, "grupoId": 1, "bloqueHorarioId": 1,
    "diaSemana": "lunes",
    "profesor": { "nombre": "Giovana Jurado" },
    "materia": { "nombre": "Matemáticas" },
    "grupo": { "nombre": "9°1" },
    "bloqueHorario": { "jornada": "manana", "orden": 1, "horaInicio": "06:00:00", "horaFin": "06:56:00", "esDescanso": false }
  }]
  ```
- **Nota:** mismo shape siempre (con o sin filtros) — `horarioDocente.js` solo usa los ids sueltos, pero `horarioGeneral.js` y `reportes.js` necesitan las relaciones anidadas.
- **Usado en:** `horarioDocente.js`, `horarioGeneral.js`, `reportes.js`

#### `POST /horario-clases`
- **Envía:** `{ profesorId, materiaId, grupoId, bloqueHorarioId, diaSemana }`
- **Recibe:** la fila creada, con al menos `{ id }`
- **Conflicto:** responde `409` si viola el `@@unique` (mismo profesor o mismo grupo ya ocupados a esa hora ese día) — el mensaje de error se muestra tal cual al usuario.
- **Usado en:** `horarioDocente.js`

#### `PUT /horario-clases/:id`
- **Envía:** igual que `POST`
- **Recibe:** la fila actualizada · mismo `409` si genera conflicto
- **Usado en:** `horarioDocente.js`

#### `DELETE /horario-clases/:id`
- **Recibe:** `200`/`204`
- **Usado en:** `horarioDocente.js`

#### `DELETE /horario-clases` (sin id — borra TODO)
- **Recibe:** `200`/`204`
- ⚠️ Ruta especial, no es REST estándar. Es el botón "Borrar todos los horarios". Si se prefiere explícita, se puede cambiar a `POST /horario-clases/borrar-todo`.
- **Usado en:** `horarioDocente.js`

### Horario especial (`horario_especial`)

Programaciones puntuales por fecha exacta (no por día de semana).

#### `GET /horario-especial?fecha=2026-03-10`
- **Recibe:** `[{ "id": 1, "fecha": "2026-03-10", "grupoId": 1, "bloqueHorarioId": 1, "descripcion": "Izada de bandera", "profesorId": null, "materiaId": null }]`
- **Usado en:** `horarioEspecial.js`

#### `POST /horario-especial`
- **Envía:** `{ fecha, grupoId, bloqueHorarioId, descripcion }`
- **Recibe:** la fila creada, con al menos `{ id }`
- **Usado en:** `horarioEspecial.js`

#### `PUT /horario-especial/:id`
- **Envía:** `{ descripcion }`
- **Recibe:** la fila actualizada
- **Usado en:** `horarioEspecial.js`

#### `DELETE /horario-especial/:id`
- **Recibe:** `200`/`204`
- **Usado en:** `horarioEspecial.js`

#### `DELETE /horario-especial?fecha=2026-03-10` (bulk, borra ese día)
- **Recibe:** `200`/`204`
- **Usado en:** `horarioEspecial.js`

### Registro de cambios

#### `GET /registro-cambios`
- **Recibe:**
  ```json
  [{
    "id": 1, "fecha": "2026-01-15", "motivo": "Sustitución por enfermedad",
    "materia": { "id": 3, "nombre": "Matemáticas" },
    "profesor": { "id": 1, "nombre": "Ana Díaz" }
  }]
  ```
- **Usado en:** `registro.js`

#### `POST /registro-cambios`
- **Envía:** `{ fecha, materiaId, profesorId, motivo }`
- **Recibe:** el registro creado
- **Usado en:** `registro.js`

#### `PUT /registro-cambios/:id`
- **Envía:** igual que `POST`
- **Recibe:** el registro actualizado
- **Usado en:** `registro.js`

#### `DELETE /registro-cambios/:id`
- **Recibe:** `200`/`204`
- **Usado en:** `registro.js`

### Avisos / Eventos / Estado del colegio

Mismo patrón × 3 — cada "Guardar" crea una fila nueva (historial), no sobreescribe.

#### `GET /avisos/ultimo` · `GET /eventos/ultimo` · `GET /estados-colegio/ultimo`
- **Recibe:** `{ "id": 1, "contenido": "...", "creadoEn": "2026-03-10T12:00:00Z" }` o `null` si no hay ninguno
- **Usado en:** `avisos.js` / `eventos.js` / `estado.js` (además `inicio.js` y `reportes.js` solo hacen `GET`)

#### `POST /avisos` · `POST /eventos` · `POST /estados-colegio`
- **Envía:** `{ contenido }`
- **Recibe:** la fila creada
- **Usado en:** `avisos.js` / `eventos.js` / `estado.js`

---

## Notas para el backend

1. Implementar las **32 rutas** de arriba sobre `schema.prisma`. Los `POST`/`PUT` de `avisos`, `eventos`, `estados-colegio` y `registro-cambios` deben tomar `creadoPor` del JWT de la cookie, no del body (el frontend nunca lo manda).
2. Las respuestas de `GET /profesores`, `GET /horario-clases` y `GET /registro-cambios` necesitan **relaciones anidadas** (no solo los ids) — es el punto donde más fácil se cae la integración si el backend solo devuelve ids sueltos.
3. Todo endpoint que devuelva datos de horarios/profesores/materias/registro debe exigir la misma cookie de sesión que valida `GET /auth/me` y responder `401` si falta — la guardia de `auth.js` es solo de UX, la seguridad real vive en el backend.
4. Las dos rutas `DELETE` sin id (`/horario-clases` y `/horario-especial?fecha=`) son no-estándar; confirmar si se dejan así o se cambian por una ruta explícita.
