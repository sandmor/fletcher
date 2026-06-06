"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import { toast } from "sonner"
import { Doc } from "@/convex/_generated/dataModel"
import {
  getStudioRevision,
  hasStudioRevisionChanged,
} from "@/lib/studio/job-studio-revision"

type StudioJob = Doc<"jobs"> & { outputUrl: string }

type UseStudioJobSyncArgs = {
  job: StudioJob
  publishing: boolean
  advancedLayout: boolean
  lastPublishFailedRef: MutableRefObject<boolean>
  onResetLocalState: () => void
  clearPendingPublish: () => void
  cancelPublishQueue: () => void
  setAdvancedLayout: (value: boolean) => void
}

function applyExternalSync({
  job,
  advancedLayout,
  clearPendingPublish,
  onResetLocalState,
  setAdvancedLayout,
  notify,
}: {
  job: StudioJob
  advancedLayout: boolean
  clearPendingPublish: () => void
  onResetLocalState: () => void
  setAdvancedLayout: (value: boolean) => void
  notify: boolean
}) {
  clearPendingPublish()
  onResetLocalState()

  if (!job.background) {
    setAdvancedLayout(false)
    return
  }

  if (advancedLayout) {
    setAdvancedLayout(false)
    if (notify) {
      toast.info(
        "This image was updated elsewhere. Your positioning changes were discarded."
      )
    }
  }
}

export function useStudioJobSync({
  job,
  publishing,
  advancedLayout,
  lastPublishFailedRef,
  onResetLocalState,
  clearPendingPublish,
  cancelPublishQueue,
  setAdvancedLayout,
}: UseStudioJobSyncArgs) {
  const lastAckedRevisionRef = useRef<string | null>(null)
  const lastJobIdRef = useRef(job._id)
  const wasPublishingRef = useRef(publishing)
  const revisionAtPublishStartRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastJobIdRef.current !== job._id) {
      lastJobIdRef.current = job._id
      lastAckedRevisionRef.current = getStudioRevision(job)
      wasPublishingRef.current = publishing
      revisionAtPublishStartRef.current = null
      onResetLocalState()
      setAdvancedLayout(false)
      clearPendingPublish()
      return
    }

    const currentRevision = getStudioRevision(job)

    if (!wasPublishingRef.current && publishing) {
      revisionAtPublishStartRef.current = lastAckedRevisionRef.current
    }

    const justFinishedPublishing = wasPublishingRef.current && !publishing
    wasPublishingRef.current = publishing

    if (lastAckedRevisionRef.current === null) {
      lastAckedRevisionRef.current = currentRevision
      return
    }

    if (justFinishedPublishing) {
      const revisionAtPublishStart = revisionAtPublishStartRef.current
      revisionAtPublishStartRef.current = null

      const hadExternalChangeDuringPublish =
        revisionAtPublishStart !== null &&
        revisionAtPublishStart !== currentRevision

      lastAckedRevisionRef.current = currentRevision

      if (hadExternalChangeDuringPublish && lastPublishFailedRef.current) {
        applyExternalSync({
          job,
          advancedLayout,
          clearPendingPublish,
          onResetLocalState,
          setAdvancedLayout,
          notify: true,
        })
      }
      return
    }

    if (
      !hasStudioRevisionChanged(lastAckedRevisionRef.current, currentRevision)
    ) {
      return
    }

    if (publishing) {
      return
    }

    lastAckedRevisionRef.current = currentRevision
    applyExternalSync({
      job,
      advancedLayout,
      clearPendingPublish,
      onResetLocalState,
      setAdvancedLayout,
      notify: true,
    })
  }, [
    advancedLayout,
    clearPendingPublish,
    job,
    lastPublishFailedRef,
    onResetLocalState,
    publishing,
    setAdvancedLayout,
  ])

  useEffect(() => {
    return () => {
      cancelPublishQueue()
    }
  }, [cancelPublishQueue])
}
