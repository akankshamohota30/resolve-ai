import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';

import ChatBubble from '../components/ChatBubble';
import TypingIndicator from '../components/TypingIndicator';
import ActionButtons from '../components/ActionButtons';
import TrackingCard from '../components/TrackingCard';
import QRCode from '../components/QRCode';
import AddressForm from '../components/AddressForm';
import RatingCard from '../components/RatingCard';
import QuickActions from '../components/QuickActions';
import MetricsBottomSheet from '../components/MetricsBottomSheet';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  message_type: string;
  metadata?: any;
}

interface Metrics {
  ai_resolutions: number;
  avg_resolution_time: string;
  csat_score: number;
  cost_saved: number;
}

export default function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [currentActionData, setCurrentActionData] = useState<any>(null);
  const [metrics, setMetrics] = useState<Metrics>({
    ai_resolutions: 1284,
    avg_resolution_time: '2 min 14 sec',
    csat_score: 4.7,
    cost_saved: 288900,
  });
  const [bannerVisible, setBannerVisible] = useState(true);
  const [conversationId] = useState(() => `conv-${Date.now()}`);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);

  // Send welcome message on mount
  useEffect(() => {
    setTimeout(() => {
      const welcomeMessage: Message = {
        id: `msg-${Date.now()}`,
        text: "👋 Hi! I'm Aza, Amazon's AI assistant. I can instantly help you with refunds, returns, tracking, cancellations, and delivery changes — no hold times, no waiting. What can I help you with today?",
        sender: 'bot',
        timestamp: new Date(),
        message_type: 'text',
      };
      setMessages([welcomeMessage]);
    }, 500);

    // Fetch initial metrics
    fetchMetrics();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isTyping]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/metrics`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      text: text.trim(),
      sender: 'user',
      timestamp: new Date(),
      message_type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setShowRating(false);
    Keyboard.dismiss();

    // Show typing indicator
    setIsTyping(true);

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text.trim(),
          sender: 'user',
          message_type: 'text',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Wait 1-2 seconds to simulate realistic AI response
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setIsTyping(false);

        // Add bot messages
        const botMessages: Message[] = data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));

        setMessages(prev => [...prev, ...botMessages]);

        // Store action data if any
        if (data.requires_action) {
          setCurrentActionData({
            action_type: data.action_type,
            metadata: botMessages[0]?.metadata,
          });
        }
      } else {
        setIsTyping(false);
        Alert.alert('Error', 'Failed to get response from AI');
      }
    } catch (error) {
      setIsTyping(false);
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to connect to server');
    }
  };

  const handleActionConfirm = async () => {
    if (!currentActionData) return;

    setIsTyping(true);

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/action/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action_type: currentActionData.action_type,
          order_id: currentActionData.metadata?.order_id,
          metadata: currentActionData.metadata,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIsTyping(false);

        const botMessage: Message = {
          ...data.message,
          timestamp: new Date(data.message.timestamp),
        };

        setMessages(prev => [...prev, botMessage]);
        setCurrentActionData(null);

        if (data.show_rating) {
          setShowRating(true);
        }

        // Fetch updated metrics
        fetchMetrics();
      }
    } catch (error) {
      setIsTyping(false);
      console.error('Error confirming action:', error);
    }
  };

  const handleAddressSubmit = async (address: { street: string; city: string; pin: string }) => {
    setIsTyping(true);

    try {
      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/action/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action_type: 'address_updated',
          metadata: { address },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIsTyping(false);

        const botMessage: Message = {
          ...data.message,
          timestamp: new Date(data.message.timestamp),
        };

        setMessages(prev => [...prev, botMessage]);
        setCurrentActionData(null);

        if (data.show_rating) {
          setShowRating(true);
        }

        // Fetch updated metrics
        fetchMetrics();
      }
    } catch (error) {
      setIsTyping(false);
      console.error('Error updating address:', error);
    }
  };

  const handleRating = async (stars: number) => {
    try {
      await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          stars,
        }),
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

  const renderMessage = (message: Message) => {
    if (message.message_type === 'tracking') {
      return (
        <View key={message.id}>
          <ChatBubble
            text={message.text}
            sender={message.sender}
            timestamp={message.timestamp}
          />
          <TrackingCard metadata={message.metadata} />
        </View>
      );
    }

    if (message.message_type === 'qr') {
      return <QRCode key={message.id} metadata={message.metadata} />;
    }

    if (message.message_type === 'form') {
      return (
        <View key={message.id}>
          <ChatBubble
            text={message.text}
            sender={message.sender}
            timestamp={message.timestamp}
          />
          <AddressForm onSubmit={handleAddressSubmit} />
        </View>
      );
    }

    if (message.message_type === 'action') {
      return (
        <View key={message.id}>
          <ChatBubble
            text={message.text}
            sender={message.sender}
            timestamp={message.timestamp}
          />
          {message.metadata && (
            <ActionButtons
              action={message.metadata.action}
              metadata={message.metadata}
              onConfirm={handleActionConfirm}
            />
          )}
        </View>
      );
    }

    return (
      <ChatBubble
        key={message.id}
        text={message.text}
        sender={message.sender}
        timestamp={message.timestamp}
      />
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Navbar */}
        <View style={styles.navbar}>
          <Text style={styles.logo}>amazon</Text>
          <TouchableOpacity onPress={() => bottomSheetRef.current?.expand()}>
            <Ionicons name="stats-chart" size={24} color="#FF9900" />
          </TouchableOpacity>
        </View>

        {/* Problem Statement Banner */}
        {bannerVisible && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              69% of users faced severe service issues · AI now resolves 80% of requests instantly · Avg resolution: 2 min vs 38 min before
            </Text>
            <TouchableOpacity onPress={() => setBannerVisible(false)}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map(renderMessage)}
            {isTyping && <TypingIndicator />}
            {showRating && <RatingCard onRate={handleRating} />}
          </ScrollView>

          {/* Quick Actions */}
          <QuickActions onActionPress={sendMessage} />

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type your message..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Metrics Bottom Sheet */}
        <MetricsBottomSheet ref={bottomSheetRef} metrics={metrics} />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131921',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#131921',
    borderBottomWidth: 1,
    borderBottomColor: '#232F3E',
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF9900',
  },
  banner: {
    backgroundColor: '#FF9900',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  bannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#232F3E',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#37475A',
  },
  input: {
    flex: 1,
    backgroundColor: '#37475A',
    color: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#FF9900',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#6B7280',
  },
});
