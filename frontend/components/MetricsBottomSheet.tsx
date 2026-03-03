import React, { useMemo, forwardRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

interface MetricsData {
  ai_resolutions: number;
  avg_resolution_time: string;
  csat_score: number;
  cost_saved: number;
}

interface MetricsBottomSheetProps {
  metrics: MetricsData;
}

const MetricsBottomSheet = forwardRef<BottomSheet, MetricsBottomSheetProps>(
  ({ metrics }, ref) => {
    const snapPoints = useMemo(() => ['25%', '50%'], []);
    const [displayResolutions, setDisplayResolutions] = useState(metrics.ai_resolutions);
    const [displayCost, setDisplayCost] = useState(metrics.cost_saved);

    // Animate count up effect
    useEffect(() => {
      const resolutionDiff = metrics.ai_resolutions - displayResolutions;
      if (resolutionDiff > 0) {
        const increment = Math.ceil(resolutionDiff / 10);
        const timer = setInterval(() => {
          setDisplayResolutions(prev => {
            if (prev + increment >= metrics.ai_resolutions) {
              clearInterval(timer);
              return metrics.ai_resolutions;
            }
            return prev + increment;
          });
        }, 50);
        return () => clearInterval(timer);
      }
    }, [metrics.ai_resolutions]);

    useEffect(() => {
      const costDiff = metrics.cost_saved - displayCost;
      if (costDiff > 0) {
        const increment = Math.ceil(costDiff / 10);
        const timer = setInterval(() => {
          setDisplayCost(prev => {
            if (prev + increment >= metrics.cost_saved) {
              clearInterval(timer);
              return metrics.cost_saved;
            }
            return prev + increment;
          });
        }, 50);
        return () => clearInterval(timer);
      }
    }, [metrics.cost_saved]);

    const renderBackdrop = (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Live Metrics</Text>
          
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <View style={styles.metricIcon}>
                <Ionicons name="flash" size={24} color="#FF9900" />
              </View>
              <Text style={styles.metricValue}>{displayResolutions.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>AI Resolutions</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricIcon}>
                <Ionicons name="time" size={24} color="#10B981" />
              </View>
              <Text style={styles.metricValue}>{metrics.avg_resolution_time}</Text>
              <Text style={styles.metricLabel}>Avg Resolution Time</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricIcon}>
                <Ionicons name="star" size={24} color="#FFD700" />
              </View>
              <Text style={styles.metricValue}>{metrics.csat_score.toFixed(1)}/5</Text>
              <Text style={styles.metricLabel}>CSAT Score</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricIcon}>
                <Ionicons name="cash" size={24} color="#34D399" />
              </View>
              <Text style={styles.metricValue}>₹{displayCost.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Cost Saved Today</Text>
            </View>
          </View>
        </View>
      </BottomSheet>
    );
  }
);

MetricsBottomSheet.displayName = 'MetricsBottomSheet';

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: '#232F3E',
  },
  handleIndicator: {
    backgroundColor: '#6B7280',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricCard: {
    backgroundColor: '#37475A',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default MetricsBottomSheet;
