# Desarrollo de Biblioteca Digital

Qué tiene cada parte de la biblioteca, cómo funciona por dentro y por qué está hecha así. Lo más nuevo va primero.
Para instalar y ejecutar el proyecto, ver el [README](../README.md). Para ramas y pull requests, ver [CONTRIBUTING.md](../CONTRIBUTING.md).

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
