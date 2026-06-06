"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
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
  enabled?: boolean
  enabledRef?: MutableRefObject<boolean>
}

function getPublishErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message === "Not found") {
    return "This image was deleted"
  }
  return err instanceof Error ? err.message : "Failed to save changes"
}

function isJobNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message === "Not found"
}

export function usePublishStudioResult(
  jobId: Id<"jobs">,
  outputUrl: string,
  options: UsePublishStudioResultOptions = {}
) {
  const { enabled = true, enabledRef: externalEnabledRef } = options
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
  const internalEnabledRef = useRef(enabled)
  const lastPublishFailedRef = useRef(false)
  const onFailureRef = useRef(options.onFailure)

  const isEnabled = useCallback(() => {
    return externalEnabledRef?.current ?? internalEnabledRef.current
  }, [externalEnabledRef])

  useEffect(() => {
    onFailureRef.current = options.onFailure
  }, [options.onFailure])

  useEffect(() => {
    if (!externalEnabledRef) {
      internalEnabledRef.current = enabled
    }
  }, [enabled, externalEnabledRef])

  const deps = {
    getCompositeUploadUrl,
    updateJobBackground,
    saveCompositionLayout,
  }

  const clearPendingSolidPublish = useCallback(() => {
    if (solidColorTimeoutRef.current) {
      clearTimeout(solidColorTimeoutRef.current)
      solidColorTimeoutRef.current = null
    }
    pendingSolidRef.current = null
  }, [])

  const cancelPublishQueue = useCallback(() => {
    publishIdRef.current += 1
    publishQueueRef.current = Promise.resolve()
    setPublishing(false)
  }, [])

  const resetPublishState = useCallback(() => {
    clearPendingSolidPublish()
    cancelPublishQueue()
  }, [cancelPublishQueue, clearPendingSolidPublish])

  const enqueuePublish = useCallback(
    (args: PublishArgs) => {
      if (!isEnabled()) {
        return Promise.resolve()
      }

      const task = async () => {
        if (!isEnabled()) {
          return
        }

        const currentPublishId = ++publishIdRef.current
        lastPublishFailedRef.current = false
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
          lastPublishFailedRef.current = true
          if (currentPublishId === publishIdRef.current && isEnabled()) {
            if (!isJobNotFoundError(err)) {
              onFailureRef.current?.()
            }
            toast.error(getPublishErrorMessage(err))
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
    [isEnabled, jobId, outputUrl]
  )

  useEffect(() => {
    return () => {
      if (solidColorTimeoutRef.current) {
        clearTimeout(solidColorTimeoutRef.current)
        solidColorTimeoutRef.current = null
      }

      if (!isEnabled()) {
        clearPendingSolidPublish()
        return
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
  }, [clearPendingSolidPublish, enqueuePublish, isEnabled])

  const publishSolidBackground = useCallback(
    (color: string, compositionLayout: CompositionLayout | undefined) => {
      if (!isEnabled()) return

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
    [clearPendingSolidPublish, enqueuePublish, isEnabled]
  )

  const publishBackgroundImage = useCallback(
    async (background: Extract<BackgroundConfig, { type: "image" }>) => {
      if (!isEnabled()) return

      clearPendingSolidPublish()
      await enqueuePublish({
        background,
        compositionLayout: undefined,
        patch: { background },
      })
    },
    [clearPendingSolidPublish, enqueuePublish, isEnabled]
  )

  const publishBackgroundClear = useCallback(async () => {
    if (!isEnabled()) return

    clearPendingSolidPublish()
    await enqueuePublish({
      background: null,
      patch: { background: null },
    })
  }, [clearPendingSolidPublish, enqueuePublish, isEnabled])

  const publishCompositionLayout = useCallback(
    async (layout: CompositionLayout, background: BackgroundConfig) => {
      if (!isEnabled()) return

      clearPendingSolidPublish()
      await enqueuePublish({
        background,
        compositionLayout: layout,
        patch: { compositionLayout: layout, background },
      })
    },
    [clearPendingSolidPublish, enqueuePublish, isEnabled]
  )

  return {
    publishing,
    lastPublishFailedRef,
    publishSolidBackground,
    publishBackgroundImage,
    publishBackgroundClear,
    publishCompositionLayout,
    clearPendingSolidPublish,
    cancelPublishQueue,
    resetPublishState,
  }
}
