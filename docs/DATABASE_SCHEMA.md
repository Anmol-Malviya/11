# PS16 - Database Schema & Data Models

Persistence engine: MongoDB Atlas (via Motor / Async PyMongo driver), with automated in-memory store fallback for isolated test suites and offline demo scenarios.

---

## 1. Document Collections

### 1.1 `users`
```json
{
  "_id": "ObjectId",
  "auth_subject": "user_opaque_id",
  "preferred_language": "hi-en",
  "accessibility": {
    "text_scale": "large",
    "high_contrast": true,
    "reduced_motion": false
  },
  "created_at": "2026-10-31T08:30:00Z",
  "updated_at": "2026-10-31T08:30:00Z"
}
```

### 1.2 `sessions`
```json
{
  "_id": "ObjectId",
  "session_id": "sess_89f0a21",
  "owner_id": "user_opaque_id",
  "status": "active", // "created", "active", "ended"
  "language": "hi-en", // "en", "hi", "hi-en"
  "accessibility": {
    "text_scale": "large",
    "high_contrast": false
  },
  "started_at": "2026-10-31T08:30:00Z",
  "ended_at": null,
  "retention_expires_at": "2026-11-01T08:30:00Z"
}
```

### 1.3 `voice_consents`
```json
{
  "_id": "ObjectId",
  "consent_id": "vc_001",
  "owner_id": "user_opaque_id",
  "voice_id": "user_consented_clone_v1",
  "purpose": "Speak user-confirmed conversation replies",
  "scope": "voice_cloning_and_generation",
  "consent_version": "v1",
  "status": "active", // "active", "revoked"
  "granted_at": "2026-10-31T08:30:00Z",
  "revoked_at": null
}
```

### 1.4 `user_phrases`
```json
{
  "_id": "ObjectId",
  "phrase_id": "qp_01",
  "owner_id": "user_opaque_id",
  "text": "Mujhe paani chahiye",
  "category": "Needs",
  "language": "hi-en",
  "created_at": "2026-10-31T08:30:00Z"
}
```

### 1.5 `evaluation_results`
```json
{
  "_id": "ObjectId",
  "test_run_id": "run_001",
  "scenario_id": "hinglish_ambiguous_01",
  "mode": "audio_plus_gesture_plus_lip",
  "wer": 0.14,
  "intent_top1": 0.88,
  "intent_top3": 0.98,
  "latency_ms": {
    "p50": 1380,
    "p95": 1720
  },
  "confirmation_actions": 1,
  "created_at": "2026-10-31T08:35:00Z"
}
```

---

## 2. Retention and Deletion Guarantees
- Zero camera video frames or raw voice audio are retained in the database by default.
- Session records expire automatically via MongoDB TTL indexes on `retention_expires_at`.
- Direct call to `DELETE /api/v1/sessions/{session_id}` immediately cleans up all session memory.

