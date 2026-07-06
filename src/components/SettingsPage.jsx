import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function SettingsPage({
  habits,
  profile,
  onUpdateDisplayName,
  pausesByHabit = {},
  onDeleteHabit,
  onArchiveHabit,
  onUnarchiveHabit,
  onRenameHabit,
  onReorderHabit,
  onTogglePause,
  userEmail,
}) {
  const active = habits.filter((h) => !h.archived)
  const archived = habits.filter((h) => h.archived)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  function startEdit(h) {
    setEditingId(h.id)
    setEditValue(h.title)
  }

  function saveEdit(id) {
    onRenameHabit(id, editValue)
    setEditingId(null)
  }

  return (
    <div className="px-5 pt-6 pb-24 max-w-md mx-auto">
      <h1 className="font-display text-2xl text-ink mb-1">설정</h1>
      <p className="text-xs text-ink/40 mb-4">{userEmail}</p>

      <h2 className="text-xs text-ink/50 mb-2">내 프로필</h2>
      <NameEditor profile={profile} onSave={onUpdateDisplayName} />

      <h2 className="text-xs text-ink/50 mb-1">진행중인 할일</h2>
      <p className="text-[11px] text-ink/35 mb-2">화살표로 순서를 바꾸면 홈 화면에도 그대로 반영돼요.</p>
      <div className="space-y-2 mb-8">
        {active.length === 0 && <p className="text-sm text-ink/30">등록된 할일이 없어요.</p>}
        {active.map((h, i) => (
          <div
            key={h.id}
            className="bg-white rounded-xl border border-ink/5 shadow-soft px-4 py-3 flex items-center gap-3"
          >
            <div className="flex flex-col -my-1 shrink-0">
              <button
                onClick={() => onReorderHabit(h.id, 'up')}
                disabled={i === 0}
                className="text-ink/30 hover:text-ink disabled:opacity-20 disabled:hover:text-ink/30 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => onReorderHabit(h.id, 'down')}
                disabled={i === active.length - 1}
                className="text-ink/30 hover:text-ink disabled:opacity-20 disabled:hover:text-ink/30 transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
            {editingId === h.id ? (
              <>
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(h.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  className="flex-1 text-sm border border-ink/15 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-[#A3CBEA]"
                />
                <button onClick={() => saveEdit(h.id)} className="text-xs text-ink font-medium">
                  저장
                </button>
                <button onClick={() => setEditingId(null)} className="text-xs text-ink/30">
                  취소
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-ink flex-1">
                  {h.title}
                  {(pausesByHabit[h.id] || []).some((p) => !p.end_date) && (
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F3EFE8] text-ink/50">🌙 휴식중</span>
                  )}
                </span>
                <button onClick={() => startEdit(h)} className="text-xs text-ink/40 hover:text-ink transition">
                  이름수정
                </button>
                <button
                  onClick={() => {
                    const isPaused = (pausesByHabit[h.id] || []).some((p) => !p.end_date)
                    if (isPaused) {
                      onTogglePause(h)
                    } else if (
                      confirm(
                        `'${h.title}'을(를) 장기 휴식으로 바꿀까요? 다시 돌아올 때까지의 날들은 성공/실패 계산에서 완전히 빠지고, 연속 기록도 끊기지 않아요. (아프거나 여행 등으로 오래 쉴 때 사용하세요)`
                      )
                    ) {
                      onTogglePause(h)
                    }
                  }}
                  className="text-xs text-ink/40 hover:text-ink transition"
                >
                  {(pausesByHabit[h.id] || []).some((p) => !p.end_date) ? '휴식끝' : '휴식'}
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `'${h.title}'을(를) 보관할까요? 이번 달까지의 기록은 남고, 다음 달부터 홈 화면에서 안 보여요.`
                      )
                    ) {
                      onArchiveHabit(h.id)
                    }
                  }}
                  className="text-xs text-ink/40 hover:text-ink transition"
                >
                  보관
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `'${h.title}'을(를) 완전히 삭제할까요? 이 습관의 모든 기록과 메모가 영구히 사라져요. (보관은 취소할 수 있지만, 삭제는 되돌릴 수 없어요)`
                      )
                    ) {
                      onDeleteHabit(h.id)
                    }
                  }}
                  className="text-xs text-ink/30 hover:text-rose-400 transition"
                >
                  삭제
                </button>
              </>
            )}
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

function NameEditor({ profile, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  function start() {
    setValue(profile?.display_name || '')
    setEditing(true)
  }
  function save() {
    onSave(value)
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-ink/5 shadow-soft px-4 py-3 flex items-center gap-3 mb-6">
      {editing ? (
        <>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditing(false)
            }}
            placeholder="친구에게 보일 이름"
            className="flex-1 text-sm border border-ink/15 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-[#A3CBEA]"
          />
          <button onClick={save} className="text-xs text-ink font-medium">저장</button>
          <button onClick={() => setEditing(false)} className="text-xs text-ink/30">취소</button>
        </>
      ) : (
        <>
          <div className="flex-1">
            <p className="text-sm text-ink">{profile?.display_name || '(이름 없음)'}</p>
            <p className="text-[11px] text-ink/35">친구에게 보이는 이름이에요 · 내 코드: {profile?.friend_code || '...'}</p>
          </div>
          <button onClick={start} className="text-xs text-ink/40 hover:text-ink transition">이름수정</button>
        </>
      )}
    </div>
  )
}
