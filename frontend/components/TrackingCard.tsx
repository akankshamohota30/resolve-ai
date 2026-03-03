import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TrackingCardProps {
  metadata: {
    order_id: string;
    steps: Array<{
      label: string;
      completed: boolean;
      current?: boolean;
    }>;
    eta: string;
  };
}

export default function TrackingCard({ metadata }: TrackingCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.orderText}>Order #{metadata.order_id}</Text>
        <Text style={styles.eta}>{metadata.eta}</Text>
      </View>
      
      <View style={styles.stepsContainer}>
        {metadata.steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={styles.stepIndicator}>
              {step.completed ? (
                <View style={styles.completedCircle}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
              ) : step.current ? (
                <View style={styles.currentCircle}>
                  <View style={styles.currentInner} />
                </View>
              ) : (
                <View style={styles.pendingCircle} />
              )}
              {index < metadata.steps.length - 1 && (
                <View style={[
                  styles.connector,
                  step.completed && styles.connectorCompleted
                ]} />
              )}
            </View>
            <View style={styles.stepContent}>
              <Text style={[
                styles.stepLabel,
                step.completed && styles.stepLabelCompleted,
                step.current && styles.stepLabelCurrent
              ]}>
                {step.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#37475A',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    marginLeft: 56, // Align with bot messages
  },
  header: {
    marginBottom: 16,
  },
  orderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  eta: {
    color: '#FF9900',
    fontSize: 14,
    fontWeight: '500',
  },
  stepsContainer: {
    paddingLeft: 8,
  },
  stepRow: {
    flexDirection: 'row',
    minHeight: 40,
  },
  stepIndicator: {
    alignItems: 'center',
    marginRight: 12,
  },
  completedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF9900',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  pendingCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6B7280',
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: '#6B7280',
    marginTop: 4,
  },
  connectorCompleted: {
    backgroundColor: '#10B981',
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center',
  },
  stepLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  stepLabelCompleted: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  stepLabelCurrent: {
    color: '#FF9900',
    fontWeight: '600',
  },
});
