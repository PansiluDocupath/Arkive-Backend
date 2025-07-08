import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import authRouter from './routes/auth.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(cors());          
app.use(helmet());        // Basic security headers

//Routes
app.use('/api/auth', authRouter);

// Health check route 
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

//404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: 'Internal server error',
    detail: err.message || String(err)
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
