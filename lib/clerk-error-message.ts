type ClerkErrorShape = {
  errors?: unknown
  message?: unknown
}

type ClerkErrorDetail = {
  longMessage?: unknown
  message?: unknown
}

export function getClerkErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") return fallback

  const { errors, message } = error as ClerkErrorShape
  const firstError = Array.isArray(errors) ? errors[0] : undefined

  if (firstError && typeof firstError === "object") {
    const detail = firstError as ClerkErrorDetail

    if (typeof detail.longMessage === "string") return detail.longMessage
    if (typeof detail.message === "string") return detail.message
  }

  return typeof message === "string" ? message : fallback
}
