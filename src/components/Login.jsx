import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError('이메일 또는 비밀번호가 올바르지 않아요.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-sm tracking-widest text-ink/40 mb-2">DAILY LOG</p>
          <h1 className="font-display text-3xl text-ink">매일 조금씩</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl2 shadow-card p-6 space-y-4 border border-ink/5"
        >
          <div>
            <label className="text-xs text-ink/50 mb-1 block">이메일</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#A3CBEA] focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="text-xs text-ink/50 mb-1 block">비밀번호</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-ink/10 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#A3CBEA] focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-paper rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '들어가기'}
          </button>
        </form>

        <p className="text-center text-xs text-ink/35 mt-6">
          계정은 Supabase 대시보드에서 초대해서 만들 수 있어요.
        </p>
      </div>
    </div>
  )
}
