import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUIExpress from 'swagger-ui-express';
import dotenv from 'dotenv';
import multer from 'multer';
import { engine } from 'express-handlebars';

import usersRouter from './routes/users.router.js';
import booksRouter from './routes/books.router.js';
import chatRouter from './routes/chat.router.js';
import loansRouter from './routes/loans.router.js';
import sessionsRouter from './routes/sessions.router.js';
import viewsRouter from './routes/views.router.js';
import helpers from './utils/handlebars.js';
import { attachUser } from './middlewares/auth.js';
import { getJwtSecret } from './utils/auth.js';
import __dirname from './utils/index.js';

dotenv.config({ quiet: true });
mongoose.set('strictQuery', true);

const app = express();
const PORT = process.env.PORT || 8081;
const isTest = process.env.NODE_ENV === 'test' || process.env.npm_lifecycle_event === 'test';

const swaggerOptions = {
  definition: {
    openapi: '3.0.1',
    info: {
      title: 'Biblioteca Digital API',
      description: 'API para gestionar un catálogo digital, usuarios y préstamos',
      version: '1.0.0',
    },
  },
  apis: ['src/docs/**/*.yaml'],
};

const specs = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUIExpress.serve, swaggerUIExpress.setup(specs));

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
// Archivos públicos: estilos, scripts del navegador y portadas subidas (/img/<archivo>).
app.use(express.static(`${__dirname}/../public`));
app.use(attachUser);

app.engine('handlebars', engine({ helpers }));
app.set('view engine', 'handlebars');
app.set('views', `${__dirname}/../views`);

app.use('/api/chat', chatRouter);
app.use('/api/users', usersRouter);
app.use('/api/books', booksRouter);
app.use('/api/loans', loansRouter);
app.use('/api/sessions', sessionsRouter);

app.use('/api', (req, res) => res.status(404).send({ status: 'error', error: 'Ruta no encontrada' }));
app.use('/', viewsRouter);
app.use((req, res) => res.status(404).render('error', { title: 'No encontrado', code: 404, message: 'La página que buscas no existe.' }));

// Manejador de errores: ids inválidos, archivos rechazados y cualquier error inesperado.
// Las rutas de la API responden JSON; las vistas, una página de error.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = 500;
  let message = 'Error interno del servidor';
  if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'La portada no puede superar 2 MB' : 'Archivo inválido';
  } else if (err.status === 400) {
    status = 400;
    message = err.message;
  } else if (err.name === 'CastError') {
    status = 404;
    message = 'Recurso no encontrado';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Datos inválidos';
  } else if (!isTest) {
    console.error(err);
  }
  if (req.originalUrl.startsWith('/api/')) return res.status(status).send({ status: 'error', error: message });
  return res.status(status).render('error', { title: 'Error', code: status, message });
});

if (!isTest) {
  getJwtSecret(); // Falla al arrancar si falta JWT_SECRET, en lugar de fallar en el primer login.
  mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/biblioteca_digital');
  app.listen(PORT, () => console.log(`Listening on ${PORT}`));
}

export default app;
