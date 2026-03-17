import { useState, useEffect, useRef } from 'react'

const API = 'http://localhost:8000'

// ── 10 onboarding questions ───────────────────────────────────────────────────
const QUESTIONS = [
  {
    key: 'name',
    text: "What's your name?",
    goal: "The user's first name.",
    skipFollowup: true,
  },
  {
    key: 'morning_routine',
    text: "What time do you usually wake up, and what does your morning typically look like before work starts?",
    goal: 'Wake time and pre-work morning routine.',
  },
  {
    key: 'work_type',
    text: "What do you do for work — is it mostly meetings, deep focus, physical, or unpredictable?",
    goal: 'Nature of work: cognitive load, physical demand, schedule predictability.',
  },
  {
    key: 'peak_energy',
    text: "When during the day do you naturally have the most energy — morning, afternoon, or evening?",
    goal: 'Chronotype and peak performance window.',
  },
  {
    key: 'training',
    text: "Do you work out? If yes — what do you do, how many days a week, and when do you prefer to train?",
    goal: 'Exercise type, weekly frequency, and preferred training time.',
  },
  {
    key: 'low_energy_response',
    text: "On a day when your energy is low, what do you actually do — push through your normal routine, scale things back, or rest?",
    goal: 'Behavioural response to low-recovery or low-energy days.',
  },
  {
    key: 'alcohol',
    text: "How often do you drink alcohol, and does it noticeably affect how you feel or sleep the next day?",
    goal: 'Alcohol frequency and perceived next-day impact on recovery.',
  },
  {
    key: 'stress_sleep',
    text: "What does a high-stress day look like for you, and how does it affect your sleep that night?",
    goal: 'Stress triggers and their effect on sleep quality.',
  },
  {
    key: 'evening_habits',
    text: "What are your evening commitments like — lots of social dinners and late nights, or do you mostly wind down early?",
    goal: 'Evening routine, social obligations, and sleep schedule consistency.',
  },
  {
    key: 'health_goal',
    text: "What's one thing you wish you were better at when it comes to your health or daily routine?",
    goal: 'Primary health or lifestyle improvement focus.',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function MicIcon({ active }) {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <rect
        x="5.5" y="1" width="6" height="10" rx="3"
        fill={active ? 'white' : 'currentColor'}
      />
      <path
        d="M2.5 8.5a6 6 0 0 0 12 0"
        stroke={active ? 'white' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="8.5" y1="14.5" x2="8.5" y2="16.5"
        stroke={active ? 'white' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path
        d="M13.5 7.5L1.5 1.5L4 7.5L1.5 13.5L13.5 7.5Z"
        fill="white"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-1.5 items-center py-0.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-[#C7C3BF] animate-bounce"
          style={{ animationDelay: `${i * 140}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  )
}

// ── Progress dots (10 questions) ──────────────────────────────────────────────
function QuestionProgress({ questionIndex, isDone }) {
  return (
    <div className="flex gap-[5px] items-center">
      {QUESTIONS.map((_, i) => {
        const done = isDone || i < questionIndex
        const active = !isDone && i === questionIndex
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width:           done ? 14 : active ? 7 : 5,
              height:          5,
              backgroundColor: done || active ? '#D97706' : '#E7E5E4',
              opacity:         done || active ? 1 : 0.45,
            }}
          />
        )
      })}
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ role, text }) {
  const isAlex = role === 'alex'
  return (
    <div className={`flex items-end gap-2 ${isAlex ? 'justify-start' : 'justify-end'}`}>
      {isAlex && (
        <div className="w-7 h-7 rounded-full bg-[#D97706] flex items-center justify-center flex-shrink-0 mb-0.5">
          <span className="text-white text-[11px] font-bold">A</span>
        </div>
      )}
      <div
        className={`max-w-[78%] px-4 py-3 text-sm leading-relaxed ${
          isAlex
            ? 'bg-white text-[#1C1917] rounded-2xl rounded-bl-sm shadow-[0_1px_4px_rgba(0,0,0,0.07)]'
            : 'text-white rounded-2xl rounded-br-sm'
        }`}
        style={!isAlex ? { backgroundColor: '#D97706' } : {}}
      >
        {text}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Onboarding({ onComplete }) {
  const [messages, setMessages]               = useState([])
  const [questionIndex, setQuestionIndex]     = useState(0)
  const [followupCount, setFollowupCount]     = useState(0)
  const [questionMessages, setQuestionMessages] = useState([]) // context for Claude
  const [collectedData, setCollectedData]     = useState({})
  const [input, setInput]                     = useState('')
  const [isTyping, setIsTyping]               = useState(false)
  const [isListening, setIsListening]         = useState(false)
  const [isDone, setIsDone]                   = useState(false)
  const [fadingOut, setFadingOut]             = useState(false)

  const messagesEndRef  = useRef(null)
  const inputRef        = useRef(null)
  const recognitionRef  = useRef(null)
  // ── FIX: prevents React StrictMode double-invoke from firing two opening messages
  const hasInitRef      = useRef(false)

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // ── Opening message (runs exactly once) ─────────────────────────────────────
  useEffect(() => {
    if (hasInitRef.current) return
    hasInitRef.current = true

    setIsTyping(true)
    setTimeout(() => {
      const opening =
        "Hey — I'm Alex, your personal health assistant. I'll use your Oura data and calendar to build your day around how you actually feel. Let's start — what's your name?"
      addAlexMessage(opening)
      setQuestionMessages([{ role: 'alex', text: opening }])
      setIsTyping(false)
      setTimeout(() => inputRef.current?.focus(), 80)
    }, 700)
  }, []) // eslint-disable-line

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function addAlexMessage(text) {
    setMessages((prev) => [...prev, { role: 'alex', text, id: Date.now() + Math.random() }])
  }

  // ── Advance to the next question (or finish) ─────────────────────────────────
  async function advanceToNextQuestion(nextIdx, data) {
    if (nextIdx >= QUESTIONS.length) {
      // ── All 10 questions answered ──
      const closing = "Perfect — I know enough to start building your days around you."
      addAlexMessage(closing)
      setIsTyping(false)
      setIsDone(true)

      const profile = buildProfile(data)
      await saveProfile(profile)

      setTimeout(() => {
        setFadingOut(true)
        setTimeout(() => onComplete(profile), 500)
      }, 1900)

    } else {
      // ── Show next question ──
      setQuestionIndex(nextIdx)
      setFollowupCount(0)
      const nextQ = QUESTIONS[nextIdx]
      setQuestionMessages([{ role: 'alex', text: nextQ.text }])
      addAlexMessage(nextQ.text)
      setIsTyping(false)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }

  // ── Handle user submission ───────────────────────────────────────────────────
  async function handleSend() {
    const text = input.trim()
    if (!text || isTyping || isDone) return
    setInput('')

    // Show user bubble immediately
    setMessages((prev) => [...prev, { role: 'user', text, id: Date.now() }])

    const currentQ   = QUESTIONS[questionIndex]
    const newQMsgs   = [...questionMessages, { role: 'user', text }]
    setQuestionMessages(newQMsgs)

    // Append to collected data (second answer appends with separator)
    const existing   = collectedData[currentQ.key] || ''
    const combined   = existing ? `${existing} | ${text}` : text
    const updatedData = { ...collectedData, [currentQ.key]: combined }
    setCollectedData(updatedData)

    setIsTyping(true)

    // Q1 (name): never follow up
    if (currentQ.skipFollowup) {
      await sleep(500)
      await advanceToNextQuestion(questionIndex + 1, updatedData)
      return
    }

    // Max 1 follow-up already used → move on
    if (followupCount >= 1) {
      await sleep(400)
      await advanceToNextQuestion(questionIndex + 1, updatedData)
      return
    }

    // ── Ask Claude whether to follow up ──────────────────────────────────────
    let moveOn      = false
    let followUpText = ''

    try {
      const res = await fetch(`${API}/api/onboarding-followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text:  currentQ.text,
          question_goal:  currentQ.goal,
          conversation:   newQMsgs,
          follow_up_count: followupCount,
          user_name:      updatedData.name || 'the user',
        }),
      })
      const result = await res.json()
      moveOn = result.type === 'move_on'
      if (!moveOn) followUpText = result.text
    } catch {
      moveOn = true // backend down — advance gracefully
    }

    if (moveOn) {
      await sleep(350)
      await advanceToNextQuestion(questionIndex + 1, updatedData)
    } else {
      // Show Claude's follow-up question
      setFollowupCount(1)
      setQuestionMessages((prev) => [...prev, { role: 'alex', text: followUpText }])
      addAlexMessage(followUpText)
      setIsTyping(false)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }

  // ── Profile builders ─────────────────────────────────────────────────────────
  function buildProfile(data) {
    return {
      name:                data.name                || '',
      morning_routine:     data.morning_routine     || '',
      work_type:           data.work_type           || '',
      peak_energy:         data.peak_energy         || '',
      training:            data.training            || '',
      low_energy_response: data.low_energy_response || '',
      alcohol:             data.alcohol             || '',
      stress_sleep:        data.stress_sleep        || '',
      evening_habits:      data.evening_habits      || '',
      health_goal:         data.health_goal         || '',
      created_at:          new Date().toISOString(),
    }
  }

  async function saveProfile(profile) {
    try { localStorage.setItem('alex_profile', JSON.stringify(profile)) } catch (_) {}
    try {
      await fetch(`${API}/api/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
    } catch (_) {}
  }

  // ── Voice input ──────────────────────────────────────────────────────────────
  function handleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('Voice input is not supported in this browser. Try Chrome or Safari.')
      return
    }
    if (isListening) {
      recognitionRef.current?.stop()
      return
    }
    const recognition         = new SR()
    recognition.lang          = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart  = () => setIsListening(true)
    recognition.onend    = () => setIsListening(false)
    recognition.onerror  = () => setIsListening(false)
    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript
      setInput((prev) => (prev ? prev + ' ' + t : t))
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  // ── Header subtitle ───────────────────────────────────────────────────────────
  const subtitle = isDone
    ? 'All set'
    : `Question ${questionIndex + 1} of ${QUESTIONS.length}`

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[#FAFAF8] flex flex-col transition-opacity duration-500"
      style={{ opacity: fadingOut ? 0 : 1 }}
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 px-6 py-4 border-b border-[#EEE9E4]"
        style={{ background: 'rgba(250,250,248,0.92)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#D97706] flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">A</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1C1917] leading-tight">Alex</p>
              <p className="text-[11px] text-[#A8A29E]">{subtitle}</p>
            </div>
          </div>
          <QuestionProgress questionIndex={questionIndex} isDone={isDone} />
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-2">
        <div className="max-w-xl mx-auto space-y-3">
          {messages.map((msg) => (
            <Bubble key={msg.id} role={msg.role} text={msg.text} />
          ))}

          {isTyping && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-[#D97706] flex items-center justify-center flex-shrink-0 mb-0.5">
                <span className="text-white text-[11px] font-bold">A</span>
              </div>
              <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.07)]">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-2" />
        </div>
      </div>

      {/* ── Input ── */}
      <div
        className="flex-shrink-0 px-5 py-4 border-t border-[#EEE9E4]"
        style={{ background: 'rgba(250,250,248,0.95)', backdropFilter: 'blur(8px)' }}
      >
        <div className="max-w-xl mx-auto flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isDone ? '' : 'Type your answer…'}
            disabled={isDone}
            className="flex-1 bg-white border border-[#E7E5E4] rounded-full px-4 py-2.5 text-sm text-[#1C1917] placeholder-[#C7C3BF] outline-none focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/10 transition-all disabled:opacity-0"
          />

          {!isDone && (
            <button
              onClick={handleMic}
              title={isListening ? 'Stop' : 'Voice input'}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
              style={{
                backgroundColor: isListening ? '#DC2626' : '#F0EDE9',
                color:           isListening ? 'white'   : '#78716C',
              }}
            >
              <MicIcon active={isListening} />
            </button>
          )}

          {!isDone && (
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 disabled:opacity-30"
              style={{ backgroundColor: '#D97706' }}
            >
              <SendIcon />
            </button>
          )}
        </div>

        {isListening && (
          <p className="max-w-xl mx-auto text-center text-xs text-[#DC2626] mt-2 font-medium animate-pulse">
            Listening… speak now
          </p>
        )}
      </div>
    </div>
  )
}
