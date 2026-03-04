from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import json
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# LLM Configuration
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
LLM_PROVIDER = "openai"
LLM_MODEL = "gpt-5.2"

# System prompt for the AI assistant
SYSTEM_PROMPT = """You are a fraud risk scoring engine for an e-commerce customer support system.

Your task is to analyze the FULL conversation and return a structured fraud risk score from 0 to 100.

You must strictly return valid JSON only.

Risk Scoring Rules:

Base risk score = 5

Add risk points using these rules:

+60 → User requests refund immediately without providing order ID
+40 → User repeatedly asks for refund in same session
+30 → User uses urgency like "right now", "immediately", "ASAP"
+25 → User avoids answering verification questions
+20 → Aggressive tone or threats
+15 → Inconsistent order details
+10 → Account is new (if mentioned)

Low Risk Indicators:

+5 → Normal tracking request
+5 → Polite tone
+0 → Simple informational query

Rules:
- Risk score must NEVER be 0
- Minimum score = 5
- Maximum score = 100
- Combine all applicable rules
- Do NOT guess missing information
- If no fraud indicators, return 5

Return strictly this JSON format:

{
  "intent": "track_order | refund_request | replace_order | return_request | cancel_order | address_change | other",
  "confidence": 0.0-1.0,
  "risk_score": number,
  "risk_level": "Low | Medium | High | Critical",
  "response": "Your helpful, empathetic response to the customer",
  "reason": "One concise explanation based on applied rules"
}

Risk Level Mapping:
0-20 → Low
21-50 → Medium
51-75 → High
76-100 → Critical

Confidence Scoring:
- 0.9-1.0: Very clear intent ("track my order", "I want a refund")
- 0.7-0.9: Clear intent with context
- 0.5-0.7: Ambiguous intent
- <0.5: Unclear intent

Response Guidelines:
- Be empathetic and professional
- If confidence > 0.7 and intent is clear: Route directly, don't ask clarifying questions
- If confidence < 0.7: Ask ONE clarifying question
- For refunds, mention both instant wallet and bank transfer options
- NEVER ask "what happened?" if the user already explained the issue

Return ONLY valid JSON. No markdown, no extra text.
"""


# Define Models
class ConversationMessage(BaseModel):
    role: str  # "user" or "assistant" or "system"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    conversation_history: List[Dict[str, str]]  # Full conversation history
    session_id: str


class ChatResponse(BaseModel):
    intent: str
    confidence: float
    risk_score: int
    risk_level: str
    response: str
    reason: str
    conversation_history: List[Dict[str, str]]


# Helper functions
async def calculate_risk_score(conversation_history: List[Dict[str, str]], current_intent: str) -> int:
    """
    Calculate dynamic risk score based on conversation history
    NEVER RETURNS 0 - Minimum score: 5 for tracking, 10 for all others
    Maximum score: 100
    """
    # Deterministic baseline based on intent
    if current_intent == 'track_order':
        risk_score = 5  # Normal tracking is low risk
    elif current_intent == 'refund_request':
        risk_score = 30  # Refund requests start higher
    else:
        risk_score = 10  # Default baseline for other intents
    
    # Count refund requests in conversation
    refund_count = sum(1 for msg in conversation_history 
                      if msg.get('role') == 'user' and 
                      any(word in msg.get('content', '').lower() 
                          for word in ['refund', 'money back']))
    
    # Get user messages only
    user_messages = [msg for msg in conversation_history if msg.get('role') == 'user']
    
    # RULE 1: Refund without order ID = 60+
    if current_intent == 'refund_request' and len(user_messages) <= 2:
        # Check if order ID mentioned
        has_order_id = False
        for msg in user_messages:
            content = msg.get('content', '')
            if 'order' in content.lower() and any(char.isdigit() for char in content):
                has_order_id = True
                break
        
        if not has_order_id:
            risk_score = 60  # Refund without order ID
            logging.info(f"Risk: Refund without order ID detected. Score: {risk_score}")
    
    # RULE 2: Multiple refunds in session = +20 each
    if refund_count >= 3:
        risk_score += 60  # 3+ refund attempts
        logging.info(f"Risk: Multiple refund attempts ({refund_count}). Added +60. Score: {risk_score}")
    elif refund_count == 2:
        risk_score += 20  # 2 refund attempts
        logging.info(f"Risk: Second refund attempt. Added +20. Score: {risk_score}")
    
    # RULE 3: Normal tracking stays 5-10
    if current_intent == 'track_order':
        # Keep tracking between 5-10
        risk_score = min(risk_score, 10)
    
    # Check for aggressive tone in recent messages
    recent_messages = conversation_history[-3:] if len(conversation_history) > 3 else conversation_history
    aggressive_words = ['give me', 'just refund', 'immediately', 'now', 'ridiculous', 'pathetic', 'worst']
    for msg in recent_messages:
        if msg.get('role') == 'user':
            content_lower = msg.get('content', '').lower()
            if any(word in content_lower for word in aggressive_words):
                risk_score += 20
                logging.info(f"Risk: Aggressive tone detected. Added +20. Score: {risk_score}")
                break
    
    # Check for detailed description (reduces risk but never below baseline)
    if user_messages:
        last_msg = user_messages[-1].get('content', '')
        if len(last_msg.split()) > 20:
            original_score = risk_score
            risk_score = max(10, risk_score - 10)  # Detailed description, min 10
            logging.info(f"Risk: Detailed description. Reduced from {original_score} to {risk_score}")
    
    # Ensure within bounds (NEVER 0)
    final_score = max(5, min(100, risk_score))
    
    logging.info(f"FINAL RISK SCORE: {final_score} (Intent: {current_intent}, Refund Count: {refund_count})")
    
    return final_score


