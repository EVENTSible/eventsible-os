export const HERO_CONFIG = Object.freeze({
  wedding: Object.freeze({
    key: "wedding",
    title: "Wedding Hero",
    description: "Interactive Wedding Companion",
    templateName: "Wedding Hero",
    templateSlug: "wedding-hero",
    eventType: "Wedding",
    routeSegment: "wedding",
  }),
  event: Object.freeze({
    key: "event",
    title: "Event Hero",
    templateName: "Event Hero",
    templateSlug: "event-hero",
    eventType: null,
    routeSegment: "event",
  }),
});

export const HERO_RELATIONSHIPS = Object.freeze([
  Object.freeze({ value: "booked", label: "We are already booked with EVENTSible" }),
  Object.freeze({ value: "talking", label: "We are already talking with EVENTSible" }),
  Object.freeze({ value: "planning", label: "I am planning or considering an event" }),
]);

export function heroConfig(value) {
  return typeof value === "string" ? HERO_CONFIG[value] ?? null : null;
}

export function cleanText(value, maxLength = 240) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

export function normalizeEmail(value) {
  return cleanText(value, 320).toLowerCase();
}

export function splitDisplayName(value) {
  const displayName = cleanText(value, 160);
  if (!displayName) return { displayName: "EVENTSible client", firstName: null, lastName: null };
  const parts = displayName.split(" ");
  return {
    displayName,
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

export function localDateTimeToIso(value, timeZone = "America/Indiana/Indianapolis") {
  const match = cleanText(value, 32).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const desired = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let guess = desired;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const observed = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    guess += desired - observed;
  }

  const result = new Date(guess);
  return Number.isNaN(result.getTime()) ? null : result.toISOString();
}

export function heroEventTitle(hero, suppliedTitle, displayName) {
  const title = cleanText(suppliedTitle, 180);
  if (title) return title;
  const name = cleanText(displayName, 120);
  if (hero?.key === "wedding") return name ? `${name}'s wedding` : "Wedding planning workspace";
  return name ? `${name}'s event` : "Event planning workspace";
}

export function normalizeHeroStartInput(heroKey, values) {
  const hero = heroConfig(heroKey);
  if (!hero) return { ok: false, message: "Choose Wedding Hero or Event Hero." };

  const clientName = cleanText(values?.clientName, 160);
  const eventType = hero.eventType ?? cleanText(values?.eventType, 80);
  const startsAt = localDateTimeToIso(values?.startsAt);
  const relationship = cleanText(values?.relationship, 24);
  if (!clientName) return { ok: false, message: "Enter your name so EVENTSible knows who started this workspace." };
  if (!eventType) return { ok: false, message: "Choose an event type." };
  if (!startsAt) return { ok: false, message: "Enter the event date and start time." };
  if (!HERO_RELATIONSHIPS.some((option) => option.value === relationship)) {
    return { ok: false, message: "Tell us where you are in the EVENTSible process." };
  }

  return {
    ok: true,
    data: {
      hero,
      clientName,
      phone: cleanText(values?.phone, 40) || null,
      eventTitle: heroEventTitle(hero, values?.eventTitle, clientName),
      eventType,
      startsAt,
      venueName: cleanText(values?.venueName, 180) || null,
      city: cleanText(values?.city, 100) || null,
      relationship,
    },
  };
}
