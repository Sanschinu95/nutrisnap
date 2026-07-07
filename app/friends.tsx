/**
 * Friends & Leaderboards.
 *
 * Privacy: friends only ever see streak + consistency (never meals, calories,
 * macros, weight, or photos). All reads go through the friend-scoped RPCs in
 * docs/migration_social.sql.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/react/shallow';
import { ThemedText } from '@/components/ui/ThemedText';
import { Typography } from '@/constants/theme';
import { trackEvent } from '@/lib/telemetry';
import { useAuthStore } from '@/stores/auth.store';
import { useUserStore } from '@/stores/user.store';
import {
  useSocialStore, type FriendProfile, type LeaderboardEntry, type LeaderboardPeriod,
} from '@/stores/social.store';

const CREAM = '#F7F4EE';
const CARD = '#FFFFFF';
const PRIMARY = '#2F241E';
const MUTED = '#8a7e74';
const GREEN = '#22C55E';
const BLUE = '#3D8BFF';
const GREEN_TINT = '#eaf6ec';

const CODE_RE = /^NUTRI-[A-Z0-9]{6}$/;
const INVITE_LINK = 'https://nyurix.app';

function formatCode(raw: string): string {
  const alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = alnum.startsWith('NUTRI') ? alnum.slice(5) : alnum;
  return body.length ? `NUTRI-${body.slice(0, 6)}` : 'NUTRI-';
}

function initial(name: string | null): string {
  return name?.trim()?.[0]?.toUpperCase() ?? '?';
}

export default function FriendsScreen() {
  const selfId = useAuthStore((s) => s.user?.id ?? null);
  const friendCode = useUserStore((s) => s.friendCode);
  const isGhostMode = useUserStore((s) => s.isGhostMode);

  const {
    friends, incomingRequests, outgoingRequests, friendsLoading,
    qualifiedReferralCount, pendingReferralCount, hasEarnedProReward, proRewardExpiresAt,
    streakLeaderboard, consistencyLeaderboard,
    loadFriendsData, sendFriendRequest, respondToRequest, cancelRequest, removeFriend, loadLeaderboards,
  } = useSocialStore(
    useShallow((s) => ({
      friends: s.friends, incomingRequests: s.incomingRequests, outgoingRequests: s.outgoingRequests,
      friendsLoading: s.friendsLoading, qualifiedReferralCount: s.qualifiedReferralCount,
      pendingReferralCount: s.pendingReferralCount, hasEarnedProReward: s.hasEarnedProReward,
      proRewardExpiresAt: s.proRewardExpiresAt, streakLeaderboard: s.streakLeaderboard,
      consistencyLeaderboard: s.consistencyLeaderboard, loadFriendsData: s.loadFriendsData,
      sendFriendRequest: s.sendFriendRequest, respondToRequest: s.respondToRequest,
      cancelRequest: s.cancelRequest, removeFriend: s.removeFriend, loadLeaderboards: s.loadLeaderboards,
    })),
  );

  const [tab, setTab] = useState<'friends' | 'leaderboard'>('friends');
  const [metric, setMetric] = useState<'streak' | 'consistency'>('streak');
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [codeInput, setCodeInput] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [selected, setSelected] = useState<FriendProfile | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { loadFriendsData(); }, [loadFriendsData]);
  useEffect(() => {
    if (tab === 'leaderboard') {
      loadLeaderboards(period);
      trackEvent('leaderboard_viewed', { metric, period });
    }
  }, [tab, period, metric, loadLeaderboards]);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const validCode = CODE_RE.test(codeInput);

  const handleSend = useCallback(async () => {
    if (!validCode || sending) return;
    Haptics.selectionAsync();
    setSending(true);
    setFeedback(null);
    const res = await sendFriendRequest(codeInput);
    setFeedback({ ok: res.success, msg: res.message });
    if (res.success) {
      setCodeInput('');
      trackEvent('friend_request_sent', {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSending(false);
  }, [validCode, sending, codeInput, sendFriendRequest]);

  const shareCode = useCallback(async () => {
    if (!friendCode) return;
    Haptics.selectionAsync();
    trackEvent('friend_code_shared', {});
    await Share.share({
      message: `Add me on Nyurix! My friend code is ${friendCode}. Get the app: ${INVITE_LINK}`,
    }).catch(() => {});
  }, [friendCode]);

  const shareInvite = useCallback(async () => {
    Haptics.selectionAsync();
    trackEvent('referral_link_shared', {});
    await Share.share({
      message: `I've been using Nyurix to track my food. Join me — use my code ${friendCode ?? ''} to add me as a friend! ${INVITE_LINK}`,
    }).catch(() => {});
  }, [friendCode]);

  const handleRemove = useCallback((friend: FriendProfile) => {
    Haptics.selectionAsync();
    removeFriend(friend.friend_id);
    trackEvent('friend_removed', {});
    setSelected(null);
    flashToast('Friend removed');
  }, [removeFriend]);

  const activeBoard = metric === 'streak' ? streakLeaderboard : consistencyLeaderboard;
  const myEntry = useMemo(() => activeBoard.find((e) => e.user_id === selfId) ?? null, [activeBoard, selfId]);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.iconBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={PRIMARY} />
        </Pressable>
        <Text style={s.title}>Friends</Text>
        <Pressable style={s.iconBtn} onPress={shareCode}>
          <Ionicons name="share-outline" size={20} color={PRIMARY} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['friends', 'leaderboard'] as const).map((t) => (
          <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => { Haptics.selectionAsync(); setTab(t); }}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'friends' ? 'Friends' : 'Leaderboard'}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {tab === 'friends' ? (
          <>
            {/* Your code */}
            <View style={s.card}>
              <Text style={s.cardLabel}>Your friend code</Text>
              <Text style={s.codeBig}>{friendCode ?? '—'}</Text>
              <Pressable style={s.shareRow} onPress={shareCode}>
                <Ionicons name="share-outline" size={16} color={BLUE} />
                <Text style={[s.linkText, { color: BLUE }]}>Share code</Text>
              </Pressable>
            </View>

            {/* Add a friend */}
            <View style={s.card}>
              <Text style={s.cardLabel}>Add a friend</Text>
              <View style={s.addRow}>
                <TextInput
                  style={s.codeInput}
                  value={codeInput}
                  onChangeText={(v) => { setCodeInput(formatCode(v)); setFeedback(null); }}
                  placeholder="NUTRI-XXXXXX"
                  placeholderTextColor={MUTED}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={12}
                />
                <Pressable style={[s.sendBtn, (!validCode || sending) && s.disabled]} disabled={!validCode || sending} onPress={handleSend}>
                  {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={s.sendBtnText}>Send</Text>}
                </Pressable>
              </View>
              {feedback ? (
                <Text style={[s.feedback, { color: feedback.ok ? GREEN : '#C0392B' }]}>{feedback.msg}</Text>
              ) : null}
            </View>

            {/* Referral progress (placeholder reward until a Pro tier exists) */}
            <View style={[s.card, { backgroundColor: GREEN_TINT }]}>
              <View style={s.referralHead}>
                <Text style={{ fontSize: 20 }}>🎁</Text>
                <Text style={s.referralTitle}>Invite 10 friends → 1 month Pro</Text>
              </View>
              {hasEarnedProReward ? (
                <Text style={s.referralEarned}>
                  🎉 You’ve earned 1 month of Pro{proRewardExpiresAt ? ` (until ${new Date(proRewardExpiresAt).toLocaleDateString()})` : ''}
                </Text>
              ) : (
                <>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${Math.min(100, (qualifiedReferralCount / 10) * 100)}%` }]} />
                  </View>
                  <Text style={s.referralMeta}>
                    {qualifiedReferralCount} of 10 qualified{pendingReferralCount > 0 ? ` · ${pendingReferralCount} pending` : ''}
                  </Text>
                </>
              )}
              <Pressable style={s.inviteBtn} onPress={shareInvite}>
                <Ionicons name="share-social-outline" size={16} color="#FFF" />
                <Text style={s.inviteBtnText}>Invite more</Text>
              </Pressable>
            </View>

            {/* Requests */}
            {incomingRequests.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Requests</Text>
                {incomingRequests.map((r) => (
                  <View key={r.id} style={s.card}>
                    <View style={s.friendRow}>
                      <Avatar name={r.other_name} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.friendName}>{r.other_name ?? 'Nyurix user'}</Text>
                        <Text style={s.friendSub}>{r.other_code} · {timeAgo(r.created_at)}</Text>
                      </View>
                    </View>
                    <View style={s.requestActions}>
                      <Pressable style={[s.pill, { backgroundColor: GREEN }]} onPress={() => { respondToRequest(r.id, true); trackEvent('friend_request_accepted', {}); }}>
                        <Text style={s.pillText}>Accept</Text>
                      </Pressable>
                      <Pressable style={[s.pill, { backgroundColor: '#efe9e0' }]} onPress={() => { respondToRequest(r.id, false); trackEvent('friend_request_declined', {}); }}>
                        <Text style={[s.pillText, { color: PRIMARY }]}>Decline</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            )}
            {outgoingRequests.map((r) => (
              <View key={r.id} style={s.card}>
                <View style={s.friendRow}>
                  <Avatar name={r.other_name} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.friendName}>{r.other_name ?? 'Nyurix user'}</Text>
                    <Text style={s.friendSub}>{r.other_code} · Waiting…</Text>
                  </View>
                  <Pressable style={[s.pill, { backgroundColor: '#efe9e0' }]} onPress={() => cancelRequest(r.id)}>
                    <Text style={[s.pillText, { color: PRIMARY }]}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Friends list */}
            <Text style={s.sectionTitle}>Friends ({friends.length})</Text>
            {friendsLoading && friends.length === 0 ? (
              <View style={s.card}><ActivityIndicator color={GREEN} /></View>
            ) : friends.length === 0 ? (
              <View style={[s.card, s.emptyCard]}>
                <Ionicons name="people-outline" size={26} color={MUTED} />
                <Text style={s.emptyText}>No friends yet. Share your code to connect.</Text>
              </View>
            ) : (
              friends.map((f) => (
                <Pressable key={f.friend_id} style={s.card} onPress={() => { Haptics.selectionAsync(); setSelected(f); }}>
                  <View style={s.friendRow}>
                    <Avatar name={f.name} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.friendName}>{f.name ?? 'Nyurix user'} {f.is_ghost_mode ? '👻' : ''}</Text>
                      <Text style={s.friendSub}>{f.friend_code}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {f.is_ghost_mode ? (
                        <Text style={s.friendSub}>Hidden</Text>
                      ) : (
                        <>
                          <Text style={s.friendStat}>🔥 {f.current_streak ?? 0}</Text>
                          <Text style={s.friendSub}>{f.consistency_score ?? 0}/100</Text>
                        </>
                      )}
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </>
        ) : (
          <LeaderboardView
            metric={metric}
            setMetric={setMetric}
            period={period}
            setPeriod={setPeriod}
            board={activeBoard}
            myEntry={myEntry}
            selfId={selfId}
            friendCount={friends.length}
            isGhostMode={isGhostMode}
          />
        )}
      </ScrollView>

      {/* Friend detail modal */}
      <Modal transparent visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={s.modalOverlay} onPress={() => setSelected(null)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <View style={s.grabber} />
            {selected && (
              <>
                <Avatar name={selected.name} large />
                <Text style={s.modalName}>{selected.name ?? 'Nyurix user'}</Text>
                <Text style={s.modalCode}>{selected.friend_code}</Text>
                {selected.is_ghost_mode ? (
                  <Text style={s.ghostNote}>👻 Ghost mode — hidden from leaderboards</Text>
                ) : (
                  <View style={s.modalStats}>
                    <View style={s.modalStat}><Text style={s.modalStatValue}>🔥 {selected.current_streak ?? 0}</Text><Text style={s.friendSub}>day streak</Text></View>
                    <View style={s.modalStat}><Text style={s.modalStatValue}>{selected.consistency_score ?? 0}/100</Text><Text style={s.friendSub}>consistency</Text></View>
                  </View>
                )}
                <Pressable style={s.modalRemove} onPress={() => handleRemove(selected)}>
                  <Text style={s.modalRemoveText}>Remove friend</Text>
                </Pressable>
                <Pressable style={s.modalClose} onPress={() => setSelected(null)}>
                  <Text style={s.modalCloseText}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? <View pointerEvents="none" style={s.toast}><Text style={s.toastText}>{toast}</Text></View> : null}
    </SafeAreaView>
  );
}

function Avatar({ name, large }: { name: string | null; large?: boolean }) {
  const size = large ? 60 : 40;
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarText, large && { fontSize: 24 }]}>{initial(name)}</Text>
    </View>
  );
}

function LeaderboardView({
  metric, setMetric, period, setPeriod, board, myEntry, selfId, friendCount, isGhostMode,
}: {
  metric: 'streak' | 'consistency';
  setMetric: (m: 'streak' | 'consistency') => void;
  period: LeaderboardPeriod;
  setPeriod: (p: LeaderboardPeriod) => void;
  board: LeaderboardEntry[];
  myEntry: LeaderboardEntry | null;
  selfId: string | null;
  friendCount: number;
  isGhostMode: boolean;
}) {
  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);
  const fmt = (v: number) => (metric === 'streak' ? `${v}` : `${v}/100`);

  if (friendCount === 0) {
    return (
      <View style={[s.card, s.emptyCard]}>
        <Ionicons name="people-outline" size={26} color={MUTED} />
        <Text style={s.emptyText}>Add friends to see leaderboards.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={s.segment}>
        {(['streak', 'consistency'] as const).map((m) => (
          <Pressable key={m} style={[s.segBtn, metric === m && s.segActive]} onPress={() => { Haptics.selectionAsync(); setMetric(m); }}>
            <Text style={[s.segText, metric === m && s.segTextActive]}>{m === 'streak' ? 'Streak' : 'Consistency'}</Text>
          </Pressable>
        ))}
      </View>

      {/* Period control only applies to consistency (streak is always current). */}
      {metric === 'consistency' && (
        <View style={s.periodRow}>
          {(['weekly', 'monthly', 'all_time'] as const).map((p) => (
            <Pressable key={p} style={[s.periodBtn, period === p && s.periodActive]} onPress={() => { Haptics.selectionAsync(); setPeriod(p); }}>
              <Text style={[s.periodText, period === p && s.periodTextActive]}>{p === 'all_time' ? 'All time' : p === 'weekly' ? 'Weekly' : 'Monthly'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Your position */}
      {isGhostMode ? (
        <View style={[s.card, { backgroundColor: '#fdf3e3' }]}>
          <Text style={s.ghostNote}>You’re in ghost mode. Turn it off in Settings to appear on leaderboards.</Text>
        </View>
      ) : myEntry ? (
        <View style={[s.card, { backgroundColor: GREEN_TINT, alignItems: 'center' }]}>
          <Text style={s.cardLabel}>Your position</Text>
          <Text style={s.rankBig}>#{myEntry.rank}</Text>
          <Text style={s.friendSub}>of {board.length} · {fmt(myEntry.value)}</Text>
        </View>
      ) : null}

      {board.map((e) => {
        const isSelf = e.user_id === selfId;
        return (
          <View key={e.user_id} style={[s.card, s.rankRow, isSelf && { backgroundColor: GREEN_TINT }]}>
            <Text style={s.rankNum}>{medal(e.rank) ?? e.rank}</Text>
            <Avatar name={e.name} />
            <Text style={[s.friendName, { flex: 1, marginLeft: 10 }]} numberOfLines={1}>{isSelf ? 'You' : (e.name ?? 'Nyurix user')}</Text>
            <Text style={s.rankValue}>{fmt(e.value)}</Text>
          </View>
        );
      })}
    </>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  return 'just now';
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: CREAM },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: PRIMARY, fontFamily: Typography.fonts.headingBold, fontSize: 20 },

  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#ece5da', borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: '#FFF' },
  tabText: { color: MUTED, fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },
  tabTextActive: { color: PRIMARY },

  content: { padding: 16, paddingBottom: 40, gap: 10 },

  card: { backgroundColor: CARD, borderRadius: 16, padding: 16 },
  cardLabel: { color: MUTED, fontFamily: Typography.fonts.bodyMedium, fontSize: 12 },
  codeBig: { color: PRIMARY, fontFamily: Typography.fonts.headingBold, fontSize: 24, marginTop: 4, letterSpacing: 1 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  linkText: { fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },

  addRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' },
  codeInput: { flex: 1, backgroundColor: '#f6f2ec', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: PRIMARY, fontFamily: Typography.fonts.bodyMedium, fontSize: 15, letterSpacing: 1 },
  sendBtn: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minWidth: 72 },
  sendBtnText: { color: '#FFF', fontFamily: Typography.fonts.bodySemiBold, fontSize: 14 },
  disabled: { opacity: 0.4 },
  feedback: { marginTop: 10, fontFamily: Typography.fonts.bodyMedium, fontSize: 12 },

  referralHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  referralTitle: { flex: 1, color: PRIMARY, fontFamily: Typography.fonts.bodySemiBold, fontSize: 15 },
  referralMeta: { color: '#5a4f45', fontFamily: Typography.fonts.bodyMedium, fontSize: 13, marginTop: 8 },
  referralEarned: { color: '#1b7a3d', fontFamily: Typography.fonts.bodySemiBold, fontSize: 14, marginTop: 10 },
  progressTrack: { height: 6, backgroundColor: '#d7e8da', borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: BLUE, borderRadius: 3 },
  inviteBtn: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  inviteBtnText: { color: '#FFF', fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },

  sectionTitle: { color: PRIMARY, fontFamily: Typography.fonts.headingBold, fontSize: 16, marginTop: 8, marginBottom: 2 },

  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  friendName: { color: PRIMARY, fontFamily: Typography.fonts.bodySemiBold, fontSize: 14 },
  friendSub: { color: MUTED, fontFamily: Typography.fonts.body, fontSize: 12, marginTop: 1 },
  friendStat: { color: PRIMARY, fontFamily: Typography.fonts.bodySemiBold, fontSize: 14 },
  requestActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  pill: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  pillText: { color: '#FFF', fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },

  avatar: { backgroundColor: '#d9c7bb', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontFamily: Typography.fonts.headingBold, fontSize: 16 },

  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { color: MUTED, fontFamily: Typography.fonts.body, fontSize: 13, textAlign: 'center' },

  // Leaderboard
  segment: { flexDirection: 'row', backgroundColor: '#ece5da', borderRadius: 12, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  segActive: { backgroundColor: '#FFF' },
  segText: { color: MUTED, fontFamily: Typography.fonts.bodySemiBold, fontSize: 13 },
  segTextActive: { color: PRIMARY },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 999, backgroundColor: '#FFF' },
  periodActive: { backgroundColor: PRIMARY },
  periodText: { color: MUTED, fontFamily: Typography.fonts.bodyMedium, fontSize: 12 },
  periodTextActive: { color: '#FFF' },
  rankBig: { color: PRIMARY, fontFamily: Typography.fonts.headingBold, fontSize: 44, marginTop: 2 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  rankNum: { width: 28, textAlign: 'center', color: MUTED, fontFamily: Typography.fonts.bodySemiBold, fontSize: 15 },
  rankValue: { color: PRIMARY, fontFamily: Typography.fonts.headingBold, fontSize: 17 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, alignItems: 'center', gap: 6 },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e0d9ce', marginBottom: 10 },
  modalName: { color: PRIMARY, fontFamily: Typography.fonts.headingBold, fontSize: 22, marginTop: 8 },
  modalCode: { color: MUTED, fontFamily: Typography.fonts.body, fontSize: 12 },
  ghostNote: { color: '#8a6d3b', fontFamily: Typography.fonts.bodyMedium, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  modalStats: { flexDirection: 'row', gap: 40, marginTop: 18 },
  modalStat: { alignItems: 'center', gap: 2 },
  modalStatValue: { color: PRIMARY, fontFamily: Typography.fonts.headingBold, fontSize: 20 },
  modalRemove: { marginTop: 22, paddingVertical: 10 },
  modalRemoveText: { color: '#C0392B', fontFamily: Typography.fonts.bodySemiBold, fontSize: 14 },
  modalClose: { paddingVertical: 8 },
  modalCloseText: { color: MUTED, fontFamily: Typography.fonts.bodyMedium, fontSize: 14 },

  toast: { position: 'absolute', bottom: 40, alignSelf: 'center', left: 0, right: 0, alignItems: 'center' },
  toastText: { backgroundColor: PRIMARY, color: '#FFF', fontFamily: Typography.fonts.bodyMedium, fontSize: 13, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, overflow: 'hidden' },
});
