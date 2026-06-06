"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAction } from "convex/react"
import { toast } from "sonner"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import type { BackgroundConfig } from "@/lib/background"
import type { CompositionLayout } from "@/lib/composition-layout"
import { publishStudioResult } from "@/lib/studio/publish-studio-result"

const SOLID_COLOR_DEBOUNCE_MS = 400

type PublishArgs = {
  background?: BackgroundConfig | null
  compositionLayout?: CompositionLayout
  patch: {
    background?: BackgroundConfig | null
    compositionLayout?: CompositionLayout | null
  }
}

type UsePublishStudioResultOptions = {
  onFailure?: () => void
}

export function usePublishStudioResult(
  jobId: Id<"jobs">,
  outputUrl: string,
  options: UsePublishStudioResultOptions = {}
) {
  const getCompositeUploadUrl = useAction(api.jobs.getCompositeUploadUrl)
  const updateJobBackground = useAction(api.jobs.updateJobBackground)
  const saveCompositionLayout = useAction(api.jobs.saveCompositionLayout)
  const [publishing, setPublishing] = useState(false)
  const solidColorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSolidRef = useRef<{
    color: string
    compositionLayout?: CompositionLayout
  } | null>(null)
  const publishIdRef = useRef(0)
  const publishQueueRef = useRef(Promise.resolve())
  const onFailureRef = useRef(options.onFailure)

  useEffect(() => {
    onFailureRef.current = options.onFailure
  }, [options.onFailure])

  const deps = {
    getCompositeUploadUrl,
    updateJobBackground,
    saveCompositionLayout,
  }

  const enqueuePublish = useCallback(
    (args: PublishArgs) => {
      const task = async () => {
        const currentPublishId = ++publishIdRef.current
        setPublishing(true)
        try {
          await publishStudioResult({
            jobId,
            outputUrl,
            background: args.background,
            compositionLayout: args.compositionLayout,
            patch: args.patch,
            deps,
          })
        } catch (err) {
          if (currentPublishId === publishIdRef.current) {
            onFailureRef.current?.()
            toast.error(
              err instanceof Error ? err.message : "Failed to save changes"
            )
          }
          throw err
        } finally {
          if (currentPublishId === publishIdRef.current) {
            setPublishing(false)
          }
        }
      }

      const next = publishQueueRef.current.then(task, task)
      publishQueueRef.current = next.catch(() => {})
      return next
    },
    [jobId, outputUrl]
  )

  useEffect(() => {
    return () => {
      if (solidColorTimeoutRef.current) {
        clearTimeout(solidColorTimeoutRef.current)
        solidColorTimeoutRef.current = null
      }

      const pending = pendingSolidRef.current
      if (pending) {
        pendingSolidRef.current = null
        void enqueuePublish({
          background: { type: "solid", color: pending.color },
          compositionLayout: pending.compositionLayout,
          patch: { background: { type: "solid", color: pending.color } },
        })
      }
    }
  }, [enqueuePublish])

  const clearPendingSolidPublish = useCallback(() => {
    if (solidColorTimeoutRef.current) {
      clearTimeout(solidColorTimeoutRef.current)
      solidColorTimeoutRef.current = null
    }
    pendingSolidRef.current = null
  }, [])

  const publishSolidBackground = useCallback(
    (color: string, compositionLayout: CompositionLayout | undefined) => {
      clearPendingSolidPublish()
      pendingSolidRef.current = { color, compositionLayout }

      solidColorTimeoutRef.current = setTimeout(() => {
        pendingSolidRef.current = null
        solidColorTimeoutRef.current = null
        void enqueuePublish({
          background: { type: "solid", color },
          compositionLayout,
          patch: { background: { type: "solid", color } },
        })
      }, SOLID_COLOR_DEBOUNCE_MS)
    },
    [clearPendingSolidPublish, enqueuePublish]
  )

  const publishBackgroundImage = useCallback(
    async (background: Extract<BackgroundConfig, { type: "image" }>) => {
      clearPendingSolidPublish()
      await enqueuePublish({
        background,
        compositionLayout: undefined,
        patch: { background },
      })
    },
    [clearPendingSolidPublish, enqueuePublish]
  )

  const publishBackgroundClear = useCallback(async () => {
    clearPendingSolidPublish()
    await enqueuePublish({
      background: null,
      patch: { background: null },
    })
  }, [clearPendingSolidPublish, enqueuePublish])

  const publishCompositionLayout = useCallback(
    async (layout: CompositionLayout, background: BackgroundConfig) => {
      clearPendingSolidPublish()
      await enqueuePublish({
        background,
        compositionLayout: layout,
        patch: { compositionLayout: layout, background },
      })
    },
    [clearPendingSolidPublish, enqueuePublish]
  )

  return {
    publishing,
    publishSolidBackground,
    publishBackgroundImage,
    publishBackgroundClear,
    publishCompositionLayout,
  }
}
