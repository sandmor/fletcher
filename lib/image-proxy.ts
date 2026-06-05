export function toProxiedImageUrl(s3Url: string): string {
  return `/api/image?url=${encodeURIComponent(s3Url)}`
}

export function isAllowedImageUrl(url: string, publicUrlBase: string): boolean {
  const base = publicUrlBase.replace(/\/$/, "")
  if (!base) return false
  return url === base || url.startsWith(`${base}/`)
}
