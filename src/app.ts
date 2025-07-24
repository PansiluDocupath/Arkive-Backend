// src/app.ts

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

import authRouter from './routes/auth.routes';

const app = express();

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(helmet());

// Health check route
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

// Unified auth router
app.use('/api/auth', authRouter);

// Catch-all 404 route
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: 'Internal server error',
    detail: err.message || String(err),
  });
});

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});