# Desarrollo de Biblioteca Digital

Qué tiene cada parte de la biblioteca, cómo funciona por dentro y por qué está hecha así. Lo más nuevo va primero.
Para instalar y ejecutar el proyecto, ver el [README](../README.md). Para ramas y pull requests, ver [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Recuperar la contraseña por email (25/11/2026)

### Qué se agregó

| Pieza | Archivo | Para qué |
|---|---|---|
| Colección `PasswordResets` | `src/dao/models/PasswordReset.js` | Pedidos pendientes: usuario, **hash** del token y vencimiento (MongoDB borra los vencidos) |
| `sendResetEmail`, `findValidReset`, `consumeReset`, `clearResets` | `src/utils/passwordReset.js` | Token de un solo uso que vence a los 30 minutos y email con el link |
| `mailer.send`, `appUrl`, `escapeHtml` | `src/utils/mailer.js` | Envío con la API de Brevo (con `fetch`, sin SDK); el dominio del link sale de `APP_URL` |
| `POST /api/sessions/forgot` y `POST /api/sessions/reset` | `src/controllers/sessions.controller.js` | Pedir el link y crear la contraseña nueva |
| `forgotLimiter` | mismo archivo | 3 pedidos por email y conexión, y 10 por conexión, cada hora |
| Páginas `/recuperar` y `/restablecer` | `forgot.handlebars`, `reset.handlebars`, `src/public/js/recover.js` | Formularios, y el link "¿Olvidaste tu contraseña?" en el login |
| Variables nuevas | `.env.example` | `APP_URL`, `BREVO_API_KEY`, `MAIL_FROM`, `MAIL_FROM_NAME` |

### Cómo funciona

1. **El pedido.** En `/recuperar` se escribe el email.
   - El servidor valida el formato y cuenta el pedido en el límite, exista o no la cuenta.
   - **Responde siempre el mismo mensaje.**
   - Si la cuenta existe, el email se envía **después de responder** (sin `await`): ni el texto ni la demora revelan qué emails están registrados.
2. **El token.** `sendResetEmail` borra los pedidos anteriores de esa cuenta y genera 32 bytes aleatorios en `base64url`. En la base guarda **solo el SHA-256**, con vencimiento a los 30 minutos (índice TTL).
3. **El email.** El link es `${APP_URL}/restablecer?token=…`. En producción `APP_URL` es obligatoria: si falta, no se envía nada y se registra el error. El nombre de la cuenta se escapa en el HTML del email.
4. **El formulario.** `/restablecer` busca el pedido vigente por el hash del token.
   - Si existe, muestra el formulario con la lista de requisitos de la contraseña; si no, "El link venció o ya se usó" y un botón para pedir otro.
   - La página responde con `Referrer-Policy: no-referrer`, para que el token no viaje a otro sitio.
5. **La contraseña nueva.** `POST /api/sessions/reset`:
   - aplica la regla del registro;
   - recién con todo validado, **consume** el token con `findOneAndDelete`: de dos usos simultáneos del mismo link, gana uno;
   - guarda el hash nuevo y sube `sessionVersion`, lo que **cierra todas las sesiones**;
   - borra los demás pedidos y limpia el bloqueo de login de esa cuenta.
6. **Sin clave de Brevo.** En desarrollo el email se imprime en la consola del servidor, con el link para probar. En producción no se envía nada y queda el error en el log.

### Por qué

- **Recuperación sin el administrador:** quien olvida la contraseña la recupera solo, probando que es dueño del email. El administrador no tiene que conocer ni generar contraseñas ajenas.
- **Guardar el hash y no el token:** si alguien lee la base (un backup, un acceso indebido), no puede usar los links pendientes.
- **`APP_URL` y no el `Host` del pedido:** con el `Host` alguien podría pedir el link de otra persona con `Host: sitio-falso.com`. La víctima recibiría un email legítimo con un link al sitio falso, que le robaría el token. Hay un test con `Host` y `X-Forwarded-Host` falsos.
- **Misma respuesta exista o no la cuenta, y envío en segundo plano:** evita usar el formulario para averiguar qué emails tienen cuenta.
- **Validar antes de consumir el token:** una contraseña débil no gasta el link; la persona la corrige y vuelve a intentar.
- **Cerrar todas las sesiones:** si alguien estaba usando la cuenta, recuperar la contraseña lo deja afuera.
- **Brevo con `fetch`:** permite enviar desde un email verificado sin dominio propio, con 300 envíos por día gratis. Es una llamada HTTP, así que no suma una dependencia.

### Límites conocidos

- El límite de pedidos vive en la memoria del proceso, igual que el del login.
- Si Brevo falla, la persona no se entera (ve el mismo mensaje de siempre). El error queda en el log del servidor.
- Los emails pueden llegar a spam mientras el remitente no tenga un dominio propio verificado.

### Tests

En `test/passwordReset.test.js` (10 tests). Ninguno llama a Brevo: se reemplaza `mailer.send`.

- Pedido:
  - misma respuesta con y sin cuenta, y email solo a la que existe;
  - en la base queda el hash;
  - el link usa `APP_URL` aunque el `Host` sea falso.
- Validación del email y límite de pedidos.
- Restablecer:
  - con el link se cambia la contraseña y se cierran las sesiones;
  - el link no sirve dos veces;
  - pedir otro link anula el anterior;
  - un link vencido no sirve;
  - una contraseña débil no gasta el link.
- Ataques: tokens inventados u operadores, y dos usos simultáneos (gana uno).
- El email escapa el nombre.
- El login ofrece recuperar la contraseña.

---

## Mi perfil y cierre de las otras sesiones (25/11/2026)

### Qué se agregó

| Pieza | Archivo | Para qué |
|---|---|---|
| `sessionVersion` en el usuario | `src/dao/models/User.js` | Número que sube cada vez que cambia la contraseña |
| `sv` en el token | `src/utils/auth.js` (`signToken`) | Cada token guarda la versión de sesión que había al firmarse |
| `attachUser` asíncrono | `src/middlewares/auth.js` | Además de la firma, compara la versión del token con la del usuario; nombre y rol salen de la base |
| `changePassword(id, hash)` | `src/dao/Users.dao.js`, `src/repository/UserRepository.js` | Contraseña nueva y versión +1 en una sola operación |
| `PUT /api/sessions/profile` | `src/controllers/sessions.controller.js` | Cambiar nombre y apellido |
| `PUT /api/sessions/password` | mismo archivo | Cambiar la contraseña: pide la actual, aplica la regla del registro, cierra las otras sesiones |
| `passwordChangeLimiter` | mismo archivo | 5 intentos con la contraseña actual equivocada por cuenta y conexión cada 15 minutos |
| Página `/perfil` | `src/views/profile.handlebars`, `src/public/js/profile.js`, `styles.css` | Dos formularios (datos y contraseña) y el link "Mi perfil" en el menú de la cuenta |

### Cómo funciona

1. Al iniciar sesión, `signToken` guarda en el token `sv`, la versión de sesión del usuario: 0 para todos al principio.
2. En cada pedido con cookie, `attachUser` verifica la firma y busca al usuario por id, trayendo solo nombre, email, rol y versión.
   - Si la cuenta no existe o la versión no coincide, la sesión se descarta y se borra la cookie.
   - Un token sin `sv`, de antes de este cambio, cuenta como versión 0: sigue valiendo hasta que se cambie la contraseña.
3. **Cambiar la contraseña:**
   - pasa por el límite de intentos;
   - compara la actual con bcrypt;
   - aplica `passwordProblem` con email, nombre y apellido, la misma regla del registro;
   - rechaza repetir la actual.
   Después `changePassword` guarda el hash nuevo y suma 1 a `sessionVersion` en un solo `findByIdAndUpdate`. La respuesta trae una cookie nueva con la versión nueva: esta sesión sigue y todas las demás, incluido el token viejo de este mismo navegador, dejan de valer.
4. **Cambiar el nombre:** se recorta, se unifican los espacios y se limita a 50 caracteres. Como `attachUser` lee el nombre de la base, el menú lo muestra al instante en todas las sesiones, sin firmar un token nuevo. El email y el rol no se cambian desde acá.

### Por qué

- **Versión de sesión y no lista de tokens revocados:** con un número por usuario alcanza para cerrar todas las sesiones de una vez. No hay que guardar cada token ni limpiar una colección, y un solo cambio invalida todo lo anterior.
- **Una consulta por pedido:** es una búsqueda por `_id`, que es el índice principal, con proyección de cinco campos. A cambio, el rol y el nombre siempre están al día: quitarle el rol de administrador a alguien le corta el acceso al panel en ese momento, no cuando vence su token de 8 horas.
- **Pedir la contraseña actual:** con una sesión abierta en una computadora compartida, otra persona no puede cambiar la contraseña y dejar afuera al dueño. Por eso ese paso tiene su propio límite de intentos.
- **Respuesta 400 y no 401 si la actual es incorrecta:** el usuario sí tiene sesión. Un 401 sugeriría que tiene que volver a iniciarla.
- **Una sola operación para contraseña y versión:** si fueran dos escrituras y la segunda fallara, quedaría la contraseña nueva con las sesiones viejas abiertas.

### Límites conocidos

- Cerrar sesión (`/logout`) sigue borrando solo la cookie de ese navegador. Si alguien copió ese token, vale hasta que venza o hasta que se cambie la contraseña.
- No hay "cerrar todas mis sesiones" sin cambiar la contraseña; con `sessionVersion` sería un botón más.
- El límite de intentos vive en la memoria del proceso, igual que el del login.

### Tests

En `test/profile.test.js` (10 tests):

- La página pide sesión y escapa los datos.
- Cambio de nombre:
  - se ve al instante;
  - no permite cambiar email, rol ni contraseña;
  - rechaza vacíos, operadores y más de 50 caracteres.
- Sin sesión, 401.
- Cambio de contraseña:
  - cierra el otro dispositivo y el token viejo, pero no la sesión actual;
  - la contraseña vieja deja de servir;
  - con la actual equivocada responde 400, y después de 5 intentos, 429;
  - aplica la regla del registro y no acepta repetir la actual.
- Sesiones:
  - un token sin versión sigue valiendo;
  - quitarle el rol de administrador corta el acceso al panel al instante;
  - borrar la cuenta corta su sesión.

---

## Tests automáticos en GitHub y pull requests (18/11/2026)

### Qué se agregó

| Pieza | Archivo | Para qué |
|---|---|---|
| Workflow "Tests" | `.github/workflows/tests.yml` | Corre `npm ci`, `npm test` y `npm audit --omit=dev --audit-level=high` en cada pull request y en cada push a `main` |
| Plantilla de pull request | `.github/pull_request_template.md` | Cada PR cuenta qué cambia, cómo se probó, qué no se verificó y qué hacer después de unirlo |
| Guía de ramas | `CONTRIBUTING.md` | Una rama por cambio con prefijo según el tipo; cómo se une un PR |
| Insignia de estado | `README.md` | Muestra si los tests de `main` pasan |

### Cómo funciona

1. Cada cambio va en su propia rama y se sube como pull request contra `main`.
2. GitHub Actions corre el workflow en Ubuntu con Node 24, la misma versión mayor que usa Render.
   - Cada archivo de test levanta su propia MongoDB en memoria.
   - Con `npm test`, `getJwtSecret()` (en `src/utils/auth.js`) usa una clave solo de prueba. Por eso el workflow no necesita secretos del repositorio.
3. El PR se une a `main` solo con el chequeo en verde (regla de protección de la rama). Recién ahí Render publica.

### Por qué

- **Una máquina limpia:** `npm ci` instala exactamente lo que dice `package-lock.json`. Detecta lo que en la computadora de desarrollo anda por un archivo sin commitear o una dependencia instalada a mano. También detecta un `.env` local del que dependan los tests sin que se note.
- **Solo lectura:** con `permissions: contents: read` y `persist-credentials: false`, una acción o dependencia comprometida no tendría un token con permiso de escritura en el repo.
- **`concurrency`:** un push nuevo a la misma rama cancela la corrida vieja.
- **Caché del binario de MongoDB:** se guarda fuera de `node_modules`, porque `npm ci` borra esa carpeta.

### Límites conocidos

- Las acciones están fijadas por versión mayor (`@v4`), no por hash de commit.
- El escaneo de secretos (ggshield) corre en el hook de pre-commit local y en la integración de GitGuardian del repositorio, no dentro del workflow.
