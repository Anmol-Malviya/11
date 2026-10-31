from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        env_prefix="PS16_"  # Namespace to avoid colliding with OS environment variables like DEBUG=WARN
    )

    APP_NAME: str = "PS16 Assistive Multimodal Conversation API"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = True
    
    # Security
    SESSION_TOKEN_SECRET: str = "ps16-dev-secret-key-32-characters-minimum-for-security"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # MongoDB
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "ps16_assistive_ai"
    USE_MOCK_DB: bool = True  # Auto-fallback to resilient in-memory store if MongoDB is not connected
    
    # AI Providers
    ELEVENLABS_API_KEY: Optional[str] = None
    ELEVENLABS_DEFAULT_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM" # Standard approved Rachel voice
    
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gemini-1.5-flash"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    
    # Latency & Limits
    MAX_AUDIO_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB
    MAX_INFERENCE_CONTEXT_SECONDS: int = 30
    DEFAULT_LANGUAGE: str = "hi-en"  # "en", "hi", "hi-en"

settings = Settings()
