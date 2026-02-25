import { Router } from 'express';

export const authRouter = Router();

authRouter.get('/auth/status', (req, res) => {
  res.json({
    auth: req.auth ?? {
      isAuthenticated: false,
      provider: 'unknown',
      user: null
    }
  });
});
