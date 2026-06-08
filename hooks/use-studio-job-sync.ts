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
  /** Called when a revision change from our own successful publish is acked. */
  onOwnPublishAck?: (job: StudioJob) => void
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

function ackOwnPublishRevision({
  currentRevision,
  lastAckedRevisionRef,
  expectingOwnPublishRef,
  onOwnPublishAck,
  job,
}: {
  currentRevision: string
  lastAckedRevisionRef: MutableRefObject<string | null>
  expectingOwnPublishRef: MutableRefObject<boolean>
  onOwnPublishAck?: (job: StudioJob) => void
  job: StudioJob
}) {
  lastAckedRevisionRef.current = currentRevision
  expectingOwnPublishRef.current = false
  onOwnPublishAck?.(job)
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
  onOwnPublishAck,
}: UseStudioJobSyncArgs) {
  const lastAckedRevisionRef = useRef<string | null>(null)
  const lastJobIdRef = useRef(job._id)
  const wasPublishingRef = useRef(publishing)
  const revisionAtPublishStartRef = useRef<string | null>(null)
  const expectingOwnPublishRef = useRef(false)
  const onOwnPublishAckRef = useRef(onOwnPublishAck)

  useEffect(() => {
    onOwnPublishAckRef.current = onOwnPublishAck
  }, [onOwnPublishAck])

  useEffect(() => {
    if (lastJobIdRef.current !== job._id) {
      lastJobIdRef.current = job._id
      lastAckedRevisionRef.current = getStudioRevision(job)
      wasPublishingRef.current = publishing
      revisionAtPublishStartRef.current = null
      expectingOwnPublishRef.current = false
      onResetLocalState()
      setAdvancedLayout(false)
      clearPendingPublish()
      return
    }

    const currentRevision = getStudioRevision(job)

    if (!wasPublishingRef.current && publishing) {
      revisionAtPublishStartRef.current = lastAckedRevisionRef.current
      expectingOwnPublishRef.current = true
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

      const revisionChangedSincePublishStart =
        revisionAtPublishStart !== null &&
        revisionAtPublishStart !== currentRevision

      if (lastPublishFailedRef.current) {
        expectingOwnPublishRef.current = false
        lastAckedRevisionRef.current = currentRevision

        if (revisionChangedSincePublishStart) {
          applyExternalSync({
            job,
            advancedLayout,
            clearPendingPublish,
            onResetLocalState,
            setAdvancedLayout,
            notify: true,
          })
        }
      } else if (expectingOwnPublishRef.current) {
        // Successful publish: Convex may not have pushed the new revision yet.
        // Only ack immediately if the subscription already caught up.
        if (revisionChangedSincePublishStart) {
          ackOwnPublishRevision({
            currentRevision,
            lastAckedRevisionRef,
            expectingOwnPublishRef,
            onOwnPublishAck: onOwnPublishAckRef.current,
            job,
          })
        }
      } else {
        lastAckedRevisionRef.current = currentRevision
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

    if (expectingOwnPublishRef.current && !lastPublishFailedRef.current) {
      ackOwnPublishRevision({
        currentRevision,
        lastAckedRevisionRef,
        expectingOwnPublishRef,
        onOwnPublishAck: onOwnPublishAckRef.current,
        job,
      })
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
