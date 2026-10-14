from io import BytesIO
from pathlib import Path
from uuid import uuid4

from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from backend.core.config import Settings
from backend.core.exception import ValidationError
from backend.schemas.commerce import UploadResponse


def save_image(content: bytes, directory: str, filename: str) -> None:
    try:
        with Image.open(BytesIO(content)) as original:
            if (
                original.format not in {"JPEG", "PNG", "WEBP"}
                or original.width * original.height > 20000000
            ):
                raise ValidationError(
                    "Use a JPEG, PNG, or WebP image below 20 megapixels."
                )
            original.verify()
        with Image.open(BytesIO(content)) as original:
            image = original.convert("RGB")
            image.thumbnail((2000, 2000))
            path = Path(directory)
            path.mkdir(parents=True, exist_ok=True)
            image.save(path / filename, "WEBP", quality=88)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValidationError("Invalid image file.") from exc


class UploadService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def save(self, content: bytes) -> UploadResponse:
        if len(content) > 8 * 1024 * 1024:
            raise ValidationError("Images must be below 8 MiB.")
        filename = f"{uuid4()}.webp"
        await run_in_threadpool(save_image, content, self.settings.upload_dir, filename)
        return UploadResponse(url=f"/media/{filename}")
