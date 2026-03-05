export const normalizeUrl = (url: string) => {
  try {
    const u = new URL(url);
    // Remove trailing slash for consistency
    return u.origin + u.pathname.replace(/\/$/, "") + u.search + u.hash;
  } catch {
    return url;
  }
};
