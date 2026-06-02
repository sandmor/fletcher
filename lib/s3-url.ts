/**
 * Returns the public URL for an S3 object key.
 * Relies on S3_PUBLIC_URL_BASE being set — this is the same URL shape
 * used by the Convex backend so the frontend and backend stay consistent.
 */
export function getRemoteUrl(key: string): string {
  const base = (process.env.S3_PUBLIC_URL_BASE || "").replace(/\/$/, "")
  if (!base) {
    throw new Error("S3_PUBLIC_URL_BASE is not configured")
  }
  return `${base}/${key}`
}
