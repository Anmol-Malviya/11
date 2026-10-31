import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from app.core.config import settings
from app.schemas.models import CandidateReply

logger = logging.getLogger("ps16.intent")

class IntentService:
    """
    Ranks plausible candidate replies using conversational context and fused multimodal evidence.
    Supports real live Gemini LLM generation with transparent fallback to calibrated rules.
    """
    
    async def rank_candidates(
        self,
        fused_state: Dict[str, Any],
        language: str = "hi-en"
    ) -> Dict[str, Any]:
        
        transcript = fused_state.get("transcript_text", "")
        gesture = fused_state.get("gesture", "unknown")
        lip_active = fused_state.get("lip_active", False)
        signals_used = fused_state.get("signals_used", [])
        
        # 1. Check for genuine ambiguity or missing signals
        if not transcript and gesture == "unknown" and not lip_active:
            return {
                "needs_clarification": True,
                "candidates": [
                    CandidateReply(candidate_id="clarify_1", text="Could you repeat that?", reason="No clear audio or gesture detected", confidence=0.3),
                    CandidateReply(candidate_id="clarify_2", text="I'm here, please speak again.", reason="Clarification request", confidence=0.3)
                ],
                "signals_used": signals_used
            }

        # 2. Try live Gemini call if configured
        if settings.LLM_API_KEY and settings.LLM_API_KEY != "mock_key":
            try:
                candidates = await self._call_gemini_intent(transcript, gesture, lip_active, language)
                if candidates:
                    return {
                        "needs_clarification": False,
                        "candidates": candidates,
                        "signals_used": signals_used
                    }
            except Exception as e:
                logger.warning(f"Gemini API call failed, using rule fallback: {e}")

        # 3. Rule-based candidate generation fallback
        candidates = self._generate_rule_candidates(transcript, gesture, lip_active, language)
        needs_clarification = (gesture in ["unknown"] and not transcript)
            
        return {
            "needs_clarification": needs_clarification,
            "candidates": candidates,
            "signals_used": signals_used
        }

    async def _call_gemini_intent(self, transcript: str, gesture: str, lip_active: bool, language: str) -> Optional[List[CandidateReply]]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.LLM_MODEL}:generateContent?key={settings.LLM_API_KEY}"
        system_prompt = f"""You are an assistive AI partner for a person with speech impairment.
Conversation partner said: "{transcript}"
Observed user non-verbal gesture: "{gesture}"
Observed user lip movement: "{'active' if lip_active else 'inactive'}"
Language mode: {language} (en=English, hi=Hindi, hi-en=Hinglish)

Generate 3 plausible, natural, empathetic candidate responses the user might want to say.
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
                # Clean up if markdown code fence is returned
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
        language: str
    ) -> List[CandidateReply]:
        cands = []
        transcript_lower = transcript.lower()

        if language == "hi":
            if gesture in ["thumbs_up", "head_nod", "THUMBS_UP"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="हाँ, बिल्कुल। धन्यवाद।", reason="सकारात्मक इशारा और बातचीत संदर्भ।", confidence=0.88))
                cands.append(CandidateReply(candidate_id="cand_2", text="हाँ, मुझे यह चाहिए।", reason="सहमति विकल्प।", confidence=0.74))
                cands.append(CandidateReply(candidate_id="cand_3", text="थोड़ी देर में, कृपया।", reason="वैकल्पिक विचार।", confidence=0.45))
            elif gesture in ["thumbs_down", "head_shake", "THUMBS_DOWN"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="नहीं, शुक्रिया। मुझे आवश्यकता नहीं है।", reason="नकारात्मक संकेत और संवाद संदर्भ।", confidence=0.91))
                cands.append(CandidateReply(candidate_id="cand_2", text="अभी नहीं, बाद में।", reason="स्थगन उत्तर।", confidence=0.68))
                cands.append(CandidateReply(candidate_id="cand_3", text="मुझे कुछ और चाहिए।", reason="विकल्प।", confidence=0.50))
            else:
                cands.append(CandidateReply(candidate_id="cand_1", text="हाँ, मैं समझ रहा हूँ।", reason="सद्भाव उत्तर।", confidence=0.75))
                cands.append(CandidateReply(candidate_id="cand_2", text="कृपया थोड़ा और बताएँ।", reason="स्पष्टीकरण।", confidence=0.62))
                cands.append(CandidateReply(candidate_id="cand_3", text="मुझे थोड़ा समय चाहिए।", reason="प्रतीक्षा विकल्प।", confidence=0.55))

        elif language == "hi-en":
            if gesture in ["thumbs_up", "head_nod", "THUMBS_UP"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="Haan, definitely. Thanks!", reason="Positive gesture aligned with context.", confidence=0.89))
                cands.append(CandidateReply(candidate_id="cand_2", text="Yes, please help me with that.", reason="Affirmative agreement.", confidence=0.78))
                cands.append(CandidateReply(candidate_id="cand_3", text="Thoda time lagega, but yes.", reason="Alternative elaboration.", confidence=0.48))
            elif gesture in ["thumbs_down", "head_shake", "THUMBS_DOWN"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="Nahi, thank you. I'm fine right now.", reason="Negative gesture aligned with dialogue.", confidence=0.92))
                cands.append(CandidateReply(candidate_id="cand_2", text="Abhi nahi, thodi der baad.", reason="Deferral option.", confidence=0.70))
                cands.append(CandidateReply(candidate_id="cand_3", text="Mujhe kuch aur chahiye tha.", reason="Alternative request.", confidence=0.52))
            else:
                if "water" in transcript_lower or "paani" in transcript_lower:
                    cands.append(CandidateReply(candidate_id="cand_1", text="Haan, please thoda paani de dijiye.", reason="Contextually matches water inquiry.", confidence=0.86))
                    cands.append(CandidateReply(candidate_id="cand_2", text="Nahi, abhi pyas nahi hai. Thank you.", reason="Polite refusal for water.", confidence=0.75))
                    cands.append(CandidateReply(candidate_id="cand_3", text="Room temperature water milega?", reason="Clarification preference.", confidence=0.60))
                else:
                    cands.append(CandidateReply(candidate_id="cand_1", text="Yes, absolutely. Thank you.", reason="General positive candidate.", confidence=0.78))
                    cands.append(CandidateReply(candidate_id="cand_2", text="Nahi, I am comfortable.", reason="Polite status update.", confidence=0.71))
                    cands.append(CandidateReply(candidate_id="cand_3", text="Can you repeat once more?", reason="Clarification fallback.", confidence=0.50))
        
        else: # Standard English
            if gesture in ["thumbs_up", "head_nod", "THUMBS_UP"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="Yes, please. That would be very helpful.", reason="Positive hand/face gesture aligned with dialogue.", confidence=0.90))
                cands.append(CandidateReply(candidate_id="cand_2", text="Yes, I agree.", reason="Direct confirmation.", confidence=0.80))
                cands.append(CandidateReply(candidate_id="cand_3", text="Give me just a minute.", reason="Alternative response.", confidence=0.45))
            elif gesture in ["thumbs_down", "head_shake", "THUMBS_DOWN"]:
                cands.append(CandidateReply(candidate_id="cand_1", text="No, thank you. I am good.", reason="Negative gesture detected.", confidence=0.92))
                cands.append(CandidateReply(candidate_id="cand_2", text="Not right now, maybe later.", reason="Deferral response.", confidence=0.73))
                cands.append(CandidateReply(candidate_id="cand_3", text="I'd prefer something else.", reason="Alternative preference.", confidence=0.55))
            else:
                if "water" in transcript_lower:
                    cands.append(CandidateReply(candidate_id="cand_1", text="Yes, some water would be great, thank you.", reason="Directly matches drink inquiry.", confidence=0.87))
                    cands.append(CandidateReply(candidate_id="cand_2", text="No, I am not thirsty right now.", reason="Direct polite negative.", confidence=0.76))
                    cands.append(CandidateReply(candidate_id="cand_3", text="Could I have warm water, please?", reason="Nuanced preference.", confidence=0.65))
                else:
                    cands.append(CandidateReply(candidate_id="cand_1", text="Yes, I understand and agree.", reason="Standard conversation agreement.", confidence=0.78))
                    cands.append(CandidateReply(candidate_id="cand_2", text="No, that is not what I meant.", reason="Correction candidate.", confidence=0.68))
                    cands.append(CandidateReply(candidate_id="cand_3", text="Could you please elaborate?", reason="Clarification request.", confidence=0.55))

        return cands

intent_service = IntentService()
