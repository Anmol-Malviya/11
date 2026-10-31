# Implementation Plan: PS16 Multimodal Live Conversation Assistant for People with Speech Impairments

**Version:** 1.0  
**Baseline Date:** October 31, 2026  
**Status:** In Progress / Active  
**Stack:** Next.js 14+ (App Router, Tailwind CSS, TypeScript, Lucide Icons, MediaPipe Tasks Vision) + FastAPI (Python 3.14, Pydantic v2, Motor/Async PyMongo) + MongoDB Atlas + ElevenLabs Scribe/TTS + LLM Multimodal Fusion.

---

## 1. Executive Summary & Goals
PS16 provides an assistive conversational platform for individuals experiencing atypical or impaired speech (due to ALS, Cerebral Palsy, Parkinson's, stroke, or laryngectomy). It fuses:
1. Conversation partner speech transcription (ElevenLabs Scribe / audio capture).
2. Non-verbal visual observations (Camera -> MediaPipe Hand and Face Landmarker, lip aspect metrics, nodding/gestures).
3. Conversational context and candidate intent ranking (LLM with strict JSON schema).
4. Uncompromising human-in-the-loop agency (Confirm / Edit / Reject / Cancel) before synthetic voice output (ElevenLabs TTS / standard synthesized voice).
5. Explicit voice cloning consent controls, zero unconsented raw media storage, and offline demo fallback mode.

---

## 2. Implementation Phases & Task Checklist

### Phase 1: Specifications, Traceability & Architecture Contracts
- [x] Extract and thoroughly analyze `PS16_Developer_SRS_and_Antigravity_Guide.pdf`.
- [x] Author `IMPLEMENTATION_PLAN.md` with complete checklist and task breakdown.
- [x] Author `SRS_TRACEABILITY.md` cross-referencing all 17 Functional Requirements (FR-001 to FR-017), Non-Functional Requirements (NFR-01 to NFR-09), and Test Cases (TC-01 to TC-16).
- [x] Author architectural documentation in `docs/`:
  - `docs/SRS.md`
  - `docs/ARCHITECTURE.md`
  - `docs/API_SPEC.md`
  - `docs/DATABASE_SCHEMA.md`
  - `docs/AI_PIPELINE.md`
  - `docs/SECURITY_PRIVACY.md`
  - `docs/TESTING_STRATEGY.md`
  - `docs/DEPLOYMENT.md`

### Phase 2: FastAPI Backend Core & MongoDB Setup
- [ ] Implement backend structure in `backend/`:
  - `backend/app/main.py`
  - `backend/app/core/config.py` (Pydantic Settings for Mongo URI, ElevenLabs, LLM keys, Demo Mode, CORS)
  - `backend/app/core/database.py` (Motor async connection with fallback to in-memory/mock storage for demo/tests)
  - `backend/app/core/security.py` (Opaque session token verification, rate limiter, ownership checks)
  - `backend/app/schemas/` (Pydantic models for sessions, transcriptions, vision features, inference, confirmations, speech, consent, phrases, metrics)
  - `backend/app/services/`:
    - `elevenlabs_service.py` (ElevenLabs Scribe batch adapter, TTS adapter, Voice design/listing)
    - `mediapipe_contract.py` (Landmark normalization & compact gesture/lip-movement interpretation)
    - `fusion_service.py` (Temporal window alignment between transcript segments and visual feature packets)
    - `intent_service.py` (LLM-based structured candidate generation with prompt injection protection & uncertainty score)
    - `consent_service.py` (Consent recording, verification, and revocation enforcement)
    - `metrics_service.py` (Privacy-minimized latency tracking, WER calculation, intent accuracy)
  - `backend/app/api/v1/`:
    - `health.py` (GET `/health`, GET `/ready`)
    - `sessions.py` (POST `/sessions`, GET `/sessions/{id}`, PATCH `/sessions/{id}`, POST `/sessions/{id}/end`, DELETE `/sessions/{id}`)
    - `transcriptions.py` (POST `/transcriptions`, POST `/realtime/transcription-token`)
    - `visual_features.py` (POST `/visual-features`)
    - `inference.py` (POST `/inference`, GET `/inference/{id}`)
    - `confirmations.py` (POST `/sessions/{id}/confirmations`)
    - `speech.py` (POST `/speech`)
    - `voices.py` (GET `/voices`)
    - `voice_consents.py` (POST `/voice-consents`, DELETE `/voice-consents/{id}`)
    - `preferences.py` (GET `/preferences`, PATCH `/preferences`)
    - `quick_phrases.py` (GET `/quick-phrases`, POST `/quick-phrases`, PATCH `/quick-phrases/{id}`, DELETE `/quick-phrases/{id}`)
    - `evaluations.py` (POST `/evaluations/events`, GET `/evaluations/metrics`)
    - `websocket.py` (/ws/sessions/{id} live bidirectional events)
- [ ] Write backend unit & integration tests with `pytest` covering TC-01 through TC-16.

### Phase 3: Next.js Frontend Application
- [ ] Initialize and structure Next.js App Router client in `frontend/`:
  - `frontend/src/app/layout.tsx` (Accessibility high contrast & text scaling support)
  - `frontend/src/app/page.tsx` (Landing & Welcome screen with permission checks)
  - `frontend/src/app/onboarding/page.tsx` (Microphone/Camera permission flow & setup)
  - `frontend/src/app/conversation/page.tsx` (Live conversation screen: partner transcript, patient speech, camera preview, gesture badges, suggested replies)
  - `frontend/src/app/phrases/page.tsx` (Quick phrases tile interface)
  - `frontend/src/app/settings/page.tsx` (Language, Voice mode, Consent management, Data deletion)
  - `frontend/src/app/evaluation/page.tsx` (Benchmark dashboard: WER, Latency, Intent Top-1/Top-3, Test Scenarios)
- [ ] Frontend Core Services & Components:
  - `frontend/src/components/LiveConversation.tsx`
  - `frontend/src/components/CameraLandmarkFeed.tsx` (MediaPipe vision landmark extraction)
  - `frontend/src/components/ReplyCandidates.tsx` (Confirm, Edit, Reject, Not Sure actions)
  - `frontend/src/components/AudioVisualizer.tsx`
  - `frontend/src/components/AccessibilityControls.tsx`
  - `frontend/src/lib/api.ts` (Typed backend client)
  - `frontend/src/lib/vision.ts` (MediaPipe client-side landmark processor with lip height/width ratio & gesture detection)
  - `frontend/src/lib/audio.ts` (Microphone recording & streaming helper)

### Phase 4: Multimodal Fusion & Clarification Pipeline
- [ ] Combine partner transcript with patient visual signals (nod, thumbs up/down, lip movement, open hand).
- [ ] Handle missing/occluded modalities gracefully (e.g. camera disabled -> audio-only inference).
- [ ] Flag conflicting evidence (e.g., negative gesture + affirmative transcript) with `needs_clarification=True`.
- [ ] Guarantee human confirmation gate: No audio synthesis is triggered until user explicitly confirms or edits.

### Phase 5: Voice Synthesis, Consent & Security
- [ ] ElevenLabs TTS synthesis tied to immutable confirmed text.
- [ ] Strict consent check for cloned voice IDs; block synthesis upon revoked consent.
- [ ] Demo fallback mode with standard synthetic audio when external credentials are absent.

### Phase 6: Automated Testing, Validation & Verification
- [ ] Run backend test suite via `pytest backend/tests`.
- [ ] Execute synthetic scenario benchmarks for WER, Intent Top-1/Top-3, and End-to-End Latency.
- [ ] Verify accessibility, keyboard navigation, and responsive layout across desktop and mobile viewports.

### Phase 7: Deployment Configuration & Documentation
- [ ] Environment configuration (`.env.example` for both backend and frontend).
- [ ] Complete `README.md` with step-by-step instructions for local running and cloud deployment (Vercel + Python host + MongoDB Atlas).
- [ ] Update `SRS_TRACEABILITY.md` with concrete verification evidence.

