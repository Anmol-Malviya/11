# PS16 - System Architecture

```mermaid
flowchart TD
    subgraph Browser ["Client: Next.js (App Router + TypeScript)"]
        UI["Accessible UI & Controls\n(Keyboard, High-Contrast, Screen Reader)"]
        Cam["Webcam & Camera Feed"]
        Mic["Microphone & MediaStream"]
        MP["MediaPipe Tasks Vision\n(Hand & Face Landmarker)"]
        AudioRec["Audio Segment Recorder / Streamer"]
        ConfirmUI["Confirm / Edit / Cancel Modal & TTS Player"]
        
        Cam --> MP
        Mic --> AudioRec
        MP -->|Compact Normalized Features| APIClient["API Client / WebSocket"]
        AudioRec -->|Audio Chunks| APIClient
        APIClient --> UI
        UI --> ConfirmUI
    end

    subgraph Backend ["FastAPI Application (Python 3.14)"]
        Router["API Gateway / Router (/api/v1)"]
        AuthLayer["Session & Token Auth Layer"]
        TransSvc["Transcription Service\n(Scribe Realtime & Batch)"]
        VisionSvc["Visual Feature & Landmarker Interpreter"]
        FusionSvc["Multimodal Fusion & Temporal Aligner"]
        LLMSvc["LLM Intent Ranking & Uncertainty Policy"]
        ConfirmGate["Human Confirmation Gate"]
        ConsentSvc["Voice Cloning Consent Enforcer"]
        TTSSvc["ElevenLabs TTS Service"]
        MetricSvc["Evaluation & Telemetry Service"]
        
        Router --> AuthLayer
        AuthLayer --> TransSvc
        AuthLayer --> VisionSvc
        VisionSvc & TransSvc --> FusionSvc
        FusionSvc --> LLMSvc
        LLMSvc --> ConfirmGate
        ConfirmGate -->|Only After User Confirmation| ConsentSvc
        ConsentSvc --> TTSSvc
        Router --> MetricSvc
    end

    subgraph External ["External Services & Storage"]
        ElevenLabs["ElevenLabs API\n(Scribe STT + Voice Generation)"]
        LLM["LLM Provider / Gemini / OpenAI\n(JSON Schema Intent Ranking)"]
        MongoDB["MongoDB Atlas / Local Motor DB\n(Sessions, Consents, Phrases, Metrics)"]
    end

    APIClient <-->|REST & WebSocket| Router
    TransSvc <--> ElevenLabs
    TTSSvc <--> ElevenLabs
    LLMSvc <--> LLM
    Backend <--> MongoDB
```

## Architectural Principles
1. **Human-in-the-Loop Supremacy**: The AI generates interpretations and candidate options. No audio speech is ever synthesized until explicit user confirmation or manual edit is received.
2. **On-Device Vision Inference**: Camera frames are processed on-device with MediaPipe to avoid uploading raw video streams to the cloud, minimizing network bandwidth and protecting patient dignity and privacy.
3. **Graceful Multimodal Degradation**: If camera feed or microphone is unavailable, the pipeline smoothly degrades to audio-only, visual-only, or accessible quick-phrase touch-based communication.
4. **Strict Consent Enforcement**: Cloned voices are strictly gated by cryptographically auditable consent records in MongoDB. Revocation takes effect immediately.

