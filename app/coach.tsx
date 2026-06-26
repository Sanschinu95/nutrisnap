/**
 * NutriSnap Coach — single screen with two visual states (landing + chat).
 *
 * The system prompt for every call is rebuilt fresh via buildCoachContext()
 * so the coach always sees the latest 7-day data, not a snapshot from when
 * the screen first mounted.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { ThemedText } from '@/components/ui/ThemedText';
import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { useCoachStore, type ChatMessage } from '@/stores/coach.store';
import { useUserStore } from '@/stores/user.store';
import { buildCoachContext, type DataInsight } from '@/lib/coachContext';
import { sendCoachMessage, type CoachMessage } from '@/lib/coachApi';
import { trackEvent } from '@/lib/telemetry';
import { Typography } from '@/constants/theme';

const COACH_BLUE = '#3D8BFF';
const CREAM = '#F7F4EE';
const TEXT_PRIMARY = '#2F241E';
const TEXT_MUTED = '#8a7e74';
const SOFT_CREAM = '#f7f2ea';

type ScreenState = 'landing' | 'chat';

interface QuickPrompt {
  emoji: string;
  text: string;
}

const QUICK_QUESTIONS: QuickPrompt[] = [
  { emoji: '🍱', text: 'High-protein meals under ₹200' },
  { emoji: '📈', text: 'Review my week' },
  { emoji: '🥗', text: 'Plan tomorrow’s meals' },
  { emoji: '💪', text: 'Why am I not hitting protein?' },
];

const LEARN_PROMPTS: QuickPrompt[] = [
  { emoji: '🥜', text: 'Calories vs macros explained' },
  { emoji: '🍚', text: 'Should I cut carbs?' },
  { emoji: '🥑', text: 'Are healthy fats important?' },
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function CoachScreen() {
  const profile = useUserStore((s) => s.profile);
  const {
    messages,
    isLoading,
    pinnedInsight,
    addMessage,
    setLoading,
    canAskQuestion,
    incrementQuestionCount,
    getRemainingQuestions,
    pinInsight,
    loadPersistedState,
  } = useCoachStore();

  const [view, setView] = useState<ScreenState>('landing');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [insights, setInsights] = useState<DataInsight[]>([]);
  const [inputText, setInputText] = useState('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [showLimit, setShowLimit] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState<{
    text: string;
    messageId: string;
  } | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayName = useMemo(() => {
    if (!profile?.name) return '';
    return profile.name.split(' ')[0];
  }, [profile?.name]);

  const remaining = getRemainingQuestions();
  const hasNutritionData = insights.length > 0 || messages.length > 0;

  useEffect(() => {
    trackEvent('coach_opened');
    loadPersistedState();
    (async () => {
      try {
        const ctx = await buildCoachContext();
        setSystemPrompt(ctx.systemPrompt);
        setInsights(ctx.dataInsights);
      } catch {
        // Context build failures shouldn't break the screen — leave defaults.
      }
    })();
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, [loadPersistedState]);

  useEffect(() => {
    if (view === 'chat') {
      // Scroll to bottom on new message or typing change.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [view, messages.length, isLoading]);

  const showError = useCallback((message: string) => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    setErrorBanner(message);
    errorTimer.current = setTimeout(() => setErrorBanner(null), 4000);
  }, []);

  const send = useCallback(
    async (text: string, eventSource: 'insight' | 'suggestion' | 'custom') => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      if (!canAskQuestion()) {
        trackEvent('coach_limit_reached');
        setShowLimit(true);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (eventSource === 'insight') trackEvent('coach_insight_tapped');
      else if (eventSource === 'suggestion') trackEvent('coach_suggestion_tapped');
      else trackEvent('coach_custom_prompt', { length: trimmed.length });

      setView('chat');
      setInputText('');
      setErrorBanner(null);

      const userMsg: ChatMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
        action: null,
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setLoading(true);

      // Refresh the context on every send so the coach sees today's latest data.
      let prompt = systemPrompt;
      try {
        const ctx = await buildCoachContext();
        prompt = ctx.systemPrompt;
        setSystemPrompt(ctx.systemPrompt);
      } catch {
        // Stale prompt is fine if the rebuild fails.
      }

      const history: CoachMessage[] = useCoachStore
        .getState()
        .messages.slice(0, -1) // drop the user msg we just added — sendCoachMessage adds it
        .map((m) => ({
          role: m.role,
          content:
            m.role === 'assistant' && m.action
              ? `${m.content}\nACTION: ${m.action}`
              : m.content,
        }));

      try {
        const response = await sendCoachMessage(prompt, history, trimmed);
        incrementQuestionCount();
        addMessage({
          id: newId(),
          role: 'assistant',
          content: response.text,
          action: response.action,
          timestamp: Date.now(),
        });
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        if (code === 'COACH_BUSY') {
          showError('The coach is taking a breather. Try again in a minute.');
        } else if (code === 'COACH_UNAVAILABLE') {
          showError('Couldn’t reach the coach right now. Your question is saved.');
        } else {
          showError('No connection. Try again when you’re back online.');
        }
      } finally {
        setLoading(false);
      }
    },
    [
      addMessage,
      canAskQuestion,
      incrementQuestionCount,
      isLoading,
      setLoading,
      showError,
      systemPrompt,
    ],
  );

  const handlePin = useCallback(
    (text: string, messageId: string) => {
      if (pinnedInsight && pinnedInsight.fromMessageId !== messageId) {
        setReplaceConfirm({ text, messageId });
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      pinInsight(text, messageId);
      trackEvent('coach_action_pinned');
    },
    [pinnedInsight, pinInsight],
  );

  const confirmReplace = useCallback(() => {
    if (!replaceConfirm) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    pinInsight(replaceConfirm.text, replaceConfirm.messageId);
    trackEvent('coach_action_pinned', { replaced: true });
    setReplaceConfirm(null);
  }, [pinInsight, replaceConfirm]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {view === 'landing' ? (
          <LandingView
            displayName={displayName}
            hasData={hasNutritionData}
            insights={insights}
            inputText={inputText}
            setInputText={setInputText}
            remaining={remaining}
            onSendInsight={(insight) => send(insight.followUp, 'insight')}
            onSendQuick={(prompt) => send(prompt.text, 'suggestion')}
            onSendCustom={() => send(inputText, 'custom')}
            onClose={() => router.back()}
          />
        ) : (
          <ChatView
            messages={messages}
            isLoading={isLoading}
            errorBanner={errorBanner}
            inputText={inputText}
            setInputText={setInputText}
            pinnedInsight={pinnedInsight}
            scrollRef={scrollRef}
            onBack={() => setView('landing')}
            onSendCustom={() => send(inputText, 'custom')}
            onPin={handlePin}
          />
        )}
      </KeyboardAvoidingView>

      {showLimit && (
        <LimitModal onClose={() => setShowLimit(false)} />
      )}

      {replaceConfirm && (
        <ReplacePinModal
          onCancel={() => setReplaceConfirm(null)}
          onConfirm={confirmReplace}
        />
      )}
    </SafeAreaView>
  );
}

/* ─── Landing view ─────────────────────────────────────────── */

