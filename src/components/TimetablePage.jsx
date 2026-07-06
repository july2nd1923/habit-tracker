import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { PALETTE, toDateStr } from '../lib/dateUtils'

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function dateKey(d) {
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeek(d) {
  // 월요일 시작
  const day = d.getDay() // 0=일
  const diff = day === 0 ? -6 : 1 - day
  const s = new Date(d)
  s.setDate(d.getDate() + diff)
  s.setHours(0, 0, 0, 0)
  return s
}

function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`
}

export default function TimetablePage({ habits, today, myUserId }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [selected, setSelected] = useState(() => dateKey(today))
  const [events, setEvents] = useState([])
  const [habitLogs, setHabitLogs] = useState({}) // habit_id -> status for selected date
  const [showAdd, setShowAdd] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())

  const activeHabits = useMemo(() => habits.filter((h) => !h.archived), [habits])

  // 1분마다 현재 시간 갱신 (지난 시간 표시용)
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
  }, [weekStart])

  const load = useCallback(async () => {
    // 선택 날짜의 일정만 (습관 연동 여부와 무관하게 모든 블록은 특정 날짜 소속)
    const { data: evts } = await supabase
      .from('timetable_events')
      .select('*')
      .eq('event_date', selected)
      .order('start_time', { ascending: true })
    setEvents(evts || [])

    // 습관 블록의 해당 날짜 완료 상태
    const habitIds = (evts || []).filter((e) => e.habit_id).map((e) => e.habit_id)
    if (habitIds.length) {
      const { data: logs } = await supabase
        .from('habit_logs')
        .select('habit_id, status')
        .in('habit_id', habitIds)
        .eq('log_date', selected)
      const map = {}
      for (const l of logs || []) map[l.habit_id] = l.status
      setHabitLogs(map)
    } else {
      setHabitLogs({})
    }
  }, [selected])

  useEffect(() => {
    load()
  }, [load])

  const habitById = useMemo(() => Object.fromEntries(habits.map((h) => [h.id, h])), [habits])

  // 표시할 블록: 일반 일정(해당 날짜) + 습관 블록(습관이 존재하고 보관 안 된 것)
  const blocks = useMemo(() => {
    return events
      .filter((e) => !e.habit_id || habitById[e.habit_id])
      .map((e) => {
        const h = e.habit_id ? habitById[e.habit_id] : null
        return {
          ...e,
          displayTitle: h ? h.title : e.title,
          displayColor: h ? h.color : e.color || '#A3CBEA',
          isHabit: !!e.habit_id,
          done: e.habit_id ? habitLogs[e.habit_id] === 'done' : e.completed,
        }
      })
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  }, [events, habitById, habitLogs, selected])

  const selDate = useMemo(() => new Date(selected + 'T00:00:00'), [selected])
  const isToday = selected === dateKey(today)
  const isPastDay = selDate < new Date(dateKey(today) + 'T00:00:00')

  function isTimePassed(block) {
    if (isPastDay) return true
    if (!isToday) return false
    const now = new Date(nowTick)
    const t = block.end_time || block.start_time
    if (!t) return false
    const [h, m] = t.split(':').map(Number)
    return now.getHours() * 60 + now.getMinutes() > h * 60 + m
  }

  async function toggleBlock(block) {
    if (block.isHabit) {
      const isDone = habitLogs[block.habit_id] === 'done'
      setHabitLogs((prev) => ({ ...prev, [block.habit_id]: isDone ? undefined : 'done' }))
      if (isDone) {
        await supabase.from('habit_logs').delete().eq('habit_id', block.habit_id).eq('log_date', selected)
      } else {
        await supabase
          .from('habit_logs')
          .upsert(
            { habit_id: block.habit_id, log_date: selected, status: 'done' },
            { onConflict: 'habit_id,log_date' }
          )
      }
    } else {
      const next = !block.completed
      setEvents((prev) => prev.map((e) => (e.id === block.id ? { ...e, completed: next } : e)))
      await supabase.from('timetable_events').update({ completed: next }).eq('id', block.id)
    }
  }

  async function deleteBlock(block) {
    const label = block.isHabit ? '이 일정을 삭제할까요? (연결된 습관 자체와 기록은 그대로예요)' : '이 일정을 삭제할까요?'
    if (!confirm(label)) return
    await supabase.from('timetable_events').delete().eq('id', block.id)
    load()
  }

  function moveWeek(dir) {
    const s = new Date(weekStart)
    s.setDate(s.getDate() + dir * 7)
    setWeekStart(s)
  }

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-ink">타임테이블</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center hover:opacity-90 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-ink/40 mb-4">
        {weekStart.getMonth() + 1}월 · 나만 볼 수 있어요
      </p>

      {/* 주간 날짜 띠 */}
      <div className="flex items-center gap-1 mb-5">
        <button onClick={() => moveWeek(-1)} className="text-ink/40 hover:text-ink transition p-1 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex gap-1.5 flex-1 justify-between">
          {weekDays.map((d) => {
            const key = dateKey(d)
            const isSel = key === selected
            const isTodayCell = key === dateKey(today)
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`flex-1 rounded-xl py-2 flex flex-col items-center transition border ${
                  isSel
                    ? 'bg-white shadow-card border-ink/10'
                    : 'bg-white/50 border-transparent hover:bg-white'
                }`}
              >
                <span className="text-[10px] text-ink/40">{DAY_LABELS[d.getDay()]}</span>
                <span className={`text-sm ${isTodayCell ? 'font-bold text-ink' : 'text-ink/70'}`}>
                  {d.getDate()}
                </span>
                {isTodayCell && <span className="w-1 h-1 rounded-full bg-ink mt-0.5" />}
              </button>
            )
          })}
        </div>
        <button onClick={() => moveWeek(1)} className="text-ink/40 hover:text-ink transition p-1 shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <h2 className="text-xs text-ink/50 mb-3">
        {isToday ? 'TODAY' : `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 (${DAY_LABELS[selDate.getDay()]})`}
      </h2>

      {blocks.length === 0 ? (
        <div className="text-center pt-12 text-ink/40 text-sm">
          이 날의 일정이 없어요.
          <br />
          오른쪽 위 + 버튼으로 추가해보세요.
        </div>
      ) : (
        <div className="space-y-2.5">
          {blocks.map((b) => {
            const passed = isTimePassed(b)
            const missed = passed && !b.done
            return (
              <div key={b.id} className="flex items-start gap-3">
                <div className="w-16 shrink-0 text-right pt-2.5">
                  <span className={`text-[11px] ${missed ? 'text-rose-400' : 'text-ink/45'}`}>
                    {fmtTime(b.start_time)}
                  </span>
                </div>
                <button
                  onClick={() => toggleBlock(b)}
                  className={`flex-1 text-left rounded-xl px-4 py-2.5 transition hover:shadow-soft relative ${
                    missed ? 'opacity-60' : ''
                  }`}
                  style={{ backgroundColor: `${b.displayColor}40` }}
                >
                  <div className="flex items-center gap-1.5">
                    {b.isHabit && <span className="text-[10px]">🔗</span>}
                    <span className={`text-sm text-ink ${b.done ? 'line-through text-ink/40' : ''}`}>
                      {b.displayTitle}
                    </span>
                    {missed && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />}
                  </div>
                  <div className="text-[11px] text-ink/40 mt-0.5">
                    {fmtTime(b.start_time)}
                    {b.end_time ? ` - ${fmtTime(b.end_time)}` : ''}
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteBlock(b)
                    }}
                    className="absolute top-1.5 right-2.5 text-ink/20 hover:text-rose-400 transition text-sm leading-none cursor-pointer"
                  >
                    ×
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-[11px] text-ink/30 text-center">
        블록을 탭하면 완료(취소선) 표시 · 🔗는 습관 연동 일정 (체크하면 홈 화면 습관도 함께 체크돼요)
      </p>

      {showAdd && (
        <AddEventModal
          habits={activeHabits}
          selectedDate={selected}
          myUserId={myUserId}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function AddEventModal({ habits, selectedDate, myUserId, onClose, onAdded }) {
  const [habitId, setHabitId] = useState('') // ''이면 일반 일정
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(PALETTE[0].value)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('')

  const linkedHabit = habits.find((h) => h.id === habitId)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!habitId && !title.trim()) return

    await supabase.from('timetable_events').insert(
      habitId
        ? {
            user_id: myUserId,
            habit_id: habitId,
            event_date: selectedDate,
            start_time: startTime,
            end_time: endTime || null,
          }
        : {
            user_id: myUserId,
            title: title.trim(),
            color,
            event_date: selectedDate,
            start_time: startTime,
            end_time: endTime || null,
          }
    )
    onAdded()
  }

  const d = new Date(selectedDate + 'T00:00:00')

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6 border border-ink/5">
        <h2 className="font-display text-lg text-ink mb-1">일정 추가</h2>
        <p className="text-xs text-ink/40 mb-4">{d.getMonth() + 1}월 {d.getDate()}일</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {habits.length > 0 && (
            <div>
              <label className="text-xs text-ink/50 mb-1.5 block">내 습관과 연결 (선택)</label>
              <div className="flex flex-wrap gap-1.5">
                {habits.map((h) => (
                  <button
                    type="button"
                    key={h.id}
                    onClick={() => setHabitId(habitId === h.id ? '' : h.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-full border transition flex items-center gap-1.5 ${
                      habitId === h.id ? 'border-ink/40 bg-[#F3EFE8]' : 'border-ink/10 hover:bg-ink/5'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: h.color }} />
                    {h.title}
                  </button>
                ))}
              </div>
              {linkedHabit && (
                <p className="text-[11px] text-ink/35 mt-1.5">
                  이 블록을 체크하면 홈 화면의 '{linkedHabit.title}' 습관도 이 날짜로 함께 체크돼요.
                </p>
              )}
            </div>
          )}

          {!habitId && (
            <>
              <div>
                <label className="text-xs text-ink/50 mb-1 block">일정 이름</label>
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 팀 미팅"
                  className="w-full rounded-lg border border-ink/10 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#A3CBEA]"
                />
              </div>
              <div>
                <label className="text-xs text-ink/50 mb-2 block">색상</label>
                <div className="grid grid-cols-5 gap-2.5">
                  {PALETTE.map((c) => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setColor(c.value)}
                      className="aspect-square rounded-full flex items-center justify-center"
                      style={{ backgroundColor: c.value }}
                    >
                      {color === c.value && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3E3A36" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-ink/50 mb-1 block">시작</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#A3CBEA]"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-ink/50 mb-1 block">끝 (선택)</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-ink/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#A3CBEA]"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg py-2.5 text-sm text-ink/60 border border-ink/10 hover:bg-ink/5 transition">
              취소
            </button>
            <button type="submit" className="flex-1 rounded-lg py-2.5 text-sm bg-ink text-paper hover:opacity-90 transition">
              추가하기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
