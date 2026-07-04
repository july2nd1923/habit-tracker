import { useState } from 'react'
import { PALETTE } from '../lib/dateUtils'

export default function CreateChallengeModal({ friendName, onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState(PALETTE[0].value)

  function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    onCreate({ title: title.trim(), color })
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6 border border-ink/5">
        <h2 className="font-display text-lg text-ink mb-1">함께 챌린지 만들기</h2>
        <p className="text-xs text-ink/40 mb-4">{friendName}님에게 초대를 보내요.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-ink/50 mb-1 block">챌린지 이름</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 매일 물 2L 마시기"
              className="w-full rounded-lg border border-ink/10 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#A3CBEA] focus:border-transparent"
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
                  title={c.name}
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

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg py-2.5 text-sm text-ink/60 border border-ink/10 hover:bg-ink/5 transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg py-2.5 text-sm bg-ink text-paper hover:opacity-90 transition"
            >
              초대 보내기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