async def call_llm_with_retry(chat: LlmChat, user_message: UserMessage, max_retries: int = 2) -> Dict[str, Any]:
    """
    Call LLM and retry once if JSON parsing fails
    NEVER returns risk_score: 0 - minimum is 10 on failure
    """
    for attempt in range(max_retries):
        try:
            response_text = await chat.send_message(user_message)
            
            # Try to parse as JSON
            # Clean response - remove markdown code blocks if present
            cleaned = response_text.strip()
            if cleaned.startswith('```json'):
                cleaned = cleaned[7:]
            if cleaned.startswith('```'):
                cleaned = cleaned[3:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            response_json = json.loads(cleaned)
            
            # Validate required fields
            required_fields = ['intent', 'confidence', 'risk_score', 'response', 'reason']
            if all(field in response_json for field in required_fields):
                # Ensure risk_score is never 0
                if response_json.get('risk_score', 0) == 0:
                    response_json['risk_score'] = 10
                    logging.warning("LLM returned risk_score: 0, overriding to 10")
                return response_json
            else:
                if attempt < max_retries - 1:
                    continue
                else:
                    raise ValueError("Missing required fields in response")
                    
        except json.JSONDecodeError as e:
            logging.error(f"JSON parsing failed (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                # Retry with explicit JSON request
                retry_message = UserMessage(
                    text="Please respond with ONLY valid JSON. No other text. Format: {\"intent\": \"...\", \"confidence\": 0.0, \"risk_score\": 10, \"response\": \"...\", \"reason\": \"...\"}"
                )
                response_text = await chat.send_message(retry_message)
                continue
            else:
                # Fallback response with risk_score = 10 (NEVER 0)
                logging.error("All retry attempts failed, using fallback with risk_score: 10")
                return {
                    "intent": "general",
                    "confidence": 0.5,
                    "risk_score": 10,  # Minimum baseline on failure
                    "response": "I want to help you with that. Could you provide more details about your order issue?",
                    "reason": "LLM response parsing failed - using fallback"
                }
    
    # If all retries fail, return fallback with risk_score = 10
    logging.error("Maximum retries exceeded, using fallback with risk_score: 10")
    return {
        "intent": "general",
        "confidence": 0.3,
        "risk_score": 10,  # NEVER 0 - minimum baseline
        "response": "I'm here to help. Please tell me more about what you need assistance with.",
        "reason": "LLM response parsing failed after all retries"
    }


# API Routes
@api_router.get("/")
async def root():
    return {"message": "Amazon AI Support Hub API - LLM Powered"}


@api_router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process chat message with full conversation history
    """
    try:
        # Validate conversation history
        if not request.conversation_history or len(request.conversation_history) == 0:
            raise HTTPException(status_code=400, detail="Conversation history is required")
        
        # Get the latest user message
        user_messages = [msg for msg in request.conversation_history if msg.get('role') == 'user']
        if not user_messages:
            raise HTTPException(status_code=400, detail="No user message found")
        
        latest_user_msg = user_messages[-1].get('content', '')
        
        # Initialize LLM chat with session
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=request.session_id,
            system_message=SYSTEM_PROMPT
        ).with_model(LLM_PROVIDER, LLM_MODEL)
        
        # Create user message for LLM
        # Include context from conversation history
        context_summary = ""
        if len(user_messages) > 1:
            context_summary = f"\\nPrevious messages: {len(user_messages) - 1}"
        
        user_message = UserMessage(
            text=f"User message: {latest_user_msg}{context_summary}\\n\\nRespond with valid JSON only."
        )
        
        # Call LLM with retry logic
        llm_response = await call_llm_with_retry(chat, user_message)
        
        # Calculate risk score dynamically
        calculated_risk_score = await calculate_risk_score(
            request.conversation_history,
            llm_response.get('intent', 'general')
        )
        
        # Override LLM risk score with our calculated one (more reliable)
        final_risk_score = max(calculated_risk_score, llm_response.get('risk_score', 10))
        
        # Ensure minimum risk score of 5 (NEVER 0)
        final_risk_score = max(5, final_risk_score)
        
        # Determine risk level based on score
        if final_risk_score <= 20:
            risk_level = "Low"
        elif final_risk_score <= 50:
            risk_level = "Medium"
        elif final_risk_score <= 75:
            risk_level = "High"
        else:
            risk_level = "Critical"
        
        # LOG RISK SCORE BEFORE SENDING TO FRONTEND
        logging.info(f"=== SENDING TO FRONTEND ===")
        logging.info(f"Session: {request.session_id}")
        logging.info(f"Intent: {llm_response.get('intent', 'general')}")
        logging.info(f"Risk Score: {final_risk_score}")
        logging.info(f"Risk Level: {risk_level}")
        logging.info(f"Confidence: {llm_response.get('confidence', 0.5)}")
        logging.info(f"===========================")
        
        # Store message in MongoDB
        conversation_doc = {
            "session_id": request.session_id,
            "timestamp": datetime.utcnow(),
            "user_message": latest_user_msg,
            "assistant_response": llm_response.get('response', ''),
            "intent": llm_response.get('intent', 'general'),
            "confidence": llm_response.get('confidence', 0.5),
            "risk_score": final_risk_score,
            "risk_level": risk_level,
            "reason": llm_response.get('reason', '')
        }
        await db.conversations.insert_one(conversation_doc)
        
        # Add assistant response to conversation history
        updated_history = request.conversation_history + [{
            "role": "assistant",
            "content": llm_response.get('response', '')
        }]
        
        return ChatResponse(
            intent=llm_response.get('intent', 'general'),
            confidence=llm_response.get('confidence', 0.5),
            risk_score=final_risk_score,
            risk_level=risk_level,
            response=llm_response.get('response', ''),
            reason=llm_response.get('reason', ''),
            conversation_history=updated_history
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@api_router.get("/conversation/{session_id}")
async def get_conversation(session_id: str):
    """
    Retrieve conversation history for a session
    """
    conversations = await db.conversations.find(
        {"session_id": session_id}
    ).sort("timestamp", 1).to_list(100)
    
    return {"session_id": session_id, "messages": conversations}


@api_router.delete("/conversation/{session_id}")
async def clear_conversation(session_id: str):
    """
    Clear conversation history (explicit new session)
    """
    result = await db.conversations.delete_many({"session_id": session_id})
    return {"deleted_count": result.deleted_count}


@api_router.get("/metrics")
async def get_metrics():
    """
    Get aggregated metrics
    """
    total_conversations = await db.conversations.count_documents({})
    avg_risk_score = await db.conversations.aggregate([
        {"$group": {"_id": None, "avg_risk": {"$avg": "$risk_score"}}}
    ]).to_list(1)
    
    return {
        "total_conversations": total_conversations,
        "average_risk_score": avg_risk_score[0]['avg_risk'] if avg_risk_score else 0,
        "timestamp": datetime.utcnow()
    }


# Include the router in the main app
app.include_router(api_router)
