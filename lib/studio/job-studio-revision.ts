import type { Doc } from "@/convex/_generated/dataModel"

type StudioJobFields = Pick<
  Doc<"jobs">,
  "compositeUpdatedAt" | "background" | "compositionLayout"
>

export function getStudioRevision(job: StudioJobFields): string {
  return JSON.stringify({
    t: job.compositeUpdatedAt ?? null,
    bg: job.background ?? null,
    layout: job.compositionLayout ?? null,
  })
}

export function hasStudioRevisionChanged(
  previous: string | null,
  next: string
): boolean {
  return previous !== null && previous !== next
}
