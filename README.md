# Fletcher

Upload images, queue background-removal jobs, and download the results. Images are stored in an S3-compatible object store so the backend can access them for processing.

## Quick start

```bash
bun install
# copy and fill in your object-store credentials
cp .env.example .env.local
bun run dev
```

## Configuration

Set the variables in `.env.local`:

| Variable                | Required | Description                                                               |
| ----------------------- | -------- | ------------------------------------------------------------------------- |
| `S3_BUCKET_NAME`        | **Yes**  | Target bucket                                                             |
| `S3_ACCESS_KEY_ID`      | **Yes**  | Access key                                                                |
| `S3_SECRET_ACCESS_KEY`  | **Yes**  | Secret key                                                                |
| `S3_REGION`             | No       | Region (default: `auto`)                                                  |
| `S3_ENDPOINT`           | No       | Custom endpoint for MinIO / R2 / etc.                                     |
| `S3_PUBLIC_URL_BASE`    | **Yes**  | Public-read URL base for generated object URLs                            |
| `S3_FORCE_PATH_STYLE`   | No       | Force path-style URLs (`true` / `false`, default: inferred from endpoint) |
| `MODAL_ENDPOINT_URL`    | **Yes**  | Deployed Modal web endpoint (`…/trigger_job`)                             |
| `MODAL_CALLBACK_SECRET` | **Yes**  | Shared secret used to authenticate Modal -> Convex webhook callbacks      |

### Cloudflare R2

R2 requires its S3-compatible endpoint and a public bucket or custom domain for serving uploaded images.

1. Create an R2 bucket and note the **S3 API** endpoint (e.g., `https://<account>.r2.cloudflarestorage.com`).
2. Create an R2 API token with **Object Read & Write** permissions.
3. If you want public access, either enable **public bucket** or add a **custom domain** in the R2 dashboard and use it as `S3_PUBLIC_URL_BASE`.

Example `.env.local` for R2:

```env
S3_REGION=auto
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_BUCKET_NAME=my-bucket
S3_ACCESS_KEY_ID=<r2-access-key>
S3_SECRET_ACCESS_KEY=<r2-secret-key>
S3_PUBLIC_URL_BASE=https://cdn.example.com
MODAL_CALLBACK_SECRET=your-random-secret-here
```

The presigned PUT URL is generated server-side, so the client uploads directly to R2, and the server never proxies binary data.

## Modal job processor

The backend offloads image processing to a [Modal](https://modal.com) app defined in `modal/main.py`.

### Deploy

1. [Install Modal](https://modal.com/docs/guide/custom-container) and authenticate:

```bash
   uv sync
   uv run modal token new
```

2. Deploy the app:

```bash
   uv run modal deploy modal/main.py
```

3. Copy the deployed web endpoint URL into your `.env.local`:

```env
   MODAL_ENDPOINT_URL=https://your-workspace--image-processor-trigger-job.modal.run
```

## Convex

The app uses [Convex](https://convex.dev) as its real-time backend for the job queue. All job states (pending, processing, completed, failed) live in Convex, and the UI subscribes to them so updates appear instantly across tabs.

### Running Convex locally

1. Make sure you are logged in:

```bash
npx convex dev
```

This generates `.env.local` entries for `CONVEX_DEPLOYMENT`, `NEXT_PUBLIC_CONVEX_URL`, and `NEXT_PUBLIC_CONVEX_SITE_URL` if they are missing.

### Environment variables in Convex

Convex functions run in the cloud, **not** inside Next.js. Because of that, **`.env.local` variables are not available to Convex actions or mutations**. You must set the same variables directly in Convex.

Set them via the CLI (from the project root):

```bash
npx convex env set S3_BUCKET_NAME=<your-bucket>
npx convex env set S3_ACCESS_KEY_ID=<key>
npx convex env set S3_SECRET_ACCESS_KEY=<secret>
npx convex env set S3_PUBLIC_URL_BASE=<url>
npx convex env set MODAL_ENDPOINT_URL=<modal-endpoint>
npx convex env set MODAL_CALLBACK_SECRET=<secret>
```

Or set them in the **Convex Dashboard** → Settings → Environment Variables.

Required variables:

| Variable                | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `S3_BUCKET_NAME`        | Target S3-compatible bucket                    |
| `S3_ACCESS_KEY_ID`      | Access key for the bucket                      |
| `S3_SECRET_ACCESS_KEY`  | Secret key for the bucket                      |
| `S3_PUBLIC_URL_BASE`    | Public-read URL base for generated object URLs |
| `MODAL_ENDPOINT_URL`    | Deployed Modal web endpoint (`…/trigger_job`)  |
| `MODAL_CALLBACK_SECRET` | Shared secret for Modal webhook callbacks      |

If you skip this step, actions like `triggerModalJob` will fail with a `Region is missing` error because the S3 SDK inside Convex has no credentials to work with.

### How the flow works

1. The frontend uploads images directly to the S3-compatible store (via a presigned PUT URL generated by the Next.js API route).
2. The user clicks **Submit** — this calls the `createJob` Convex mutation, then `triggerModalJob`.
3. `triggerModalJob` generates a presigned upload URL for the output, grabs `MODAL_ENDPOINT_URL`, and queues the Modal worker.
4. The Modal worker posts `"processing"` to the Convex HTTP action (`/updateJobStatus`), then downloads the input image, re-uploads it to the output key (placeholder until real background removal is implemented), and finally posts `"completed"` with the output URL.
5. The UI updates instantly because every page is subscribed to live Convex queries.
6. Deleting a job from the queue widget triggers `cleanupJobS3` to remove the corresponding S3 objects before the DB record is deleted.

### Notes

- `S3_PUBLIC_URL_BASE` is used consistently on both the frontend (via `lib/s3-url.ts`) and the Convex backend (via `getPublicUrl`) to build object URLs. It must be set for both environments.
- The Modal webhook (`/updateJobStatus`) requires the `x-callback-secret` header to match `MODAL_CALLBACK_SECRET`. Requests without a valid secret are rejected with `401`.
