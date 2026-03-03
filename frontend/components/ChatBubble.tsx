import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ChatBubbleProps {
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export default function ChatBubble({ text, sender, timestamp }: ChatBubbleProps) {
  const isUser = sender === 'user';
  
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer]}>
      {!isUser && (
        <View style={styles.botAvatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
      )}
      
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
        <Text style={[styles.text, isUser ? styles.userText : styles.botText]}>
          {text}
        </Text>
        <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.botTimestamp]}>
          {formatTime(timestamp)}
        </Text>
      </View>
      
      {isUser && (
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>U</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  botContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '70%',
    borderRadius: 16,
    padding: 12,
    paddingBottom: 8,
  },
  userBubble: {
    backgroundColor: '#FF9900',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#37475A',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  userText: {
    color: '#FFFFFF',
  },
  botText: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
  },
  botTimestamp: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'left',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9900',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
