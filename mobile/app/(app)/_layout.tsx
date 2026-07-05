import { Tabs, router } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Spacing, FontSize, Radius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { isBeta } from '../../lib/betaConfig';
import { Analytics } from '../../lib/analytics';
import { useEffect } from 'react';

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  focused: boolean;
  isScan?: boolean;
};

function TabIcon({ name, color, label, focused, isScan }: TabIconProps) {
  const { colors } = useTheme();

  if (isScan) {
    return (
      <View style={styles.tabItem}>
        <View style={[styles.scanPill, { backgroundColor: focused ? colors.accent : colors.accent + '28' }]}>
          <Ionicons name={name} size={20} color={focused ? '#FFF' : colors.accent} />
        </View>
        <Text style={[styles.tabLabel, { color: focused ? colors.accent : colors.textSecondary, fontWeight: focused ? '700' : '500' }]}>
          Scanner
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabItem}>
      <View style={[styles.tabIconWrap, focused && { backgroundColor: colors.accent + '20' }]}>
        <Ionicons name={name} size={22} color={color} />
      </View>
      <Text style={[styles.tabLabel, { color, fontWeight: focused ? '700' : '500' }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function getTabBarStyle(colors: ReturnType<typeof useTheme>['colors'], bottomInset = 0) {
  return {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 76 + bottomInset,
    paddingBottom: 10 + bottomInset,
    paddingTop: 8,
  };
}

export default function AppLayout() {
  const { colors } = useTheme();
  const { user, isLoading } = useAuth();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/(auth)/welcome');
    }
  }, [user, isLoading]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: getTabBarStyle(colors, Platform.OS === 'web' ? 0 : insets.bottom),
        tabBarShowLabel: false,
        tabBarItemStyle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={{ focus: () => Analytics.tabViewed('home') }}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} label="Home" focused={focused} />
          ),
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          href: isBeta ? null : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'bookmark' : 'bookmark-outline'} color={color} label="Saved" focused={focused} />
          ),
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      />
      <Tabs.Screen
        name="scan"
        listeners={{ focus: () => Analytics.tabViewed('scan') }}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="scan" color={color} label="Scan" focused={focused} isScan />
          ),
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      />
      <Tabs.Screen
        name="connections"
        listeners={{ focus: () => Analytics.tabViewed('connections') }}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'people' : 'people-outline'} color={color} label="Connects" focused={focused} />
          ),
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      />
      <Tabs.Screen
        name="profile"
        listeners={{ focus: () => Analytics.tabViewed('profile') }}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} color={color} label="Card" focused={focused} />
          ),
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabIconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  scanPill: {
    width: 52,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
