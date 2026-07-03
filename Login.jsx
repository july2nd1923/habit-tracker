import { useMemo } from 'react'
import { daysInMonth, toDateStr } from '../lib/dateUtils'
import { supabase } from '../supabaseClient'

export default function HabitCard({ habit, logs, year, month, today, onToggle, onOpenNote, onToggleVisibility }) {
  const total = daysInMonth(year, month)
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month
  const elapsedDays = isCurrentMonth ? today.getDate() : total

  const completedSet = useMemo(() => new Set(logs), [logs])

  const completedThisMonth = useMemo(() => {
    let c = 0
    for (let d = 1; d <= elapsedDays; d++) {
      if (completedSet.has(toDateStr(year, month, d))) c++
    }
    return c
  }, [completedSet, elapsedDays, year, month])

  const percent = elapsedDays > 0 ? Math.round((completedThisMonth / elapsedDays) * 100) : 0

  const days = Array.from({ length: total }, (_, i) => i + 1)

  return (
    <div className="bg-white rounded-xl2 shadow-soft border border-ink/5 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: habit.color }}
            />
            <h3 className="font-display text-base text-ink">{habit.title}</h3>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleVisibility(habit)}
            className="text-ink/30 hover:text-ink/60 transition"
            title={habit.visibility === 'friends' ? '친구에게 공개 중 (클릭하면 비공개로)' : '비공개 (클릭하면 친구에게 공개)'}
          >
            {habit.visibility === 'friends' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 7.2-2.4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onOpenNote(habit)}
            className="text-ink/30 hover:text-ink/60 transition"
            title="메모 열기"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
              <path d="M14 3v5h5" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <PercentRing percent={percent} color={habit.color} />
              <span className="text-xs font-medium text-ink/60">{percent}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const dateStr = toDateStr(year, month, d)
          const done = completedSet.has(dateStr)
          const isFuture =
            isCurrentMonth && d > today.getDate()
          return (
            <button
              key={d}
              disabled={isFuture}
              onClick={() => onToggle(habit, dateStr, done)}
              className={`aspect-square rounded-md text-[11px] flex items-center justify-center transition ${
                isFuture ? 'opacity-25 cursor-default' : 'hover:scale-105'
              }`}
              style={{
                backgroundColor: done ? habit.color : '#F3EFE8',
                color: done ? '#3E3A36' : '#B7B0A5',
              }}
            >
              {d}
            </button>
          )
        })}
      </div>

      <div className="mt-2.5 text-[11px] text-ink/40">
        이번 달 {completedThisMonth}회 완료
      </div>
    </div>
  )
}

function PercentRing({ percent, color }) {
  const r = 8
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
      <circle cx="10" cy="10" r={r} stroke="#F3EFE8" strokeWidth="3" fill="none" />
      <circle
        cx="10"
        cy="10"
        r={r}
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}
