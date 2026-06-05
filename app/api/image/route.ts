import { NextResponse } from "next/server"
import { isAllowedImageUrl } from "@/lib/image-proxy"

export async function GET(request: Request) {
  const publicUrlBase = process.env.S3_PUBLIC_URL_BASE
  if (!publicUrlBase) {
    return NextResponse.json(
      { error: "S3_PUBLIC_URL_BASE not configured" },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const imageUrl = searchParams.get("url")

  if (!imageUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }

  if (!isAllowedImageUrl(imageUrl, publicUrlBase)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 })
  }

  try {
    const upstream = await fetch(imageUrl)

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      )
    }

    const contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream"
    const body = await upstream.arrayBuffer()

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
