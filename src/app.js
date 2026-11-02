import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUIExpress from 'swagger-ui-express';
import dotenv from 'dotenv';
import multer from 'multer';

import usersRouter from './routes/users.router.js';
import booksRouter from './routes/books.router.js';
import chatRouter from './routes/chat.router.js';
import loansRouter from './routes/loans.router.js';
import sessionsRouter from './routes/sessions.router.js';
import { attachUser } from './middlewares/auth.js';
import { getJwtSecret } from './utils/auth.js';
import __dirname from './utils/index.js';

dotenv.config({ quiet: true });

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
// Portadas subidas: se sirven en /img/<archivo>.
app.use('/img', express.static(`${__dirname}/../public/img`));
app.use(attachUser);

app.use('/api/chat', chatRouter);
app.use('/api/users', usersRouter);
app.use('/api/books', booksRouter);
app.use('/api/loans', loansRouter);
app.use('/api/sessions', sessionsRouter);

app.use('/api', (req, res) => res.status(404).send({ status: 'error', error: 'Ruta no encontrada' }));

// Manejador de errores: ids inválidos, archivos rechazados y cualquier error inesperado.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'La portada no puede superar 2 MB' : 'Archivo inválido';
    return res.status(400).send({ status: 'error', error: message });
  }
  if (err.status === 400) return res.status(400).send({ status: 'error', error: err.message });
  if (err.name === 'CastError') return res.status(404).send({ status: 'error', error: 'Recurso no encontrado' });
  if (err.name === 'ValidationError') return res.status(400).send({ status: 'error', error: 'Datos inválidos' });
  if (!isTest) console.error(err);
  return res.status(500).send({ status: 'error', error: 'Error interno del servidor' });
});

if (!isTest) {
  getJwtSecret(); // Falla al arrancar si falta JWT_SECRET, en lugar de fallar en el primer login.
  mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/biblioteca_digital');
  app.listen(PORT, () => console.log(`Listening on ${PORT}`));
}

export default app;
