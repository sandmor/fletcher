import type { Id } from "@/convex/_generated/dataModel"
import type { BackgroundConfig } from "@/lib/background"
import type { CompositionLayout } from "@/lib/composition-layout"
import {
  compositeImageFromUrl,
  exportCompositedBlob,
} from "@/lib/image-compositor"
import { uploadToS3 } from "@/lib/s3"

export type PublishStudioResultPatch = {
  background?: BackgroundConfig | null
  compositionLayout?: CompositionLayout | null
}

export type PublishStudioResultDeps = {
  getCompositeUploadUrl: (args: { jobId: Id<"jobs"> }) => Promise<{
    uploadUrl: string
    compositeUrl: string
    key: string
  }>
  updateJobBackground: (args: {
    jobId: Id<"jobs">
    background: BackgroundConfig | null
    compositeUrl?: string
  }) => Promise<unknown>
  saveCompositionLayout: (args: {
    jobId: Id<"jobs">
    compositionLayout: CompositionLayout | null
    compositeUrl: string
    background: BackgroundConfig
  }) => Promise<unknown>
}

export type PublishStudioResultArgs = {
  jobId: Id<"jobs">
  outputUrl: string
  background: BackgroundConfig | null | undefined
  compositionLayout?: CompositionLayout
  patch: PublishStudioResultPatch
  deps: PublishStudioResultDeps
}

async function uploadComposite(
  deps: PublishStudioResultDeps,
  jobId: Id<"jobs">,
  outputUrl: string,
  background: BackgroundConfig,
  compositionLayout?: CompositionLayout
): Promise<string> {
  const canvas = await compositeImageFromUrl(
    outputUrl,
    background,
    compositionLayout
  )
  const blob = await exportCompositedBlob(canvas)
  const file = new File([blob], "composite.png", { type: "image/png" })
  const { uploadUrl, compositeUrl } = await deps.getCompositeUploadUrl({ jobId })
  await uploadToS3(uploadUrl, file)
  return compositeUrl
}

export async function publishStudioResult({
  jobId,
  outputUrl,
  background,
  compositionLayout,
  patch,
  deps,
}: PublishStudioResultArgs): Promise<void> {
  if (patch.background === null) {
    await deps.updateJobBackground({ jobId, background: null })
    return
  }

  const effectiveBackground =
    patch.background !== undefined ? patch.background : background
  if (!effectiveBackground) {
    throw new Error("Cannot publish studio result without a background")
  }

  const effectiveLayout =
    patch.compositionLayout !== undefined
      ? (patch.compositionLayout ?? undefined)
      : compositionLayout

  const compositeUrl = await uploadComposite(
    deps,
    jobId,
    outputUrl,
    effectiveBackground,
    effectiveLayout
  )

  if (patch.compositionLayout !== undefined) {
    await deps.saveCompositionLayout({
      jobId,
      compositionLayout: patch.compositionLayout,
      compositeUrl,
      background: effectiveBackground,
    })
    return
  }

  if (patch.background !== undefined) {
    await deps.updateJobBackground({
      jobId,
      background: patch.background,
      compositeUrl,
    })
  }
}
