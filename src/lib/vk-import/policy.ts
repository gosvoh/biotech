/** Shared by server import logic and the history form; contains no credentials. */
export const VK_FIRST_DAY = "2026-09-01";
export const VK_TIME_ZONE = "Europe/Moscow";
// Moscow midnight is UTC+03:00 on the first supported publication day.
export const VK_FIRST_PUBLICATION_SECONDS = Date.parse(`${VK_FIRST_DAY}T00:00:00+03:00`) / 1000;
