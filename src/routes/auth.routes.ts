import express from 'express';
import { registerUser, loginUser, getOrganizations } from '../controllers/auth.controller';

const authRouter = express.Router();

authRouter.post('/register', registerUser);
authRouter.post('/login', loginUser);
authRouter.get('/organizations', getOrganizations);

export default authRouter;
