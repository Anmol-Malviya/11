# PS16 - API Specification

Base URL: `/api/v1`

## Endpoints

### 1. Sessions Lifecycle
- `POST /sessions` - Initialize conversation session with language mode & accessibility preferences.
- `GET /sessions/{session_id}` - Retrieve active session status and metadata.
- `PATCH /sessions/{session_id}` - Update session settings (language, active voice mode).
- `POST /sessions/{session_id}/end` - Close conversation session and clean up transient buffers.
- `DELETE /sessions/{session_id}` - Purge session records according to retention policy.

### 2. Transcription
- `POST /transcriptions` - Submit recorded partner audio segment for ElevenLabs Scribe STT.
- `POST /realtime/transcription-token` - Mint single-use token for direct client-side Scribe websocket.

### 3. Visual Landmarks & Features
- `POST /visual-features` - Ingest client-computed normalized MediaPipe landmarks & gestures.

### 4. Multimodal Fusion & Inference
- `POST /inference` - Execute temporal fusion between transcript segments and visual feature packets to generate ranked candidate responses.
- `GET /inference/{inference_id}` - Fetch status and candidates for an inference task.

### 5. Confirmation Gate
- `POST /sessions/{session_id}/confirmations` - Explicitly `confirm`, `edit`, `reject`, or `cancel` a candidate reply.

### 6. Speech Generation
- `POST /speech` - Synthesize speech using ElevenLabs TTS for confirmed replies. Validates confirmation ID and active voice consent.

### 7. Voice & Consent Management
- `GET /voices` - List available approved voices (standard synthetic + consented cloned).
- `POST /voice-consents` - Store explicit voice cloning consent grant.
- `DELETE /voice-consents/{consent_id}` - Immediately revoke consent for a voice reference.

### 8. User Preferences & Quick Phrases
- `GET /preferences` & `PATCH /preferences` - Manage accessibility and linguistic preferences.
- `GET /quick-phrases`, `POST /quick-phrases`, `PATCH /quick-phrases/{id}`, `DELETE /quick-phrases/{id}` - CRUD for customizable assistive tiles.

### 9. Evaluation & Observability
- `POST /evaluations/events` - Log privacy-minimized latency and interaction events.
- `GET /evaluations/metrics` - Retrieve aggregate WER, latency, and intent accuracy metrics.
- `GET /health` & `GET /ready` - Health and readiness probes.

### 10. WebSocket Contract
- `/ws/sessions/{session_id}` - Realtime event bus for partial transcripts, visual status updates, and speech playback triggers.

