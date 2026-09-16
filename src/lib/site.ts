/** The only public origin, independent of request hosts and deployment env. */
export const SITE_URL = "https://biotech.itmo.ru";

export function siteUrl(pathname = "/"): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || /[\\?#]/.test(pathname)) {
    throw new Error("Expected a site-relative pathname without query or fragment");
  }
  const url = new URL(pathname, SITE_URL);
  if (url.origin !== SITE_URL) throw new Error("Invalid site origin");
  return url.href;
}
