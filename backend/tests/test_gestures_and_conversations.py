import base64
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.gesture_model import get_gesture_model
from app.services.gesture_preprocessor import decode_image_from_bytes_or_base64, preprocess_frame_for_gesture

client = TestClient(app)

@pytest.fixture
def sample_image_bytes():
    # Create synthetic test image (200x200 3-channel RGB)
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    cv2.circle(img, (100, 100), 50, (255, 255, 255), -1)
    _, buffer = cv2.imencode('.jpg', img)
    return buffer.tobytes()

@pytest.fixture
def sample_image_base64(sample_image_bytes):
    return "data:image/jpeg;base64," + base64.b64encode(sample_image_bytes).decode('utf-8')

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert data["classes_count"] == 6

def test_gestures_endpoint():
    response = client.get("/api/gestures")
    assert response.status_code == 200
    data = response.json()
    assert "classes" in data
    assert "default_phrases" in data
    assert len(data["classes"]) == 6
    assert data["classes"] == ['blank', 'ok', 'thumbsup', 'thumbsdown', 'fist', 'five']
    assert data["default_phrases"]["thumbsup"] == "Yes, I agree"
    assert data["default_phrases"]["fist"] == "I need assistance"

def test_preprocessing(sample_image_bytes):
    decoded = decode_image_from_bytes_or_base64(sample_image_bytes)
    assert decoded is not None
    processed = preprocess_frame_for_gesture(decoded)
    assert processed.shape == (1, 100, 120, 1)

def test_predict_endpoint_json(sample_image_base64):
    response = client.post(
        "/api/gesture/predict",
        json={"image_base64": sample_image_base64, "confidence_threshold": 0.50}
    )
    assert response.status_code == 200
    data = response.json()
    assert "predicted_gesture" in data
    assert "confidence" in data
    assert "probabilities" in data
    assert len(data["probabilities"]) == 6
    assert data["predicted_gesture"] in ['blank', 'ok', 'thumbsup', 'thumbsdown', 'fist', 'five']

def test_predict_endpoint_invalid_image():
    response = client.post(
        "/api/gesture/predict",
        json={"image_base64": "invalid_corrupt_base64"}
    )
    assert response.status_code in [400, 422]

def test_conversations_flow():
    # 1. Create conversation
    create_res = client.post(
        "/api/conversations",
        json={"title": "Test Doctor Visit", "partner_name": "Dr. Sarah"}
    )
    assert create_res.status_code == 201
    conv = create_res.json()
    conv_id = conv["id"]
    assert conv["title"] == "Test Doctor Visit"

    # 2. Add message from user (gesture)
    msg_res1 = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={
            "text": "Yes, I agree",
            "speaker": "user",
            "modality": "gesture",
            "gesture_label": "thumbsup",
            "confidence": 0.94
        }
    )
    assert msg_res1.status_code == 201
    msg1 = msg_res1.json()
    assert msg1["text"] == "Yes, I agree"
    assert msg1["gesture_label"] == "thumbsup"

    # 3. Add message from partner (typed/speech)
    msg_res2 = client.post(
        f"/api/conversations/{conv_id}/messages",
        json={
            "text": "Great, let's proceed with the checkup.",
            "speaker": "partner",
            "modality": "typed"
        }
    )
    assert msg_res2.status_code == 201

    # 4. Retrieve messages
    list_msgs = client.get(f"/api/conversations/{conv_id}/messages?page=1&page_size=10")
    assert list_msgs.status_code == 200
    msgs_data = list_msgs.json()
    assert msgs_data["total_messages"] == 2
    assert len(msgs_data["messages"]) == 2

    # 5. List conversations
    convs_res = client.get("/api/conversations")
    assert convs_res.status_code == 200
    assert any(c["id"] == conv_id for c in convs_res.json())

    # 6. Delete conversation
    del_res = client.delete(f"/api/conversations/{conv_id}")
    assert del_res.status_code == 200

    # 7. Check 404 after delete
    get_del = client.get(f"/api/conversations/{conv_id}/messages")
    assert get_del.status_code == 404

