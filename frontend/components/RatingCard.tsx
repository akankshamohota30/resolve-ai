import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RatingCardProps {
  onRate: (stars: number) => void;
}

export default function RatingCard({ onRate }: RatingCardProps) {
  const [rated, setRated] = useState(false);
  const [selectedStars, setSelectedStars] = useState(0);

  const handleRate = (stars: number) => {
    setSelectedStars(stars);
    setRated(true);
    onRate(stars);
  };

  if (rated) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="checkmark-circle" size={32} color="#10B981" />
          <Text style={styles.thankYou}>Thank you! Feedback recorded.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>How was your experience?</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => handleRate(star)}
              style={styles.starButton}
            >
              <Ionicons
                name={selectedStars >= star ? 'star' : 'star-outline'}
                size={32}
                color="#FF9900"
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    backgroundColor: '#37475A',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  thankYou: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
});
