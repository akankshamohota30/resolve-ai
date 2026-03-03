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
import random
import re


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    sender: str  # 'user' or 'bot'
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    message_type: str = "text"  # text, action, qr, tracking, form
    metadata: Optional[Dict[str, Any]] = None

class MessageCreate(BaseModel):
    text: str
    sender: str
    message_type: str = "text"
    metadata: Optional[Dict[str, Any]] = None

class AIResponse(BaseModel):
    messages: List[Message]
    intent: str
    requires_action: bool = False
    action_type: Optional[str] = None

class Metrics(BaseModel):
    ai_resolutions: int = 1284
    avg_resolution_time: str = "2 min 14 sec"
    csat_score: float = 4.7
    cost_saved: int = 288900

class Rating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    stars: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class RatingCreate(BaseModel):
    conversation_id: str
    stars: int

class ActionConfirm(BaseModel):
    action_type: str
    order_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# AI Triage Logic
def detect_intent(message: str) -> str:
    """Detect user intent from message"""
    message_lower = message.lower()
    
    # Missing package
    if any(keyword in message_lower for keyword in ["didn't receive", "not delivered", "missing package", "haven't received", "not received"]):
        return "missing_package"
    
    # Return
    if any(keyword in message_lower for keyword in ["return", "want to return", "send back"]):
        return "return"
    
    # Track
    if any(keyword in message_lower for keyword in ["where is", "track", "package status", "order status", "delivery status"]):
        return "track"
    
    # Cancel
    if any(keyword in message_lower for keyword in ["cancel", "cancel order", "cancel my order"]):
        return "cancel"
    
    # Change address
    if any(keyword in message_lower for keyword in ["change address", "wrong address", "update address", "delivery address"]):
        return "change_address"
    
    return "other"

def generate_order_id() -> str:
    """Generate random order ID"""
    return f"IND-{random.randint(100000, 999999)}"

def generate_ai_response(user_message: str, intent: str) -> AIResponse:
    """Generate AI response based on detected intent"""
    
    if intent == "missing_package":
        order_id = generate_order_id()
        amount = random.choice([1499, 2499, 3299, 4999])
        product = random.choice(["boAt Headphones", "Fire-Boltt Smartwatch", "Noise Earbuds", "pTron Earphones"])
        
        bot_message = Message(
            text=f"I found your order #{order_id} ({product} ₹{amount:,}). It shows delivered Dec 3rd but you haven't received it. I'm initiating an instant refund of ₹{amount:,} to your original payment method. Confirm?",
            sender="bot",
            message_type="action",
            metadata={"action": "refund_confirm", "order_id": order_id, "amount": amount}
        )
        
        return AIResponse(
            messages=[bot_message],
            intent=intent,
            requires_action=True,
            action_type="refund_confirm"
        )
    
    elif intent == "return":
        order_id = generate_order_id()
        
        bot_messages = [
            Message(
                text="I can schedule a free pickup return for your order. Here's your return QR code:",
                sender="bot",
                message_type="text"
            ),
            Message(
                text=f"QR Code for Order #{order_id}",
                sender="bot",
                message_type="qr",
                metadata={"order_id": order_id, "qr_data": f"RETURN-{order_id}"}
            ),
            Message(
                text="Pickup scheduled for tomorrow 10AM-2PM. Done!",
                sender="bot",
                message_type="text"
            )
        ]
        
        return AIResponse(
            messages=bot_messages,
            intent=intent,
            requires_action=False
        )
    
    elif intent == "track":
        order_id = generate_order_id()
        
        bot_message = Message(
            text="Here's your order tracking information:",
            sender="bot",
            message_type="tracking",
            metadata={
                "order_id": order_id,
                "steps": [
                    {"label": "Order Placed", "completed": True},
                    {"label": "Packed", "completed": True},
                    {"label": "Shipped", "completed": True},
                    {"label": "Out for Delivery", "completed": False, "current": True},
                    {"label": "Delivered", "completed": False}
                ],
                "eta": "Arriving today by 7PM"
            }
        )
        
        return AIResponse(
            messages=[bot_message],
            intent=intent,
            requires_action=False
        )
    
    elif intent == "cancel":
        order_id = generate_order_id()
        amount = random.choice([3299, 4299, 5499, 6999])
        product = random.choice(["Nike Shoes", "Adidas Sneakers", "Puma T-Shirt", "Levi's Jeans"])
        
        bot_message = Message(
            text=f"I found order #{order_id} ({product} ₹{amount:,}) — not yet shipped. Cancel it?",
            sender="bot",
            message_type="action",
            metadata={"action": "cancel_confirm", "order_id": order_id, "amount": amount}
        )
        
        return AIResponse(
            messages=[bot_message],
            intent=intent,
            requires_action=True,
            action_type="cancel_confirm"
        )
    
    elif intent == "change_address":
        bot_message = Message(
            text="Please enter your new delivery address:",
            sender="bot",
            message_type="form",
            metadata={"form_type": "address"}
        )
        
        return AIResponse(
            messages=[bot_message],
            intent=intent,
            requires_action=True,
            action_type="address_form"
        )
    
    else:
        ticket_id = random.randint(10000, 99999)
        bot_message = Message(
            text=f"I understand you're facing an issue. Let me connect you with a specialist. Ticket #TKT-{ticket_id} created. Expected response: 2 hours. Is there anything else I can help with?",
            sender="bot",
            message_type="text"
        )
        
        return AIResponse(
            messages=[bot_message],
            intent=intent,
            requires_action=False
        )