interface LandingViewProps {
  displayName: string;
  hasData: boolean;
  insights: DataInsight[];
  inputText: string;
  setInputText: (s: string) => void;
  remaining: number;
  onSendInsight: (insight: DataInsight) => void;
  onSendQuick: (prompt: QuickPrompt) => void;
  onSendCustom: () => void;
  onClose: () => void;
}

function LandingView(props: LandingViewProps) {
  const {
    displayName,
    hasData,
    insights,
    inputText,
    setInputText,
    remaining,
    onSendInsight,
    onSendQuick,
    onSendCustom,
    onClose,
  } = props;

  const greeting = displayName ? `Hey ${displayName}, what's on your mind?` : "What's on your mind?";
  const subtext = hasData
    ? "I've looked at your recent nutrition data."
    : "Start logging meals and I'll learn your habits.";

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Pressable style={styles.iconButton} onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
        </Pressable>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.landingScroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(300).springify()}>
          <ThemedText style={styles.greeting}>{greeting}</ThemedText>
          <ThemedText variant="body" color={TEXT_MUTED} style={styles.subtext}>
            {subtext}
          </ThemedText>
        </Animated.View>

        {insights.length > 0 && (
          <View style={styles.insightsBlock}>
            {insights.map((insight, idx) => (
              <Animated.View
                key={`${insight.emoji}-${idx}`}
                entering={FadeInDown.delay(80 + idx * 60).springify()}
              >
                <Pressable
                  style={styles.insightCard}
                  onPress={() => onSendInsight(insight)}
                >
                  <View style={styles.insightIcon}>
                    <ThemedText style={styles.insightEmoji}>{insight.emoji}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.insightText}>{insight.text}</ThemedText>
                    <ThemedText style={styles.insightTap}>Tap to discuss</ThemedText>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Quick questions</ThemedText>
          <View style={styles.pillRow}>
            {QUICK_QUESTIONS.map((q) => (
              <Pressable key={q.text} style={styles.pill} onPress={() => onSendQuick(q)}>
                <ThemedText style={styles.pillEmoji}>{q.emoji}</ThemedText>
                <ThemedText style={styles.pillText}>{q.text}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Learn</ThemedText>
          <View style={styles.pillRow}>
            {LEARN_PROMPTS.map((q) => (
              <Pressable key={q.text} style={styles.pill} onPress={() => onSendQuick(q)}>
                <ThemedText style={styles.pillEmoji}>{q.emoji}</ThemedText>
                <ThemedText style={styles.pillText}>{q.text}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <InputBar
        value={inputText}
        onChangeText={setInputText}
        onSubmit={onSendCustom}
        remaining={remaining}
      />
    </View>
  );
}

/* ─── Chat view ─────────────────────────────────────────────── */

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  errorBanner: string | null;
  inputText: string;
  setInputText: (s: string) => void;
  pinnedInsight: ReturnType<typeof useCoachStore.getState>['pinnedInsight'];
  scrollRef: React.RefObject<ScrollView | null>;
  onBack: () => void;
  onSendCustom: () => void;
  onPin: (text: string, messageId: string) => void;
}

function ChatView(props: ChatViewProps) {
  const {
    messages,
    isLoading,
    errorBanner,
    inputText,
    setInputText,
    pinnedInsight,
    scrollRef,
    onBack,
    onSendCustom,
    onPin,
  } = props;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={COACH_BLUE} />
          <ThemedText style={styles.backLabel}>Back</ThemedText>
        </Pressable>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.chatScroll}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={styles.userBubbleWrap}>
              <View style={styles.userBubble}>
                <ThemedText style={styles.userBubbleText}>{m.content}</ThemedText>
              </View>
            </View>
          ) : (
            <View key={m.id} style={styles.assistantWrap}>
              <ThemedText style={styles.assistantText}>{m.content}</ThemedText>
              {m.action && (
                <View style={styles.actionCard}>
                  <ThemedText style={styles.actionLabel}>Your action</ThemedText>
                  <ThemedText style={styles.actionText}>{m.action}</ThemedText>
                  <PinButton
                    text={m.action}
                    messageId={m.id}
                    isPinned={pinnedInsight?.fromMessageId === m.id}
                    onPin={onPin}
                  />
                </View>
              )}
            </View>
          ),
        )}
        {isLoading && <TypingIndicator />}
      </ScrollView>

      {errorBanner && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.errorBanner}
        >
          <Ionicons name="alert-circle-outline" size={16} color={TEXT_PRIMARY} />
          <ThemedText style={styles.errorText}>{errorBanner}</ThemedText>
        </Animated.View>
      )}

      <InputBar
        value={inputText}
        onChangeText={setInputText}
        onSubmit={onSendCustom}
      />
    </View>
  );
}

