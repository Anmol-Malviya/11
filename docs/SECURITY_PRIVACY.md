# PS16 - Security, Privacy, and Consent Architecture

## 1. Secrets Management
- All sensitive API keys (`ELEVENLABS_API_KEY`, `LLM_API_KEY`, `MONGODB_URI`, `SESSION_TOKEN_SECRET`) are strictly maintained on the FastAPI backend in secure environment variables.
- The Next.js frontend only accesses public configuration (`NEXT_PUBLIC_API_BASE_URL`).

## 2. Voice Cloning Consent Lifecycle
- Voice cloning is strictly forbidden without active, verifiable consent records.
- Consent records explicitly capture:
  - Subject owner ID
  - Voice model reference
  - Purpose: e.g. "Speak user-confirmed conversation replies"
  - Scope: "voice_cloning_and_generation"
  - Timestamp of grant
- Revoking consent via `DELETE /api/v1/voice-consents/{consent_id}` marks the record as `revoked` and immediately halts any future synthesis requests for that voice.

## 3. Media Dignity & Privacy
- Zero persistent storage of raw camera streams or audio files.
- Visual landmark processing occurs on the client device using MediaPipe Tasks Vision. Only compact numerical landmark metrics and validated gestures are transmitted.
- Conversation audio is processed in memory by the STT adapter and purged immediately after transcription.

## 4. Confirmation Gate & Agency
- The core ethical principle of PS16 is assistive empowerment without usurping user agency.
- The confirmation gate ensures that no inference output can bypass explicit user verification (Confirm, Edit, Reject, Cancel).

