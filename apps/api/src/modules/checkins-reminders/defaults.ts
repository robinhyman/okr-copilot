import { env } from '../../config/env.js';

export const checkinReminderDefaults = {
  timezone: env.defaultTimezone,
  weeklyCheckin: {
    dayOfWeek: 'monday',
    localTime: '09:00'
  },
  reminders: {
    beforeDueHours: [24],
    atDueTime: true,
    lateNudgesHours: [24],
    escalationAfterHours: 72,
    cancelPendingNudgesOnSubmission: true
  },
  reviewCadenceWeeks: 4,
  quietHoursLocal: {
    start: '20:00',
    end: '08:00'
  },
  snoozeOptions: ['2h', 'tomorrow', 'this_week'] as const
} as const;

export type CheckinReminderDefaults = typeof checkinReminderDefaults;