function PinButton({
  text,
  messageId,
  isPinned,
  onPin,
}: {
  text: string;
  messageId: string;
  isPinned: boolean;
  onPin: (text: string, messageId: string) => void;
}) {
  return (
    <Pressable
      style={styles.pinButton}
      onPress={() => !isPinned && onPin(text, messageId)}
      hitSlop={8}
      disabled={isPinned}
    >
      <ThemedText
        style={[styles.pinButtonText, isPinned && styles.pinButtonTextPinned]}
      >
        {isPinned ? '📌 Pinned' : '📌 Pin to Home'}
      </ThemedText>
    </Pressable>
  );
}

/* ─── Input bar ─────────────────────────────────────────────── */

function InputBar({
  value,
  onChangeText,
  onSubmit,
  remaining,
}: {
  value: string;
  onChangeText: (s: string) => void;
  onSubmit: () => void;
  remaining?: number;
}) {
  const disabled = value.trim().length === 0;
  return (
    <View style={styles.inputBarWrap}>
      <View style={styles.inputBar}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask anything about your nutrition..."
          placeholderTextColor={TEXT_MUTED}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={onSubmit}
          multiline
          maxLength={400}
        />
        <Pressable
          style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
          onPress={onSubmit}
          disabled={disabled}
        >
          <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
      {remaining !== undefined && (
        <ThemedText style={styles.counter}>
          {remaining} of 5 questions left today
        </ThemedText>
      )}
    </View>
  );
}

