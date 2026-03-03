import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface QuickAction {
  label: string;
  emoji: string;
  message: string;
}

interface QuickActionsProps {
  onActionPress: (message: string) => void;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Track Order', emoji: '📦', message: 'Track my order' },
  { label: 'Return Item', emoji: '↩️', message: 'I want to return an item' },
  { label: 'Missing Package', emoji: '❌', message: "I didn't receive my package" },
  { label: 'Cancel Order', emoji: '🚫', message: 'Cancel my order' },
  { label: 'Change Address', emoji: '🏠', message: 'Change my delivery address' },
];

export default function QuickActions({ onActionPress }: QuickActionsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {QUICK_ACTIONS.map((action, index) => (
        <TouchableOpacity
          key={index}
          style={styles.chip}
          onPress={() => onActionPress(action.message)}
        >
          <Text style={styles.emoji}>{action.emoji}</Text>
          <Text style={styles.label}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#37475A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  emoji: {
    fontSize: 16,
    marginRight: 6,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
});
