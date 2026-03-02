/**
 * FoodMap tab - Food discovery grid
 */

import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ui/ThemedText';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SkeletonList } from '@/components/ui/SkeletonLoader';
import { useTheme } from '@/hooks/useTheme';
import { FOOD_CATEGORIES, type FoodCategory } from '@/constants/nutrients';
import { Spacing, Colors, BorderRadius } from '@/constants/theme';
import type { FoodMapEntry } from '@/types/nutrition';

export default function FoodMapScreen() {
  const { theme } = useTheme();
  const [foods, setFoods] = useState<FoodMapEntry[]>([]);
  const [filteredFoods, setFilteredFoods] = useState<FoodMapEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory>('all');

  const loadFoods = useCallback(async () => {
    try {
      setIsLoading(true);
      // Mock: no Supabase, start with empty food map
      // Foods will accumulate in-memory when user scans food via the camera
      setFoods([]);
      setFilteredFoods([]);
    } catch (error) {
      console.error('Load foods error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  useEffect(() => {
    let result = foods;

    // Filter by search query
    if (searchQuery) {
      result = result.filter((f) =>
        f.food_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter((f) => f.category === selectedCategory);
    }

    setFilteredFoods(result);
  }, [searchQuery, selectedCategory, foods]);

  const progressPercent = Math.min(1, foods.length / 100); // 100 foods = 100%

  const renderFoodItem = useCallback(
    ({ item, index }: { item: FoodMapEntry; index: number }) => (
      <Card
        style={styles.foodCard}
        onPress={() => {
          // TODO: Open detail modal
        }}
      >
        <View style={styles.foodHeader}>
          <ThemedText variant="bodyMedium" numberOfLines={2}>
            {item.food_name}
          </ThemedText>
        </View>
        <View style={styles.foodStats}>
          <ThemedText variant="labelSmall" color={theme.textMuted}>
            {item.times_scanned}x scanned
          </ThemedText>
          {item.avg_calories && (
            <ThemedText variant="labelSmall" color={theme.primary}>
              ~{Math.round(item.avg_calories)} cal
            </ThemedText>
          )}
        </View>
      </Card>
    ),
    [theme]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText variant="h2">FoodMap 🗺️</ThemedText>
        <ThemedText variant="label" color={theme.textMuted}>
          You've discovered {foods.length} foods
        </ThemedText>
        
        {/* Progress bar */}
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.primary,
                width: `${progressPercent * 100}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
          <Ionicons name="search" size={20} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search foods..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category filters */}
      <FlatList
        horizontal
        data={FOOD_CATEGORIES}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        style={styles.categoryList}
        contentContainerStyle={styles.categoryContent}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.categoryPill,
              {
                backgroundColor:
                  selectedCategory === item.key ? theme.primary : theme.card,
              },
            ]}
            onPress={() => setSelectedCategory(item.key)}
          >
            <ThemedText style={styles.categoryEmoji}>{item.icon}</ThemedText>
            <ThemedText
              variant="label"
              color={selectedCategory === item.key ? 'white' : theme.text}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        )}
      />

      {/* Food grid */}
      {isLoading ? (
        <SkeletonList count={6} style={styles.skeletonList} />
      ) : filteredFoods.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={64} color={theme.textMuted} />
          <ThemedText
            variant="h3"
            align="center"
            style={styles.emptyTitle}
          >
            Your food world is empty
          </ThemedText>
          <ThemedText
            variant="body"
            color={theme.textMuted}
            align="center"
            style={styles.emptyText}
          >
            Start scanning foods to build your personal food map!
          </ThemedText>
          <Pressable
            style={[styles.scanButton, { backgroundColor: theme.primary }]}
            onPress={() => router.push('/(tabs)/camera')}
          >
            <Ionicons name="camera" size={24} color="white" />
            <ThemedText variant="button" color="white" style={styles.scanButtonText}>
              Start Scanning
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredFoods}
          renderItem={renderFoodItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
  },
  categoryList: {
    maxHeight: 44,
    marginBottom: Spacing.md,
  },
  categoryContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginRight: Spacing.sm,
  },
  categoryEmoji: {
    marginRight: Spacing.xs,
  },
  skeletonList: {
    paddingHorizontal: Spacing.xl,
  },
  gridContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['4xl'],
  },
  foodCard: {
    flex: 1,
    margin: Spacing.xs,
    minHeight: 100,
  },
  foodHeader: {
    flex: 1,
  },
  foodStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    marginBottom: Spacing.xl,
    maxWidth: 250,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  scanButtonText: {
    marginLeft: Spacing.sm,
  },
});
