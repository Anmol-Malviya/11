import logging
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

logger = logging.getLogger("ps16.database")

class InMemoryStore:
    """Resilient in-memory database fallback for test environments or demo mode."""
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.transcriptions: Dict[str, Dict[str, Any]] = {}
        self.visual_features: Dict[str, Dict[str, Any]] = {}
        self.inferences: Dict[str, Dict[str, Any]] = {}
        self.confirmations: Dict[str, Dict[str, Any]] = {}
        self.voice_consents: Dict[str, Dict[str, Any]] = {}
        self.user_phrases: Dict[str, Dict[str, Any]] = {}
        self.preferences: Dict[str, Dict[str, Any]] = {}
        self.evaluations: List[Dict[str, Any]] = []

memory_db = InMemoryStore()
_mongo_client: Optional[AsyncIOMotorClient] = None
_mongo_db: Optional[AsyncIOMotorDatabase] = None

async def init_db() -> bool:
    global _mongo_client, _mongo_db
    if settings.USE_MOCK_DB:
        logger.info("Using in-memory database store (demo/test mode)")
        return True
    try:
        _mongo_client = AsyncIOMotorClient(settings.MONGODB_URI, serverSelectionTimeoutMS=2000)
        _mongo_db = _mongo_client[settings.MONGODB_DATABASE]
        # Quick ping to verify connectivity
        await _mongo_client.admin.command('ping')
        logger.info("Successfully connected to MongoDB Atlas")
        return True
    except Exception as e:
        logger.warning(f"MongoDB connection failed: {e}. Falling back to in-memory store.")
        return False

async def close_db():
    global _mongo_client
    if _mongo_client:
        _mongo_client.close()
        logger.info("MongoDB client closed")

def get_db():
    return _mongo_db

