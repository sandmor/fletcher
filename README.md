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

| Variable               | Required | Description                                                               |
| ---------------------- | -------- | ------------------------------------------------------------------------- |
| `S3_BUCKET_NAME`       | **Yes**  | Target bucket                                                             |
| `S3_ACCESS_KEY_ID`     | **Yes**  | Access key                                                                |
| `S3_SECRET_ACCESS_KEY` | **Yes**  | Secret key                                                                |
| `S3_REGION`            | No       | Region (default: `auto`)                                                  |
| `S3_ENDPOINT`          | No       | Custom endpoint for MinIO / R2 / etc.                                     |
| `S3_PUBLIC_URL_BASE`   | No       | Explicit public-read URL base (overrides endpoint)                        |
| `S3_FORCE_PATH_STYLE`  | No       | Force path-style URLs (`true` / `false`, default: inferred from endpoint) |

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
```

The presigned PUT URL is generated server-side, so the client uploads directly to R2, and the server never proxies binary data.
