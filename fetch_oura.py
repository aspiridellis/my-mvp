#!/usr/bin/env python3
"""
Fetch today's Oura v2 data and save to backend/data/oura_latest.json
Usage: python3 fetch_oura.py

Sleep and activity are published under the previous day's date, so we
always query a 2-day window (yesterday → today) and pick the most recent record.
"""

import json
import urllib.request
import urllib.error
from datetime import date, timedelta, datetime
from pathlib import Path

TOKEN     = "VLYE7WMMYRPAO7ZXODYDS6P56OPYO656"
TODAY     = date.today().isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()
OUT_FILE  = Path(__file__).parent / "backend" / "data" / "oura_latest.json"

ENDPOINTS = {
    "readiness":   f"https://api.ouraring.com/v2/usercollection/daily_readiness?start_date={TODAY}&end_date={TODAY}",
    "sleep":       f"https://api.ouraring.com/v2/usercollection/sleep?start_date={YESTERDAY}&end_date={TODAY}",
    "daily_sleep": f"https://api.ouraring.com/v2/usercollection/daily_sleep?start_date={YESTERDAY}&end_date={TODAY}",
    "activity":    f"https://api.ouraring.com/v2/usercollection/daily_activity?start_date={YESTERDAY}&end_date={TODAY}",
}


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def latest(collection: dict) -> dict:
    """Return the most recent item in an Oura collection response, or {}."""
    items = collection.get("data", [])
    if not items:
        return {}
    # Sort by day/date field descending, take first
    return sorted(items, key=lambda x: x.get("day", x.get("timestamp", "")), reverse=True)[0]


def secs_to_str(s):
    if not isinstance(s, (int, float)) or s <= 0:
        return None
    h = int(s) // 3600
    m = (int(s) % 3600) // 60
    return f"{h}h {m:02d}m"


def main():
    print(f"Fetching Oura data (readiness: {TODAY}, sleep/activity: {YESTERDAY}–{TODAY})…")

    raw = {}
    for key, url in ENDPOINTS.items():
        try:
            raw[key] = fetch(url)
            count = len(raw[key].get("data", []))
            print(f"  ✓ {key}: {count} record(s)")
        except urllib.error.HTTPError as e:
            print(f"  ✗ {key}: HTTP {e.code} — {e.reason}")
            raw[key] = {}
        except Exception as e:
            print(f"  ✗ {key}: {e}")
            raw[key] = {}

    readiness   = latest(raw.get("readiness", {}))
    sleep       = latest(raw.get("sleep", {}))
    daily_sleep = latest(raw.get("daily_sleep", {}))
    activity    = latest(raw.get("activity", {}))

    # ── Flatten into a single dict the backend's transform_oura() understands ──
    output = {
        "fetched_at": datetime.now().isoformat(),
        "date":       TODAY,

        # Readiness (today)
        "readiness":               readiness,
        "score":                   readiness.get("score"),
        "recovery_score":          readiness.get("score"),
        "temp_delta":              readiness.get("temperature_deviation"),
        "body_temperature_delta":  readiness.get("temperature_deviation"),
        "temperature_deviation":   readiness.get("temperature_deviation"),

        # Sleep session (last night — paths match transform_oura fallbacks)
        "sleep":                   sleep,
        "hrv":                     sleep.get("average_hrv"),
        "average_hrv":             sleep.get("average_hrv"),
        "resting_hr":              sleep.get("lowest_heart_rate"),
        "resting_heart_rate":      sleep.get("lowest_heart_rate"),
        "lowest_heart_rate":       sleep.get("lowest_heart_rate"),
        "efficiency":              sleep.get("efficiency"),
        "sleep_efficiency":        sleep.get("efficiency"),
        "total_sleep_duration":    sleep.get("total_sleep_duration"),
        "deep_sleep_duration":     sleep.get("deep_sleep_duration"),
        "rem_sleep_duration":      sleep.get("rem_sleep_duration"),

        # Sleep score (daily_sleep endpoint)
        "daily_sleep":             daily_sleep,
        "sleep_score":             daily_sleep.get("score"),

        # Activity
        "activity":                activity,
        "steps":                   activity.get("steps"),
        "active_calories":         activity.get("active_calories"),
        "activity_score":          activity.get("score"),

        # Raw blobs for future use
        "_raw": {
            "readiness":   raw.get("readiness", {}),
            "sleep":       raw.get("sleep", {}),
            "daily_sleep": raw.get("daily_sleep", {}),
            "activity":    raw.get("activity", {}),
        },
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(output, indent=2))
    print(f"\nSaved → {OUT_FILE}")

    # ── Print key numbers ──────────────────────────────────────────────────────
    print("\n── Today's snapshot ─────────────────────────────")
    print(f"  Readiness score  : {output.get('score') or 'n/a'}")
    print(f"  Sleep score      : {output.get('sleep_score') or 'n/a'}")
    print(f"  Activity score   : {output.get('activity_score') or 'n/a'}")
    print(f"  HRV              : {output.get('average_hrv') or 'n/a'} ms")
    print(f"  Resting HR       : {output.get('resting_hr') or 'n/a'} bpm")
    print(f"  Sleep efficiency : {output.get('efficiency') or 'n/a'}%")
    total_s = output.get("total_sleep_duration")
    if total_s:
        print(f"  Total sleep      : {secs_to_str(total_s)}")
    deep_s = output.get("deep_sleep_duration")
    if deep_s:
        print(f"  Deep sleep       : {secs_to_str(deep_s)}")
    rem_s = output.get("rem_sleep_duration")
    if rem_s:
        print(f"  REM sleep        : {secs_to_str(rem_s)}")
    temp = output.get("temp_delta")
    if temp is not None:
        print(f"  Temp deviation   : {temp:+.2f}°C")
    steps = output.get("steps")
    if steps:
        print(f"  Steps (yesterday): {steps:,}")
    print("─────────────────────────────────────────────────")


if __name__ == "__main__":
    main()
