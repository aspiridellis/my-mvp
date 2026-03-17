from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from pathlib import Path
import asyncio
import datetime as dt_module
import json
import os

# ── Google Calendar (optional — gracefully absent if not installed) ────────────
try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request as GoogleRequest
    from googleapiclient.discovery import build as gcal_build
    GCAL_AVAILABLE = True
except ImportError:
    GCAL_AVAILABLE = False

# Load .env from project root (one level up from backend/)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import anthropic as anthropic_sdk

app = FastAPI(title="Alex Health API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Paths ─────────────────────────────────────────────────────────────────────
OURA_FILE    = Path(__file__).parent / "data" / "oura_latest.json"
DATA_DIR     = Path(__file__).parent.parent / "data"
PROFILE_FILE = DATA_DIR / "profile.json"

GCAL_SCOPES     = ["https://www.googleapis.com/auth/calendar.readonly"]
GCAL_CREDS_FILE = Path(__file__).parent / "credentials.json"
GCAL_TOKEN_FILE = Path(__file__).parent / "data" / "google_token.json"

# ── Mock fallback data ─────────────────────────────────────────────────────────
MOCK = {
    "date": datetime.now().strftime("%A, %B %-d"),
    "recovery": {
        "score": 78,
        "status": "Good",
        "hrv": 54,
        "hrv_trend": "+3 vs avg",
        "resting_hr": 49,
        "temp_delta": 0.1,
        "sleep_total": "7h 20m",
        "sleep_deep": "1h 35m",
        "sleep_rem": "1h 50m",
        "efficiency": 89,
    },
    "training": {
        "recommendation": "Train hard today",
        "type": "Upper body strength",
        "duration": "50 min",
        "intensity": "RPE 8",
        "notes": "HRV is above your 7-day avg. Good window for progressive overload on bench and rows.",
    },
    "calendar": [
        {"time": "8:00 AM", "title": "Team standup", "duration": "30m", "flag": None},
        {"time": "10:00 AM", "title": "Deep work block", "duration": "2h", "flag": None},
        {"time": "12:30 PM", "title": "Lunch with Mike", "duration": "1h", "flag": None},
        {"time": "3:00 PM", "title": "Product review", "duration": "1h", "flag": None},
        {
            "time": "7:30 PM",
            "title": "Dinner (late)",
            "duration": "2h",
            "flag": {
                "type": "sleep-risk",
                "label": "Late meal",
                "note": "Aim to eat light — late dinners drop your HRV by ~8 points on average.",
            },
        },
    ],
    "schedule_note": "Light morning, packed afternoon. The 7:30 dinner is your only sleep risk today.",
    "nutrition": {
        "protein_target": 210,
        "calories": 2900,
        "note": "Training day — front-load protein. Pre-workout: banana + black coffee.",
    },
    "sleep_target": "10:30 PM",
}


# ── Startup diagnostics ───────────────────────────────────────────────────────
print(f"[Alex] OURA_FILE : {OURA_FILE}")
print(f"[Alex] File exists: {OURA_FILE.exists()}")
if OURA_FILE.exists():
    try:
        _p = json.loads(OURA_FILE.read_text())
        print(
            f"[Alex] Oura data  : readiness={(_p.get('readiness') or {}).get('score') or _p.get('score')} | "
            f"hrv={_p.get('average_hrv') or _p.get('hrv')} ms | "
            f"resting_hr={_p.get('resting_hr')} bpm | "
            f"temp={_p.get('body_temperature_delta') or _p.get('temp_delta')}°"
        )
    except Exception as _e:
        print(f"[Alex] Failed to read Oura file: {_e}")

# ── Helpers ────────────────────────────────────────────────────────────────────
def secs_to_str(seconds) -> str:
    if not isinstance(seconds, (int, float)) or seconds <= 0:
        return None
    h = int(seconds) // 3600
    m = (int(seconds) % 3600) // 60
    return f"{h}h {m:02d}m"


def dig(obj: dict, *paths: str):
    for path in paths:
        cur = obj
        for key in path.split("."):
            if isinstance(cur, dict):
                cur = cur.get(key)
            else:
                cur = None
                break
        if cur is not None:
            return cur
    return None


def transform_oura(raw: dict) -> dict:
    score         = dig(raw, "readiness.score", "recovery_score", "score") or MOCK["recovery"]["score"]
    hrv           = dig(raw, "sleep.average_hrv", "hrv", "average_hrv") or MOCK["recovery"]["hrv"]
    rhr           = dig(raw, "sleep.lowest_heart_rate", "resting_hr", "resting_heart_rate", "lowest_heart_rate") or MOCK["recovery"]["resting_hr"]
    eff           = dig(raw, "sleep.efficiency", "sleep_efficiency", "efficiency") or MOCK["recovery"]["efficiency"]
    temp          = dig(raw, "body_temperature_delta", "temp_delta", "temperature_deviation")
    # temp can legitimately be negative — only fall back to mock if truly absent
    if temp is None:
        temp = MOCK["recovery"]["temp_delta"]

    total_raw = dig(raw, "sleep.total_sleep_duration", "sleep_total_seconds", "total_sleep_duration")
    deep_raw  = dig(raw, "sleep.deep_sleep_duration",  "sleep_deep_seconds",  "deep_sleep_duration")
    rem_raw   = dig(raw, "sleep.rem_sleep_duration",   "sleep_rem_seconds",   "rem_sleep_duration")

    sleep_total = secs_to_str(total_raw) or MOCK["recovery"]["sleep_total"]
    sleep_deep  = secs_to_str(deep_raw)  or MOCK["recovery"]["sleep_deep"]
    sleep_rem   = secs_to_str(rem_raw)   or MOCK["recovery"]["sleep_rem"]

    hrv_avg = dig(raw, "hrv_7day_avg", "hrv_avg", "average_hrv_5_days")
    if hrv_avg:
        delta = int(hrv) - int(hrv_avg)
        hrv_trend = f"+{delta} vs avg" if delta >= 0 else f"{delta} vs avg"
    else:
        hrv_trend = MOCK["recovery"]["hrv_trend"]

    s = int(score)
    status = "Good" if s >= 70 else ("Warning" if s >= 40 else "Low")

    # Sleep score — from daily_sleep endpoint or embedded readiness score
    sleep_score = dig(raw, "daily_sleep.score", "sleep_score", "sleep.readiness.score")

    # Activity score — from daily_activity endpoint
    activity_score = dig(raw, "activity.score", "activity_score")

    # Use fetched_at date (today) rather than sleep record date (yesterday)
    fetched_at = raw.get("fetched_at", datetime.now().isoformat())
    try:
        from datetime import date as date_cls
        date_str = date_cls.fromisoformat(fetched_at[:10]).strftime("%A, %B %-d")
    except Exception:
        date_str = datetime.now().strftime("%A, %B %-d")

    return {
        "date": date_str,
        "recovery": {
            "score":        int(score),
            "status":       status,
            "hrv":          int(hrv),
            "hrv_trend":    hrv_trend,
            "resting_hr":   int(rhr),
            "temp_delta":   round(float(temp), 2),
            "sleep_total":  sleep_total,
            "sleep_deep":   sleep_deep,
            "sleep_rem":    sleep_rem,
            "efficiency":   int(eff),
            "sleep_score":  int(sleep_score) if sleep_score is not None else None,
            "activity_score": int(activity_score) if activity_score is not None else None,
        },
        "training":      MOCK["training"],
        "calendar":      MOCK["calendar"],
        "schedule_note": MOCK["schedule_note"],
        "nutrition":     MOCK["nutrition"],
        "sleep_target":  MOCK["sleep_target"],
        "fetched_at":    fetched_at,
        "source":        "oura",
    }


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/api/health-data")
async def get_health_data():
    if OURA_FILE.exists():
        try:
            raw = json.loads(OURA_FILE.read_text())
            return transform_oura(raw)
        except Exception:
            pass
    return {
        **MOCK,
        "date": datetime.now().strftime("%A, %B %-d"),  # always today, even if server ran overnight
        "source": "mock",
        "fetched_at": datetime.now().isoformat(),
    }


@app.get("/api/profile")
async def get_profile():
    if PROFILE_FILE.exists():
        try:
            return json.loads(PROFILE_FILE.read_text())
        except Exception:
            pass
    return {}


@app.post("/api/profile")
async def save_profile(request: Request):
    data = await request.json()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROFILE_FILE.write_text(json.dumps(data, indent=2))
    return {"ok": True}


@app.delete("/api/profile")
async def reset_profile():
    """Dev helper — deletes profile so onboarding re-runs."""
    if PROFILE_FILE.exists():
        PROFILE_FILE.unlink()
    return {"ok": True}


@app.post("/api/onboarding-followup")
async def onboarding_followup(request: Request):
    """
    Given the user's answer to a specific onboarding question, decide whether
    to ask ONE smart follow-up or signal MOVE_ON to the next question.
    Uses claude-haiku-4-5-20251001. Max 1 follow-up per question.
    """
    data = await request.json()
    question_text: str  = data.get("question_text", "")
    question_goal: str  = data.get("question_goal", "")
    conversation: list  = data.get("conversation", [])
    follow_up_count: int = data.get("follow_up_count", 0)
    user_name: str      = data.get("user_name", "the user")

    # Hard cap: max 1 follow-up per question
    if follow_up_count >= 1:
        return {"type": "move_on"}

    # ── Build message list for the Claude API ──
    # conversation contains "alex" and "user" turns.
    # Drop leading "alex" message (the question itself is in the system prompt).
    api_messages = []
    for msg in conversation:
        role = "user" if msg.get("role") == "user" else "assistant"
        if not api_messages and role == "assistant":
            continue  # skip opening question — it's in the system prompt
        # Merge consecutive same-role messages (safety guard)
        if api_messages and api_messages[-1]["role"] == role:
            api_messages[-1]["content"] += " " + msg["text"]
        else:
            api_messages.append({"role": role, "content": msg["text"]})

    # Need at least one user message
    if not api_messages or api_messages[0]["role"] != "user":
        return {"type": "move_on"}

    system = f"""You are Alex, a sharp and warm personal health assistant doing a quick intake with {user_name}.

You just asked them: "{question_text}"
What you're trying to learn: {question_goal}

Look at their answer and decide ONE of two things:

1. Ask ONE concise follow-up — do this ONLY if the answer is vague, skips a key detail \
(e.g. a frequency, time, or concrete example), or leaves something important unclear.

2. Return exactly the word MOVE_ON — do this if the answer is already specific enough \
to be useful. When in doubt, move on.

Rules:
- Keep any follow-up under 15 words and laser-focused on the missing detail
- Probe for numbers, times, and real examples — not more description
- Output ONLY the follow-up question text, OR exactly: MOVE_ON
- No preamble, no sign-off, no explanation"""

    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key or api_key == "your-anthropic-api-key-here":
            return {"type": "move_on"}

        client = anthropic_sdk.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=80,
            system=system,
            messages=api_messages,
        )

        text = response.content[0].text.strip()

        # Detect MOVE_ON signal
        if "MOVE_ON" in text.upper() and len(text) < 25:
            return {"type": "move_on"}

        return {"type": "question", "text": text}

    except Exception:
        return {"type": "move_on"}


