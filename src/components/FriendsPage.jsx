import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatMonthLabel, computeStreak } from '../lib/dateUtils'
import FriendHabitRow from './FriendHabitRow'
import CreateChallengeModal from './CreateChallengeModal'

export default function FriendsPage({ profile, today }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [friends, setFriends] = useState([]) // [{id, display_name, friend_code, friendshipId, streak}]
  const [loading, setLoading] = useState(true)
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [challengeInvites, setChallengeInvites] = useState([])

  const loadFriendships = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data, error } = await supabase
      .from('friendships')
      .select(
        '*, requester:requester_id(id, display_name, friend_code), addressee:addressee_id(id, display_name, friend_code)'
      )
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)

    if (error) {
      setLoading(false)
      return
    }

    const inc = []
    const out = []
    const acceptedFriends = []
    for (const row of data || []) {
      const isRequester = row.requester_id === profile.id
      const other = isRequester ? row.addressee : row.requester
      if (row.status === 'pending') {
        if (isRequester) out.push({ ...row, other })
        else inc.push({ ...row, other })
      } else if (row.status === 'accepted') {
        acceptedFriends.push({ ...other, friendshipId: row.id })
      }
    }
    setIncoming(inc)
    setOutgoing(out)

    // 각 친구의 이번 달 스트릭(공개 습관 중 최고 기록)도 같이 계산
    const withStreaks = await Promise.all(
      acceptedFriends.map(async (f) => {
        const { data: habits } = await supabase
          .from('habits')
          .select('id')
          .eq('user_id', f.id)
          .eq('visibility', 'friends')
          .eq('archived', false)
        const habitIds = (habits || []).map((h) => h.id)
        if (habitIds.length === 0) return { ...f, streak: 0 }

        const y = today.getFullYear()
        const m = today.getMonth()
        const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
        const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const { data: logs } = await supabase
          .from('habit_logs')
          .select('habit_id, log_date')
          .eq('status', 'done')
          .in('habit_id', habitIds)
          .gte('log_date', start)
          .lte('log_date', end)

        const byHabit = {}
        for (const row of logs || []) {
          if (!byHabit[row.habit_id]) byHabit[row.habit_id] = []
          byHabit[row.habit_id].push(row.log_date)
        }
        const maxStreak = Math.max(
          0,
          ...Object.values(byHabit).map((dates) => computeStreak(dates, y, m, today))
        )
        return { ...f, streak: maxStreak }
      })
    )
    setFriends(withStreaks)
    setLoading(false)
  }, [profile, today])

  const loadChallengeInvites = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('challenges')
      .select('*, creator:creator_id(display_name, friend_code)')
      .eq('partner_id', profile.id)
      .eq('status', 'pending')
    setChallengeInvites(data || [])
  }, [profile])

  useEffect(() => {
    loadFriendships()
    loadChallengeInvites()
  }, [loadFriendships, loadChallengeInvites])

  async function handleAddFriend(e) {
    e.preventDefault()
    setMessage('')
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    if (profile && trimmed === profile.friend_code) {
      setMessage('내 코드는 추가할 수 없어요.')
      return
    }

    const { data: target, error: findError } = await supabase
      .from('profiles')
      .select('id, display_name, friend_code')
      .eq('friend_code', trimmed)
      .maybeSingle()

    if (findError || !target) {
      setMessage('해당 코드의 사용자를 찾을 수 없어요.')
      return
    }

    const { data: existing } = await supabase
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${profile.id},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${profile.id})`
      )
      .maybeSingle()

    if (existing) {
      if (existing.status === 'accepted') {
        setMessage('이미 친구예요.')
      } else if (existing.requester_id === profile.id) {
        setMessage('이미 요청을 보냈어요. 상대의 수락을 기다려주세요.')
      } else {
        await supabase.from('friendships').update({ status: 'accepted' }).eq('id', existing.id)
        setMessage(`${target.display_name || target.friend_code}님과 친구가 됐어요!`)
        setCode('')
        loadFriendships()
      }
      return
    }

    const { error: insertError } = await supabase
      .from('friendships')
      .insert({ requester_id: profile.id, addressee_id: target.id, status: 'pending' })

    if (insertError) {
      setMessage('요청을 보내지 못했어요. 다시 시도해주세요.')
    } else {
      setMessage(`${target.display_name || target.friend_code}님에게 요청을 보냈어요.`)
      setCode('')
      loadFriendships()
    }
  }

  async function respond(id, status) {
    await supabase.from('friendships').update({ status }).eq('id', id)
    loadFriendships()
  }

  async function cancelRequest(id) {
    await supabase.from('friendships').delete().eq('id', id)
    loadFriendships()
  }

  async function respondChallenge(challenge, accept) {
    if (!accept) {
      await supabase.from('challenges').update({ status: 'declined' }).eq('id', challenge.id)
      loadChallengeInvites()
      return
    }
    // 수락: 내 습관 row를 만들고 challenge에 연결
    const { data: newHabit } = await supabase
      .from('habits')
      .insert({
        title: challenge.title,
        color: challenge.color,
        user_id: profile.id,
        visibility: 'friends',
      })
      .select()
      .single()

    if (newHabit) {
      await supabase
        .from('challenges')
        .update({ status: 'accepted', partner_habit_id: newHabit.id })
        .eq('id', challenge.id)
      await supabase.from('habits').update({ challenge_id: challenge.id }).eq('id', newHabit.id)
    }
    loadChallengeInvites()
  }

  if (selectedFriend) {
    return (
      <FriendDetail
        friend={selectedFriend}
        myId={profile?.id}
        today={today}
        onBack={() => {
          setSelectedFriend(null)
          loadFriendships()
        }}
        onUnfriend={async () => {
          await supabase.from('friendships').delete().eq('id', selectedFriend.friendshipId)
          setSelectedFriend(null)
          loadFriendships()
        }}
      />
    )
  }

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <h1 className="font-display text-2xl text-ink mb-1">친구</h1>
      <p className="text-xs text-ink/40 mb-5">코드로 친구를 추가하고, 서로 공개한 습관을 확인해요.</p>

      {/* 내 코드 */}
      <div className="bg-white rounded-xl2 shadow-soft border border-ink/5 p-4 mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-ink/40 mb-0.5">내 친구 코드</p>
          <p className="font-display text-lg tracking-wider text-ink">
            {profile ? profile.friend_code : '...'}
          </p>
        </div>
        <button
          onClick={() => {
            if (profile) {
              navigator.clipboard?.writeText(profile.friend_code)
              setMessage('코드가 복사됐어요.')
            }
          }}
          className="text-xs px-3 py-1.5 rounded-full border border-ink/10 text-ink/60 hover:bg-ink/5 transition"
        >
          복사
        </button>
      </div>

      {/* 친구 추가 */}
      <form onSubmit={handleAddFriend} className="flex gap-2 mb-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="친구 코드 입력 (예: 7K3M9)"
          className="flex-1 rounded-lg border border-ink/10 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#A3CBEA] focus:border-transparent uppercase"
        />
        <button
          type="submit"
          className="rounded-lg px-4 py-2.5 text-sm bg-ink text-paper hover:opacity-90 transition"
        >
          추가
        </button>
      </form>
      {message && <p className="text-xs text-ink/50 mb-4">{message}</p>}

      {/* 챌린지 초대 */}
      {challengeInvites.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs text-ink/50 mb-2">챌린지 초대</h2>
          <div className="space-y-2">
            {challengeInvites.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-ink/5 shadow-soft px-4 py-3 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <div className="flex-1">
                  <p className="text-sm text-ink">{c.title}</p>
                  <p className="text-[11px] text-ink/40">{c.creator?.display_name || c.creator?.friend_code}님의 초대</p>
                </div>
                <button onClick={() => respondChallenge(c, true)} className="text-xs px-3 py-1 rounded-full bg-ink text-paper">수락</button>
                <button onClick={() => respondChallenge(c, false)} className="text-xs px-3 py-1 rounded-full border border-ink/10 text-ink/50">거절</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 받은 요청 */}
      {incoming.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs text-ink/50 mb-2">받은 요청</h2>
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-ink/5 shadow-soft px-4 py-3 flex items-center gap-3">
                <span className="text-sm text-ink flex-1">{r.other?.display_name || r.other?.friend_code}</span>
                <button onClick={() => respond(r.id, 'accepted')} className="text-xs px-3 py-1 rounded-full bg-ink text-paper">수락</button>
                <button onClick={() => respond(r.id, 'declined')} className="text-xs px-3 py-1 rounded-full border border-ink/10 text-ink/50">거절</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 보낸 요청 */}
      {outgoing.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs text-ink/50 mb-2">보낸 요청</h2>
          <div className="space-y-2">
            {outgoing.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-ink/5 shadow-soft px-4 py-3 flex items-center gap-3">
                <span className="text-sm text-ink/60 flex-1">{r.other?.display_name || r.other?.friend_code}</span>
                <span className="text-[11px] text-ink/30">수락 대기중</span>
                <button onClick={() => cancelRequest(r.id)} className="text-xs text-ink/30 hover:text-rose-400 transition">취소</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 친구 목록 */}
      <h2 className="text-xs text-ink/50 mb-2">친구 목록</h2>
      {loading ? (
        <p className="text-sm text-ink/30 text-center pt-6">불러오는 중...</p>
      ) : friends.length === 0 ? (
        <p className="text-sm text-ink/30 text-center pt-6">아직 친구가 없어요. 위에서 코드로 추가해보세요.</p>
      ) : (
        <div className="space-y-2">
          {friends.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFriend(f)}
              className="w-full bg-white rounded-xl2 shadow-soft border border-ink/5 p-4 flex items-center gap-3 text-left hover:shadow-card transition"
            >
              <span className="w-9 h-9 rounded-full bg-[#F3EFE8] flex items-center justify-center text-sm font-display text-ink/60 shrink-0">
                {(f.display_name || f.friend_code || '?')[0]}
              </span>
              <span className="font-display text-sm text-ink flex-1">{f.display_name || f.friend_code}</span>
              {f.streak >= 2 && <span className="text-xs text-ink/50">🔥 {f.streak}일</span>}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3E3A36" strokeOpacity="0.3" strokeWidth="2">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FriendDetail({ friend, myId, today, onBack, onUnfriend }) {
  const [habits, setHabits] = useState([])
  const [logsByHabit, setLogsByHabit] = useState({})
  const [pausesByHabit, setPausesByHabit] = useState({})
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [showChallengeModal, setShowChallengeModal] = useState(false)
  const [challengeMessage, setChallengeMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: habitData } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', friend.id)
      .eq('visibility', 'friends')
      .eq('archived', false)
      .order('created_at', { ascending: true })

    setHabits(habitData || [])

    const habitIds = (habitData || []).map((h) => h.id)
    if (habitIds.length === 0) {
      setLogsByHabit({})
      setPausesByHabit({})
      setLoading(false)
      return
    }
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = new Date(year, month + 1, 0).getDate()
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`
    const [{ data: logs }, { data: pauseRows }] = await Promise.all([
      supabase
        .from('habit_logs')
        .select('habit_id, log_date, status')
        .in('habit_id', habitIds)
        .gte('log_date', start)
        .lte('log_date', end),
      supabase.from('habit_pauses').select('*').in('habit_id', habitIds),
    ])

    const grouped = {}
    for (const row of logs || []) {
      if (!grouped[row.habit_id]) grouped[row.habit_id] = { done: [], rest: [] }
      if (row.status === 'rest') grouped[row.habit_id].rest.push(row.log_date)
      else grouped[row.habit_id].done.push(row.log_date)
    }
    setLogsByHabit(grouped)

    const pGrouped = {}
    for (const row of pauseRows || []) {
      if (!pGrouped[row.habit_id]) pGrouped[row.habit_id] = []
      pGrouped[row.habit_id].push(row)
    }
    setPausesByHabit(pGrouped)
    setLoading(false)
  }, [friend.id, year, month])

  useEffect(() => {
    load()
  }, [load])

  function goPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else setMonth((m) => m - 1)
  }
  function goNextMonth() {
    const isCurrent = today.getFullYear() === year && today.getMonth() === month
    if (isCurrent) return
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else setMonth((m) => m + 1)
  }

  async function handleCreateChallenge({ title, color }) {
    const { data: myProfile } = await supabase.auth.getUser()
    const { data: newHabit } = await supabase
      .from('habits')
      .insert({
        title,
        color,
        user_id: myProfile.user.id,
        visibility: 'friends',
      })
      .select()
      .single()

    if (newHabit) {
      const { data: newChallenge } = await supabase
        .from('challenges')
        .insert({
          title,
          color,
          creator_id: myId,
          partner_id: friend.id,
          status: 'pending',
          creator_habit_id: newHabit.id,
        })
        .select()
        .single()

      if (newChallenge) {
        await supabase.from('habits').update({ challenge_id: newChallenge.id }).eq('id', newHabit.id)
      }
    }
    setShowChallengeModal(false)
    setChallengeMessage('초대를 보냈어요! 상대가 수락하면 함께 진행 상황을 볼 수 있어요.')
  }

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <button onClick={onBack} className="text-ink/50 hover:text-ink transition p-1 -ml-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="w-8 h-8 rounded-full bg-[#F3EFE8] flex items-center justify-center text-sm font-display text-ink/60">
          {(friend.display_name || friend.friend_code || '?')[0]}
        </span>
        <h1 className="font-display text-lg text-ink flex-1">{friend.display_name || friend.friend_code}</h1>
        <button
          onClick={() => setShowChallengeModal(true)}
          className="text-xs px-3 py-1.5 rounded-full border border-ink/10 text-ink/60 hover:bg-ink/5 transition"
        >
          🤝 챌린지 만들기
        </button>
      </div>

      {challengeMessage && <p className="text-xs text-ink/50 mb-4">{challengeMessage}</p>}

      <div className="flex items-center justify-center gap-4 mb-4">
        <button onClick={goPrevMonth} className="text-ink/40 hover:text-ink transition p-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs text-ink/60 w-20 text-center">{formatMonthLabel(year, month)}</span>
        <button
          onClick={goNextMonth}
          disabled={today.getFullYear() === year && today.getMonth() === month}
          className="text-ink/40 hover:text-ink transition p-1 disabled:opacity-20"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ink/30 text-center pt-6">불러오는 중...</p>
      ) : habits.length === 0 ? (
        <p className="text-sm text-ink/30 text-center pt-6">공개한 습관이 없어요.</p>
      ) : (
        <div className="space-y-2.5">
          {habits.map((h) => (
            <FriendHabitRow
              key={h.id}
              habit={h}
              logs={logsByHabit[h.id] || { done: [], rest: [] }}
              pauses={pausesByHabit[h.id] || []}
              year={year}
              month={month}
              today={today}
              myId={myId}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => {
          if (
            confirm(
              `${friend.display_name || friend.friend_code}님과 친구를 끊을까요? 서로의 습관이 더 이상 보이지 않아요. (진행 중이던 챌린지 습관과 기록은 각자에게 남아요)`
            )
          ) {
            onUnfriend()
          }
        }}
        className="mt-6 w-full rounded-lg py-2.5 text-xs border border-ink/10 text-ink/40 hover:text-rose-400 hover:border-rose-200 transition"
      >
        친구 끊기
      </button>

      {showChallengeModal && (
        <CreateChallengeModal
          friendName={friend.display_name || friend.friend_code}
          onClose={() => setShowChallengeModal(false)}
          onCreate={handleCreateChallenge}
        />
      )}
    </div>
  )
}
