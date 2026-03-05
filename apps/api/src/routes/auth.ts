import { Router } from 'express';
import { buildPermissionSummary, getActorContext } from '../modules/auth/rbac.js';

export const authRouter = Router();

authRouter.get('/auth/status', async (req, res) => {
  const actor = await getActorContext(req);
  res.json({
    auth: req.auth ?? {
      isAuthenticated: false,
      provider: 'unknown',
      user: null
    },
    actor,
    permissions: buildPermissionSummary(actor, actor.activeTeamId)
  });
});
