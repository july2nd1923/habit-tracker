import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatMonthLabel } from '../lib/dateUtils'
import FriendHabitCard from './FriendHabitCard'

export default function FriendsPage({ profile, today }) {
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [friends, setFriends] = useState([]) // [{id, display_name, friend_code}]
  const [friendHabits, setFriendHabits] = useState({}) // friendId -> [habits]
  const [friendLogs, setFriendLogs] = useState({}) // habitId -> [dateStr]
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

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
        acceptedFriends.push(other)
      }
    }
    setIncoming(inc)
    setOutgoing(out)
    setFriends(acceptedFriends)
    setLoading(false)
  }, [profile])

  useEffect(() => {
    loadFriendships()
  }, [loadFriendships])

  useEffect(() => {
    async function loadFriendHabits() {
      if (friends.length === 0) {
        setFriendHabits({})
        setFriendLogs({})
        return
      }
      const friendIds = friends.map((f) => f.id)
      const { data: habits } = await supabase
        .from('habits')
        .select('*')
        .in('user_id', friendIds)
        .eq('visibility', 'friends')
        .eq('archived', false)
        .order('created_at', { ascending: true })

      const grouped = {}
      for (const h of habits || []) {
        if (!grouped[h.user_id]) grouped[h.user_id] = []
        grouped[h.user_id].push(h)
      }
      setFriendHabits(grouped)

      const habitIds = (habits || []).map((h) => h.id)
      if (habitIds.length === 0) {
        setFriendLogs({})
        return
      }
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const endDate = new Date(year, month + 1, 0).getDate()
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`
      const { data: logs } = await supabase
        .from('habit_logs')
        .select('habit_id, log_date')
        .in('habit_id', habitIds)
        .gte('log_date', start)
        .lte('log_date', end)

      const logsGrouped = {}
      for (const row of logs || []) {
        if (!logsGrouped[row.habit_id]) logsGrouped[row.habit_id] = []
        logsGrouped[row.habit_id].push(row.log_date)
      }
      setFriendLogs(logsGrouped)
    }
    loadFriendHabits()
  }, [friends, year, month])

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
        // 상대가 이미 나한테 요청을 보내둔 상태 → 바로 수락 처리
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

      {/* 친구들의 공개 습관 */}
      <div className="flex items-center justify-between mt-6 mb-3">
        <h2 className="text-xs text-ink/50">친구들의 습관</h2>
        <div className="flex items-center gap-3">
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
      </div>

      {loading ? (
        <p className="text-sm text-ink/30 text-center pt-6">불러오는 중...</p>
      ) : friends.length === 0 ? (
        <p className="text-sm text-ink/30 text-center pt-6">아직 친구가 없어요. 위에서 코드로 추가해보세요.</p>
      ) : (
        <div className="space-y-6">
          {friends.map((f) => (
            <div key={f.id}>
              <p className="text-xs font-medium text-ink/60 mb-2">{f.display_name || f.friend_code}</p>
              {(friendHabits[f.id] || []).length === 0 ? (
                <p className="text-xs text-ink/30">공개한 습관이 없어요.</p>
              ) : (
                <div className="space-y-3">
                  {(friendHabits[f.id] || []).map((h) => (
                    <FriendHabitCard
                      key={h.id}
                      habit={h}
                      logs={friendLogs[h.id] || []}
                      year={year}
                      month={month}
                      today={today}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
