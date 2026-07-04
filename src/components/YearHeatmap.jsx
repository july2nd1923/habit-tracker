import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { daysInMonth, buildPausedSet, toDateStr } from '../lib/dateUtils'

export default function YearHeatmap({ habits, pausesByHabit, today, onClose }) {
  const [year, setYear] = useState(today.getFullYear())
  const [logsByHabit, setLogsByHabit] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const ids = habits.map((h) => h.id)
      if (!ids.length) {
        setLogsByHabit({})
        setLoading(false)
        return
      }
      const { data } = await supabase
        .from('habit_logs')
        .select('habit_id, log_date, status')
        .in('habit_id', ids)
        .gte('log_date', `${year}-01-01`)
        .lte('log_date', `${year}-12-31`)
      if (cancelled) return
      const grouped = {}
      for (const row of data || []) {
        if (!grouped[row.habit_id]) grouped[row.habit_id] = { done: new Set(), rest: new Set() }
        if (row.status === 'rest') grouped[row.habit_id].rest.add(row.log_date)
        else grouped[row.habit_id].done.add(row.log_date)
      }
      setLogsByHabit(grouped)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [habits, year])

  const isCurrentYear = year === today.getFullYear()

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onClose} className="text-ink/50 hover:text-ink transition p-1 -ml-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-xl text-ink flex-1">연간 기록</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="text-ink/40 hover:text-ink transition p-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm text-ink/70">{year}년</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            disabled={isCurrentYear}
            className="text-ink/40 hover:text-ink transition p-1 disabled:opacity-20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink/30 text-center pt-10">불러오는 중...</p>
      ) : habits.length === 0 ? (
        <p className="text-sm text-ink/30 text-center pt-10">아직 습관이 없어요.</p>
      ) : (
        <div className="space-y-5">
          {habits.map((h) => (
            <HabitYearGrid
              key={h.id}
              habit={h}
              logs={logsByHabit[h.id] || { done: new Set(), rest: new Set() }}
              pauses={pausesByHabit[h.id] || []}
              year={year}
              today={today}
            />
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-4 text-[10px] text-ink/40 justify-center">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[#B3C99C]" /> 완료
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-[3px] border-2 border-[#B3C99C] bg-white" /> 쉬어가기
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[#E4DFD5]" /> 휴식
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[#F3EFE8]" /> 미완료
        </span>
      </div>
    </div>
  )
}

function HabitYearGrid({ habit, logs, pauses, year, today }) {
  const months = Array.from({ length: 12 }, (_, i) => i)

  // 해당 연도의 완료 일수 합계
  const totalDone = useMemo(() => {
    let c = 0
    for (const d of logs.done) {
      if (d.startsWith(`${year}-`)) c++
    }
    return c
  }, [logs.done, year])

  const createdDate = habit.created_at ? new Date(habit.created_at) : null

  return (
    <div className="bg-white rounded-xl2 shadow-soft border border-ink/5 p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
          <span className="font-display text-sm text-ink">{habit.title}</span>
        </div>
        <span className="text-[11px] text-ink/40">올해 {totalDone}일 완료</span>
      </div>

      <div className="space-y-1">
        {months.map((m) => {
          const total = daysInMonth(year, m)
          const pausedSet = buildPausedSet(pauses, year, m, today)
          const isFutureMonth =
            year > today.getFullYear() || (year === today.getFullYear() && m > today.getMonth())
          if (isFutureMonth) return null
          return (
            <div key={m} className="flex items-center gap-1.5">
              <span className="text-[9px] text-ink/35 w-6 text-right shrink-0">{m + 1}월</span>
              <div className="flex gap-[2px] flex-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                  if (d > total) return <span key={d} className="flex-1 aspect-square" />
                  const ds = toDateStr(year, m, d)
                  const cur = new Date(year, m, d)
                  const isFuture = cur > today
                  const isBeforeCreation = createdDate && cur < new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate())
                  let bg = '#F3EFE8'
                  let border = 'none'
                  if (isFuture || isBeforeCreation) {
                    bg = 'transparent'
                  } else if (logs.done.has(ds)) {
                    bg = habit.color
                  } else if (logs.rest.has(ds)) {
                    bg = '#fff'
                    border = `1.5px solid ${habit.color}`
                  } else if (pausedSet.has(ds)) {
                    bg = '#E4DFD5'
                  }
                  return (
                    <span
                      key={d}
                      title={ds}
                      className="flex-1 aspect-square rounded-[2px]"
                      style={{ backgroundColor: bg, border }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
