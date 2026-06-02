import modal
import requests
import time
import logging

logger = logging.getLogger(__name__)

image = modal.Image.debian_slim(python_version="3.11").uv_sync()

app = modal.App(name="image-processor", image=image)

def _send_callback(
    callback_url: str,
    payload: dict,
    secret: str | None = None,
    max_retries: int = 5,
    backoff_base: float = 2.0,
):
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["x-callback-secret"] = secret

    last_error = None
    for attempt in range(max_retries):
        try:
            response = requests.post(callback_url, json=payload, headers=headers, timeout=10)

            # Success
            if response.status_code < 500:
                return

            # 5xx = transient server error (includes Convex "no workers"), retry
            last_error = f"HTTP {response.status_code}: {response.text[:200]}"
            logger.warning(f"Callback attempt {attempt + 1}/{max_retries} failed — {last_error}")

        except requests.exceptions.RequestException as e:
            last_error = str(e)
            logger.warning(f"Callback attempt {attempt + 1}/{max_retries} failed — {last_error}")

        if attempt < max_retries - 1:
            sleep_time = backoff_base ** attempt  # 1s, 2s, 4s, 8s ...
            logger.info(f"Retrying in {sleep_time:.1f}s...")
            time.sleep(sleep_time)

    logger.error(f"Callback failed after {max_retries} attempts. Last error: {last_error}")


@app.function()
def process_image_background(
    job_id: str,
    input_url: str,
    upload_url: str,
    download_url: str,
    callback_url: str,
    callback_secret: str | None = None,
):
    try:
        _send_callback(callback_url, {"jobId": job_id, "status": "processing"}, callback_secret)

        # TODO: Replace this placeholder with actual background-removal logic.
        # For now, download the input image and re-upload it so the output URL works.
        input_response = requests.get(input_url, timeout=60)
        input_response.raise_for_status()
        requests.put(
            upload_url,
            data=input_response.content,
            headers={"Content-Type": "image/png"},
            timeout=120,
        )

        _send_callback(
            callback_url,
            {"jobId": job_id, "status": "completed", "outputUrl": download_url},
            callback_secret,
        )
    except Exception:
        import traceback
        traceback.print_exc()
        _send_callback(
            callback_url,
            {"jobId": job_id, "status": "failed", "error": "Processing failed"},
            callback_secret,
        )


@app.function()
@modal.fastapi_endpoint(method="POST")
def trigger_job(data: dict):
    process_image_background.spawn(
        data["jobId"],
        data["inputUrl"],
        data["uploadUrl"],
        data["downloadUrl"],
        data["callbackUrl"],
        data.get("callbackSecret"),
    )
    return {"message": "Job queued for processing."}