import { supabase } from '../supabaseClient'

export default function SettingsPage({ habits, onDeleteHabit, onArchiveHabit, onUnarchiveHabit, userEmail }) {
  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <h1 className="font-display text-2xl text-ink mb-1">설정</h1>
      <p className="text-xs text-ink/40 mb-6">{userEmail}</p>

      <h2 className="text-xs text-ink/50 mb-2">진행중인 할일</h2>
      <div className="space-y-2 mb-8">
        {active.length === 0 && <p className="text-sm text-ink/30">등록된 할일이 없어요.</p>}
        {active.map((h) => (
          <div
            key={h.id}
            className="bg-white rounded-xl border border-ink/5 shadow-soft px-4 py-3 flex items-center gap-3"
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
            <span className="text-sm text-ink flex-1">{h.title}</span>
            <button
              onClick={() => {
                if (confirm(`'${h.title}'을(를) 보관할까요? 이번 달까지의 기록은 남고, 다음 달부터 홈 화면에서 안 보여요.`)) {
                  onArchiveHabit(h.id)
                }
              }}
              className="text-xs text-ink/40 hover:text-ink transition"
            >
              보관
            </button>
            <button
              onClick={() => {
                if (confirm(`'${h.title}'을(를) 완전히 삭제할까요? 이 습관의 모든 기록과 메모가 영구히 사라져요. (보관은 취소할 수 있지만, 삭제는 되돌릴 수 없어요)`)) {
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

      {archived.length > 0 && (
        <>
          <h2 className="text-xs text-ink/50 mb-2">보관됨</h2>
          <p className="text-[11px] text-ink/35 mb-2">
            보관한 달까지의 기록은 그대로 남아있어요. 지난 달 화면에서 계속 확인할 수 있어요.
          </p>
          <div className="space-y-2 mb-8">
            {archived.map((h) => (
              <div
                key={h.id}
                className="bg-white rounded-xl border border-ink/5 shadow-soft px-4 py-3 flex items-center gap-3 opacity-70"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                <span className="text-sm text-ink flex-1">{h.title}</span>
                <button
                  onClick={() => onUnarchiveHabit(h.id)}
                  className="text-xs text-ink/40 hover:text-ink transition"
                >
                  복원
                </button>
                <button
                  onClick={() => {
                    if (confirm(`'${h.title}'을(를) 완전히 삭제할까요? 모든 기록과 메모가 영구히 사라져요.`)) {
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
        </>
      )}

      <button
        onClick={() => supabase.auth.signOut()}
        className="w-full rounded-lg py-2.5 text-sm border border-ink/10 text-ink/60 hover:bg-ink/5 transition"
      >
        로그아웃
      </button>
    </div>
  )
}
