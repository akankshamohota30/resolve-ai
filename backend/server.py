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
SYSTEM_PROMPT = """You are Aza, Amazon India's AI customer service assistant. You help customers with orders, returns, refunds, tracking, and address changes.

CRITICAL INSTRUCTIONS:
1. Always return VALID JSON in this exact format:
{
  "intent": "track_order|replace_order|refund_request|return_request|cancel_order|address_change|general",
  "confidence": 0.0-1.0,
  "risk_score": 5-100,
  "response": "your helpful response here",
  "reason": "brief explanation of risk score"
}

2. Intent Detection Rules:
   - "track_order": User wants to know order location/status
   - "replace_order": User wants new item sent
   - "refund_request": User explicitly asks for refund/money back
   - "return_request": User wants to return an item
   - "cancel_order": User wants to cancel order
   - "address_change": User wants to change delivery address
   - "general": Other queries

3. Confidence Scoring:
   - 0.9-1.0: Very clear intent ("track my order", "I want a refund")
   - 0.7-0.9: Clear intent with context
   - 0.5-0.7: Ambiguous intent
   - <0.5: Unclear intent

4. Risk Scoring (5-100):
   Base score: 5 (minimum for all requests)
   
   Add points for:
   - Immediate refund without order ID: +40
   - Multiple refund attempts in conversation: +30
   - Aggressive/demanding tone: +20
   - Vague issue description: +15
   - Immediate refund as first message: +35
   
   Subtract points for:
   - Detailed problem description: -10
   - Provides order ID: -10
   - Polite tone: -5
   - Normal tracking request: keep at 5-15
   
   Never return risk_score: 0 (minimum is 5)

5. Response Guidelines:
   - If confidence > 0.7 and intent is clear: Route directly, don't ask clarifying questions
   - If confidence < 0.7: Ask ONE clarifying question
   - Be empathetic and professional
   - Offer specific next steps
   - For refunds, mention both instant wallet and bank transfer options

6. NEVER ask "what happened?" if the user already explained the issue
7. ALWAYS return valid JSON - no markdown, no extra text
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
    response: str
    reason: str
    conversation_history: List[Dict[str, str]]


# Helper functions
async def calculate_risk_score(conversation_history: List[Dict[str, str]], current_intent: str) -> int:
    """
    Calculate dynamic risk score based on conversation history
    Minimum score: 5
    Maximum score: 100
    """
    risk_score = 5  # Base minimum score
    
    # Count refund requests in conversation
    refund_count = sum(1 for msg in conversation_history 
                      if msg.get('role') == 'user' and 
                      any(word in msg.get('content', '').lower() 
                          for word in ['refund', 'money back']))
    
    # Check if first message is refund request
    if len(conversation_history) <= 2 and current_intent == 'refund_request':
        user_messages = [msg for msg in conversation_history if msg.get('role') == 'user']
        if len(user_messages) == 1:
            first_msg = user_messages[0].get('content', '').lower()
            if 'refund' in first_msg and len(first_msg.split()) < 10:
                risk_score += 40  # Immediate refund without context
    
    # Multiple refund attempts
    if refund_count >= 3:
        risk_score += 30
    elif refund_count == 2:
        risk_score += 15
    
    # Check for aggressive tone in recent messages
    recent_messages = conversation_history[-3:] if len(conversation_history) > 3 else conversation_history
    aggressive_words = ['give me', 'just refund', 'immediately', 'now', 'ridiculous', 'pathetic', 'worst']
    for msg in recent_messages:
        if msg.get('role') == 'user':
            content_lower = msg.get('content', '').lower()
            if any(word in content_lower for word in aggressive_words):
                risk_score += 20
                break
    
    # Check for detailed description (reduces risk)
    user_messages = [msg for msg in conversation_history if msg.get('role') == 'user']
    if user_messages:
        last_msg = user_messages[-1].get('content', '')
        if len(last_msg.split()) > 20:
            risk_score = max(5, risk_score - 10)  # Detailed description
    
    # Check for order ID mention (reduces risk)
    if any('order' in msg.get('content', '').lower() and 
           any(char.isdigit() for char in msg.get('content', ''))
           for msg in user_messages):
        risk_score = max(5, risk_score - 10)
    
    # Normal tracking requests should be low risk
    if current_intent == 'track_order' and risk_score < 20:
        risk_score = min(risk_score, 15)
    
    # Ensure within bounds
    return max(5, min(100, risk_score))


async def call_llm_with_retry(chat: LlmChat, user_message: UserMessage, max_retries: int = 2) -> Dict[str, Any]:
    """
    Call LLM and retry once if JSON parsing fails
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
                return response_json
            else:
                if attempt < max_retries - 1:
                    continue
                else:
                    raise ValueError("Missing required fields in response")
                    
        except json.JSONDecodeError as e:
            if attempt < max_retries - 1:
                # Retry with explicit JSON request
                retry_message = UserMessage(
                    text="Please respond with ONLY valid JSON. No other text. Format: {\"intent\": \"...\", \"confidence\": 0.0, \"risk_score\": 0, \"response\": \"...\", \"reason\": \"...\"}"
                )
                response_text = await chat.send_message(retry_message)
                continue
            else:
                # Fallback response
                return {
                    "intent": "general",
                    "confidence": 0.5,
                    "risk_score": 20,
                    "response": "I want to help you with that. Could you provide more details about your order issue?",
                    "reason": "Could not parse LLM response"
                }
    
    # If all retries fail, return fallback
    return {
        "intent": "general",
        "confidence": 0.3,
        "risk_score": 25,
        "response": "I'm here to help. Please tell me more about what you need assistance with.",
        "reason": "LLM response parsing failed after retries"
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
        final_risk_score = max(calculated_risk_score, llm_response.get('risk_score', 5))
        
        # Ensure minimum risk score of 5
        final_risk_score = max(5, final_risk_score)
        
        # Store message in MongoDB
        conversation_doc = {
            "session_id": request.session_id,
            "timestamp": datetime.utcnow(),
            "user_message": latest_user_msg,
            "assistant_response": llm_response.get('response', ''),
            "intent": llm_response.get('intent', 'general'),
            "confidence": llm_response.get('confidence', 0.5),
            "risk_score": final_risk_score,
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
