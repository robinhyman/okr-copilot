import { Router } from 'express';
import { checkinReminderDefaults } from '../modules/checkins-reminders/defaults.js';

export const defaultsRouter = Router();

defaultsRouter.get('/defaults/checkins', (_req, res) => {
  res.json({ defaults: checkinReminderDefaults });
});
