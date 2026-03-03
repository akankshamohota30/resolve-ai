import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  Modal,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

interface ConversationContext {
  conversationState: string;
  lastIssueType: string;
  issueResolved: boolean;
  refundOffered: boolean;
  closingMessageIndex: number;
  awaitingChoice: boolean;
  choiceContext: string;
  riskFlag: boolean;
  fraudScore: number;
  refundAttempts: number;
  chatStartTime: number;
  repeatIssue: boolean;
  activeIntent: string | null;
  issueExplained: boolean;
}

const PRODUCTS = [
  { name: 'boAt Headphones', emoji: '🎧', rating: 4.3, reviews: '12,450', price: '₹2,499', original: '₹3,999', discount: '38% OFF' },
  { name: 'Samsung Galaxy M34', emoji: '📱', rating: 4.5, reviews: '8,920', price: '₹24,999', original: '₹29,999', discount: '17% OFF' },
  { name: 'Nike Running Shoes', emoji: '👟', rating: 4.2, reviews: '5,630', price: '₹4,299', original: '₹7,999', discount: '46% OFF' },
  { name: 'Fire-Boltt Smart Watch', emoji: '⌚', rating: 4.0, reviews: '15,230', price: '₹1,999', original: '₹4,999', discount: '60% OFF' },
  { name: 'Cotton T-Shirt Pack of 3', emoji: '👕', rating: 4.1, reviews: '3,450', price: '₹599', original: '₹1,299', discount: '54% OFF' },
  { name: 'Prestige Mixer Grinder', emoji: '🔌', rating: 4.4, reviews: '6,780', price: '₹3,299', original: '₹5,499', discount: '40% OFF' },
];

const HERO_SLIDES = [
  { bg: '#1E3A8A', text: 'Electronics Sale - Up to 60% off' },
  { bg: '#FF9900', text: 'Fashion Week - Min 40% off' },
  { bg: '#059669', text: 'Grocery Deals - Fresh everyday' },
];

