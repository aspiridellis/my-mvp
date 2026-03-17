import { useState, useEffect } from 'react'

// ── Rec type → icon ───────────────────────────────────────────────────────────
const REC_ICONS = { workout: '🏋️', nap: '😴', recovery: '💚', sleep: '🌙', nutrition: '🥗' }

const FALLBACK_RECS = [
  { type: 'workout', title: 'Train hard today', body: 'Your HRV is above baseline — good window for progressive overload. Push intensity on compound lifts.', time: '10:00 AM', priority: 'high' },
  { type: 'nutrition', title: 'Front-load protein at lunch', body: 'Aim for 60g+ protein at midday on training days. Pre-workout: banana + black coffee 30 min before.', time: '12:30 PM', priority: 'medium' },
  { type: 'sleep', title: 'Wind down by 10 PM', body: 'Protect your sleep target. Dim lights after 9 PM and avoid screens 30 minutes before bed.', time: '10:00 PM', priority: 'medium' },
]
import { mockData } from './data/mockData'
import RecoveryCard from './components/RecoveryCard'
import ScheduleCard from './components/ScheduleCard'
import Onboarding from './components/Onboarding'

const API = 'http://localhost:8000'

// Abort a fetch if it doesn't respond within `ms` milliseconds.
// Lets the dashboard fall back to mock data instantly when the backend is down.
function fetchWithTimeout(url, opts = {}, ms = 4000) {
  const ctrl  = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

export default function App() {
  const [appState, setAppState]           = useState('loading')
  const [healthData, setHealthData]       = useState(null)
  const [calendarEvents, setCalendarEvents] = useState([])
  const [profile, setProfile]             = useState(null)
  const [dashFadeIn, setDashFadeIn]       = useState(false)
  const [insight, setInsight]             = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [recsLoading, setRecsLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      fetchWithTimeout(`${API}/api/profile`)
        .then((r) => r.json())
        .catch(() => {
          try {
            const cached = localStorage.getItem('alex_profile')
            return cached ? JSON.parse(cached) : {}
          } catch (_) { return {} }
        }),
      fetchWithTimeout(`${API}/api/health-data`)
        .then((r) => r.json())
        .catch(() => ({ ...mockData, source: 'mock', fetched_at: new Date().toISOString() })),
      fetchWithTimeout(`${API}/api/calendar`)
        .then((r) => r.json())
        .catch(() => []),
    ]).then(([profileData, data, events]) => {
      setHealthData(data)
      setCalendarEvents(Array.isArray(events) ? events : [])
      if (profileData?.name) {
        setProfile(profileData)
        setAppState('dashboard')
        setTimeout(() => setDashFadeIn(true), 30)
      } else {
        setAppState('onboarding')
      }

      // Fetch recommendations in the background — fills in after dashboard appears
      fetchWithTimeout(`${API}/api/recommendations`, { method: 'POST' })
        .then((r) => r.json())
        .then((recs) => {
          setInsight(recs?.insight ?? '')
          setRecommendations(Array.isArray(recs?.recommendations) ? recs.recommendations : [])
          setRecsLoading(false)
        })
        .catch(() => { setRecommendations(FALLBACK_RECS); setRecsLoading(false) })
    })
  }, [])

  function handleOnboardingComplete(newProfile) {
    setProfile(newProfile)
    setAppState('dashboard')
    setTimeout(() => setDashFadeIn(true), 30)
    // Kick off recommendations now that we have a profile
    fetchWithTimeout(`${API}/api/recommendations`, { method: 'POST' })
      .then((r) => r.json())
      .then((recs) => {
        setInsight(recs?.insight ?? '')
        setRecommendations(Array.isArray(recs?.recommendations) ? recs.recommendations : [])
        setRecsLoading(false)
      })
      .catch(() => { setRecommendations(FALLBACK_RECS); setRecsLoading(false) })
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#D97706] flex items-center justify-center">
            <span className="text-white font-bold">A</span>
          </div>
          <p className="text-sm text-[#A8A29E]">Loading…</p>
        </div>
      </div>
    )
  }

  // ── Onboarding ───────────────────────────────────────────────────────────────
  if (appState === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  const data      = healthData ?? { ...mockData, source: 'mock', fetched_at: new Date().toISOString() }
  const { date, recovery, sleep_target, fetched_at, source } = data
  const firstName = (profile?.name ?? 'Alex').split(' ')[0]

  return (
    <div
      className="min-h-screen bg-[#FAFAF8] transition-opacity duration-500"
      style={{ opacity: dashFadeIn ? 1 : 0 }}
    >
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* ── Two-column layout: 40% left / 60% right ── */}
        <div className="grid grid-cols-[2fr_3fr] gap-8 items-start">

          {/* ── Left column ── */}
          <div>
            <div className="mb-7">
              <h1 className="text-[24px] font-semibold text-[#1C1917] tracking-tight leading-tight">
                Good morning, {firstName}.
              </h1>
              {insight ? (
                <p className="text-sm text-[#78716C] italic mt-1.5 leading-relaxed">
                  {insight}
                </p>
              ) : (
                <p className="text-sm text-[#C7C3BF] mt-1.5">{date}</p>
              )}
            </div>
            <RecoveryCard
              recovery={recovery}
              fetchedAt={fetched_at}
              source={source}
            />
          </div>

          {/* ── Right column ── */}
          <ScheduleCard
            events={calendarEvents}
            date={date}
            sleepTarget={sleep_target}
          />

        </div>

        {/* ── Your Day, Optimized ── */}
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A8A29E]">
              Your Day, Optimized
            </p>
            {recsLoading && (
              <span className="text-[11px] text-[#C7C3BF] italic">Generating…</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {recsLoading
              ? [0, 1, 2].map((i) => <RecSkeleton key={i} />)
              : recommendations.map((rec, i) => <RecCard key={i} rec={rec} />)
            }
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Recommendation card ───────────────────────────────────────────────────────
function RecCard({ rec }) {
  const icon   = REC_ICONS[rec.type] ?? '💡'
  const isHigh = rec.priority === 'high'
  return (
    <div
      className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-2"
      style={isHigh ? { borderLeft: '3px solid #D97706' } : {}}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg leading-none">{icon}</span>
        {rec.time && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] whitespace-nowrap">
            {rec.time}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-[#1C1917] leading-snug">{rec.title}</p>
      <p className="text-xs text-[#78716C] leading-relaxed">{rec.body}</p>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function RecSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm animate-pulse">
      <div className="w-7 h-7 rounded-full bg-[#F5F5F4] mb-3" />
      <div className="h-3.5 bg-[#F5F5F4] rounded-full w-3/4 mb-2.5" />
      <div className="h-3 bg-[#F5F5F4] rounded-full w-full mb-1.5" />
      <div className="h-3 bg-[#F5F5F4] rounded-full w-2/3" />
    </div>
  )
}
