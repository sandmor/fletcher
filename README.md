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

| Variable                            | Required | Description                                                               |
| ----------------------------------- | -------- | ------------------------------------------------------------------------- |
| `S3_BUCKET_NAME`                    | **Yes**  | Target bucket                                                             |
| `S3_ACCESS_KEY_ID`                  | **Yes**  | Access key                                                                |
| `S3_SECRET_ACCESS_KEY`              | **Yes**  | Secret key                                                                |
| `S3_REGION`                         | No       | Region (default: `auto`)                                                  |
| `S3_ENDPOINT`                       | No       | Custom endpoint for MinIO / R2 / etc.                                     |
| `S3_PUBLIC_URL_BASE`                | **Yes**  | Public-read URL base for generated object URLs                            |
| `S3_FORCE_PATH_STYLE`               | No       | Force path-style URLs (`true` / `false`, default: inferred from endpoint) |
| `MODAL_ENDPOINT_URL`                | **Yes**  | Deployed Modal web endpoint (`…/trigger_job`)                             |
| `MODAL_CALLBACK_SECRET`             | **Yes**  | Shared secret used to authenticate Modal -> Convex webhook callbacks      |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Yes**  | Clerk publishable key                                                     |
| `CLERK_SECRET_KEY`                  | **Yes**  | Clerk secret key                                                          |

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
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

The presigned PUT URL is generated server-side, so the client uploads directly to R2, and the server never proxies binary data.

## Authentication

The app uses [Clerk](https://clerk.dev) for user authentication. You need to create a Clerk application and add the API keys to your `.env.local`.

1. Go to the [Clerk Dashboard](https://dashboard.clerk.dev) and create a new application.
2. Copy **Publishable key** and **Secret key** into your `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

These values match the app’s hardcoded routes, so the app works out of the box once the two Clerk keys above are set.

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

### Connecting Clerk to Convex (Auth Setup)

To allow Convex to securely read and authenticate Clerk users, you must configure a secure handshake between them:

1. In the **Clerk Dashboard**, navigate to **Configure > Session Management > JWT Templates**.
2. Click **New Template** and select **Convex**.
3. Under the claims JSON editor, you can remove unnecessary fields to keep the token light. Adjust it to only keep your preferred claims:

```json
{
  "aud": "convex",
  "email": "{{user.primary_email_address}}",
  "picture": "{{user.image_url}}",
  "updated_at": "{{user.updated_at}}"
}
```

4. Save the template. Copy the **Issuer URL** provided by Clerk (e.g., `https://your-instance.clerk.accounts.dev`).
5. Set this Issuer URL in your Convex environment variables as `CLERK_JWT_ISSUER_DOMAIN` (see instructions below).

### Environment variables in Convex

Convex functions run in the cloud, **not** inside Next.js. Because of that, **`.env.local` variables are not available to Convex actions or mutations**. You must set the same variables directly in Convex.

Set them via the CLI (from the project root):

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN=<your-clerk-issuer-url>
npx convex env set S3_BUCKET_NAME=<your-bucket>
npx convex env set S3_ACCESS_KEY_ID=<key>
npx convex env set S3_SECRET_ACCESS_KEY=<secret>
npx convex env set S3_PUBLIC_URL_BASE=<url>
npx convex env set MODAL_ENDPOINT_URL=<modal-endpoint>
npx convex env set MODAL_CALLBACK_SECRET=<secret>
```

Or set them in the **Convex Dashboard** → Settings → Environment Variables.

Required variables:

| Variable                  | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `CLERK_JWT_ISSUER_DOMAIN` | The Issuer URL from your Clerk Convex JWT Template |
| `S3_BUCKET_NAME`          | Target S3-compatible bucket                        |
| `S3_ACCESS_KEY_ID`        | Access key for the bucket                          |
| `S3_SECRET_ACCESS_KEY`    | Secret key for the bucket                          |
| `S3_PUBLIC_URL_BASE`      | Public-read URL base for generated object URLs     |
| `MODAL_ENDPOINT_URL`      | Deployed Modal web endpoint (`…/trigger_job`)      |
| `MODAL_CALLBACK_SECRET`   | Shared secret for Modal webhook callbacks          |

If you skip setting the S3 variables, actions like `triggerModalJob` will fail with a `Region is missing` error because the S3 SDK inside Convex has no credentials to work with. If you skip `CLERK_JWT_ISSUER_DOMAIN`, all user authentication checks within Convex will fail.

### How the flow works

1. The frontend requests a presigned S3 upload URL directly from a Convex action (`getFrontendUploadUrl`) and uploads the image.
2. The user clicks **Submit** — this calls the `createJob` Convex mutation to save the job record, followed by the `triggerModalJob` action.
3. `triggerModalJob` generates a secure presigned upload URL for the final output and passes it alongside a unique `MODAL_CALLBACK_SECRET` to the external Modal worker.
4. The Modal worker processes the image, pushes the results back to a secure Convex HTTP endpoint (`/updateJobStatus`), and provides the secret header. The endpoint validates this secret and runs an `internalMutation` to update the job status.
5. The UI updates instantly because the frontend components are reactively subscribed to live Convex queries.
6. Deleting a job or clearing the queue triggers a single server-side action (`deleteJobAndFiles` or `clearCompletedWithFiles`). This securely verifies user ownership, deletes the corresponding files from S3 in a best-effort batch, and removes the database records entirely on the server.

### Notes

- `S3_PUBLIC_URL_BASE` is used consistently on both the frontend (via `lib/s3-url.ts`) and the Convex backend (via `getPublicUrl`) to build object URLs. It must be set for both environments.
- The Modal webhook (`/updateJobStatus`) requires the `x-callback-secret` header to match `MODAL_CALLBACK_SECRET`. Requests without a valid secret are rejected with `401`.
