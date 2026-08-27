import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUIExpress from 'swagger-ui-express';
import dotenv from 'dotenv';

import usersRouter from './routes/users.router.js';
import booksRouter from './routes/books.router.js';
import chatRouter from './routes/chat.router.js';
import loansRouter from './routes/loans.router.js';
import sessionsRouter from './routes/sessions.router.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8081;

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

app.use(express.json());
app.use(cookieParser());

app.use('/api/chat', chatRouter);
app.use('/api/users', usersRouter);
app.use('/api/books', booksRouter);
app.use('/api/loans', loansRouter);
app.use('/api/sessions', sessionsRouter);

if (process.env.NODE_ENV !== 'test' && process.env.npm_lifecycle_event !== 'test') {
  mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/biblioteca_digital');
  app.listen(PORT, () => console.log(`Listening on ${PORT}`));
}

export default app;
