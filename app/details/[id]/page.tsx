"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft,
  Download,
  Loader2,
  Clock,
  Image as ImageIcon,
  ChevronsLeftRight,
} from "lucide-react"

export default function DetailPage() {
  const params = useParams()
  const router = useRouter()
  // Slider position state (0 to 100)
  const [sliderPos, setSliderPos] = useState(50)

  const rawId = Array.isArray(params.id) ? params.id[0] : params.id
  const id = rawId ? (rawId as Id<"jobs">) : null
  const job = useQuery(api.jobs.getJobById, id ? { id } : "skip")

  if (!id || job === null) {
    return (
      <main className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6 lg:px-8">
        <ImageIcon className="h-12 w-12 text-muted-foreground opacity-50" />
        <h1 className="text-xl font-semibold">Image not found</h1>
        <Button variant="outline" onClick={() => router.push("/results")}>
          Back to results
        </Button>
      </main>
    )
  }

  if (job === undefined) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  const showResult = job.status === "completed" && job.outputUrl

  const checkerboardStyle = {
    backgroundImage: `
      repeating-linear-gradient(45deg, #f3f4f6 25%, transparent 25%, transparent 75%, #f3f4f6 75%, #f3f4f6), 
      repeating-linear-gradient(45deg, #f3f4f6 25%, #ffffff 25%, #ffffff 75%, #f3f4f6 75%, #f3f4f6)
    `,
    backgroundPosition: "0 0, 10px 10px",
    backgroundSize: "20px 20px",
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {job.fileName}
          </h1>
          <StatusLabel status={job.status} />
        </div>

        {showResult && (
          <Button asChild>
            <a href={job.outputUrl!} download={job.fileName}>
              <Download className="mr-2 h-4 w-4" />
              Download Result
            </a>
          </Button>
        )}
      </div>

      {showResult ? (
        <Tabs defaultValue="result" className="w-full">
          <div className="mb-4 flex items-center justify-center">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="result">Result</TabsTrigger>
              <TabsTrigger value="compare">Compare</TabsTrigger>
              <TabsTrigger value="original">Original</TabsTrigger>
            </TabsList>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <TabsContent value="result" className="m-0">
                <div
                  className="relative flex aspect-4/3 w-full items-center justify-center p-4"
                  style={checkerboardStyle}
                >
                  <img
                    src={job.outputUrl!}
                    alt="Result"
                    className="h-full w-full object-contain drop-shadow-xl"
                  />
                </div>
              </TabsContent>

              <TabsContent value="compare" className="m-0">
                <div
                  className="relative aspect-4/3 w-full overflow-hidden p-4"
                  style={checkerboardStyle}
                >
                  <img
                    src={job.outputUrl!}
                    alt="Result"
                    className="pointer-events-none absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] object-contain drop-shadow-xl select-none"
                  />

                  <img
                    src={job.inputUrl}
                    alt="Original"
                    className="pointer-events-none absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] object-contain select-none"
                    style={{
                      clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                    }}
                  />

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderPos}
                    onChange={(e) => setSliderPos(Number(e.target.value))}
                    className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
                  />

                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-10 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                    style={{
                      left: `${sliderPos}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    <div className="absolute top-1/2 left-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg">
                      <ChevronsLeftRight className="h-4 w-4 text-slate-800" />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="original" className="m-0">
                <div className="relative flex aspect-4/3 w-full items-center justify-center bg-muted/20 p-4">
                  <img
                    src={job.inputUrl}
                    alt="Original"
                    className="h-full w-full object-contain"
                  />
                </div>
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      ) : (
        /* Fallback for processing/pending/failed states */
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative flex aspect-4/3 w-full items-center justify-center bg-muted/20 p-4">
              <img
                src={job.inputUrl}
                alt="Original"
                className="h-full w-full object-contain opacity-50"
              />

              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                {job.status === "processing" && (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-sm font-medium">
                      Applying magic...
                    </span>
                  </div>
                )}
                {job.status === "pending" && (
                  <div className="flex flex-col items-center gap-3">
                    <Clock className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Waiting in queue...
                    </span>
                  </div>
                )}
                {job.status === "failed" && (
                  <div className="flex flex-col items-center gap-3 text-destructive">
                    <span className="text-sm font-semibold">
                      Processing failed
                    </span>
                    {job.error && (
                      <span className="max-w-md px-4 text-center text-xs opacity-80">
                        {job.error}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function StatusLabel({ status }: { status: string }) {
  if (status === "completed")
    return (
      <Badge className="border-0 bg-emerald-500/15 text-emerald-600 shadow-none hover:bg-emerald-500/25">
        Completed
      </Badge>
    )
  if (status === "processing")
    return <Badge variant="default">Processing</Badge>
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>
  return null
}
