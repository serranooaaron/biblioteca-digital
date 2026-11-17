# Biblioteca Digital

Aplicación web para una biblioteca: catálogo de libros, cuentas de lectores, préstamos, reservas y reseñas, con un panel para administrar todo.

Parte de la entrega final de Programación Backend III (Coderhouse, comisión 86245; el primer commit de este repo es esa entrega) y le suma interfaz web, roles y correcciones de seguridad.

## Stack

- Node.js 24 + Express 4
- Express-Handlebars (vistas) + JavaScript sin frameworks en el navegador
- MongoDB + Mongoose 6
- JWT + bcrypt + cookies `httpOnly`
- Multer para portadas
- Swagger / OpenAPI
- Mocha + Chai + Supertest (tests con MongoDB en memoria)
- Docker

## Funcionalidades

**Lectores**
- Catálogo con búsqueda por título o autor, filtro por disponibilidad y orden
- Pedir un libro con un clic (hasta 3 préstamos activos)
- Cada préstamo dura 14 días, con aviso cuando está por vencer y cuando ya venció
- “Mis préstamos”: libros en su poder ordenados por vencimiento, devolución e historial
- Reservas: si un libro está prestado, el lector se anota en la lista de espera (hasta 3 reservas). Al devolverse queda apartado 3 días para el primero de la lista, con un aviso en todas las páginas
- Página de cada libro con reseñas de 1 a 5 estrellas, solo de quienes lo tuvieron prestado

**Administradores** (`/admin`)
- Libros: alta con portada opcional, edición y borrado; muestra los apartados y cuántos lectores esperan cada uno
- Moderación de reseñas
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
- Límite de intentos: 5 logins fallidos por cuenta y conexión cada 15 minutos, y hasta 10 registros por conexión por hora
- Operadores de MongoDB enviados por el cliente se toman como texto (`sanitizeFilter`)
- Cabeceras de seguridad: política de contenido, protección contra clickjacking y HSTS en producción
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
| `MONGO_URL` | Cadena de conexión de MongoDB; puede ser la que copia Atlas, sin nombre de base |
| `DB_NAME` | Opcional: nombre de la base (por defecto `biblioteca-digital`). Así varias apps pueden compartir el mismo clúster sin mezclar datos |
| `JWT_SECRET` | Clave larga y aleatoria para firmar los tokens (obligatoria) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Opcional: cuenta administradora que crea `npm run seed` |
| `PORT` | Puerto (por defecto 8081) |
| `NODE_ENV` | `production` activa la cookie `Secure` y HSTS |
| `TRUST_PROXY` | Saltos de proxy delante de la app (en Render, `1`) para que el límite de intentos vea la IP real |

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

## Deploy en Render

El repo trae un [`render.yaml`](render.yaml): en Render, **New > Blueprint** y elegir este repositorio.

1. En MongoDB Atlas, crear un usuario con rol `readWrite` solo sobre la base `biblioteca-digital` y copiar la cadena `mongodb+srv://`.
2. Varias apps pueden usar el mismo clúster: cada una guarda en su propia base (`biblioteca-digital` en esta).
3. En Render, cargar `MONGO_URL` con esa cadena (el resto de las variables las define el Blueprint; `JWT_SECRET` se genera solo).
4. Render usa `/api/health` para saber cuándo la versión nueva está lista.

A tener en cuenta:
- En el plan gratuito el servicio se duerme tras 15 minutos sin visitas: la primera carga tarda unos segundos.
- Render no tiene IP fija en ese plan, así que Atlas queda abierto a `0.0.0.0/0`; lo compensa un usuario de mínimo privilegio con contraseña larga.
- El disco de Render se borra en cada deploy: las portadas subidas desde el panel no se conservan entre deploys.

## Vistas

| Ruta | Descripción |
|---|---|
| `/` | Inicio |
| `/catalogo` | Catálogo con búsqueda y filtros |
| `/libros/:bid` | Página del libro con reseñas, pedido y reserva |
| `/mis-prestamos` | Préstamos y reservas del lector (requiere sesión) |
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
| `GET` | `/api/books/:bid/reviews` (`?page=`, `?limit=`) | Público |
| `PUT` `DELETE` | `/api/books/:bid/reviews`, `/api/books/:bid/reviews/:rid` | Lector que lo tuvo prestado · autor o administrador |
| `GET` | `/api/reservations/mine` | Con sesión |
| `POST` `DELETE` | `/api/reservations/:bid` (anotarse o salir de la lista) | Con sesión |
| `GET` | `/api/health` | Público |

La especificación OpenAPI está en [src/docs](src/docs).
