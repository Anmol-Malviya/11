import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import memory_db

@pytest.fixture(autouse=True)
def clean_memory():
    memory_db.sessions.clear()
    memory_db.confirmations.clear()
    memory_db.inferences.clear()
    memory_db.voice_consents.clear()
    memory_db.evaluations.clear()
    memory_db.user_phrases.clear()
    yield

@pytest.mark.asyncio
async def test_transcription_batch_and_languages():
    """TC-02, TC-03, TC-04: Transcribe speech in English, Hindi, and Hinglish"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        dummy_wav = b"RIFF....WAVEfmt ...."
        
        # English
        res_en = await ac.post(
            "/api/v1/transcriptions",
            data={"session_id": "sess_1", "language_hint": "en", "speaker_hint": "partner"},
            files={"audio_file": ("test.wav", dummy_wav, "audio/wav")}
        )
        assert res_en.status_code == 200
        assert "water" in res_en.json()["text"].lower()

        # Hindi
        res_hi = await ac.post(
            "/api/v1/transcriptions",
            data={"session_id": "sess_1", "language_hint": "hi", "speaker_hint": "partner"},
            files={"audio_file": ("test.wav", dummy_wav, "audio/wav")}
        )
        assert res_hi.status_code == 200
        assert "पानी" in res_hi.json()["text"]

        # Hinglish
        res_hien = await ac.post(
            "/api/v1/transcriptions",
            data={"session_id": "sess_1", "language_hint": "hi-en", "speaker_hint": "partner"},
            files={"audio_file": ("test.wav", dummy_wav, "audio/wav")}
        )
        assert res_hien.status_code == 200
        assert "water" in res_hien.json()["text"].lower()

@pytest.mark.asyncio
async def test_multimodal_vision_and_conflict_handling():
    """TC-05, TC-06, TC-07: Occluded vision, missing landmarks, and conflicting signals"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Submit visual features
        vf_res = await ac.post("/api/v1/visual-features", json={
            "session_id": "sess_1",
            "captured_at": "2026-10-31T12:00:00Z",
            "frame_window_ms": 500,
            "features": {
                "hand_landmarks": [],
                "face_landmarks": [],
                "gesture_label": "thumbs_down",
                "lip_motion_features": {"available": True, "mouth_open_detected": False, "lip_aspect_ratio": 0.18}
            }
        })
        assert vf_res.status_code == 202
        feat_id = vf_res.json()["feature_id"]

        # Negative gesture with positive query (TC-07 conflict handling)
        inf_res = await ac.post("/api/v1/inference", json={
            "session_id": "sess_1",
            "visual_feature_ids": [feat_id],
            "raw_transcript_text": "Do you want this?",
            "detected_gesture": "thumbs_down",
            "language": "en"
        })
        assert inf_res.status_code == 200
        candidates = inf_res.json()["candidates"]
        assert len(candidates) > 0
        # First candidate reflects negative gesture (No / not right now)
        assert "No" in candidates[0]["text"]

@pytest.mark.asyncio
async def test_quick_phrases_crud():
    """FR-015: User-managed assistive phrase shortcuts"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # List initial
        res = await ac.get("/api/v1/quick-phrases")
        assert res.status_code == 200
        initial_count = len(res.json())

        # Create
        new_p = await ac.post("/api/v1/quick-phrases", json={
            "text": "Doctor ko call karein",
            "category": "Urgent",
            "language": "hi-en"
        })
        assert new_p.status_code == 201
        pid = new_p.json()["phrase_id"]

        # Delete
        del_res = await ac.delete(f"/api/v1/quick-phrases/{pid}")
        assert del_res.status_code == 204

@pytest.mark.asyncio
async def test_evaluation_telemetry_and_metrics():
    """FR-017 & TC-16: Evaluation latency and WER telemetry recording"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Record event
        ev_res = await ac.post("/api/v1/evaluations/events", json={
            "test_run_id": "run_test_001",
            "scenario_id": "torgo_sample_12",
            "mode": "audio_plus_gesture_plus_lip",
            "wer": 0.14,
            "intent_top1": 0.88,
            "intent_top3": 0.98,
            "latency_ms": {"p50": 1380, "p95": 1720},
            "confirmation_actions": 1
        })
        assert ev_res.status_code == 202

        # Fetch metrics summary
        summary_res = await ac.get("/api/v1/evaluations/metrics")
        assert summary_res.status_code == 200
        data = summary_res.json()
        assert data["total_evaluations"] >= 1
        assert data["target_latency_achieved"] is True
        assert data["latency_p95_ms"] < 2000

