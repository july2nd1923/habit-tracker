import { useState } from 'react'
import { formatMonthLabel } from '../lib/dateUtils'
import HabitCard from './HabitCard'
import StatsSummary from './StatsSummary'
import YearHeatmap from './YearHeatmap'

export default function HomePage({
  habits,
  allHabits,
  logsByHabit,
  pausesByHabit,
  year,
  month,
  today,
  onPrevMonth,
  onNextMonth,
  onToggle,
  onOpenNote,
  onToggleVisibility,
  onAddClick,
  onRefreshHabits,
}) {
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const [showYearView, setShowYearView] = useState(false)

  if (showYearView) {
    return (
      <YearHeatmap
        habits={allHabits || habits}
        pausesByHabit={pausesByHabit}
        today={today}
        onClose={() => setShowYearView(false)}
      />
    )
  }

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl text-ink">매일 조금씩</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowYearView(true)}
            className="text-xs px-3 py-1.5 rounded-full border border-ink/10 text-ink/60 hover:bg-ink/5 transition"
          >
            📅 연간
          </button>
          <button
            onClick={onAddClick}
            className="w-9 h-9 rounded-full bg-ink text-paper flex items-center justify-center hover:opacity-90 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 my-4">
        <button onClick={onPrevMonth} className="text-ink/40 hover:text-ink transition p-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-sm font-medium text-ink/70 w-28 text-center">
          {formatMonthLabel(year, month)}
        </span>
        <button
          onClick={onNextMonth}
          disabled={isCurrentMonth}
          className="text-ink/40 hover:text-ink transition p-1 disabled:opacity-20 disabled:hover:text-ink/40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {habits.length > 0 && (
        <StatsSummary habits={habits} logsByHabit={logsByHabit} pausesByHabit={pausesByHabit} year={year} month={month} today={today} />
      )}

      {habits.length === 0 ? (
        <div className="text-center pt-16 text-ink/40 text-sm">
          아직 할일이 없어요.
          <br />
          오른쪽 위 + 버튼으로 첫 습관을 추가해보세요.
        </div>
      ) : (
        <div className="space-y-3.5">
          {habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              logs={logsByHabit[h.id] || { done: [], rest: [] }}
              pauses={pausesByHabit[h.id] || []}
              year={year}
              month={month}
              today={today}
              onToggle={onToggle}
              onOpenNote={onOpenNote}
              onToggleVisibility={onToggleVisibility}
              onRefreshHabits={onRefreshHabits}
            />
          ))}
        </div>
      )}
    </div>
  )
}