export default function Index() {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'bot',
      text: "Hey there! 👋 I'm Aza, your Amazon assistant.\nSkip the hold music — just tell me what's going on and I'll sort it out right now 😊",
      time: getCurrentTime(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [context, setContext] = useState<ConversationContext>({
    conversationState: 'greeting',
    lastIssueType: 'none',
    issueResolved: false,
    refundOffered: false,
    closingMessageIndex: 0,
    awaitingChoice: false,
    choiceContext: 'none',
    riskFlag: false,
    fraudScore: 0,
    refundAttempts: 0,
    chatStartTime: Date.now(),
    repeatIssue: false,
    activeIntent: null,
    issueExplained: false,
  });
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const messagesEndRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Auto-slide hero banner
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % HERO_SLIDES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Pulse animation for chat button
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  function getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function updateFraudScore(userMsg: string) {
    const msg = userMsg.toLowerCase();
    
    // CRITICAL: If user is responding to bot's offered options, score = 0
    const isSelectingBotOption = /^[123]$|option\s*[12]|instant|wallet|amazon pay|bank|card|original/i.test(msg);
    
    // If we're in refund_options state, user is just picking what bot offered
    if (context.conversationState === 'refund_options' && isSelectingBotOption) {
      setContext(prev => ({ ...prev, fraudScore: 0 }));
      return;
    }
    
    // If awaitingChoice, user is selecting from options bot provided
    if (context.awaitingChoice && isSelectingBotOption) {
      setContext(prev => ({ ...prev, fraudScore: 0 }));
      return;
    }
    
    // Check if this is user's first message and it's demanding refund
    const isFirstMessage = messages.length <= 2; // Opening message + user's first
    const isRefundDemand = /\brefund\b|money back|give me refund|want refund/i.test(msg);
    
    let newScore = context.fraudScore;
    
    // HIGH FRAUD SIGNALS
    
    // 1. Refund as VERY FIRST message with no context
    if (isFirstMessage && isRefundDemand && msg.length < 30 && !context.issueExplained) {
      newScore = 70;
    }
    
    // 2. Asked for refund 3+ times in session
    else if (context.refundAttempts >= 3) {
      newScore = 80;
    }
    
    // 3. Only repeats "give me refund" without answering questions
    else if (/give me refund|just refund|just give/i.test(msg) && context.issueExplained) {
      newScore = Math.min(75, newScore + 25);
    }
    
    // LOW FRAUD SIGNALS (set to 0)
    
    // User described problem before asking for refund
    else if (context.issueExplained && isRefundDemand) {
      newScore = 0;
    }
    
    // User engaged in conversation (multiple back-and-forth)
    else if (messages.length > 6) {
      newScore = Math.max(0, newScore - 10);
    }
    
    // User provides details (long message)
    else if (msg.length > 40 && /tried|attempted|contacted|waited|delivery|damaged|wrong|broken/i.test(msg)) {
      newScore = 0;
    }
    
    setContext(prev => ({ 
      ...prev, 
      fraudScore: Math.max(0, Math.min(100, newScore))
    }));
  }

  function getBotResponse(userMsg: string): string {
    const msg = userMsg.toLowerCase();
    const msgLength = userMsg.trim().length;
    
    // Check for repeat issue keywords
    const isRepeatIssue = /again|second time|always|every time|not the first time|this keeps happening|keeps happening/i.test(msg);
    if (isRepeatIssue && !context.repeatIssue) {
      setContext(prev => ({ ...prev, repeatIssue: true }));
    }
    
    // ═══════════════════════════════════════════════════════════
    // SESSION CLOSURE HANDLING - Reset context for new request
    // ═══════════════════════════════════════════════════════════
    if (sessionClosed) {
      // Reset issue-specific states but keep chat history
      setContext(prev => ({
        ...prev,
        awaitingChoice: false,
        issueResolved: false,
        activeIntent: null,
        issueExplained: false,
        conversationState: 'greeting',
      }));
      setSessionClosed(false);
    }
    
    // ═══════════════════════════════════════════════════════════
    // STEP 1: IF ISSUE RESOLVED - ONLY ALLOW GRATITUDE/GOODBYE
    // ═══════════════════════════════════════════════════════════
    if (context.issueResolved) {
      // Check for gratitude
      const isThankYou = /thank|thanks|thx|ty|great|awesome|perfect|brilliant|wonderful|amazing|helpful|sorted|all good|that's great|ok thanks|got it thanks|you're great|so helpful|happy now|satisfied|resolved/i.test(msg);
      if (isThankYou) {
        const closingMessages = [
          "You're so welcome! 😊 Sorry again for the trouble. Hope everything goes smoothly. Have a great day!",
          "Happy to help! 🙌 That's exactly what I'm here for. Happy shopping! 😊",
          "Glad I sorted that for you 😊 Take care and enjoy your purchase!",
        ];
        const response = closingMessages[context.closingMessageIndex % 3];
        setContext(prev => ({ ...prev, closingMessageIndex: prev.closingMessageIndex + 1 }));
        return response;
      }
      
      // Check for goodbye
      if (/bye|goodbye|see you|take care|cya|good night|good day|see ya|logging off|ttyl/i.test(msg)) {
        return "Take care! 👋 Hope I made your day a little easier. Happy shopping on Amazon! 😊";
      }
      
      // If they ask something else after resolution, reset and treat as new request
      setSessionClosed(true);
      setContext(prev => ({
        ...prev,
        awaitingChoice: false,
        issueResolved: false,
        activeIntent: null,
        issueExplained: false,
        conversationState: 'greeting',
      }));
      
      // Fall through to handle as new request
    }
    
    // ═══════════════════════════════════════════════════════════
    // GUARD: Refund/Replace/Cancel with NO activeIntent
    // ═══════════════════════════════════════════════════════════
    if (!context.activeIntent && /^(refund|replace|cancel)$/i.test(msg.trim())) {
      setContext(prev => ({ ...prev, conversationState: 'context_inquiry', issueExplained: true }));
      return "Sure, I can help with that. Is this regarding a recent order that was delivered, damaged, or not received?";
    }
    
    // If in context_inquiry state, route based on answer
    if (context.conversationState === 'context_inquiry') {
      if (/delivered|shows delivered|marked delivered/i.test(msg)) {
        setContext(prev => ({ ...prev, awaitingChoice: true, choiceContext: 'delivery', activeIntent: 'delivery', conversationState: 'greeting' }));
        return "That's frustrating 😔 I'm sorry about this. What would you like me to do?\n\n1️⃣ Track my order — find exact current location\n2️⃣ Send a replacement — get a new one delivered\n3️⃣ Process a refund — get my money back";
      } else if (/damaged|wrong|broken|defective/i.test(msg)) {
        setContext(prev => ({ ...prev, awaitingChoice: true, choiceContext: 'damaged', activeIntent: 'damaged', conversationState: 'greeting' }));
        return "I'm sorry you received a damaged or wrong item. What would you like me to do?\n\n1️⃣ Return & replacement — send it back, get a new one\n2️⃣ Return & refund — send it back, get your money back\n3️⃣ Keep it & partial refund — if the damage is minor";
      } else if (/not received|never got|didn't get/i.test(msg)) {
        setContext(prev => ({ ...prev, awaitingChoice: true, choiceContext: 'delivery', activeIntent: 'delivery', conversationState: 'greeting' }));
        return "That's completely unacceptable 😔 What would you like me to do?\n\n1️⃣ Track my order — find exact current location\n2️⃣ Send a replacement — get a new one delivered\n3️⃣ Process a refund — get my money back";
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // STEP 2: IF AWAITING CHOICE - HANDLE CHOICE RESPONSES FIRST
    // ═══════════════════════════════════════════════════════════
    if (context.awaitingChoice) {
      // Check for reschedule keywords FIRST
      const isReschedule = /reschedule|schedule again|change date|deliver tomorrow|missed delivery|attempt failed|deliver later|different time|another day/i.test(msg);
      
      if (isReschedule && context.choiceContext === 'delivery') {
        setContext(prev => ({ ...prev, issueResolved: true, awaitingChoice: false }));
        return "No problem 👍 I've rescheduled your delivery for tomorrow between 10AM–2PM. You'll receive a confirmation SMS shortly.";
      }
      
      // Check for choice number
      const choice = msg.match(/^[123]$|option\s*[123]|choice\s*[123]|^[123]\s/i)?.[0]?.match(/[123]/)?.[0];
      
      if (choice && context.choiceContext === 'delivery') {
        if (choice === '1') {
          setContext(prev => ({ ...prev, awaitingChoice: false }));
          return "Your order was last scanned at Mumbai distribution facility at 9:43 AM. Delivery was attempted but the partner couldn't reach you.\n\nOptions:\n— Reschedule for tomorrow\n— Nearest pickup point\n— Want replacement or refund instead?\n\nWhat works best?";
        } else if (choice === '2') {
          setContext(prev => ({ ...prev, issueResolved: true, awaitingChoice: false }));
          const goodwill = context.repeatIssue ? "\n\nAs an apology for the repeated issue, I've added ₹100 to your Amazon Pay wallet as a goodwill gesture 🙏" : '';
          return "Done! Replacement order placed 📦 Delivery in 2–3 business days to same address. Tracking SMS will be sent shortly ✅" + goodwill;
        } else if (choice === '3') {
          setContext(prev => ({ ...prev, conversationState: 'refund_options', awaitingChoice: false, refundAttempts: prev.refundAttempts + 1 }));
          return "I can process your refund in two ways:\n\n⚡ Option 1 — Instant to Amazon Pay wallet\n   Available in 2 minutes after pickup confirmation.\n\n🏦 Option 2 — Back to original payment method\n   3–5 business days to your card/bank.\n\nWhich do you prefer?";
        }
      }
      
      if (choice && context.choiceContext === 'damaged') {
        if (choice === '1') {
          setContext(prev => ({ ...prev, issueResolved: true, awaitingChoice: false, riskFlag: true }));
          const flagNote = "\n\nI've also flagged this to our quality team so this doesn't happen to other customers 🔍";
          return "Replacement arranged! Free pickup tomorrow 10AM–2PM. New item will be delivered in 2–3 days 📦✅" + flagNote;
        } else if (choice === '2') {
          setContext(prev => ({ ...prev, conversationState: 'refund_options', awaitingChoice: false, riskFlag: true, refundAttempts: prev.refundAttempts + 1 }));
          return "I can process your refund in two ways:\n\n⚡ Option 1 — Instant to Amazon Pay wallet\n   Available in 2 minutes.\n\n🏦 Option 2 — Back to original payment method\n   3–5 business days.\n\nWhich do you prefer?";
        } else if (choice === '3') {
          setContext(prev => ({ ...prev, issueResolved: true, awaitingChoice: false }));
          return "Understood! I've processed a partial refund of ₹750 (30% of item price) to your Amazon Pay wallet for the inconvenience 🙏 It'll reflect in 2 minutes ✅";
        }
      }
      
      // If awaiting choice but no valid choice detected, prompt again
      if (context.choiceContext === 'delivery') {
        return "Please choose an option:\n1️⃣ Track order\n2️⃣ Replacement\n3️⃣ Refund\n\nJust type the number or option you prefer.";
      }
      if (context.choiceContext === 'damaged') {
        return "Please choose an option:\n1️⃣ Return & replacement\n2️⃣ Return & refund\n3️⃣ Keep & partial refund\n\nJust type the number you prefer.";
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // STEP 3: GLOBAL INTENT ENGINE (IF NOT AWAITING CHOICE)
    // ═══════════════════════════════════════════════════════════
    
    // Check for refund options state
    if (context.conversationState === 'refund_options') {
      if (/1|option 1|instant|wallet|amazon pay/i.test(msg)) {
        setContext(prev => ({ ...prev, issueResolved: true, refundOffered: true }));
        
        // Check fraud score
        if (context.fraudScore >= 61) {
          return "I want to make absolutely sure your refund goes through without any issues 😊 I'm connecting you to a specialist who handles these cases directly. They'll reach out within 2 hours. Ticket #" + Math.floor(10000 + Math.random() * 90000) + " raised ✅";
        } else if (context.fraudScore >= 31) {
          setContext(prev => ({ ...prev, conversationState: 'fraud_verification' }));
          return "Just to confirm before I process this — could you tell me what the item looked like or roughly when it was ordered? Just a quick check on our end 😊";
        }
        
        const flagNote = context.riskFlag ? "\n\nI've also flagged this to our quality team so this doesn't happen to other customers 🔍" : '';
        const goodwill = context.repeatIssue ? "\n\nAs an apology for the repeated issue, I've added ₹100 to your Amazon Pay wallet as a goodwill gesture 🙏" : '';
        return "Done! ₹2,499 will hit your Amazon Pay wallet within 2 minutes of pickup confirmation 🎉 You'll get a notification the moment it's in ✅\nReally sorry for the trouble." + flagNote + goodwill;
      }
      
      if (/2|option 2|bank|card|original/i.test(msg)) {
        setContext(prev => ({ ...prev, issueResolved: true, refundOffered: true }));
        
        if (context.fraudScore >= 61) {
          return "I want to make absolutely sure your refund goes through without any issues 😊 I'm connecting you to a specialist who handles these cases directly. They'll reach out within 2 hours. Ticket #" + Math.floor(10000 + Math.random() * 90000) + " raised ✅";
        }
        
        const flagNote = context.riskFlag ? "\n\nI've also flagged this to our quality team so this doesn't happen to other customers 🔍" : '';
        return "Sorted! ₹2,499 refund initiated to your original payment method 👍 Should reflect in 3–5 business days. Sorry again for the inconvenience." + flagNote;
      }
    }
    
    // INTENT: GRATITUDE (when issue not yet resolved)
    const isThankYou = /thank|thanks|thx|ty|great|awesome|perfect|brilliant|wonderful|amazing|helpful|sorted|all good/i.test(msg);
    if (isThankYou) {
      return "You're welcome! 😊 Just checking — did we fully sort out your issue? I want to make sure you're good to go.";
    }
    
    // INTENT: GOODBYE
    if (/bye|goodbye|see you|take care|cya|good night|good day|see ya|logging off|ttyl/i.test(msg)) {
      return "Take care! 👋 Hope I made your day a little easier. Happy shopping on Amazon! 😊";
    }
    
    // INTENT: ANGRY / EXTREMELY FRUSTRATED
    const isAngry = msg === msg.toUpperCase() && msg.length > 5;
    const hasFrustratedWords = /ridiculous|pathetic|worst|horrible|disgusting|unacceptable|fraud|cheating|useless|terrible|awful|never buying again|consumer forum|escalate|legal action|this is a scam/i.test(msg);
    
    if (isAngry || hasFrustratedWords) {
      setContext(prev => ({ ...prev, awaitingChoice: true, choiceContext: 'delivery', lastIssueType: 'delivery', activeIntent: 'delivery', issueExplained: true }));
      const prefix = context.repeatIssue ? "I see this has happened before — that's completely unacceptable and I sincerely apologize 😔 You should never have to face this more than once.\n\n" : '';
      return prefix + "That's completely unacceptable and I am so sorry this happened to you 😔 You did not deserve this. I'm treating this as urgent and will fix it right now.\n\nWhat would you like me to do?\n\n1️⃣ Track my order — find exact current location\n2️⃣ Send a replacement — get a new one delivered\n3️⃣ Process a refund — get my money back";
    }
    
    // INTENT: DAMAGED / WRONG ITEM DELIVERED
    const isDamagedOrWrong = /damaged|broken|wrong item|wrong product|cracked|scratched|torn|defective|faulty|not working|wrong\/damaged|wrong parcel|damaged parcel|received wrong|got wrong|different product|not what i ordered|fake|duplicate|open box|tampered|seal broken|used product/i.test(msg);
    
    if (isDamagedOrWrong) {
      setContext(prev => ({ ...prev, awaitingChoice: true, choiceContext: 'damaged', lastIssueType: 'damaged', riskFlag: true, activeIntent: 'damaged', issueExplained: true }));
      const prefix = context.repeatIssue ? "I see this has happened before — that's completely unacceptable and I sincerely apologize 😔 You should never have to face this more than once.\n\n" : '';
      return prefix + "Oh no, that's really upsetting 😔 I'm sorry you received a damaged or wrong item — that should never happen.\n\nWhat would you like me to do?\n\n1️⃣ Return & replacement — send it back, get a new one\n2️⃣ Return & refund — send it back, get your money back\n3️⃣ Keep it & partial refund — if the damage is minor";
    }
    
    // INTENT: MISSING / UNDELIVERED PACKAGE
    const isMissingPackage = /didn't receive|did not receive|not received|never got|shows delivered|marked delivered|app shows delivered|parcel not here|package missing|not at door|not in mailbox|delivery guy|delivery boy|delivery partner|delivery person|courier|still not got|never arrived|haven't received|not delivered|waited for delivery|expected today but no delivery|tracking shows delivered but nothing|empty box received/i.test(msg);
    
    if (isMissingPackage) {
      setContext(prev => ({ ...prev, awaitingChoice: true, choiceContext: 'delivery', lastIssueType: 'delivery', activeIntent: 'delivery', issueExplained: true }));
      
      // If message is long (>20 chars) and detailed, skip clarification
      if (msgLength > 20 || userMsg.split(' ').length > 8) {
        const prefix = context.repeatIssue ? "I see this has happened before — that's completely unacceptable and I sincerely apologize 😔 You should never have to face this more than once.\n\n" : '';
        return prefix + "That's completely unacceptable — I'm really sorry this happened 😔 You shouldn't have to deal with this. I'm on it right now.\n\nWhat would you like me to do?\n\n1️⃣ Track my order — find exact current location\n2️⃣ Send a replacement — get a new one delivered\n3️⃣ Process a refund — get my money back";
      } else if (context.issueExplained) {
        // Already explained once, don't ask again
        return "That's completely unacceptable — I'm really sorry this happened 😔 You shouldn't have to deal with this. I'm on it right now.\n\nWhat would you like me to do?\n\n1️⃣ Track my order — find exact current location\n2️⃣ Send a replacement — get a new one delivered\n3️⃣ Process a refund — get my money back";
      } else {
        // First time, short message - ask one clarification
        setContext(prev => ({ ...prev, issueExplained: true, awaitingChoice: false }));
        return "Oh no, that's so frustrating 😔 I'm sorry about this. Quick question — did the tracking update show delivered, or has there been no update at all?";
      }
    }
    
    // INTENT: RETURN REQUEST
    if (/\breturn\b|send back|want to return|i want to return|return this|return my order|return request|initiate return|how to return/i.test(msg) && !isDamagedOrWrong) {
      if (!context.activeIntent || context.activeIntent !== 'return') {
        setContext(prev => ({ ...prev, conversationState: 'return_inquiry', lastIssueType: 'return', activeIntent: 'return', issueExplained: true }));
        return "I'll get that sorted for you right away 😊 What's the reason for the return?\n— Wrong size or color\n— Damaged or defective\n— Changed my mind\n— Something else";
      } else if (context.conversationState === 'return_inquiry') {
        setContext(prev => ({ ...prev, conversationState: 'return_confirm' }));
        return "Got it, that makes sense. Is this the item you ordered recently?";
      } else if (context.conversationState === 'return_confirm') {
        setContext(prev => ({ ...prev, issueResolved: true }));
        return "Done! Free pickup scheduled for tomorrow 10AM–2PM 📦 Your refund of ₹2,499 will be processed within 5 days of pickup. You'll get an SMS confirmation shortly ✅";
      }
    }
    
    // INTENT: CANCELLATION
    if (/cancel|don't want|cancel order|want to cancel|please cancel|stop my order|cancel this|cancel before delivery/i.test(msg)) {
      if (!context.activeIntent || context.activeIntent !== 'cancel') {
        setContext(prev => ({ ...prev, conversationState: 'cancel_inquiry', lastIssueType: 'cancel', activeIntent: 'cancel', issueExplained: true }));
        return "Sure, I can cancel that for you! Has the order shipped yet, do you know?";
      } else if (context.conversationState === 'cancel_inquiry') {
        if (/no|not|hasn't|nope|not yet/i.test(msg)) {
          setContext(prev => ({ ...prev, issueResolved: true }));
          return "Done! Your order has been cancelled ✅ Refund of ₹2,499 will be credited to your original payment method instantly. Is there anything else I can help with?";
        } else {
          setContext(prev => ({ ...prev, issueResolved: true }));
          return "Since it's already shipped, best option is to refuse delivery when it arrives — it'll come back to us automatically and your full refund will be processed within 5 days 👍 Want me to make a note on your account?";
        }
      }
    }
    
    // INTENT: TRACKING
    if (/track|where is|when will|arrive|delivery status|order status|how long|shipment|dispatched|out for delivery|expected delivery|where's my order|track my package/i.test(msg)) {
      if (!context.activeIntent || context.activeIntent !== 'track') {
        setContext(prev => ({ ...prev, conversationState: 'track_inquiry', lastIssueType: 'track', activeIntent: 'track', issueExplained: true }));
        return "Sure! What did you order? I'll pull up the latest for you.";
      } else if (context.conversationState === 'track_inquiry') {
        setContext(prev => ({ ...prev, issueResolved: true }));
        
        // Check for delayed delivery
        if (/late|delayed|overdue|was supposed|should have come|yesterday/i.test(msg)) {
          return "Your order is running late — I can see it's overdue 😔 Since it's past the expected delivery date, I can set up a refund or replacement for you right now. You don't have to wait any longer. Want me to do that?";
        }
        
        return "Your order is out for delivery today! 🚚\nLast scanned: Mumbai Central facility at 8:30 AM.\nEstimated arrival: by 7PM tonight.\nWant a notification when it's 30 minutes away?";
      }
    }
    
    // INTENT: ADDRESS CHANGE
    if (/wrong address|change address|update address|different address|new address|incorrect address|change delivery address|update my address|wrong delivery address/i.test(msg)) {
      if (!context.activeIntent || context.activeIntent !== 'address') {
        setContext(prev => ({ ...prev, conversationState: 'address_inquiry', lastIssueType: 'address', activeIntent: 'address', issueExplained: true }));
        return "No worries, quick fix! What's the correct delivery address?";
      } else if (context.conversationState === 'address_inquiry') {
        setContext(prev => ({ ...prev, issueResolved: true }));
        return "Updated! Your order will now be delivered to that address. All confirmed ✅";
      }
    }
    
    // INTENT: REFUND STATUS (separate from refund options state)
    if (/refund|money back|want refund|refund status|where is my refund|not received refund|when will i get refund|refund not credited/i.test(msg) && context.conversationState !== 'refund_options') {
      setContext(prev => ({ ...prev, conversationState: 'refund_inquiry', refundAttempts: prev.refundAttempts + 1, activeIntent: 'refund', issueExplained: true }));
      return "I'll check on that right away. Was the refund for a recent return or a missing order?";
    }
    
    if (context.conversationState === 'refund_inquiry') {
      setContext(prev => ({ ...prev, conversationState: 'refund_options' }));
      return "I can process this in two ways:\n\n⚡ Option 1 — Instant to Amazon Pay wallet\n   Available in 2 minutes after pickup confirmation.\n\n🏦 Option 2 — Back to original payment method\n   3–5 business days to your card or bank account.\n\nWhich do you prefer?";
    }
    
    // INTENT: GLOBAL RESCHEDULE (before fallback)
    const isReschedule = /reschedule|schedule again|change date|change delivery date|deliver tomorrow|missed delivery|attempt failed|deliver later|different time|another day/i.test(msg);
    if (isReschedule) {
      if (context.activeIntent === 'delivery' || context.lastIssueType === 'delivery') {
        setContext(prev => ({ ...prev, issueResolved: true }));
        return "No problem 👍 I've rescheduled your delivery for tomorrow between 10AM–2PM. You'll receive a confirmation SMS shortly.";
      } else {
        setContext(prev => ({ ...prev, activeIntent: 'reschedule', issueExplained: true }));
        return "Is this about a current order that's out for delivery?";
      }
    }
    
    // INTENT: SMALL TALK
    if (/^(hi|hello|hey|what's up)$/i.test(msg.trim())) {
      return "Hey! 👋 I'm Aza, Amazon's assistant. Just tell me what's going on and I'll sort it out right now 😊";
    }
    
    if (/how are you/i.test(msg)) {
      return "All good and ready to help! 😊 What can I sort out for you today?";
    }
    
    if (/who are you|what can you do/i.test(msg)) {
      return "I'm Aza, Amazon's AI support assistant! 🤖\nI can help with:\n— Missing or undelivered orders\n— Returns and replacements\n— Refunds (instant or standard)\n— Order tracking\n— Cancellations and address changes\nNo hold times. No waiting. Just talk to me 😊";
    }
    
    // ═══════════════════════════════════════════════════════════
    // STEP 4: STRICT FALLBACK - ONLY IF NOTHING MATCHED
    // ═══════════════════════════════════════════════════════════
    
    // Fallback FORBIDDEN if issue already explained
    if (context.issueExplained) {
      // Don't ask "what happened" again - offer help
      return "I want to help you with this. Could you choose what you'd like me to do:\n— Process a refund\n— Send a replacement\n— Track your order\n— Something else?";
    }
    
    // Fallback only fires if absolutely nothing matched and issue not yet explained
    if (!context.awaitingChoice && !context.issueExplained && !context.activeIntent) {
      return "I want to make sure I get this right for you 😊 Could you tell me a little more about what's going on with your order?";
    }
    
    // Safety fallback (should rarely trigger)
    return "I'm here to help! What can I do for you today?";
  }

  async function handleSend() {
    if (!inputValue.trim()) return;
    
    const userMsg = inputValue.trim();
    setInputValue('');
    
    setMessages(prev => [...prev, {
      sender: 'user',
      text: userMsg,
      time: getCurrentTime(),
    }]);
    
    // Update fraud score
    updateFraudScore(userMsg);
    
    setIsTyping(true);
    
    setTimeout(() => {
      const response = getBotResponse(userMsg);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: response,
        time: getCurrentTime(),
      }]);
    }, 1500);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.mainScroll}>
        {/* Navbar */}
        <View style={styles.navbar}>
          <Text style={styles.logo}>amazon</Text>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search Amazon.in"
              placeholderTextColor="#999"
            />
            <TouchableOpacity style={styles.searchButton}>
              <Ionicons name="search" size={20} color="#131921" />
            </TouchableOpacity>
          </View>
          <View style={styles.navRight}>
            <Text style={styles.navText}>Hello, Sign in</Text>
            <Text style={styles.navText}>Orders</Text>
            <Ionicons name="cart-outline" size={28} color="#FFFFFF" />
          </View>
        </View>

        {/* Location Bar */}
        <View style={styles.locationBar}>
          <Ionicons name="location" size={16} color="#131921" />
          <Text style={styles.locationText}>Deliver to Mumbai 400001</Text>
        </View>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={[styles.heroSlide, { backgroundColor: HERO_SLIDES[currentSlide].bg }]}>
            <Text style={styles.heroText}>{HERO_SLIDES[currentSlide].text}</Text>
          </View>
          <View style={styles.heroControls}>
            <TouchableOpacity onPress={() => setCurrentSlide((currentSlide - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}>
              <Ionicons name="chevron-back-circle" size={32} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCurrentSlide((currentSlide + 1) % HERO_SLIDES.length)}>
              <Ionicons name="chevron-forward-circle" size={32} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Deals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Deals</Text>
          <View style={styles.productsGrid}>
            {PRODUCTS.map((product, idx) => (
              <View key={idx} style={styles.productCard}>
                <View style={styles.productImage}>
                  <Text style={styles.productEmoji}>{product.emoji}</Text>
                </View>
                <Text style={styles.productName}>{product.name}</Text>
                <View style={styles.rating}>
                  <Text style={styles.ratingText}>{product.rating} ⭐</Text>
                  <Text style={styles.reviewsText}>({product.reviews})</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{product.price}</Text>
                  <Text style={styles.originalPrice}>{product.original}</Text>
                </View>
                <Text style={styles.discount}>{product.discount}</Text>
                <TouchableOpacity style={styles.addToCart}>
                  <Text style={styles.addToCartText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>About Us</Text>
            <Text style={styles.footerLink}>Careers</Text>
            <Text style={styles.footerLink}>Press</Text>
            <Text style={styles.footerLink}>Help</Text>
          </View>
          <Text style={styles.copyright}>© 2025 Amazon.com Inc. or its affiliates</Text>
        </View>
      </ScrollView>

      {/* Floating Chat Button */}
      {!chatOpen && (
        <Animated.View style={[styles.floatingButton, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity onPress={() => setChatOpen(true)} style={styles.chatButton}>
            <Text style={styles.chatButtonIcon}>💬</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Chat Window */}
      <Modal visible={chatOpen} transparent animationType="slide">
        <View style={styles.chatOverlay}>
          <View style={styles.chatWindow}>
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <View style={styles.botAvatar}>
                <Text style={styles.avatarEmoji}>😊</Text>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.chatTitle}>Aza - Amazon Assistant</Text>
                <View style={styles.onlineStatus}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>online</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChatOpen(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView style={styles.messagesArea} ref={messagesEndRef}>
              {messages.map((msg, idx) => (
                <View key={idx} style={[styles.message, msg.sender === 'user' ? styles.userMessage : styles.botMessage]}>
                  {msg.sender === 'bot' && (
                    <View style={styles.smallBotAvatar}>
                      <Text style={styles.smallAvatarEmoji}>😊</Text>
                    </View>
                  )}
                  <View style={[styles.messageBubble, msg.sender === 'user' ? styles.userBubble : styles.botBubble]}>
                    <Text style={[styles.messageText, msg.sender === 'user' ? styles.userText : styles.botText]}>
                      {msg.text}
                    </Text>
                    <Text style={[styles.messageTime, msg.sender === 'user' ? styles.userTime : styles.botTime]}>
                      {msg.time}
                    </Text>
                  </View>
                </View>
              ))}
              
              {/* Typing Indicator */}
              {isTyping && (
                <View style={[styles.message, styles.botMessage]}>
                  <View style={styles.smallBotAvatar}>
                    <Text style={styles.smallAvatarEmoji}>😊</Text>
                  </View>
                  <View style={[styles.messageBubble, styles.botBubble]}>
                    <View style={styles.typingDots}>
                      <View style={[styles.dot, styles.dot1]} />
                      <View style={[styles.dot, styles.dot2]} />
                      <View style={[styles.dot, styles.dot3]} />
                    </View>
                  </View>
                </View>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Input Bar */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.chatInput}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Type your message..."
                placeholderTextColor="#999"
                multiline
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {/* Fraud Score Badge (Demo/Portfolio) */}
            <View style={[
              styles.fraudBadge,
              context.fraudScore <= 30 && styles.fraudBadgeGreen,
              context.fraudScore > 30 && context.fraudScore <= 60 && styles.fraudBadgeYellow,
              context.fraudScore > 60 && styles.fraudBadgeRed,
            ]}>
              <Text style={styles.fraudBadgeText}>🛡️ Risk Score: {context.fraudScore}/100</Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainScroll: {
    flex: 1,
  },
  navbar: {
    backgroundColor: '#131921',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF9900',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#FF9900',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  navText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  locationBar: {
    backgroundColor: '#FF9900',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  locationText: {
    color: '#131921',
    fontSize: 14,
    fontWeight: '500',
  },
  heroBanner: {
    height: 180,
    position: 'relative',
  },
  heroSlide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  heroControls: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    top: '50%',
    marginTop: -16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#131921',
    marginBottom: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: (width - 44) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    backgroundColor: '#F3F3F3',
    height: 120,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  productEmoji: {
    fontSize: 48,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#131921',
    marginBottom: 4,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#131921',
  },
  reviewsText: {
    fontSize: 11,
    color: '#666',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#131921',
  },
  originalPrice: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  discount: {
    fontSize: 12,
    color: '#CC0C39',
    fontWeight: '600',
    marginBottom: 8,
  },
  addToCart: {
    backgroundColor: '#FF9900',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  addToCartText: {
    color: '#131921',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: '#131921',
    padding: 24,
    marginTop: 32,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  footerLink: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  copyright: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 999,
  },
  chatButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF9900',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  chatButtonIcon: {
    fontSize: 32,
  },
  chatOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 16,
  },
  chatWindow: {
    width: Math.min(380, width - 32),
    height: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  chatHeader: {
    backgroundColor: '#131921',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  botAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF9900',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  headerText: {
    flex: 1,
  },
  chatTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  onlineText: {
    color: '#10B981',
    fontSize: 12,
  },
  closeButton: {
    padding: 4,
  },
  messagesArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  message: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  userMessage: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  botMessage: {
    justifyContent: 'flex-start',
  },
  smallBotAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF9900',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAvatarEmoji: {
    fontSize: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 12,
    padding: 12,
  },
  userBubble: {
    backgroundColor: '#FF9900',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#F3F3F3',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  botText: {
    color: '#131921',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
  },
  userTime: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },
  botTime: {
    color: '#666',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9900',
  },
  dot1: {
    animation: 'bounce 1.4s infinite ease-in-out',
  },
  dot2: {
    animation: 'bounce 1.4s infinite ease-in-out 0.2s',
  },
  dot3: {
    animation: 'bounce 1.4s infinite ease-in-out 0.4s',
  },
  inputBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    gap: 12,
    alignItems: 'center',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F3F3F3',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF9900',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fraudBadge: {
    position: 'absolute',
    bottom: 70,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  fraudBadgeGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
  },
  fraudBadgeYellow: {
    backgroundColor: 'rgba(234, 179, 8, 0.9)',
  },
  fraudBadgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  fraudBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});