/* ─── Modals ───────────────────────────────────────────────── */

function LimitModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    trackEvent('coach_premium_viewed');
  }, []);

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View entering={FadeInDown.springify().damping(15)} style={styles.modalCard}>
          <ThemedText style={styles.modalTitle}>You’ve hit today’s limit</ThemedText>
          <ThemedText style={styles.modalBody}>
            Come back tomorrow for 5 more questions. Or upgrade for unlimited coaching.
          </ThemedText>
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              trackEvent('coach_premium_tapped');
              onClose();
            }}
          >
            <ThemedText style={styles.primaryButtonText}>Upgrade to Premium</ThemedText>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} style={{ marginTop: 12 }}>
            <ThemedText style={styles.secondaryButtonText}>Maybe later</ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ReplacePinModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <Animated.View entering={FadeInDown.springify().damping(15)} style={styles.modalCard}>
          <ThemedText style={styles.modalTitle}>Replace pinned insight?</ThemedText>
          <ThemedText style={styles.modalBody}>
            Your current pinned insight will be replaced with this one.
          </ThemedText>
          <Pressable style={styles.primaryButton} onPress={onConfirm}>
            <ThemedText style={styles.primaryButtonText}>Replace</ThemedText>
          </Pressable>
          <Pressable onPress={onCancel} hitSlop={8} style={{ marginTop: 12 }}>
            <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ─── Styles ───────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 12,
  },
  backLabel: {
    color: COACH_BLUE,
    fontSize: 13,
    fontFamily: Typography.fonts.bodyMedium,
    marginLeft: 2,
  },

  /* landing */
  landingScroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  greeting: {
    fontFamily: Typography.fonts.serifBold,
    fontSize: 22,
    lineHeight: 30,
    color: TEXT_PRIMARY,
  },
  subtext: {
    marginTop: 6,
    fontSize: 13,
    color: TEXT_MUTED,
  },
  insightsBlock: {
    marginTop: 20,
    gap: 10,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightEmoji: { fontSize: 18 },
  insightText: { fontSize: 13, color: TEXT_PRIMARY, lineHeight: 19 },
  insightTap: { marginTop: 6, fontSize: 11, color: COACH_BLUE, fontWeight: '500' },

  section: {
    marginTop: 24,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontFamily: Typography.fonts.bodyMedium,
    letterSpacing: 0.3,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  pillEmoji: { fontSize: 14 },
  pillText: { fontSize: 13, color: TEXT_PRIMARY },

  /* chat */
  chatScroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 4,
  },
  userBubbleWrap: {
    alignItems: 'flex-end',
    marginVertical: 6,
  },
  userBubble: {
    backgroundColor: COACH_BLUE,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: '85%',
  },
  userBubbleText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 21,
  },
  assistantWrap: {
    alignItems: 'flex-start',
    marginVertical: 6,
    maxWidth: '92%',
    gap: 10,
  },
  assistantText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 24,
  },
  actionCard: {
    backgroundColor: SOFT_CREAM,
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
    gap: 4,
    alignSelf: 'stretch',
  },
  actionLabel: { fontSize: 11, color: TEXT_MUTED },
  actionText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontFamily: Typography.fonts.bodySemiBold,
    lineHeight: 18,
  },
  pinButton: { marginTop: 6 },
  pinButtonText: {
    fontSize: 12,
    color: COACH_BLUE,
    fontFamily: Typography.fonts.bodyMedium,
  },
  pinButtonTextPinned: { color: TEXT_MUTED },

  /* error banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SOFT_CREAM,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: TEXT_PRIMARY,
  },

  /* input bar */
  inputBarWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    paddingLeft: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  input: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontFamily: Typography.fonts.body,
    maxHeight: 100,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COACH_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  counter: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 11,
    color: TEXT_MUTED,
  },

  /* modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: Typography.fonts.serifBold,
    fontSize: 20,
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 20,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: COACH_BLUE,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Typography.fonts.bodySemiBold,
  },
  secondaryButtonText: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
});
