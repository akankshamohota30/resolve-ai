import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface QRCodeProps {
  metadata: {
    order_id: string;
    qr_data: string;
  };
}

export default function QRCode({ metadata }: QRCodeProps) {
  return (
    <View style={styles.container}>
      <View style={styles.qrBox}>
        <View style={styles.qrPattern}>
          {/* Simple QR-like pattern */}
          <View style={styles.qrRow}>
            <View style={styles.qrDot} />
            <View style={[styles.qrDot, styles.qrEmpty]} />
            <View style={styles.qrDot} />
            <View style={styles.qrDot} />
          </View>
          <View style={styles.qrRow}>
            <View style={styles.qrDot} />
            <View style={styles.qrDot} />
            <View style={[styles.qrDot, styles.qrEmpty]} />
            <View style={styles.qrDot} />
          </View>
          <View style={styles.qrRow}>
            <View style={[styles.qrDot, styles.qrEmpty]} />
            <View style={styles.qrDot} />
            <View style={styles.qrDot} />
            <View style={[styles.qrDot, styles.qrEmpty]} />
          </View>
          <View style={styles.qrRow}>
            <View style={styles.qrDot} />
            <View style={[styles.qrDot, styles.qrEmpty]} />
            <View style={styles.qrDot} />
            <View style={styles.qrDot} />
          </View>
        </View>
        <Text style={styles.qrCode}>{metadata.qr_data}</Text>
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
  qrBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  qrPattern: {
    width: 120,
    height: 120,
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  qrRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  qrDot: {
    width: 20,
    height: 20,
    backgroundColor: '#000000',
    borderRadius: 2,
  },
  qrEmpty: {
    backgroundColor: 'transparent',
  },
  qrCode: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
});
