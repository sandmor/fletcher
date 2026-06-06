import type { Doc } from "@/convex/_generated/dataModel"

export function getResultImageUrl(
  job: Pick<Doc<"jobs">, "compositeUrl" | "outputUrl">
): string | undefined {
  return job.compositeUrl ?? job.outputUrl
}
