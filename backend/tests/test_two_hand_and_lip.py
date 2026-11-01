import pytest
from app.services.intent_service import intent_service

@pytest.mark.asyncio
async def test_multimodal_water_both_thumbs_up():
    fused_state = {
        "transcript_text": "Would you like water or tea?",
        "gesture": "BOTH_THUMBS_UP",
        "lip_reading_words": ["water"],
        "lip_reading_status": "speaking",
        "lip_active": True,
        "signals_used": ["transcript", "lip_reading_visemes", "hand_landmarks"]
    }
    result = await intent_service.rank_candidates(fused_state, language="en")
    assert result["needs_clarification"] is False
    assert len(result["candidates"]) >= 2
    top = result["candidates"][0]
    assert "water" in top.text.lower()
    assert top.confidence >= 0.95
    assert "BOTH_THUMBS_UP" in top.reason

@pytest.mark.asyncio
async def test_two_hand_gestures_all_six():
    two_hand_cases = [
        ("BOTH_THUMBS_UP", "agree"),
        ("BOTH_THUMBS_DOWN", "disagree"),
        ("HAND_HEART", "love"),
        ("PALMS_TOGETHER", "request"),
        ("BOTH_OPEN_PALMS", "stop"),
        ("T_SHAPE", "break")
    ]
    for gesture, keyword in two_hand_cases:
        fused_state = {
            "transcript_text": "",
            "gesture": gesture,
            "lip_reading_words": [],
            "lip_reading_status": "resting",
            "lip_active": False,
            "signals_used": ["hand_landmarks"]
        }
        res = await intent_service.rank_candidates(fused_state, language="en")
        assert res["needs_clarification"] is False
        assert len(res["candidates"]) > 0
        cand = res["candidates"][0]
        assert cand.confidence >= 0.90
        assert gesture in cand.reason

