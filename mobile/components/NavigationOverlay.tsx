import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Magnetometer } from 'expo-sensors';
import { Route } from '../lib/dijkstra';

interface Props {
  route: Route;
  targetBearing: number;
  bottomOffset?: number;
}

function compassBearing(mag: { x: number; y: number }): number {
  const angle = Math.atan2(mag.y, mag.x) * (180 / Math.PI);
  return (angle + 360) % 360;
}

export default function NavigationOverlay({ targetBearing, bottomOffset = 90 }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Magnetometer.setUpdateInterval(300);
    const sub = Magnetometer.addListener(data => {
      const h = compassBearing(data);
      const arrow = (targetBearing - h + 360) % 360;
      Animated.timing(rotation, {
        toValue: arrow,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    return () => sub.remove();
  }, [targetBearing, rotation]);

  const arrowDeg = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]}>
      <Animated.Text style={[styles.arrow, { transform: [{ rotate: arrowDeg }] }]}>
        ↑
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#3498db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 8,
  },
  arrow: { fontSize: 20, color: '#3498db', fontWeight: '900' },
});
