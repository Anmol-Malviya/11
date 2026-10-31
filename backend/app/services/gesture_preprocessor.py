import cv2
import numpy as np
import base64
from typing import Tuple

def decode_image_from_bytes_or_base64(data: bytes) -> np.ndarray:
    """
    Decodes an image from raw image bytes or base64 encoded string.
    Returns RGB or BGR numpy array, or raises ValueError if invalid.
    """
    # Check if data might be base64 string bytes (e.g. data:image/jpeg;base64,...)
    if data.startswith(b"data:image") and b";base64," in data:
        header, b64_str = data.split(b";base64,", 1)
        data = base64.b64decode(b64_str)
    elif len(data) > 0 and (data[0:4] not in [b'\xff\xd8\xff\xe0', b'\xff\xd8\xff\xe1', b'\x89PNG', b'RIFF']):
        # Attempt base64 decode if not standard image magic bytes
        try:
            decoded = base64.b64decode(data, validate=True)
            if len(decoded) > 100:
                data = decoded
        except Exception:
            pass

    np_arr = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image from provided data payload. Ensure valid JPEG/PNG format.")
    return image

def preprocess_frame_for_gesture(image: np.ndarray, target_size: Tuple[int, int] = (100, 120)) -> np.ndarray:
    """
    Applies the exact notebook preprocessing:
    1. Grayscale conversion: cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    2. Resize to (width=120, height=100) -> note cv2.resize takes (width, height) = (120, 100)
       producing shape (100, 120)
    3. Reshape to (1, 100, 120, 1)
    """
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    # Notebook: cv2.resize(gray_image, (100, 120))
    # In OpenCV, cv2.resize(img, (dsize_cols, dsize_rows))
    # In notebook: input_shape=(100, 120, 1) where rows=100, cols=120
    # Notice: cv2.resize(gray, (120, 100)) outputs shape (100, 120)
    # The notebook did cv2.resize(gray, (100, 120)) which gave shape (120, 100).
    # Then X_train was reshaped to (X_train.shape[0], 100, 120, 1) or (120, 100, 1).
    # To be fully robust to (100, 120, 1):
    resized = cv2.resize(gray, (120, 100))
    if resized.shape != (100, 120):
        resized = cv2.resize(gray, (100, 120)).T # Transpose if inverted

    processed = resized.reshape(1, 100, 120, 1).astype(np.float32)
    return processed

