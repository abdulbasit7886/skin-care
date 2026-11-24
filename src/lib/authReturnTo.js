// Resolve ?returnTo= to a safe in-portal path, else null.
//
// The value is a router path inside the portal (e.g. "/patients?x=1"). The
// same-origin check alone is not enough: a value like /.//evil.com or
// /\evil.com parses same-origin but normalizes to a protocol-relative
// //evil.com when assigned to location.href — an open redirect. So require the
// resolved path to be exactly one leading slash (no "//" prefix, no backslash).
export function safeReturnTo() {
  const raw = new URLSearchParams(window.location.search).get("returnTo");
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
    if (path === "/login" || path.startsWith("/login?")) return null;
    return path;
  } catch {
    return null;
  }
}
