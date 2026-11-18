import { localDateKey } from '../hq-calendar.mjs';

// Google all-day end dates are exclusive. Timed entries end at the previous
// occupied instant so an event ending at midnight does not occupy the next day.
export function googleEntryDateKeys(entry) {
  const first = entry.allDay ? entry.startsOn : localDateKey(new Date(entry.startsAt), entry.timezone || 'America/Indiana/Indianapolis');
  const end = entry.allDay ? entry.endsOn : localDateKey(new Date(new Date(entry.endsAt).valueOf() - 1), entry.timezone || 'America/Indiana/Indianapolis');
  if (!first || !end || end < first) return [];
  const keys = [];
  let date = new Date(`${first}T12:00:00Z`);
  for (let day = 0; day < 370; day++) {
    const key = date.toISOString().slice(0, 10);
    if (entry.allDay ? key >= end : key > end) break;
    keys.push(key);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return keys;
}
