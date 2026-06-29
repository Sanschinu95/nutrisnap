/**
 * In-brand feedback form for bug reports / feature requests / contact support.
 * Replaces the legacy local-only feedback flow on the profile screen.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ui/ThemedText';
import { BorderRadius, Colors, Spacing, Typography } from '@/constants/theme';
import { submitUserFeedback, type UserFeedbackType } from '@/lib/userFeedback';
import { uploadFeedbackScreenshot } from '@/lib/cloudinary';
import { trackEvent } from '@/lib/telemetry';

const TYPE_TITLE: Record<UserFeedbackType, string> = {
  bug_report: 'Report a bug',
  feature_request: 'Request a feature',
  contact_support: 'Contact support',
};

const TYPE_DESCRIPTION_PLACEHOLDER: Record<UserFeedbackType, string> = {
  bug_report: 'What happened? What did you expect?',
  feature_request: 'Describe the feature you’d like',
  contact_support: 'How can we help?',
};

interface Props {
  type: UserFeedbackType;
  userId: string;
  onClose: () => void;
}

export function UserFeedbackForm({ type, userId, onClose }: Props) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [screenshotUploaded, setScreenshotUploaded] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = description.trim().length > 0 && !submitting;

  const handleAttach = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (res.canceled || !res.assets[0]?.uri) return;
      const uri = res.assets[0].uri;
      setScreenshotUri(uri);
      setUploadingScreenshot(true);
      const url = await uploadFeedbackScreenshot(uri, userId);
      setScreenshotUploaded(url);
      setUploadingScreenshot(false);
    } catch {
      setUploadingScreenshot(false);
      setError("Couldn't attach that screenshot. Try another.");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitUserFeedback({
        userId,
        type,
        title: subject,
        description,
        screenshotUrl: screenshotUploaded,
      });
      trackEvent('feedback_submitted', { type });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      // Brief pause so the confirmation registers, then close.
      setTimeout(onClose, 1200);
    } catch (err) {
      console.warn('Feedback submit failed:', err);
      setError("Couldn't send feedback. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={styles.card}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={28} color={Colors.white} />
        </View>
        <ThemedText variant="h3" align="center" style={styles.successTitle}>
          Thanks! We’ve received your feedback.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ThemedText variant="h3">{TYPE_TITLE[type]}</ThemedText>
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={Colors.muted} />
        </Pressable>
      </View>

      <TextInput
        value={subject}
        onChangeText={setSubject}
        placeholder="Brief summary"
        placeholderTextColor={Colors.muted}
        style={styles.subjectInput}
        maxLength={120}
      />

      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={TYPE_DESCRIPTION_PLACEHOLDER[type]}
        placeholderTextColor={Colors.muted}
        style={styles.descInput}
        multiline
        textAlignVertical="top"
        maxLength={2000}
      />

      <Pressable style={styles.attachButton} onPress={handleAttach} disabled={uploadingScreenshot}>
        {uploadingScreenshot ? (
          <ActivityIndicator size="small" color={Colors.muted} />
        ) : (
          <Ionicons name={screenshotUri ? 'image' : 'image-outline'} size={16} color={Colors.muted} />
        )}
        <ThemedText variant="label" color={Colors.muted}>
          {screenshotUri ? (screenshotUploaded ? 'Screenshot attached' : 'Uploading…') : 'Attach screenshot'}
        </ThemedText>
      </Pressable>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
          <ThemedText variant="label" color={Colors.error} style={{ flex: 1 }}>
            {error}
          </ThemedText>
        </View>
      )}

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <ThemedText variant="button" color={Colors.white}>Send</ThemedText>
        )}
      </Pressable>
    </View>
  );
}

const SUBMIT_GREEN = '#22C55E';

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectInput: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    fontFamily: Typography.fonts.body,
    fontSize: 14,
    color: Colors.brown,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  descInput: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    fontFamily: Typography.fonts.body,
    fontSize: 14,
    color: Colors.brown,
    minHeight: 120,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  attachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.errorLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  submitButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: SUBMIT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SUBMIT_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: Spacing.md,
  },
  successTitle: {
    marginVertical: Spacing.md,
  },
});
