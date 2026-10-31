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
    yield

@pytest.mark.asyncio
async def test_health_and_readiness():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        r1 = await ac.get("/api/v1/health")
        assert r1.status_code == 200
        assert r1.json()["status"] == "healthy"

        r2 = await ac.get("/api/v1/ready")
        assert r2.status_code == 200
        assert r2.json()["ready"] is True

@pytest.mark.asyncio
async def test_session_lifecycle_and_termination():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create
        create_res = await ac.post("/api/v1/sessions", json={
            "language": "hi-en",
            "accessibility": {"text_scale": "large", "high_contrast": True}
        })
        assert create_res.status_code == 201
        session_id = create_res.json()["session_id"]
        assert session_id.startswith("sess_")
        assert create_res.json()["language"] == "hi-en"

        # Read
        get_res = await ac.get(f"/api/v1/sessions/{session_id}")
        assert get_res.status_code == 200
        assert get_res.json()["status"] == "active"

        # End
        end_res = await ac.post(f"/api/v1/sessions/{session_id}/end")
        assert end_res.status_code == 200
        assert end_res.json()["status"] == "ended"

        # Verify ended
        get_res2 = await ac.get(f"/api/v1/sessions/{session_id}")
        assert get_res2.json()["status"] == "ended"

@pytest.mark.asyncio
async def test_multimodal_inference_and_confirmation_gate():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Post inference with positive gesture and partner speech
        inf_res = await ac.post("/api/v1/inference", json={
            "session_id": "sess_test_1",
            "raw_transcript_text": "Would you like some water?",
            "detected_gesture": "thumbs_up",
            "lip_active": True,
            "language": "en"
        })
        assert inf_res.status_code == 200
        inf_data = inf_res.json()
        assert inf_data["needs_clarification"] is False
        assert len(inf_data["candidates"]) > 0
        candidate_1 = inf_data["candidates"][0]
        assert "Yes" in candidate_1["text"]

        # 2. Reject candidate test (TC-09: User rejects candidate -> no speech allowed)
        reject_res = await ac.post("/api/v1/sessions/sess_test_1/confirmations", json={
            "inference_id": inf_data["inference_id"],
            "candidate_id": candidate_1["candidate_id"],
            "action": "reject"
        })
        assert reject_res.status_code == 200
        assert reject_res.json()["status"] == "cancelled"

        # Attempting speech with cancelled confirmation must be blocked with 403 Forbidden
        blocked_speech = await ac.post("/api/v1/speech", json={
            "session_id": "sess_test_1",
            "confirmation_id": reject_res.json()["confirmation_id"],
            "voice_mode": "standard"
        })
        assert blocked_speech.status_code == 403

        # 3. Confirm candidate test (TC-10: User confirms -> speech succeeds)
        confirm_res = await ac.post("/api/v1/sessions/sess_test_1/confirmations", json={
            "inference_id": inf_data["inference_id"],
            "candidate_id": candidate_1["candidate_id"],
            "action": "confirm"
        })
        assert confirm_res.status_code == 200
        assert confirm_res.json()["status"] == "confirmed"
        conf_id = confirm_res.json()["confirmation_id"]

        # Valid confirmed speech generation
        speech_res = await ac.post("/api/v1/speech", json={
            "session_id": "sess_test_1",
            "confirmation_id": conf_id,
            "voice_mode": "standard"
        })
        assert speech_res.status_code == 200
        assert len(speech_res.content) > 100

@pytest.mark.asyncio
async def test_voice_consent_lifecycle_and_blocking():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        cloned_voice = "user_private_clone_id"
        
        # Fake a confirmed message
        conf_res = await ac.post("/api/v1/sessions/sess_test_1/confirmations", json={
            "inference_id": "dummy_inf",
            "action": "edit",
            "edited_text": "I am testing voice consent"
        })
        # Mock inference in DB for test
        memory_db.inferences["dummy_inf"] = {"candidates": []}
        conf_res = await ac.post("/api/v1/sessions/sess_test_1/confirmations", json={
            "inference_id": "dummy_inf",
            "action": "edit",
            "edited_text": "I am testing voice consent"
        })
        conf_id = conf_res.json()["confirmation_id"]

        # 1. Attempt to generate cloned voice without consent -> Must fail with 403
        unconsented = await ac.post("/api/v1/speech", json={
            "session_id": "sess_test_1",
            "confirmation_id": conf_id,
            "voice_mode": "cloned",
            "voice_id": cloned_voice
        })
        assert unconsented.status_code == 403

        # 2. Grant explicit consent
        grant_res = await ac.post("/api/v1/voice-consents", json={
            "voice_id": cloned_voice,
            "purpose": "Speak user-confirmed conversation replies",
            "scope": "voice_cloning_and_generation"
        })
        assert grant_res.status_code == 201
        consent_id = grant_res.json()["consent_id"]

        # Now cloned voice speech succeeds
        consented_speech = await ac.post("/api/v1/speech", json={
            "session_id": "sess_test_1",
            "confirmation_id": conf_id,
            "voice_mode": "cloned",
            "voice_id": cloned_voice
        })
        assert consented_speech.status_code == 200

        # 3. Revoke consent
        rev_res = await ac.delete(f"/api/v1/voice-consents/{consent_id}")
        assert rev_res.status_code == 204

        # Subsequent speech attempt with that clone is immediately blocked
        blocked_again = await ac.post("/api/v1/speech", json={
            "session_id": "sess_test_1",
            "confirmation_id": conf_id,
            "voice_mode": "cloned",
            "voice_id": cloned_voice
        })
        assert blocked_again.status_code == 403

