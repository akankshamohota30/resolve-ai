import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ActionButtonsProps {
  action: string;
  metadata: any;
  onConfirm: () => void;
}

export default function ActionButtons({ action, metadata, onConfirm }: ActionButtonsProps) {
  if (action === 'refund_confirm' || action === 'cancel_confirm') {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 56, // Align with bot message
  },
  confirmButton: {
    backgroundColor: '#FF9900',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