# API Routes
@api_router.get("/")
async def root():
    return {"message": "Amazon AI Support Hub API"}

@api_router.post("/chat", response_model=AIResponse)
async def chat(message_input: MessageCreate):
    """Process user message and return AI response"""
    # Save user message
    user_message = Message(**message_input.dict())
    await db.messages.insert_one(user_message.dict())
    
    # Detect intent and generate response
    intent = detect_intent(message_input.text)
    ai_response = generate_ai_response(message_input.text, intent)
    
    # Save bot messages
    for bot_message in ai_response.messages:
        await db.messages.insert_one(bot_message.dict())
    
    return ai_response

@api_router.post("/action/confirm")
async def confirm_action(action: ActionConfirm):
    """Handle action confirmations"""
    if action.action_type == "refund_confirm":
        amount = action.metadata.get("amount", 0)
        response_text = f"✅ Refund of ₹{amount:,} initiated! Credited in 3-5 business days. Resolved in 24 seconds."
        
        # Increment metrics
        await db.metrics.update_one(
            {"_id": "global"},
            {"$inc": {"ai_resolutions": 1, "cost_saved": 225}},
            upsert=True
        )
        
    elif action.action_type == "cancel_confirm":
        amount = action.metadata.get("amount", 0)
        response_text = f"✅ Order cancelled. Refund of ₹{amount:,} in 5-7 business days."
        
        # Increment metrics
        await db.metrics.update_one(
            {"_id": "global"},
            {"$inc": {"ai_resolutions": 1, "cost_saved": 225}},
            upsert=True
        )
    
    elif action.action_type == "address_updated":
        response_text = "✅ Delivery address updated successfully!"
        
        # Increment metrics
        await db.metrics.update_one(
            {"_id": "global"},
            {"$inc": {"ai_resolutions": 1, "cost_saved": 225}},
            upsert=True
        )
    
    else:
        response_text = "✅ Action completed successfully!"
    
    bot_message = Message(
        text=response_text,
        sender="bot",
        message_type="text",
        metadata={"resolution": True}
    )
    
    await db.messages.insert_one(bot_message.dict())
    
    return {"message": bot_message, "show_rating": True}

@api_router.get("/metrics", response_model=Metrics)
async def get_metrics():
    """Get current metrics"""
    metrics_data = await db.metrics.find_one({"_id": "global"})
    
    if not metrics_data:
        # Initialize default metrics
        default_metrics = {
            "_id": "global",
            "ai_resolutions": 1284,
            "avg_resolution_time": "2 min 14 sec",
            "csat_score": 4.7,
            "cost_saved": 288900
        }
        await db.metrics.insert_one(default_metrics)
        metrics_data = default_metrics
    
    return Metrics(
        ai_resolutions=metrics_data.get("ai_resolutions", 1284),
        avg_resolution_time=metrics_data.get("avg_resolution_time", "2 min 14 sec"),
        csat_score=metrics_data.get("csat_score", 4.7),
        cost_saved=metrics_data.get("cost_saved", 288900)
    )

@api_router.post("/rating", response_model=Rating)
async def submit_rating(rating_input: RatingCreate):
    """Submit a rating"""
    rating = Rating(**rating_input.dict())
    await db.ratings.insert_one(rating.dict())
    return rating

@api_router.get("/messages", response_model=List[Message])
async def get_messages(limit: int = 50):
    """Get recent messages"""
    messages = await db.messages.find().sort("timestamp", -1).limit(limit).to_list(limit)
    messages.reverse()  # Show oldest first
    return [Message(**msg) for msg in messages]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
