import { NextResponse } from "next/server"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getRemoteUrl } from "@/lib/s3-url"

const region = process.env.S3_REGION || "auto"
const endpoint = process.env.S3_ENDPOINT
const bucket = process.env.S3_BUCKET_NAME
const accessKeyId = process.env.S3_ACCESS_KEY_ID
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY

const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true" || !!endpoint

if (!bucket) {
  console.error("Missing S3_BUCKET_NAME environment variable")
}

const s3 = new S3Client({
  region,
  endpoint: endpoint || undefined,
  credentials:
    accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined,
  forcePathStyle,
})

function generateKey(fileName: string): string {
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf("."))
    : ""
  const base = fileName.includes(".")
    ? fileName.slice(0, fileName.lastIndexOf("."))
    : fileName
  const clean = base.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 50)
  return `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${clean}${ext}`
}

function assertBucketOrConfigured() {
  if (!bucket) {
    return NextResponse.json(
      { error: "S3_BUCKET_NAME not configured" },
      { status: 500 }
    )
  }
  return bucket
}

export async function POST(request: Request) {
  const bucketOrResponse = assertBucketOrConfigured()
  if (bucketOrResponse instanceof NextResponse) return bucketOrResponse

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const fileName = typeof body.fileName === "string" ? body.fileName : ""
  const contentType =
    typeof body.contentType === "string"
      ? body.contentType
      : "application/octet-stream"

  if (!fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 })
  }

  const key = generateKey(fileName)

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })

  try {
    const url = await getSignedUrl(s3, command, { expiresIn: 600 })
    return NextResponse.json({
      url,
      remoteUrl: getRemoteUrl(key),
      key,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