# ── Google Calendar helpers ────────────────────────────────────────────────────

def _gcal_service():
    """Return an authorised Google Calendar service, or None if not available."""
    if not GCAL_AVAILABLE or not GCAL_CREDS_FILE.exists():
        return None

    creds = None
    if GCAL_TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(GCAL_TOKEN_FILE), GCAL_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(GoogleRequest())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(GCAL_CREDS_FILE), GCAL_SCOPES
            )
            # Opens a browser window; blocks until the user authorises.
            creds = flow.run_local_server(port=0)

        GCAL_TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        GCAL_TOKEN_FILE.write_text(creds.to_json())

    return gcal_build("calendar", "v3", credentials=creds)


def _fmt_duration(minutes: int) -> str:
    if minutes < 60:
        return f"{minutes}m"
    h, m = divmod(minutes, 60)
    return f"{h}h {m}m" if m else f"{h}h"


def _fetch_calendar_events_sync() -> list:
    """Synchronous helper — called via asyncio.to_thread."""
    service = _gcal_service()
    if service is None:
        return []

    local_tz = dt_module.datetime.now().astimezone().tzinfo
    today    = dt_module.date.today()
    time_min = dt_module.datetime(today.year, today.month, today.day,  0,  0,  0, tzinfo=local_tz).isoformat()
    time_max = dt_module.datetime(today.year, today.month, today.day, 23, 59, 59, tzinfo=local_tz).isoformat()

    result = service.events().list(
        calendarId="primary",
        timeMin=time_min,
        timeMax=time_max,
        singleEvents=True,
        orderBy="startTime",
    ).execute()

    events = []
    for ev in result.get("items", []):
        start_raw = ev["start"].get("dateTime", ev["start"].get("date", ""))
        end_raw   = ev["end"].get("dateTime",   ev["end"].get("date",   ""))

        if "T" in start_raw:
            start_dt = dt_module.datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
            end_dt   = dt_module.datetime.fromisoformat(end_raw.replace("Z",   "+00:00"))
            time_str = start_dt.strftime("%-I:%M %p")
            dur_mins = int((end_dt - start_dt).total_seconds() / 60)
            dur_str  = _fmt_duration(dur_mins)

            # Flag: event ending at/after 9 PM → sleep risk
            flag = None
            end_local_hour = end_dt.hour + end_dt.minute / 60
            if end_local_hour >= 21.0:
                flag = {
                    "type":  "sleep-risk",
                    "label": "Late event",
                    "note":  "Ends late — wind down before sleep to protect your HRV.",
                }
            elif start_dt.hour < 7:
                flag = {
                    "type":  "early-start",
                    "label": "Early start",
                    "note":  "Early start — hit your sleep target tonight to recover fully.",
                }
        else:
            # All-day event
            time_str = "All day"
            dur_str  = ""
            flag     = None

        events.append({
            "time":     time_str,
            "title":    ev.get("summary", "Busy"),
            "duration": dur_str,
            "flag":     flag,
        })

    return events


