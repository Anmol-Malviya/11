# SRS Traceability Matrix: PS16 Multimodal Live Conversation Assistant

**Version:** 1.0  
**Baseline Date:** October 31, 2026  
**Document Standard:** AI Manthan 2.0 PS16 Developer SRS & Antigravity Guide  

---

## 1. Functional Requirements Traceability (FR-001 to FR-017)

| SRS ID | Requirement Summary | Implementation Files / Modules | Proposed API Route / Event | Test Case ID | Status & Verification |
|---|---|---|---|---|---|
| **FR-001** | **Session Lifecycle**: Create, retrieve, and end conversation sessions with ownership verification. | `backend/app/api/v1/sessions.py`<br>`backend/app/core/database.py`<br>`frontend/src/app/conversation/page.tsx` | `POST /sessions`<br>`GET /sessions/{id}`<br>`PATCH /sessions/{id}`<br>`POST /sessions/{id}/end` | `TC-14`, `TC-15` | Implemented |
| **FR-002** | **Microphone Capture**: Explicit permission request, audio streaming/capture, clear fallback when unavailable. | `frontend/src/lib/audio.ts`<br>`frontend/src/app/onboarding/page.tsx`<br>`frontend/src/components/AudioVisualizer.tsx` | Browser MediaDevices API | `TC-01` | Implemented |
| **FR-003** | **Partner Transcription**: Transcribe conversation partner speech with partial/committed distinction. | `backend/app/api/v1/transcriptions.py`<br>`backend/app/services/elevenlabs_service.py`<br>`backend/app/api/v1/websocket.py` | `POST /transcriptions`<br>`POST /realtime/transcription-token`<br>`WS transcript.*` | `TC-02`, `TC-03`, `TC-04` | Implemented |
| **FR-004** | **Patient Speech Evidence**: Separate evidence stream for patient's atypical vocalizations without mislabeling. | `backend/app/schemas/transcription.py`<br>`backend/app/services/fusion_service.py` | `POST /transcriptions`<br>`speaker_hint="patient"` | `TC-02` | Implemented |
| **FR-005** | **Visual Landmark Extraction**: Derive hand, face, and lip-related landmarks from permitted camera frames. | `frontend/src/lib/vision.ts`<br>`frontend/src/components/CameraLandmarkFeed.tsx`<br>`backend/app/api/v1/visual_features.py` | `POST /visual-features`<br>`WS vision.status` | `TC-05`, `TC-06` | Implemented |
| **FR-006** | **Visual Feature Interpretation**: Map supported patterns to normalized gesture/movement features. Mark unknown as unknown. | `frontend/src/lib/vision.ts`<br>`backend/app/services/mediapipe_contract.py` | `POST /visual-features` | `TC-05` | Implemented |
| **FR-007** | **Temporal Alignment**: Align transcript segments and visual feature windows using timestamps. | `backend/app/services/fusion_service.py` | `POST /inference` | `TC-06`, `TC-16` | Implemented |
| **FR-008** | **Multimodal Fusion**: Combine transcript, visual evidence, and dialogue context for intent inference. | `backend/app/services/fusion_service.py`<br>`backend/app/api/v1/inference.py` | `POST /inference` | `TC-06`, `TC-07` | Implemented |
| **FR-009** | **LLM Candidate Ranking**: Return bounded list of plausible candidate replies with rationale and uncertainty score. | `backend/app/services/intent_service.py`<br>`backend/app/schemas/inference.py` | `POST /inference`<br>`GET /inference/{id}` | `TC-07`, `TC-08` | Implemented |
| **FR-010** | **Clarification & Ambiguity**: Ask for clarification or return "not sure" when confidence is low or signals conflict. | `backend/app/services/intent_service.py`<br>`frontend/src/components/ReplyCandidates.tsx` | `POST /inference` (`needs_clarification=true`) | `TC-07` | Implemented |
| **FR-011** | **Reply Confirmation Gate**: Confirm, edit, reject, and cancel actions. Only confirmed/edited message can be spoken. | `backend/app/api/v1/confirmations.py`<br>`frontend/src/components/ReplyCandidates.tsx` | `POST /sessions/{id}/confirmations` | `TC-09`, `TC-10` | Implemented |
| **FR-012** | **Speech Generation**: ElevenLabs text-to-speech for user-confirmed response text only. | `backend/app/api/v1/speech.py`<br>`backend/app/services/elevenlabs_service.py` | `POST /speech` | `TC-09`, `TC-10`, `TC-13` | Implemented |
| **FR-013** | **Voice Consent Verification**: Require active consent before cloned voice usage; immediate block on revocation. | `backend/app/api/v1/voice_consents.py`<br>`backend/app/services/consent_service.py` | `POST /voice-consents`<br>`DELETE /voice-consents/{id}` | `TC-11`, `TC-12` | Implemented |
| **FR-014** | **Language Selection**: Expose English, Hindi, and Hinglish/code-mixed language modes. | `backend/app/schemas/sessions.py`<br>`frontend/src/app/settings/page.tsx` | `POST /sessions`<br>`PATCH /preferences` | `TC-03`, `TC-04` | Implemented |
| **FR-015** | **Quick Phrases**: Accessible user-managed saved phrases for instant selection. | `backend/app/api/v1/quick_phrases.py`<br>`frontend/src/app/phrases/page.tsx` | `GET /quick-phrases`<br>`POST /quick-phrases`<br>`DELETE /quick-phrases/{id}` | `TC-09` | Implemented |
| **FR-016** | **Session Termination & Deletion**: End session and apply privacy/data retention policies. | `backend/app/api/v1/sessions.py`<br>`backend/app/core/database.py` | `POST /sessions/{id}/end`<br>`DELETE /sessions/{id}` | `TC-14` | Implemented |
| **FR-017** | **Evaluation Telemetry**: Record privacy-minimized latency, WER, intent accuracy, and confirmation actions. | `backend/app/api/v1/evaluations.py`<br>`backend/app/services/metrics_service.py`<br>`frontend/src/app/evaluation/page.tsx` | `POST /evaluations/events`<br>`GET /evaluations/metrics` | `TC-16` | Implemented |

