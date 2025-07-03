# 🧐 LifeOps — Your Personal Operating System

**An AI-powered macOS desktop app that understands your work, life, mood, and goals — then builds your most optimal day.**

---

## 🌟 Vision

LifeOps is your all-in-one command center — a self-optimizing daily assistant that listens to how you feel, watches how you spend your time, learns what matters to you, and helps you balance deep work, meaningful relationships, health, and self-care.

It combines app usage tracking, AI scheduling, voice input, mood analysis, and proactive life suggestions — built for people who want to live with focus, integrity, and intention.

---

## 🔧 Core Features

### 1. **Context Collector**

* Tracks:

  * 
  * Browser activity (via AppleScript)
  * Gmail, Health, and Google Calendar
  * iMessages (from local `chat.db`)
  * Aqua voice input
* Classifies behavior: Deep Work, Admin, Distraction, Social, Errands

### 2. **Pomodoro Engine with Intent Logging**

* Customizable timers (25/5, 90/15, etc.)
* Prompts user: “What’s your intent for this block?”
* Logs results: completed, abandoned, disrupted

### 3. **Live Usage Dashboard**

* Real-time display of:

  * Active app + tab
  * Time per category
  * Current Pomodoro cycle
  * Task progress

### 4. **AI Daily Planner (LangGraph)**

* Builds daily schedule based on:

  * Energy/mood
  * Calendar events
  * 1–3–5 tasks
  * Personal commitments
* Automatically syncs with Google Calendar

### 5. **AI Productivity Score + Daily Feedback**

* Grades your previous day (0–100)
* Provides coaching-style feedback
* Suggests small improvements

### 6. **1–3–5 AI Task Queue**

* Aggregates tasks from:

  * Gmail
  * Slack
  * iMessages
  * Voice logs
  * Manual input
* Classifies into:

  * 1 Big
  * 3 Medium
  * 5 Small
* Inserts into schedule intelligently

### 7. **Voice Input (via Aqua SDK)**

* Record goals, schedule changes, or reflections
* Transcription → LangGraph interprets
* Supports:

  * Task creation
  * Mood detection
  * Daily planning
  * Journaling

### 8. **iMessage Integration**

* Secure, local-only reading of `~/Library/Messages/chat.db`
* Pulls last 24 hours of conversations
* Detects:

  * Unreplied messages
  * Task-related language
  * Relationship check-ins

---

## 🌱 Enhanced Features (Holistic LifeOps)

### 9. **Ghost Mode (Shadow Schedule Learning)**

* Tracks your real day silently
* Compares it to what LifeOps *would have suggested*
* Shows “Gap Report” with alignment score

### 10. **Weekly Executive Summary**

* Aggregates:

  * App usage
  * Mood
  * Tasks
  * Focus score
  * Voice logs
* LangGraph generates:

  * 3 Wins
  * 3 Missed Opportunities
  * One high-leverage suggestion for the week

### 11. **Mood-Aware Scheduling**

* Manual mood logging or voice-sentiment detection
* LangGraph adjusts task intensity and break frequency

### 12. **Connection Tracker**

* Logs key relationships and recent check-ins
* Nudges reconnection:

  > “You haven’t messaged John in 10 days.”

### 13. **"Live My Values" Tracker**

* User selects top values (e.g., Growth, Discipline, Love)
* Reflects each night: “Did I live my values today?”
* LangGraph logs and graphs alignment over time

### 14. **Errand & Admin Optimizer**

* User can log chores, appointments, shopping, etc.
* LifeOps suggests when to batch and schedule
* Auto-fits errands around work & energy

### 15. **Creative Recovery Detection**

* Tracks whether you’ve engaged in creative flow (writing, music, art)
* If absent for 5+ days → prompts user to schedule time

  > “You haven’t made anything expressive lately. Want to sketch or write?”

---

## 🧠 LangGraph Brain Design

### Core Nodes:

1. **Mood Interpreter** – analyzes mood from voice/text
2. **Task Classifier** – builds 1–3–5 list from sources
3. **Schedule Builder** – plans ideal day
4. **Voice Intent Handler** – parses Aqua voice input
5. **Productivity Evaluator** – generates daily score
6. **Ghost Mode Comparator** – compares plan vs reality
7. **Weekly Summary Agent** – writes end-of-week report
8. **Schedule Modifier** – updates schedule during day

---

## 🔗 Tech Stack

| Area           | Tool                        |
| -------------- | --------------------------- |
| App Framework  | Electron + React            |
| AI Brain       | LangGraph + OpenAI          |
| Voice Input    | Aqua SDK                    |
| Automations    | n8n (hosted or local)       |
| Messaging      | SQLite access to `chat.db`  |
| Usage Tracking | `active-win`, AppleScript   |
| Data Storage   | Supabase or SQLite          |
| Calendar/Email | Google Calendar + Gmail API |
| UI Charts      | Recharts or Chart.js        |
| Notifications  | node-notifier, AppleScript  |

---

## 💻 Mac Setup Requirements

1. **macOS Ventura+**
2. **Node.js + npm** (`brew install node`)
3. **Electron & React App Scaffolding**
4. **Full Disk Access** for app/terminal (System Settings → Privacy)
5. **Xcode Command Line Tools** (`xcode-select --install`)
6. **Google OAuth Project** (for Gmail & Calendar)
7. **Slack + Gmail API credentials (optional)**
8. **Aqua SDK** installed and authenticated

---

## 🚀 Development Flow

### 🔵 Day 1 – Foundation

* Set up Electron + React
* Log app usage with `active-win`
* AppleScript for browser tab titles
* Set up SQLite or Supabase
* Aqua voice test
* LangGraph: Mood & Task node setup

### 🔵 Day 2 – Core Flows

* Implement Pomodoro + Intent logger
* Build dashboard (apps, time, Pomodoro)
* Read iMessages from `chat.db`
* Set up Gmail/Calendar/Slack via n8n
* Voice → LangGraph → Schedule/Tasks
* Daily score + schedule generation

### 🔵 Day 3 – Enhanced Features

* Ghost mode comparison
* 1–3–5 task planning engine
* Weekly summary agent
* Mood-aware planner
* Connection tracking & journaling
* Polish UI + UX

### 🔵 Day 4 – Final Polish + Submission

* Test all LangGraph + n8n flows
* Record 5-minute demo
* GitHub repo: full code + README
* BrainLift doc explaining LangGraph setup
* Finalize LinkedIn or Twitter post

---

## 📦 Final Deliverables

| Item            | Description                     |
| --------------- | ------------------------------- |
| ✅ GitHub Repo   | Code, setup, docs               |
| ✅ Video Demo    | Walkthrough of full workflow    |
| ✅ Working App   | .dmg or .pkg for Mac            |
| ✅ BrainLift Doc | System architecture + AI flow   |
| ✅ Social Post   | Share process, insights, vision |
