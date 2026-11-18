# Desarrollo de Biblioteca Digital

Qué tiene cada parte de la biblioteca, cómo funciona por dentro y por qué está hecha así. Lo más nuevo va primero.
Para instalar y ejecutar el proyecto, ver el [README](../README.md). Para ramas y pull requests, ver [CONTRIBUTING.md](../CONTRIBUTING.md).

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
