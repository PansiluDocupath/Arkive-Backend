// src/routes/auth.routes.ts

import express from 'express';
import loginRoute from './auth/login';
import postRegisterRoute from './auth/postRegister';
import organizationsRoute from './auth/organizations';

const authRouter = express.Router();

// Auth-related routes under /api/auth/
authRouter.use('/', loginRoute);                    // e.g., POST /api/auth/login
authRouter.use('/', postRegisterRoute);             // e.g., POST /api/auth/post-register
authRouter.use('/organizations', organizationsRoute); // e.g., GET /api/auth/organizations

// Optional: health check endpoint
authRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Auth service is running' });
});

export default authRouter;