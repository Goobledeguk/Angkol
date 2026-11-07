import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import type { DimensionValue } from "react-native";

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Reusable pulsing/shimmering placeholder component */
export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => {
      pulse.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

/** Pre-rendered card skeleton */
export function CardSkeleton({
  height = 140,
  style,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, { minHeight: height }, style]}>
      <View style={styles.cardHeader}>
        <Skeleton width="45%" height={18} borderRadius={6} />
        <Skeleton width="20%" height={16} borderRadius={12} />
      </View>
      <Skeleton width="80%" height={14} borderRadius={4} />
      <Skeleton width="100%" height={44} borderRadius={10} style={{ marginTop: 8 }} />
    </View>
  );
}

/** Pre-rendered list item skeleton */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={15} borderRadius={4} />
            <Skeleton width="38%" height={12} borderRadius={4} />
          </View>
          <Skeleton width={50} height={22} borderRadius={12} />
        </View>
      ))}
    </View>
  );
}

/** Pre-rendered table skeleton for Admin web tables */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Skeleton width="22%" height={16} />
        <Skeleton width="28%" height={16} />
        <Skeleton width="20%" height={16} />
        <Skeleton width="18%" height={16} />
      </View>
      {Array.from({ length: rows }).map((_, idx) => (
        <View key={idx} style={styles.tableRow}>
          <Skeleton width="20%" height={14} />
          <Skeleton width="30%" height={14} />
          <Skeleton width="18%" height={14} />
          <Skeleton width="15%" height={14} />
        </View>
      ))}
    </View>
  );
}

/** Pre-rendered stat metric cards */
export function StatsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.statsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.statBox}>
          <Skeleton width="40%" height={12} borderRadius={4} />
          <Skeleton width="65%" height={26} borderRadius={6} style={{ marginVertical: 6 }} />
          <Skeleton width="50%" height={11} borderRadius={4} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#D9E3DC",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E7EFEA",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  list: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#E3ECE6",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "#F4F7F5",
    borderBottomWidth: 1,
    borderColor: "#E3ECE6",
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderColor: "#EEF4F0",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  statBox: {
    flex: 1,
    minWidth: 130,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E7EFEA",
  },
});
