import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from app.core.database import get_db, memory_db

# Memory fallback storage for conversations & messages
if not hasattr(memory_db, "conversations"):
    memory_db.conversations = {}
if not hasattr(memory_db, "messages"):
    memory_db.messages = {}

class ConversationService:
    @staticmethod
    async def create_conversation(title: str = "New Conversation", partner_name: str = "Partner") -> Dict[str, Any]:
        conv_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        conv_doc = {
            "id": conv_id,
            "title": title,
            "partner_name": partner_name,
            "created_at": created_at,
            "message_count": 0
        }
        
        db = get_db()
        if db is not None:
            try:
                await db["conversations"].insert_one(conv_doc.copy())
                return conv_doc
            except Exception:
                pass
                
        memory_db.conversations[conv_id] = conv_doc
        return conv_doc

    @staticmethod
    async def list_conversations() -> List[Dict[str, Any]]:
        db = get_db()
        if db is not None:
            try:
                cursor = db["conversations"].find({}, {"_id": 0}).sort("created_at", -1)
                convs = await cursor.to_list(length=100)
                # update count
                for c in convs:
                    c["message_count"] = await db["messages"].count_documents({"conversation_id": c["id"]})
                return convs
            except Exception:
                pass

        res = list(memory_db.conversations.values())
        res.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        for c in res:
            cid = c["id"]
            c["message_count"] = sum(1 for m in memory_db.messages.values() if m.get("conversation_id") == cid)
        return res

    @staticmethod
    async def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
        db = get_db()
        if db is not None:
            try:
                conv = await db["conversations"].find_one({"id": conv_id}, {"_id": 0})
                if conv:
                    conv["message_count"] = await db["messages"].count_documents({"conversation_id": conv_id})
                    return conv
            except Exception:
                pass

        conv = memory_db.conversations.get(conv_id)
        if conv:
            conv["message_count"] = sum(1 for m in memory_db.messages.values() if m.get("conversation_id") == conv_id)
        return conv

    @staticmethod
    async def delete_conversation(conv_id: str) -> bool:
        db = get_db()
        if db is not None:
            try:
                res1 = await db["conversations"].delete_one({"id": conv_id})
                await db["messages"].delete_many({"conversation_id": conv_id})
                return res1.deleted_count > 0
            except Exception:
                pass

        if conv_id in memory_db.conversations:
            del memory_db.conversations[conv_id]
            # delete messages
            to_del = [mid for mid, m in memory_db.messages.items() if m.get("conversation_id") == conv_id]
            for mid in to_del:
                del memory_db.messages[mid]
            return True
        return False

    @staticmethod
    async def add_message(conv_id: str, text: str, speaker: str, modality: str, gesture_label: Optional[str] = None, confidence: Optional[float] = None) -> Dict[str, Any]:
        msg_id = str(uuid.uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        msg_doc = {
            "id": msg_id,
            "conversation_id": conv_id,
            "text": text,
            "speaker": speaker,
            "modality": modality,
            "gesture_label": gesture_label,
            "confidence": confidence,
            "created_at": created_at
        }
        
        db = get_db()
        if db is not None:
            try:
                await db["messages"].insert_one(msg_doc.copy())
                await db["conversations"].update_one({"id": conv_id}, {"$inc": {"message_count": 1}})
                return msg_doc
            except Exception:
                pass

        memory_db.messages[msg_id] = msg_doc
        if conv_id in memory_db.conversations:
            memory_db.conversations[conv_id]["message_count"] = memory_db.conversations[conv_id].get("message_count", 0) + 1
        return msg_doc

    @staticmethod
    async def get_messages(conv_id: str, page: int = 1, page_size: int = 50) -> Dict[str, Any]:
        skip = (page - 1) * page_size
        db = get_db()
        if db is not None:
            try:
                total = await db["messages"].count_documents({"conversation_id": conv_id})
                cursor = db["messages"].find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).skip(skip).limit(page_size)
                msgs = await cursor.to_list(length=page_size)
                return {
                    "conversation_id": conv_id,
                    "total_messages": total,
                    "page": page,
                    "page_size": page_size,
                    "messages": msgs
                }
            except Exception:
                pass

        conv_msgs = [m for m in memory_db.messages.values() if m.get("conversation_id") == conv_id]
        conv_msgs.sort(key=lambda x: x.get("created_at", ""))
        total = len(conv_msgs)
        paginated = conv_msgs[skip:skip + page_size]
        return {
            "conversation_id": conv_id,
            "total_messages": total,
            "page": page,
            "page_size": page_size,
            "messages": paginated
        }

