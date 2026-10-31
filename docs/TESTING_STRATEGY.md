# PS16 - Testing Strategy & Verification Protocol

## 1. Automated Test Levels
- **Unit & Service Tests (`backend/tests/test_api.py`)**: Tests isolated components, database fallback, health probes, and session lifecycle.
- **Multimodal & Feature Tests (`backend/tests/test_features.py`)**: Tests ElevenLabs transcription in multiple languages (EN/HI/HI-EN), gesture processing, conflict handling, quick phrases, and telemetry metrics.
- **Confirmation & Consent Gates**: Verifies that unconfirmed candidates, rejected actions, and unconsented cloned voices strictly return HTTP 403 Forbidden.

## 2. Test Cases Mapping
- **TC-01**: Microphone permission denied -> Fallback to text input.
- **TC-02**: Partner speech in English -> ElevenLabs Scribe transcription.
- **TC-03**: Hindi speech recognition -> Multilingual transcription support.
- **TC-04**: Hinglish code-mixed dialogue -> Contextual candidate generation.
- **TC-05**: Hand occluded / camera unavailable -> Graceful audio-only inference.
- **TC-06**: Lip landmarks unavailable -> Robust degradation.
- **TC-07**: Conflicting audio and gesture -> System returns `needs_clarification=true`.
- **TC-08**: Malformed LLM output -> Resilient JSON parsing.
- **TC-09**: User rejects candidate -> TTS request blocked.
- **TC-10**: User edits candidate -> Confirmed modified text sent to TTS.
- **TC-11**: Cloned voice without consent -> HTTP 403 Forbidden.
- **TC-12**: Revoked voice consent -> Subsequent TTS calls blocked.
- **TC-13**: External service error -> Graceful error envelope.
- **TC-14**: Session ended -> Resources and temporary memory cleared.
- **TC-15**: Cross-user session access -> HTTP 403/404 without information leakage.
- **TC-16**: Latency benchmark -> Median and p95 logged and evaluated against the <2.0s target.

