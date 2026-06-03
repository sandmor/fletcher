import modal
import requests
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_model():
    """
    Downloads the weights and bakes them into the Modal image.
    This replaces the old @modal.build() class method.
    """
    import rembg
    rembg.new_session("birefnet-massive")

model_volume = modal.Volume.from_name("rembg-models", create_if_missing=True)

VOLUME_PATH = "/data/models"

api_image = modal.Image.debian_slim(python_version="3.11").uv_sync()

gpu_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04", 
        add_python="3.11"
    )
    .apt_install("libgl1", "libglib2.0-0")
    .uv_sync()
    .env({
        "U2NET_HOME": VOLUME_PATH
    })
)

app = modal.App(name="image-processor", image=api_image)

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

@app.cls(gpu="L4", scaledown_window=300, max_containers=1, image=gpu_image, volumes={VOLUME_PATH: model_volume}, enable_memory_snapshot=True)
class BiRefNetProcessor:
    @modal.enter(snap=True)
    def pre_warm_imports(self):
        logger.info("Build Phase: Freezing heavy imports into memory...")
        import rembg

    @modal.enter()
    def load_model(self):
        """
        Runs when a new container spins up. 
        Loads the session into GPU VRAM.
        """
        import rembg
        
        logger.info(f"Runtime Phase: Loading BiRefNet from {VOLUME_PATH}...")
        self.session = rembg.new_session("birefnet-massive")
        logger.info("Model loaded successfully.")

    @modal.method()
    def process_image_background(
        self,
        job_id: str,
        input_url: str,
        upload_url: str,
        download_url: str,
        callback_url: str,
        callback_secret: str | None = None,
    ):
        try:
            _send_callback(callback_url, {"jobId": job_id, "status": "processing"}, callback_secret)

            # Download the input image
            input_response = requests.get(input_url, timeout=60)
            input_response.raise_for_status()

            # Process the image automatically via our pre-loaded session
            import rembg
            output_bytes = rembg.remove(
                input_response.content, 
                session=self.session,
                alpha_matting=True,
                alpha_matting_foreground_threshold=240, # Pixels above this are strictly foreground
                alpha_matting_background_threshold=10,  # Pixels below this are strictly background
                alpha_matting_erode_size=10             # How much to erode the boundary to calculate the soft edge
            )

            # Upload the processed image
            upload_response = requests.put(
                upload_url,
                data=output_bytes,
                headers={"Content-Type": "image/png"},
                timeout=120,
            )
            upload_response.raise_for_status()

            _send_callback(
                callback_url,
                {"jobId": job_id, "status": "completed", "outputUrl": download_url},
                callback_secret,
            )
        except Exception as e:
            import traceback
            traceback.print_exc()
            _send_callback(
                callback_url,
                {"jobId": job_id, "status": "failed", "error": str(e)},
                callback_secret,
            )

# 3. The trigger endpoint
@app.function()
@modal.fastapi_endpoint(method="POST")
def trigger_job(data: dict):
    BiRefNetProcessor().process_image_background.spawn(
        data["jobId"],
        data["inputUrl"],
        data["uploadUrl"],
        data["downloadUrl"],
        data["callbackUrl"],
        data.get("callbackSecret"),
    )
    return {"message": "Job queued for processing."}