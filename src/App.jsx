import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import BottomNav from './components/BottomNav'
import HomePage from './components/HomePage'
import NotesPage from './components/NotesPage'
import SettingsPage from './components/SettingsPage'
import FriendsPage from './components/FriendsPage'
import AddHabitModal from './components/AddHabitModal'

const today = new Date()

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('home')
  const [habits, setHabits] = useState([])
  const [logsByHabit, setLogsByHabit] = useState({})
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
    const { data } = await supabase
      .from('habits')
      .select('*')
      .eq('archived', false)
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
      .select('habit_id, log_date')
      .in('habit_id', habitIds)
      .gte('log_date', start)
      .lte('log_date', end)

    const grouped = {}
    for (const row of data || []) {
      if (!grouped[row.habit_id]) grouped[row.habit_id] = []
      grouped[row.habit_id].push(row.log_date)
    }
    setLogsByHabit(grouped)
  }, [])

  useEffect(() => {
    if (session) {
      loadHabits()
      loadProfile()
    }
  }, [session, loadHabits, loadProfile])

  useEffect(() => {
    if (habits.length >= 0 && session) {
      loadLogs(
        habits.map((h) => h.id),
        year,
        month
      )
    }
  }, [habits, year, month, session, loadLogs])

  async function handleAddHabit({ title, color }) {
    const { data: userData } = await supabase.auth.getUser()
    await supabase.from('habits').insert({
      title,
      color,
      user_id: userData.user.id,
    })
    setShowAdd(false)
    loadHabits()
  }

  async function handleDeleteHabit(id) {
    await supabase.from('habits').delete().eq('id', id)
    loadHabits()
  }

  async function handleToggle(habit, dateStr, isDone) {
    // optimistic update
    setLogsByHabit((prev) => {
      const cur = prev[habit.id] || []
      return {
        ...prev,
        [habit.id]: isDone ? cur.filter((d) => d !== dateStr) : [...cur, dateStr],
      }
    })
    if (isDone) {
      await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('log_date', dateStr)
    } else {
      await supabase.from('habit_logs').insert({ habit_id: habit.id, log_date: dateStr })
    }
  }

  async function handleToggleVisibility(habit) {
    const next = habit.visibility === 'friends' ? 'private' : 'friends'
    setHabits((prev) => prev.map((h) => (h.id === habit.id ? { ...h, visibility: next } : h)))
    await supabase.from('habits').update({ visibility: next }).eq('id', habit.id)
  }

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
          habits={habits}
          logsByHabit={logsByHabit}
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
        />
      )}
      {tab === 'notes' && (
        <NotesPage
          habits={habits}
          initialHabitId={noteTargetId}
          onConsumeInitial={() => setNoteTargetId(null)}
        />
      )}
      {tab === 'friends' && <FriendsPage profile={profile} today={today} />}
      {tab === 'settings' && (
        <SettingsPage
          habits={habits}
          onDeleteHabit={handleDeleteHabit}
          userEmail={session.user.email}
        />
      )}

      <BottomNav tab={tab} setTab={setTab} />

      {showAdd && <AddHabitModal onClose={() => setShowAdd(false)} onAdd={handleAddHabit} />}
    </div>
  )
}
