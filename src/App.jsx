import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { isHabitVisibleInMonth } from './lib/dateUtils'
import Login from './components/Login'
import BottomNav from './components/BottomNav'
import HomePage from './components/HomePage'
import NotesPage from './components/NotesPage'
import SettingsPage from './components/SettingsPage'
import FriendsPage from './components/FriendsPage'
import AddHabitModal from './components/AddHabitModal'

const today = new Date()
const REST_LIMIT_PER_MONTH = 5 // 습관 하나당 한 달에 쉬어가기 가능 횟수

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('home')
  const [habits, setHabits] = useState([])
  const [logsByHabit, setLogsByHabit] = useState({})
  const [pausesByHabit, setPausesByHabit] = useState({})
  const [unreadByFriendship, setUnreadByFriendship] = useState({})
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [showAdd, setShowAdd] = useState(false)
  const [noteTargetId, setNoteTargetId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userData.user.id).maybeSingle()
    setProfile(data)
  }, [])

  const loadHabits = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return
    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setHabits(data || [])
  }, [])

  const loadLogs = useCallback(async (habitIds, y, m) => {
    if (!habitIds.length) {
      setLogsByHabit({})
      return
    }
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const endDate = new Date(y, m + 1, 0).getDate()
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`
    const { data } = await supabase
      .from('habit_logs')
      .select('habit_id, log_date, status')
      .in('habit_id', habitIds)
      .gte('log_date', start)
      .lte('log_date', end)

    const grouped = {}
    for (const row of data || []) {
      if (!grouped[row.habit_id]) grouped[row.habit_id] = { done: [], rest: [] }
      if (row.status === 'rest') grouped[row.habit_id].rest.push(row.log_date)
      else grouped[row.habit_id].done.push(row.log_date)
    }
    setLogsByHabit(grouped)
  }, [])

  const loadPauses = useCallback(async (habitIds) => {
    if (!habitIds.length) {
      setPausesByHabit({})
      return
    }
    const { data } = await supabase.from('habit_pauses').select('*').in('habit_id', habitIds)
    const grouped = {}
    for (const row of data || []) {
      if (!grouped[row.habit_id]) grouped[row.habit_id] = []
      grouped[row.habit_id].push(row)
    }
    setPausesByHabit(grouped)
  }, [])

  const loadUnread = useCallback(async () => {
    if (!profile) return
    const { data: fr } = await supabase
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
    const ids = (fr || []).map((f) => f.id)
    if (!ids.length) {
      setUnreadByFriendship({})
      return
    }
    const { data } = await supabase
      .from('friend_messages')
      .select('friendship_id')
      .in('friendship_id', ids)
      .is('read_at', null)
      .neq('sender_id', profile.id)
    const map = {}
    for (const r of data || []) map[r.friendship_id] = (map[r.friendship_id] || 0) + 1
    setUnreadByFriendship(map)
  }, [profile])

  useEffect(() => {
    if (session) {
      loadHabits()
      loadProfile()
    }
  }, [session, loadHabits, loadProfile])

  useEffect(() => {
    if (habits.length >= 0 && session) {
      const ids = habits.map((h) => h.id)
      loadLogs(ids, year, month)
      loadPauses(ids)
    }
  }, [habits, year, month, session, loadLogs, loadPauses])

  useEffect(() => {
    if (profile) loadUnread()
  }, [profile, tab, loadUnread])

  async function handleAddHabit({ title, color }) {
    const { data: userData } = await supabase.auth.getUser()
    const maxOrder = habits.reduce((max, h) => Math.max(max, h.sort_order ?? 0), 0)
    await supabase.from('habits').insert({
      title,
      color,
      user_id: userData.user.id,
      sort_order: maxOrder + 1,
    })
    setShowAdd(false)
    loadHabits()
  }

  async function handleDeleteHabit(id) {
    await supabase.from('habits').delete().eq('id', id)
    loadHabits()
  }

  async function handleArchiveHabit(id) {
    const todayStr = today.toISOString().slice(0, 10)
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, archived: true, archived_at: todayStr } : h))
    )
    await supabase.from('habits').update({ archived: true, archived_at: todayStr }).eq('id', id)
  }

  async function handleUnarchiveHabit(id) {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, archived: false, archived_at: null } : h))
    )
    await supabase.from('habits').update({ archived: false, archived_at: null }).eq('id', id)
  }

  async function handleRenameHabit(id, newTitle) {
    const trimmed = newTitle.trim()
    if (!trimmed) return
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, title: trimmed } : h)))
    await supabase.from('habits').update({ title: trimmed }).eq('id', id)
  }

  async function handleTogglePause(habit) {
    const pauses = pausesByHabit[habit.id] || []
    const activePause = pauses.find((p) => !p.end_date)
    const todayStr = today.toISOString().slice(0, 10)
    if (activePause) {
      await supabase.from('habit_pauses').update({ end_date: todayStr }).eq('id', activePause.id)
    } else {
      await supabase.from('habit_pauses').insert({ habit_id: habit.id, start_date: todayStr })
    }
    loadPauses(habits.map((h) => h.id))
  }

  async function handleReorderHabit(id, direction) {
    const active = habits.filter((h) => !h.archived)
    const idx = active.findIndex((h) => h.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (idx === -1 || swapIdx < 0 || swapIdx >= active.length) return

    const reordered = [...active]
    ;[reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]]

    // 활성 습관들의 sort_order를 0,1,2... 순으로 다시 매김
    const updates = reordered.map((h, i) => ({ id: h.id, sort_order: i }))

    setHabits((prev) => {
      const orderMap = Object.fromEntries(updates.map((u) => [u.id, u.sort_order]))
      return prev
        .map((h) => (orderMap[h.id] !== undefined ? { ...h, sort_order: orderMap[h.id] } : h))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    })

    await Promise.all(
      updates.map((u) => supabase.from('habits').update({ sort_order: u.sort_order }).eq('id', u.id))
    )
  }

  async function handleToggle(habit, dateStr, currentStatus) {
    const cur = logsByHabit[habit.id] || { done: [], rest: [] }
    let nextStatus
    if (currentStatus === 'done') {
      // 완료 -> 쉬어가기 (한도 안에서만)
      nextStatus = cur.rest.length < REST_LIMIT_PER_MONTH ? 'rest' : null
    } else if (currentStatus === 'rest') {
      nextStatus = null
    } else {
      nextStatus = 'done'
    }

    // optimistic update
    setLogsByHabit((prev) => {
      const p = prev[habit.id] || { done: [], rest: [] }
      const done = p.done.filter((d) => d !== dateStr)
      const rest = p.rest.filter((d) => d !== dateStr)
      if (nextStatus === 'done') done.push(dateStr)
      if (nextStatus === 'rest') rest.push(dateStr)
      return { ...prev, [habit.id]: { done, rest } }
    })

    if (nextStatus === null) {
      await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('log_date', dateStr)
    } else {
      await supabase
        .from('habit_logs')
        .upsert(
          { habit_id: habit.id, log_date: dateStr, status: nextStatus },
          { onConflict: 'habit_id,log_date' }
        )
    }
  }

  async function handleToggleVisibility(habit) {
    const next = habit.visibility === 'friends' ? 'private' : 'friends'
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, visibility: next } : h)))
    await supabase.from('habits').update({ visibility: next }).eq('id', habit.id)
  }

  const visibleHabits = useMemo(
    () => habits.filter((h) => isHabitVisibleInMonth(h, year, month)),
    [habits, year, month]
  )

  function goPrevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }
  function goNextMonth() {
    const isCurrent = today.getFullYear() === year && today.getMonth() === month
    if (isCurrent) return
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-ink/30 text-sm">불러오는 중...</div>
  }
  if (!session) {
    return <Login />
  }

  return (
    <div className="min-h-screen">
      {tab === 'home' && (
        <HomePage
          habits={visibleHabits}
          allHabits={habits}
          logsByHabit={logsByHabit}
          pausesByHabit={pausesByHabit}
          year={year}
          month={month}
          today={today}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
          onToggle={handleToggle}
          onOpenNote={(habit) => {
            setNoteTargetId(habit.id)
            setTab('notes')
          }}
          onToggleVisibility={handleToggleVisibility}
          onAddClick={() => setShowAdd(true)}
          onRefreshHabits={loadHabits}
        />
      )}
      {tab === 'notes' && (
        <NotesPage
          habits={habits}
          initialHabitId={noteTargetId}
          onConsumeInitial={() => setNoteTargetId(null)}
        />
      )}
      {tab === 'friends' && (
        <FriendsPage
          profile={profile}
          today={today}
          unreadByFriendship={unreadByFriendship}
          onUnreadRefresh={loadUnread}
        />
      )}
      {tab === 'settings' && (
        <SettingsPage
          habits={habits}
          pausesByHabit={pausesByHabit}
          onDeleteHabit={handleDeleteHabit}
          onArchiveHabit={handleArchiveHabit}
          onUnarchiveHabit={handleUnarchiveHabit}
          onRenameHabit={handleRenameHabit}
          onReorderHabit={handleReorderHabit}
          onTogglePause={handleTogglePause}
          userEmail={session.user.email}
        />
      )}

      <BottomNav
        tab={tab}
        setTab={setTab}
        hasUnread={Object.values(unreadByFriendship).some((n) => n > 0)}
      />

      {showAdd && <AddHabitModal onClose={() => setShowAdd(false)} onAdd={handleAddHabit} />}
    </div>
  )
}
