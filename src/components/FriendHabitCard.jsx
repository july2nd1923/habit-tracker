import { useMemo } from 'react'
import { daysInMonth, toDateStr } from '../lib/dateUtils'

export default function FriendHabitCard({ habit, logs, year, month, today }) {
  const total = daysInMonth(year, month)
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: habit.color }} />
          <h3 className="font-display text-base text-ink">{habit.title}</h3>
        </div>
        <span className="text-xs font-medium text-ink/50">{percent}% · {completedThisMonth}회</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const dateStr = toDateStr(year, month, d)
          const done = completedSet.has(dateStr)
          const isFuture = isCurrentMonth && d > today.getDate()
          return (
            <div
              key={d}
              className="aspect-square rounded-md text-[11px] flex items-center justify-center"
              style={{
                backgroundColor: done ? habit.color : '#F3EFE8',
                color: done ? '#3E3A36' : '#B7B0A5',
                opacity: isFuture ? 0.25 : 1,
              }}
            >
              {d}
            </div>
          )
        })}
      </div>
    </div>
  )
}