@app.get("/api/calendar")
async def get_calendar():
    """Return today's Google Calendar events, or [] if not configured."""
    try:
        events = await asyncio.to_thread(_fetch_calendar_events_sync)
        return events
    except Exception:
        return []


# ── Recommendations helpers ────────────────────────────────────────────────────

def _fallback_recommendations(recovery: dict) -> dict:
    score = recovery.get("score", 70)
    hrv   = recovery.get("hrv", 0)
    if score >= 80:
        return {
            "insight": f"Strong recovery today — a great day to push hard.",
            "recommendations": [
                {
                    "type": "workout",
                    "title": "High-intensity training window",
                    "body": f"Readiness is {score} with HRV at {hrv} ms — both above your baseline. This is a good window for progressive overload or peak-effort work.",
                    "time": None,
                    "priority": "high",
                }
            ],
        }
    elif score >= 65:
        return {
            "insight": f"Solid recovery — moderate training is the right call.",
            "recommendations": [
                {
                    "type": "workout",
                    "title": "Moderate training today",
                    "body": f"Readiness of {score} supports a controlled session. Keep RPE under 7 and make sure you hit your sleep target tonight.",
                    "time": None,
                    "priority": "medium",
                }
            ],
        }
    else:
        return {
            "insight": f"Low recovery today — protect your sleep and rest.",
            "recommendations": [
                {
                    "type": "recovery",
                    "title": "Rest day — skip hard training",
                    "body": f"Readiness is {score}, which signals your body needs recovery. Consider a short walk or light mobility work only. A 20-minute nap this afternoon could help.",
                    "time": "2:00 PM",
                    "priority": "high",
                }
            ],
        }


