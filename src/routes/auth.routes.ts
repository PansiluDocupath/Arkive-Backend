import express, { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, getOrganizations } from '../controllers/auth.controller';

const authRouter = express.Router();

// Middleware for error logging and handling at route level 
const asyncHandler = (fn: Function) => (
  req: Request, res: Response, next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

authRouter.post('/register', asyncHandler(registerUser));
authRouter.post('/login', asyncHandler(loginUser));
authRouter.get('/organizations', asyncHandler(getOrganizations));

// health check route
authRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Auth service is running' });
});

export default authRouter;
