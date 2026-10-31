# PS16 - Multimodal AI Processing Pipeline

```
           +-------------------------+
           | Partner Microphone Audio|
           +------------+------------+
                        |
                        v
     +--------------------------------------+
     | ElevenLabs Scribe STT (Batch/Realtime)|
     +------------------+-------------------+
                        |
                        | transcript segments (text, speaker, timestamps)
                        v
     +--------------------------------------+
     |       Multimodal Fusion Service      |<----+ Camera Video (Client-Side)
     | - Temporal alignment (500ms windows) |     |
     | - Missing/occlusion detection        |     v
     | - Conflict detection (speech vs sign)|  +------------------------------------+
     +------------------+-------------------+  | MediaPipe Tasks Vision             |
                        |                      | - Hand Landmarker (gestures)       |
                        | fused context packet | - Face Landmarker (lip aspect ratio)|
                        v                      +------------------------------------+
     +--------------------------------------+
     | LLM Candidate Ranking & Reasoning    |
     | - Strict JSON schema validation      |
     | - Generates 2-4 candidate replies    |
     | - Uncertainty & clarification policy |
     +------------------+-------------------+
                        |
                        v
     +--------------------------------------+
     |     HUMAN CONFIRMATION GATE          |
     |  (Confirm / Edit / Reject / Cancel)  |
     +------------------+-------------------+
                        |
                        | Immutable confirmed text ONLY
                        v
     +--------------------------------------+
     |  Voice Cloning Consent Check         |
     |  (Verifies active non-revoked grant) |
     +------------------+-------------------+
                        |
                        v
     +--------------------------------------+
     | ElevenLabs Multilingual TTS / Speech |
     +--------------------------------------+
```

## Multimodal Safeguards
1. **Explicit Uncertainty State**: The system returns `needs_clarification=true` instead of hallucinating when inputs conflict or are occluded.
2. **Untrusted Transcript Content**: Dialogue transcripts are treated strictly as conversational data, preventing prompt injection attacks on the LLM.
3. **No Autonomous Vocalization**: Responses are never vocalized without explicit user confirmation or editing.

