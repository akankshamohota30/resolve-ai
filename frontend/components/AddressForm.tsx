import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AddressFormProps {
  onSubmit: (address: { street: string; city: string; pin: string }) => void;
}

export default function AddressForm({ onSubmit }: AddressFormProps) {
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = () => {
    if (street && city && pin) {
      onSubmit({ street, city, pin });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Street Address</Text>
        <TextInput
          style={styles.input}
          value={street}
          onChangeText={setStreet}
          placeholder="Enter street address"
          placeholderTextColor="#9CA3AF"
        />
        
        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="Enter city"
          placeholderTextColor="#9CA3AF"
        />
        
        <Text style={styles.label}>PIN Code</Text>
        <TextInput
          style={styles.input}
          value={pin}
          onChangeText={setPin}
          placeholder="Enter PIN code"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={6}
        />
        
        <TouchableOpacity 
          style={[styles.submitButton, (!street || !city || !pin) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!street || !city || !pin}
        >
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.submitText}>Update Address</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginVertical: 8,
    marginLeft: 56,
  },
  form: {
    backgroundColor: '#37475A',
    borderRadius: 12,
    padding: 16,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#232F3E',
    color: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  submitButton: {
    backgroundColor: '#FF9900',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#6B7280',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
