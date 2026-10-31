import cv2
import numpy as np
import base64
from typing import Tuple, Optional, Dict, Any

def decode_image_from_bytes_or_base64(data: bytes) -> np.ndarray:
    """
    Decodes an image from raw image bytes or base64 encoded string.
    Returns BGR numpy array, or raises ValueError if invalid.
    """
    if data.startswith(b"data:image") and b";base64," in data:
        _, b64_str = data.split(b";base64,", 1)
        data = base64.b64decode(b64_str)
    elif len(data) > 0 and (data[0:4] not in [b'\xff\xd8\xff\xe0', b'\xff\xd8\xff\xe1', b'\x89PNG', b'RIFF']):
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

def segment_hand_from_roi(roi_bgr: np.ndarray) -> Tuple[np.ndarray, bool, Dict[str, Any]]:
    """
    Segments the user's hand inside the Region of Interest (ROI).
    Uses adaptive skin-chroma filtering (HSV + YCrCb) with morphological closing
    and contour geometry analysis to accurately produce the exact thresholded binary
    hand mask expected by the CNN (255 for hand pixels, 0 for background).
    
    Returns:
        (preprocessed_100x120_binary_mask, hand_present, geometric_features)
    """
    h, w = roi_bgr.shape[:2]
    if h == 0 or w == 0:
        return np.zeros((100, 120), dtype=np.uint8), False, {}

    # 1. Spatial smoothing to reduce sensor noise
    blurred = cv2.GaussianBlur(roi_bgr, (5, 5), 0)

    # 2. Dual-space skin color detection (HSV + YCrCb)
    hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(blurred, cv2.COLOR_BGR2YCrCb)

    # HSV skin range
    lower_hsv = np.array([0, 18, 60], dtype=np.uint8)
    upper_hsv = np.array([28, 255, 255], dtype=np.uint8)
    mask_hsv = cv2.inRange(hsv, lower_hsv, upper_hsv)

    # YCrCb skin range (very robust across diverse skin tones and indoor lighting)
    lower_ycrcb = np.array([0, 133, 77], dtype=np.uint8)
    upper_ycrcb = np.array([255, 173, 127], dtype=np.uint8)
    mask_ycrcb = cv2.inRange(ycrcb, lower_ycrcb, upper_ycrcb)

    combined_mask = cv2.bitwise_and(mask_hsv, mask_ycrcb)

    # 3. Morphological operations to fill interior palm holes and remove fine noise
    kernel_ellipse = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    cleaned_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel_ellipse, iterations=1)
    cleaned_mask = cv2.morphologyEx(cleaned_mask, cv2.MORPH_CLOSE, kernel_ellipse, iterations=2)

    # 4. Contour extraction
    cnts, _ = cv2.findContours(cleaned_mask.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return np.zeros((100, 120), dtype=np.uint8), False, {}

    max_c = max(cnts, key=cv2.contourArea)
    area = cv2.contourArea(max_c)
    roi_area = float(h * w)
    area_ratio = area / roi_area

    # A hand filling the ROI occupies at least 8% and at most 92% of the ROI
    if area_ratio < 0.07 or area < 1000:
        return np.zeros((100, 120), dtype=np.uint8), False, {}

    # 5. Paint isolated largest hand contour onto pure binary mask
    hand_mask = np.zeros_like(cleaned_mask)
    cv2.drawContours(hand_mask, [max_c], -1, 255, -1)

    # 6. Extract geometric features for hybrid multi-cue validation
    # Bounding rect & aspect ratio
    x, y, bw, bh = cv2.boundingRect(max_c)
    aspect_ratio = float(bh) / max(1.0, float(bw))
    extent = float(area) / max(1.0, float(bw * bh))

    # Convex hull & defects
    hull = cv2.convexHull(max_c, returnPoints=False)
    deep_defects = 0
    if len(max_c) > 3 and hull is not None and len(hull) > 3:
        try:
            defects = cv2.convexityDefects(max_c, hull)
            if defects is not None:
                for row in defects:
                    d_pixel = row[3] / 256.0
                    if d_pixel > (min(h, w) * 0.06): # significant finger valley
                        deep_defects += 1
        except Exception:
            pass

    # Circularity (for fist vs open hand)
    perimeter = cv2.arcLength(max_c, True)
    circularity = (4 * np.pi * area) / max(1.0, (perimeter * perimeter))

    geo_features = {
        "area_ratio": area_ratio,
        "aspect_ratio": aspect_ratio,
        "extent": extent,
        "deep_defects": deep_defects,
        "circularity": circularity
    }

    # 7. Resize to exact training shape: 100 rows (height) x 120 cols (width)
    resized_hand = cv2.resize(hand_mask, (120, 100))

    return resized_hand, True, geo_features

def preprocess_frame_for_gesture(
    image: np.ndarray,
    target_size: Tuple[int, int] = (100, 120),
    return_details: bool = False
):
    """
    Complete end-to-end frame preprocessor:
    1. Extracts centered square ROI box (matching the green UI viewport guide).
    2. Runs adaptive hand segmentation to generate the thresholded binary mask.
    3. Normalizes to model tensor shape (1, 100, 120, 1).
    """
    h, w = image.shape[:2]

    # If the image passed is already a cropped ROI (approx square or <= 300px), use it directly
    if min(h, w) <= 300 and abs(h - w) < 60:
        roi = image
    else:
        # Extract centered ROI matching the frontend viewfinder box
        box_size = int(min(h, w) * 0.50)
        x1 = max(0, (w - box_size) // 2)
        y1 = max(0, (h - box_size) // 2)
        x2 = min(w, x1 + box_size)
        y2 = min(h, y1 + box_size)
        roi = image[y1:y2, x1:x2]

    binary_mask, hand_present, geo = segment_hand_from_roi(roi)

    # Tensor format: shape (1, 100, 120, 1), float32, range [0.0, 255.0]
    processed_tensor = binary_mask.reshape(1, 100, 120, 1).astype(np.float32)
    if return_details:
        return processed_tensor, hand_present, geo
    return processed_tensor
