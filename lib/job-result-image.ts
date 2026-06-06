import type { Doc } from "@/convex/_generated/dataModel"

export function getResultImageUrl(
  job: Pick<Doc<"jobs">, "compositeUrl" | "outputUrl" | "compositeUpdatedAt">
): string | undefined {
  const base = job.compositeUrl ?? job.outputUrl
  if (!base) return undefined
  if (job.compositeUrl && job.compositeUpdatedAt) {
    return `${job.compositeUrl}?v=${job.compositeUpdatedAt}`
  }
  return base
}
