# Biblioteca Digital API

API REST para gestionar usuarios, un catálogo digital, préstamos y sesiones de una biblioteca.

## Stack

- Node.js 20
- Express
- MongoDB + Mongoose
- Swagger / OpenAPI
- Mocha + Chai + Supertest

## Requisitos

- Node.js 18+
- MongoDB local o Atlas
- npm

## Instalación

1. Clonar el repositorio y entrar a la carpeta del proyecto.
2. Instalar dependencias:

```bash
npm install
```

3. Crear un archivo `.env` basado en `.env.example`:

```bash
cp .env.example .env
```

4. Ajustar las variables de entorno según tu entorno local.

## Ejecutar la aplicación

```bash
npm start
```

La API quedará disponible en:

- http://localhost:8081/api/...
- http://localhost:8081/docs

## Ejecutar tests

```bash
npm test
```

## Docker

No se crea `docker-compose.yml` porque el proyecto es un único servicio y no requiere orquestación multi-contenedor para funcionar. Para construir la imagen localmente:

```bash
	docker build -t biblioteca-digital-api .
```

Y para correr el contenedor:

```bash
	docker run --rm -p 8081:8081 --env-file .env biblioteca-digital-api
```
## LINK DOCKER: https://hub.docker.com/r/pochitoz/biblioteca-digital-api
> No se inventa un usuario de DockerHub ni un repositorio remoto; la imagen se construye y ejecuta localmente en este entorno.

## Temario de la entrega

La entrega presenta una biblioteca digital con estos módulos:

- Gestión de usuarios y perfiles.
- Catálogo digital de libros.
- Préstamos de libros asociados a usuarios.
- Registro e inicio de sesión con JWT y cookies.
- Documentación OpenAPI con Swagger.
- Tests funcionales de integración y tests de acceso a datos.
- Ejecución reproducible con Docker.

La API usa recursos propios del dominio bibliotecario: `/api/books` para el catálogo y `/api/loans` para los préstamos.

Nota: en esta versión se modificó la nomenclatura de `adoption routes` por `loan`, para mantener el dominio consistente con el módulo de préstamos.

## Endpoints principales

- `GET /api/users`
- `GET /api/users/:uid`
- `PUT /api/users/:uid`
- `DELETE /api/users/:uid`
- `GET /api/books` - catálogo digital
- `POST /api/books` - alta de libro
- `POST /api/books/withcover` - alta de libro con portada
- `PUT /api/books/:bid` - actualización de libro
- `DELETE /api/books/:bid` - baja de libro
- `GET /api/loans` - listado de préstamos
- `GET /api/loans/:lid` - consulta de préstamo
- `POST /api/loans/:uid/:bid` - creación de préstamo
- `POST /api/sessions/register`
- `POST /api/sessions/login`
- `GET /api/sessions/current`


## Documentación Swagger

La documentación OpenAPI queda disponible en:

```text
http://localhost:8081/docs
```

La especificación de usuarios se define en:

- [src/docs/users/users.yaml](src/docs/users/users.yaml)
