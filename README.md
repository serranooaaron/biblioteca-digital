# Biblioteca Digital

Aplicación web para una biblioteca: catálogo de libros, cuentas de lectores, préstamos y devoluciones, con un panel para administrar todo.

Parte de la entrega final de Programación Backend III (Coderhouse, comisión 86245; el primer commit de este repo es esa entrega) y le suma interfaz web, roles y correcciones de seguridad.

## Stack

- Node.js 20 + Express 4
- Express-Handlebars (vistas) + JavaScript sin frameworks en el navegador
- MongoDB + Mongoose 6
- JWT + bcrypt + cookies `httpOnly`
- Multer para portadas
- Swagger / OpenAPI
- Mocha + Chai + Supertest (38 tests con MongoDB en memoria)
- Docker

## Funcionalidades

**Lectores**
- Catálogo con búsqueda por título o autor, filtro por disponibilidad y orden
- Pedir un libro con un clic (hasta 3 préstamos activos)
- Cada préstamo dura 14 días, con aviso cuando está por vencer y cuando ya venció
- “Mis préstamos”: libros en su poder ordenados por vencimiento, devolución e historial

**Administradores** (`/admin`)
- Libros: alta con portada opcional, edición y borrado
- Préstamos activos: vencimientos, registrar un préstamo a nombre de un lector y su devolución
- Usuarios: cambiar rol y borrar cuentas

Los libros sin portada se muestran con una tapa generada a partir del título.

## Seguridad

- Contraseñas con bcrypt, mínimo 8 caracteres; los usuarios se devuelven siempre sin contraseña
- Sesión con JWT en cookie `httpOnly` + `SameSite=Lax` (`Secure` en producción)
- Rutas protegidas por rol: usuarios solo para admin; libros: lectura pública, escritura admin
- Cada lector solo ve y devuelve sus propios préstamos
- Portadas: solo JPG/PNG/WEBP de hasta 2 MB, con nombre generado por el servidor
- Búsquedas con texto escapado en `$regex` (evita ReDoS)
- Mismo mensaje para email inexistente o contraseña incorrecta
- Errores async capturados: respuestas 400/401/403/404 en lugar de caídas o 500
- Redirección tras el login solo a rutas internas

## Ejecución local

```bash
npm install
```

**Sin base de datos (recomendado para probar):** levanta MongoDB en memoria con el catálogo, dos cuentas de prueba y préstamos de ejemplo en cada estado (las contraseñas se generan en cada arranque y aparecen en la consola). Los datos se borran al cerrar.

```bash
npm run dev:memory
```

**Con MongoDB Atlas:** copia `.env.example` a `.env`, completa las variables y carga el catálogo inicial.

```bash
npm run seed
```

```bash
npm run dev
```

La app queda en http://localhost:8081 y la documentación de la API en http://localhost:8081/docs.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `MONGO_URL` | Cadena de conexión de MongoDB (usa una base propia, ej. `/biblioteca-digital`) |
| `JWT_SECRET` | Clave larga y aleatoria para firmar los tokens (obligatoria) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Opcional: cuenta administradora que crea `npm run seed` |
| `PORT` | Puerto (por defecto 8081) |
| `NODE_ENV` | `production` activa la cookie `Secure` |

## Tests

```bash
npm test
```

## Docker

```bash
docker build -t biblioteca-digital .
```

```bash
docker run --rm -p 8081:8081 --env-file .env biblioteca-digital
```

## Vistas

| Ruta | Descripción |
|---|---|
| `/` | Inicio |
| `/catalogo` | Catálogo con búsqueda y filtros |
| `/mis-prestamos` | Préstamos del lector (requiere sesión) |
| `/login`, `/register` | Ingreso y registro |
| `/admin` | Panel de libros, préstamos y usuarios (solo administradores) |

## API

| Método | Ruta | Acceso |
|---|---|---|
| `POST` | `/api/sessions/register` · `/login` · `/logout` | Público |
| `GET` | `/api/sessions/current` | Con sesión |
| `GET` | `/api/books` (`?q=`, `?available=`) | Público |
| `POST` `PUT` `DELETE` | `/api/books`, `/api/books/withcover`, `/api/books/:bid` | Administrador |
| `GET` | `/api/loans/mine` | Con sesión |
| `POST` | `/api/loans/:bid` (pedir para uno mismo) | Con sesión |
| `PUT` | `/api/loans/:lid/return` | Dueño o administrador |
| `GET` | `/api/loans/:lid` | Dueño o administrador |
| `GET` | `/api/loans` (`?active=`, `?overdue=`) · `POST /api/loans/:uid/:bid` | Administrador |
| `GET` `PUT` `DELETE` | `/api/users`, `/api/users/:uid` | Administrador |

La especificación OpenAPI está en [src/docs](src/docs).
