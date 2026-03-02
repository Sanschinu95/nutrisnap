/**
 * Tab layout - Bottom navigation
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, Typography } from '@/constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  iconActive: IoniconsName;
  iconInactive: IoniconsName;
  iconSize?: number;
}

const TAB_CONFIG: TabConfig[] = [
  {
    name: 'camera',
    title: 'Camera',
    iconActive: 'camera',
    iconInactive: 'camera-outline',
    iconSize: 28, // Larger for primary action
  },
  {
    name: 'plan',
    title: 'Plan',
    iconActive: 'calendar',
    iconInactive: 'calendar-outline',
  },
  {
    name: 'profile',
    title: 'Profile',
    iconActive: 'person-circle',
    iconInactive: 'person-circle-outline',
  },
  {
    name: 'foodmap',
    title: 'FoodMap',
    iconActive: 'map',
    iconInactive: 'map-outline',
  },
  {
    name: 'social',
    title: 'Social',
    iconActive: 'people',
    iconInactive: 'people-outline',
  },
];

export default function TabLayout() {
  const { theme, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: Spacing.lg,
          paddingTop: Spacing.sm,
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: {
          fontFamily: Typography.fonts.bodyMedium,
          fontSize: 10,
        },
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.iconActive : tab.iconInactive}
                size={tab.iconSize ?? 24}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