---

## 2. Non-Functional Requirements Traceability (NFR-01 to NFR-09)

| NFR ID | Requirement Summary | Implementation Mechanism | Verification Method | Status |
|---|---|---|---|---|
| **NFR-01** | **Latency (<2s Target)** | Timestamp recording at utterance end, inference completion, and audio synthesis readiness. Fast local landmark inference. | Latency telemetry benchmark test (`TC-16`). | Verified |
| **NFR-02** | **Availability & Resilience** | Graceful degradation if camera or external AI services fail. Fallback text input & local demo synthesis. | Fault injection tests (`TC-01`, `TC-05`, `TC-13`). | Verified |
| **NFR-03** | **Accessibility** | Large touch targets (≥48px), high contrast mode, keyboard accessibility (tab index & shortcut keys), screen reader labels. | Accessibility audit & UI inspection (`AccessibilityControls.tsx`). | Verified |
| **NFR-04** | **Privacy** | Zero raw media persistence by default; client-side landmark extraction; optional session data purge. | Audit of Mongo collections & network payloads. | Verified |
| **NFR-05** | **Security** | API keys kept strictly server-side; opaque session tokens; CORS restrictions; Pydantic request validation. | Security code review & authorization unit tests. | Verified |
| **NFR-06** | **Scalability** | Bounded context windows, limited audio segment lengths, compact normalized visual vectors. | Payload size & timeout enforcement. | Verified |
| **NFR-07** | **Browser Compatibility** | Modern WebRTC / MediaDevices support, WebGL/WASM MediaPipe inference with fallback. | Cross-browser standards compliance. | Verified |
| **NFR-08** | **Maintainability** | Clean modular separation: adapters, domain services, Pydantic schemas, and typed API clients. | Linting & structured architecture. | Verified |
| **NFR-09** | **Observability** | Request IDs, stage timing headers, sanitized logs without PII or raw media. | Log & error format verification. | Verified |

---

## 3. Test Cases Coverage (TC-01 to TC-16)

| Test ID | Scenario | Verification Module | Automated Test File | Result |
|---|---|---|---|---|
| **TC-01** | Microphone permission denied | Frontend fallback to text / manual input | `frontend` & `backend/tests/test_api.py` | Pass |
| **TC-02** | Partner speech in English | ElevenLabs Scribe transcription mock/live | `backend/tests/test_transcription.py` | Pass |
| **TC-03** | Hindi speech recognition | Multilingual language hint validation | `backend/tests/test_transcription.py` | Pass |
| **TC-04** | Hinglish/code-mixed utterance | Code-mixed dialogue context test | `backend/tests/test_inference.py` | Pass |
| **TC-05** | Hand occluded / camera unavailable | Vision feature missing signal handling | `backend/tests/test_vision.py` | Pass |
| **TC-06** | Face/lip landmarks unavailable | Multimodal inference proceeds on audio | `backend/tests/test_inference.py` | Pass |
| **TC-07** | Audio and gesture conflict | System triggers `needs_clarification=True` | `backend/tests/test_inference.py` | Pass |
| **TC-08** | LLM malformed JSON recovery | Resilient schema parsing & fallback | `backend/tests/test_inference.py` | Pass |
| **TC-09** | User rejects candidate | TTS is NOT called; response cancelled | `backend/tests/test_confirmation.py` | Pass |
| **TC-10** | User edits then confirms | Only modified text is sent to TTS | `backend/tests/test_confirmation.py` | Pass |
| **TC-11** | Cloned voice used without consent | Request rejected with 403 Forbidden | `backend/tests/test_consent.py` | Pass |
| **TC-12** | Voice consent revoked | Subsequent synthesis with clone blocked | `backend/tests/test_consent.py` | Pass |
| **TC-13** | ElevenLabs API failure/rate limit | Graceful 502/503 status; text preserved | `backend/tests/test_speech.py` | Pass |
| **TC-14** | Session ended & cleaned up | Session marked `ended`; cleanup triggered | `backend/tests/test_sessions.py` | Pass |
| **TC-15** | Cross-user session access | 404/403 returned; no info leaked | `backend/tests/test_sessions.py` | Pass |
| **TC-16** | Latency benchmark measurement | Stage timings reported for p50/p95 | `backend/tests/test_evaluations.py` | Pass |

