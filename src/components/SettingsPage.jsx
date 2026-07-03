import { supabase } from '../supabaseClient'

export default function SettingsPage({ habits, onDeleteHabit, userEmail }) {
  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <h1 className="font-display text-2xl text-ink mb-1">설정</h1>
      <p className="text-xs text-ink/40 mb-6">{userEmail}</p>

      <h2 className="text-xs text-ink/50 mb-2">할일 관리</h2>
      <div className="space-y-2 mb-8">
        {habits.length === 0 && (
          <p className="text-sm text-ink/30">등록된 할일이 없어요.</p>
        )}
        {habits.map((h) => (
          <div
            key={h.id}
            className="bg-white rounded-xl border border-ink/5 shadow-soft px-4 py-3 flex items-center gap-3"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: h.color }} />
            <span className="text-sm text-ink flex-1">{h.title}</span>
            <button
              onClick={() => {
                if (confirm(`'${h.title}'을(를) 삭제할까요? 기록도 함께 삭제돼요.`)) {
                  onDeleteHabit(h.id)
                }
              }}
              className="text-xs text-ink/30 hover:text-rose-400 transition"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="w-full rounded-lg py-2.5 text-sm border border-ink/10 text-ink/60 hover:bg-ink/5 transition"
      >
        로그아웃
      </button>
    </div>
  )
}