@app.post("/api/recommendations")
async def get_recommendations():
    """
    Reads profile, Oura data, and calendar; sends to Claude haiku;
    returns { insight: str, recommendations: [...] }.
    """
    # ── Gather context ─────────────────────────────────────────────────────────
    profile: dict = {}
    if PROFILE_FILE.exists():
        try:
            profile = json.loads(PROFILE_FILE.read_text())
        except Exception:
            pass

    health_data: dict = {}
    if OURA_FILE.exists():
        try:
            raw = json.loads(OURA_FILE.read_text())
            health_data = transform_oura(raw)
        except Exception:
            health_data = {**MOCK, "source": "mock"}
    else:
        health_data = {**MOCK, "source": "mock"}

    recovery = health_data.get("recovery", {})

    try:
        calendar_events = await asyncio.to_thread(_fetch_calendar_events_sync)
    except Exception:
        calendar_events = []

    # ── Build message ──────────────────────────────────────────────────────────
    today_str = datetime.now().strftime("%A, %B %-d")

    profile_block   = json.dumps(profile,         indent=2) if profile         else "No profile — use Oura data only."
    recovery_block  = json.dumps(recovery,         indent=2)
    calendar_block  = json.dumps(calendar_events,  indent=2) if calendar_events else "No calendar events today."

    user_msg = f"""Today is {today_str}.

USER PROFILE:
{profile_block}

TODAY'S RECOVERY (Oura):
{recovery_block}

TODAY'S CALENDAR:
{calendar_block}

Generate 2-3 specific recommendations for today plus a short insight string."""

    system = """You are a personal health AI. You know this person from their profile. \
Look at their recovery data and today's actual calendar events and generate exactly 3 recommendations.

Be specific — reference their actual calendar events by name and their actual Oura numbers. \
Pull from their profile for personal context like how they train, when they have energy, what derails them.

Rules:
- Find the best gap in their calendar for a workout based on their recovery score and their stated energy preferences
- If there is a late dinner, factor that into the sleep recommendation
- If readiness is above 80, recommend they push hard
- Always give a specific time, not vague guidance

Return ONLY valid JSON with this exact shape (no markdown, no explanation):
{
  "insight": "max 12 words summarising today",
  "recommendations": [
    {
      "type": "workout|nap|recovery|nutrition|sleep",
      "title": "max 8 words",
      "body": "2 sentences, specific, references real events",
      "time": "e.g. 10:00 AM or null",
      "priority": "high|medium|low"
    }
  ]
}"""

    try:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key or api_key == "your-anthropic-api-key-here":
            return _fallback_recommendations(recovery)

        client   = anthropic_sdk.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=700,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )

        text = response.content[0].text.strip()

        # Strip markdown code fences if Claude wraps the JSON
        if "```" in text:
            parts = text.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    text = part
                    break

        result = json.loads(text)
        # Validate shape
        if "insight" not in result or "recommendations" not in result:
            raise ValueError("Unexpected shape")
        return result

    except Exception:
        return _fallback_recommendations(recovery)
