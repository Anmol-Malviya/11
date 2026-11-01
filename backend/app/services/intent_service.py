import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings
from app.schemas.models import CandidateReply

logger = logging.getLogger("ps16.intent")

class IntentService:
    """
    Ranks plausible candidate replies using conversational context, two-hand/single-hand gestures,
    and verified temporal viseme lip reading.
    Supports Groq (Llama 3.3 70B), Gemini, and robust rule-based contextual fallback.
    """
    
    async def rank_candidates(
        self,
        fused_state: Dict[str, Any],
        language: str = "hi-en"
    ) -> Dict[str, Any]:
        
        transcript = fused_state.get("transcript_text", "")
        gesture = fused_state.get("gesture", "unknown")
        lip_active = fused_state.get("lip_active", False)
        lip_words = fused_state.get("lip_reading_words", [])
        lip_status = fused_state.get("lip_reading_status", "resting")
        signals_used = fused_state.get("signals_used", [])
        
        # 1. Check for genuine ambiguity or missing signals
        if not transcript and gesture == "unknown" and not lip_active and not lip_words:
            return {
                "needs_clarification": True,
                "candidates": [
                    CandidateReply(candidate_id="clarify_1", text="Could you repeat that?", reason="No clear audio or gesture detected", confidence=0.3),
                    CandidateReply(candidate_id="clarify_2", text="I'm here, please speak again.", reason="Clarification request", confidence=0.3)
                ],
                "signals_used": signals_used
            }

        # 2. Try live Groq API call if configured
        if settings.GROQ_API_KEY:
            try:
                candidates = await self._call_groq_intent(transcript, gesture, lip_words, lip_status, language)
                if candidates:
                    return {
                        "needs_clarification": False,
                        "candidates": candidates,
                        "signals_used": signals_used
                    }
            except Exception as e:
                logger.warning(f"Groq API call failed: {e}")

        # 3. Try live Gemini call if configured
        if settings.LLM_API_KEY and settings.LLM_API_KEY != "mock_key":
            try:
                candidates = await self._call_gemini_intent(transcript, gesture, lip_words, lip_status, language)
                if candidates:
                    return {
                        "needs_clarification": False,
                        "candidates": candidates,
                        "signals_used": signals_used
                    }
            except Exception as e:
                logger.warning(f"Gemini API call notice: {e}")

        # 4. Calibrated rule-based candidate generation fallback
        candidates = self._generate_rule_candidates(transcript, gesture, lip_active, language, lip_words, lip_status)
        needs_clarification = (gesture in ["unknown"] and not transcript and not lip_words)
            
        return {
            "needs_clarification": needs_clarification,
            "candidates": candidates,
            "signals_used": signals_used
        }

    async def _call_groq_intent(
        self,
        transcript: str,
        gesture: str,
        lip_words: List[str],
        lip_status: str,
        language: str
    ) -> Optional[List[CandidateReply]]:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        prompt = f"""You are an assistive AI conversation engine for a person with speech impairment.
Partner's latest speech: "{transcript}"
Observed hand gesture: "{gesture}"
Observed lip reading prediction: "{', '.join(lip_words) if lip_words else 'None'}" (status: {lip_status})
Language target: {language} (en=English, hi=Hindi, hi-en=Hinglish)

Return STRICT JSON array with up to 3 candidate messages the user intended to say.
Each object MUST have:
- "candidate_id": string (e.g. "cand_1", "cand_2", "cand_3")
- "text": string (natural sentence in the specified language)
- "reason": string (grounded in gesture, lip, and dialogue context)
- "confidence": number between 0.0 and 1.0

Output valid JSON only with NO markdown fences."""

        payload = {
            "model": settings.GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }

        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["choices"][0]["message"]["content"].strip()
                if raw_text.startswith("```"):
                    raw_text = raw_text.strip("`")
                    if raw_text.startswith("json"):
                        raw_text = raw_text[4:].strip()
                items = json.loads(raw_text)
                return [CandidateReply(**item) for item in items]
        return None

    async def _call_gemini_intent(
        self,
        transcript: str,
        gesture: str,
        lip_words: List[str],
        lip_status: str,
        language: str
    ) -> Optional[List[CandidateReply]]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL}:generateContent?key={settings.LLM_API_KEY}"
        system_prompt = f"""You are an assistive AI partner for a person with speech impairment.
Conversation partner said: "{transcript}"
Observed user hand gesture: "{gesture}"
Observed lip words: "{', '.join(lip_words) if lip_words else 'None'}" (status: {lip_status})
Language mode: {language} (en=English, hi=Hindi, hi-en=Hinglish)

Generate 3 plausible candidate responses the user might want to say.
Return STRICT JSON array with 3 objects, each having keys:
- candidate_id (e.g. "cand_1", "cand_2", "cand_3")
- text (string in the selected language)
- reason (short explanation of why this fits the fused evidence)
- confidence (number between 0.0 and 1.0)
Do NOT include markdown formatting or backticks. Return raw JSON array only."""

        payload = {
            "contents": [{"parts": [{"text": system_prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 600}
        }
        
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                if raw_text.startswith("```"):
                    raw_text = raw_text.strip("`")
                    if raw_text.startswith("json"):
                        raw_text = raw_text[4:].strip()
                items = json.loads(raw_text)
                return [CandidateReply(**item) for item in items]
        return None

    def _generate_rule_candidates(
        self,
        transcript: str,
        gesture: str,
        lip_active: bool,
        language: str,
        lip_words: Optional[List[str]] = None,
        lip_status: str = "resting"
    ) -> List[CandidateReply]:
        cands = []
        transcript_lower = transcript.lower()
        lip_words = lip_words or []
        gesture_upper = gesture.upper()

        # Multimodal Fusion 1: Lip reading + Gesture + Dialogue Context Alignment
        if lip_words and lip_status == "speaking":
            # Search across all recognized candidate viseme words
            all_lip_text = " ".join(lip_words).lower()
            
            if "water" in all_lip_text or "paani" in all_lip_text or "water" in transcript_lower:
                if gesture_upper in ["BOTH_THUMBS_UP", "THUMBS_UP"]:
                    if language == "hi":
                        cands.append(CandidateReply(candidate_id="cand_1", text="हाँ, मुझे पानी चाहिए। धन्यवाद।", reason="होठों के दृश्य विश्लेषण और दोनों अँगूठे ऊपर (सहमति) से प्रमाणित।", confidence=0.96))
                        cands.append(CandidateReply(candidate_id="cand_2", text="कृपया थोड़ा पानी दे दीजिए।", reason="प्रमाणित दृश्य वाक् पहचान।", confidence=0.88))
                    elif language == "hi-en":
                        cands.append(CandidateReply(candidate_id="cand_1", text="Yes, please. I would like some water.", reason=f"Fused lip prediction + {gesture_upper}.", confidence=0.97))
                        cands.append(CandidateReply(candidate_id="cand_2", text="Haan, please paani de dijiye.", reason="Visual speech + affirmative gesture.", confidence=0.89))
                    else:
                        cands.append(CandidateReply(candidate_id="cand_1", text="Yes, I would like water, please.", reason=f"Multimodal match: lip reading + {gesture_upper}.", confidence=0.98))
                        cands.append(CandidateReply(candidate_id="cand_2", text="Water please, thank you.", reason="Direct affirmative response.", confidence=0.90))
                    return cands
                elif gesture_upper in ["BOTH_THUMBS_DOWN", "THUMBS_DOWN"]:
                    cands.append(CandidateReply(candidate_id="cand_1", text="No water for me, thank you.", reason=f"Lip detected inquiry but negative gesture {gesture_upper}.", confidence=0.94))
                    cands.append(CandidateReply(candidate_id="cand_2", text="Not thirsty right now.", reason="Negative gesture alignment.", confidence=0.85))
                    return cands

            if "help" in all_lip_text or "madad" in all_lip_text or "pain" in all_lip_text:
                if language == "hi":
                    cands.append(CandidateReply(candidate_id="cand_1", text="मुझे मदद की आवश्यकता है। कृपया सहायता करें।", reason="होठों के दृश्य विश्लेषण से मदद का संकेत।", confidence=0.95))
                elif language == "hi-en":
                    cands.append(CandidateReply(candidate_id="cand_1", text="I need help right now, please.", reason="Visual speech recognition detected help request.", confidence=0.95))
                else:
                    cands.append(CandidateReply(candidate_id="cand_1", text="I need help, please assist me.", reason="Visual speech recognition detected help request.", confidence=0.96))
                return cands

            if "yes" in all_lip_text or "haan" in all_lip_text:
                if gesture_upper in ["BOTH_THUMBS_UP", "THUMBS_UP"]:
                    cands.append(CandidateReply(candidate_id="cand_1", text="Yes, absolutely agree.", reason="Affirmative lip articulation + thumbs up.", confidence=0.96))
                    return cands

        # Multimodal Fusion 2: Custom Two-Hand Gestures
        if gesture_upper == "BOTH_THUMBS_UP":
            if language == "hi":
                cands.append(CandidateReply(candidate_id="two_1", text="बिल्कुल हाँ! पूरी तरह सहमत।", reason="दोनों हाथों का अँगूठा ऊपर (प्रबल सहमति)।", confidence=0.97))
                cands.append(CandidateReply(candidate_id="two_2", text="हाँ, अवश्य करें।", reason="प्रबल सकारात्मक उत्तर।", confidence=0.85))
            elif language == "hi-en":
                cands.append(CandidateReply(candidate_id="two_1", text="Absolutely yes! Definitely agree.", reason="Two-hand gesture: BOTH_THUMBS_UP.", confidence=0.97))
                cands.append(CandidateReply(candidate_id="two_2", text="Haan, 100% yes!", reason="Strong positive agreement.", confidence=0.88))
            else:
                cands.append(CandidateReply(candidate_id="two_1", text="Absolutely yes! I strongly agree.", reason="Two-hand gesture: BOTH_THUMBS_UP.", confidence=0.98))
                cands.append(CandidateReply(candidate_id="two_2", text="Yes, perfectly fine with me.", reason="High-confidence agreement.", confidence=0.87))
            return cands

        elif gesture_upper == "BOTH_THUMBS_DOWN":
            if language == "hi":
                cands.append(CandidateReply(candidate_id="two_1", text="बिल्कुल नहीं! मैं सहमत नहीं हूँ।", reason="दोनों हाथों का अँगूठा नीचे (प्रबल असहमति)।", confidence=0.97))
            elif language == "hi-en":
                cands.append(CandidateReply(candidate_id="two_1", text="Absolutely not! I disagree completely.", reason="Two-hand gesture: BOTH_THUMBS_DOWN.", confidence=0.97))
            else:
                cands.append(CandidateReply(candidate_id="two_1", text="Absolutely not! Strong disagreement.", reason="Two-hand gesture: BOTH_THUMBS_DOWN.", confidence=0.98))
            return cands

        elif gesture_upper == "HAND_HEART":
            if language == "hi":
                cands.append(CandidateReply(candidate_id="two_1", text="मुझे आपसे स्नेह है। आपका बहुत धन्यवाद।", reason="दोनों हाथों से हृदय मुद्रा (स्नेह)।", confidence=0.95))
            elif language == "hi-en":
                cands.append(CandidateReply(candidate_id="two_1", text="I love you and appreciate you.", reason="Two-hand gesture: HAND_HEART.", confidence=0.96))
            else:
                cands.append(CandidateReply(candidate_id="two_1", text="I love you. Thank you for your care.", reason="Two-hand gesture: HAND_HEART.", confidence=0.96))
            return cands

        elif gesture_upper == "PALMS_TOGETHER":
            if language == "hi":
                cands.append(CandidateReply(candidate_id="two_1", text="कृपया, मेरा यह निवेदन स्वीकार करें।", reason="नमस्ते मुद्रा / दोनों हथेलियाँ साथ (अनुरोध)।", confidence=0.95))
            elif language == "hi-en":
                cands.append(CandidateReply(candidate_id="two_1", text="Please, I request your help.", reason="Two-hand gesture: PALMS_TOGETHER.", confidence=0.95))
            else:
                cands.append(CandidateReply(candidate_id="two_1", text="Please, I kindly request this.", reason="Two-hand gesture: PALMS_TOGETHER.", confidence=0.96))
            return cands

        elif gesture_upper == "BOTH_OPEN_PALMS":
            if language == "hi":
                cands.append(CandidateReply(candidate_id="two_1", text="तुरंत रुकिए! कृपया ठहरिए।", reason="दोनों खुली हथेलियाँ (प्रबल विराम संकेत)।", confidence=0.97))
            elif language == "hi-en":
                cands.append(CandidateReply(candidate_id="two_1", text="Stop immediately! Please pause.", reason="Two-hand gesture: BOTH_OPEN_PALMS.", confidence=0.97))
            else:
                cands.append(CandidateReply(candidate_id="two_1", text="Stop immediately! Please hold on.", reason="Two-hand gesture: BOTH_OPEN_PALMS.", confidence=0.98))
            return cands

        elif gesture_upper == "T_SHAPE":
            if language == "hi":
                cands.append(CandidateReply(candidate_id="two_1", text="मुझे थोड़ा विराम (break) चाहिए।", reason="टी-आकार मुद्रा (विराम अनुरोध)।", confidence=0.94))
            elif language == "hi-en":
                cands.append(CandidateReply(candidate_id="two_1", text="I need a break right now.", reason="Two-hand gesture: T_SHAPE.", confidence=0.95))
            else:
                cands.append(CandidateReply(candidate_id="two_1", text="Time out, I need a break.", reason="Two-hand gesture: T_SHAPE.", confidence=0.95))
            return cands

        # Multimodal Fusion 3: Single-Hand Gestures & Dialogue Context
        if language == "hi":
            if gesture_upper in ["THUMBS_UP", "HEAD_NOD"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="हाँ, बिल्कुल। धन्यवाद।", reason="सकारात्मक इशारा और बातचीत संदर्भ।", confidence=0.88))
                cands.append(CandidateReply(candidate_id="cand_2", text="हाँ, मुझे यह चाहिए।", reason="सहमति विकल्प।", confidence=0.74))
            elif gesture_upper in ["THUMBS_DOWN", "HEAD_SHAKE"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="नहीं, शुक्रिया। मुझे आवश्यकता नहीं है।", reason="नकारात्मक संकेत और संवाद संदर्भ।", confidence=0.91))
            elif gesture_upper == "CLOSED_FIST":
                cands.append(CandidateReply(candidate_id="cand_1", text="मुझे तुरंत सहायता चाहिए।", reason="मुट्ठी बंद (मदद की गुहार)।", confidence=0.93))
            elif gesture_upper == "PEACE_SIGN":
                cands.append(CandidateReply(candidate_id="cand_1", text="नमस्ते! आप कैसे हैं?", reason="अभिवादन संकेत।", confidence=0.90))
            else:
                if "water" in transcript_lower or "paani" in transcript_lower:
                    cands.append(CandidateReply(candidate_id="cand_1", text="हाँ, कृपया थोड़ा पानी दे दीजिए।", reason="पानी से संबंधित प्रश्न का संदर्भ।", confidence=0.85))
                else:
                    cands.append(CandidateReply(candidate_id="cand_1", text="हाँ, मैं समझ रहा हूँ।", reason="सद्भाव उत्तर।", confidence=0.75))

        elif language == "hi-en":
            if gesture_upper in ["THUMBS_UP", "HEAD_NOD"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="Haan, definitely. Thanks!", reason="Positive gesture aligned with context.", confidence=0.89))
                cands.append(CandidateReply(candidate_id="cand_2", text="Yes, please help me with that.", reason="Affirmative agreement.", confidence=0.78))
            elif gesture_upper in ["THUMBS_DOWN", "HEAD_SHAKE"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="Nahi, thank you. I'm fine right now.", reason="Negative gesture aligned with dialogue.", confidence=0.92))
            elif gesture_upper == "CLOSED_FIST":
                cands.append(CandidateReply(candidate_id="cand_1", text="I need help right now, please.", reason="Help gesture detected.", confidence=0.94))
            elif gesture_upper == "PEACE_SIGN":
                cands.append(CandidateReply(candidate_id="cand_1", text="Hello! Good to see you.", reason="Greeting gesture.", confidence=0.92))
            else:
                if "water" in transcript_lower or "tea" in transcript_lower or "paani" in transcript_lower:
                    cands.append(CandidateReply(candidate_id="cand_1", text="Haan, please thoda paani de dijiye.", reason="Contextually matches drink inquiry.", confidence=0.86))
                    cands.append(CandidateReply(candidate_id="cand_2", text="Nahi, abhi pyas nahi hai. Thank you.", reason="Polite refusal for drink.", confidence=0.75))
                else:
                    cands.append(CandidateReply(candidate_id="cand_1", text="Yes, absolutely. Thank you.", reason="General positive candidate.", confidence=0.78))

        else: # Standard English
            if gesture_upper in ["THUMBS_UP", "HEAD_NOD"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="Yes, please. That would be very helpful.", reason="Positive hand gesture aligned with dialogue.", confidence=0.90))
                cands.append(CandidateReply(candidate_id="cand_2", text="Yes, I agree.", reason="Direct confirmation.", confidence=0.80))
            elif gesture_upper in ["THUMBS_DOWN", "HEAD_SHAKE"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="No, thank you. I am good.", reason="Negative gesture detected.", confidence=0.92))
            elif gesture_upper == "CLOSED_FIST":
                cands.append(CandidateReply(candidate_id="cand_1", text="I need help, please.", reason="Emergency help gesture.", confidence=0.94))
            elif gesture_upper == "PEACE_SIGN":
                cands.append(CandidateReply(candidate_id="cand_1", text="Hello! How are you?", reason="Greeting gesture.", confidence=0.92))
            else:
                if "water" in transcript_lower or "tea" in transcript_lower:
                    cands.append(CandidateReply(candidate_id="cand_1", text="Yes, some water would be great, thank you.", reason="Directly matches drink inquiry.", confidence=0.88))
                    cands.append(CandidateReply(candidate_id="cand_2", text="No, I am not thirsty right now.", reason="Direct polite negative.", confidence=0.76))
                else:
                    cands.append(CandidateReply(candidate_id="cand_1", text="Yes, I understand and agree.", reason="Standard conversation agreement.", confidence=0.78))

        return cands

intent_service = IntentService()
