# 🤖 Agent 1 Instructions: LifeOps Smart Pomodoro Foundation

> **Mission: Build the AI-enhanced Pomodoro core that demonstrates LifeOps' magic in 1 day**

---

## 🎯 **Your Objective**

Build the **Smart Pomodoro Foundation** - the killer feature that shows users how AI can transform their focus sessions. This is the perfect entry point that provides immediate value while establishing the technical foundation for the entire LifeOps ecosystem.

**Target: Complete Week 1's work in 1 day** (aggressive but achievable with focus)

---

## 📚 **Required Reading & Research**

### **1. Essential Documentation (READ FIRST)**
```bash
# Core architecture and vision
./claude.md                           # Original LifeOps specification
./development-flow.md                 # Your roadmap (focus on Phase 1)
./app-flow.md                        # User journey (focus on Work Session Journey)
./ui-integration-strategy.md         # How to integrate with Minimal Focus UI
```

### **2. Existing UI Foundation (STUDY THESE)**
```bash
# Your starting point - beautiful Minimal Focus UI
./src/renderer/pages/MinimalFocusLayout.tsx
./src/renderer/pages/MinimalFocusLayout.scss
./src/renderer/components/Sidebar.tsx
./src/renderer/App.tsx
```

### **3. Technical Implementation Guides**
```bash
./tech-architecture.md               # System design (focus on Database Schema)
./langgraph-implementation-guide.md  # AI brain implementation
```

### **4. Package.json & Dependencies**
```bash
./lifeops/package.json              # Existing Electron React boilerplate
```

---

## 📋 **Information to Request from User**

Ask Damon for these specific items:

### **1. API Keys & Credentials**
```bash
"I need the following API keys to get started:
- OpenAI API key for LangGraph
- Aqua SDK credentials for voice input
- Any other service credentials you want me to use"
```

### **2. Development Preferences**
```bash
"Quick questions about your dev setup:
- Should I work in the existing ./lifeops/ directory or create a new one?
- Any specific code style preferences?
- Should I use the existing Electron React Boilerplate structure?
- Do you want me to commit changes as I go or wait until complete?"
```

### **3. Feature Priorities**
```bash
"For today's sprint, should I prioritize:
- Voice input quality vs basic text input?
- AI sophistication vs speed of implementation?
- Beautiful animations vs core functionality?
- Real app monitoring vs simulated data?"
```

---

## 🚀 **1-Day Implementation Plan**

### **Hour 1-2: Setup & Foundation**
```bash
✅ Research existing codebase
✅ Set up development environment
✅ Install additional dependencies needed
✅ Test existing Minimal Focus UI
✅ Plan component modifications
```

**Key Dependencies to Add:**
```bash
npm install @langchain/langgraph @langchain/openai @langchain/core
npm install active-win sqlite3 
npm install @types/sqlite3
# Aqua SDK (get instructions from user)
```

### **Hour 3-4: Database & Monitoring**
```bash
✅ Implement SQLite database setup
✅ Create core tables (focus on pomodoro_sessions, app_usage)
✅ Set up active-win app monitoring
✅ Test app usage tracking
✅ Create basic data storage functions
```

**Database Priority Tables:**
```sql
-- Essential for Day 1
CREATE TABLE pomodoro_sessions (...);
CREATE TABLE app_usage (...);
CREATE TABLE voice_interactions (...);

-- Can add later
-- mood_entries, daily_plans, productivity_scores
```

### **Hour 5-6: Voice Integration**
```bash
✅ Integrate Aqua SDK (or fallback to Web Speech API)
✅ Create voice input component
✅ Test voice transcription
✅ Add voice button to Minimal Focus UI
✅ Handle voice state management
```

**Fallback Strategy:** If Aqua SDK is complex, use browser's Web Speech API for Day 1 prototype.

### **Hour 7-8: LangGraph Foundation**
```bash
✅ Set up basic LangGraph workflow
✅ Create Intent Analyzer node
✅ Test OpenAI integration
✅ Implement voice-to-intent processing
✅ Create simple response generation
```

**Minimal LangGraph for Day 1:**
```typescript
// Single node that processes:
// "Work on presentation slides" → "Focus session: Presentation prep (25min)"
```

### **Hour 9-10: Enhanced Pomodoro Component**
```bash
✅ Modify MinimalFocusLayout hero section
✅ Add Pomodoro timer states (setting → active → complete)
✅ Integrate voice intent capture
✅ Add real-time app monitoring display
✅ Create session completion flow
```

### **Hour 11-12: Integration & Polish**
```bash
✅ Connect all components together
✅ Test complete user flow
✅ Add basic error handling
✅ Polish UI transitions
✅ Create demo-ready experience
```

---

## 🎨 **UI Implementation Strategy**

### **Modify Existing MinimalFocusLayout**

**Current Hero Section:**
```tsx
// ./src/renderer/pages/MinimalFocusLayout.tsx
<div className="hero-content">
  <h1>Welcome to Lifeops</h1>
  <p>Your productivity companion...</p>
  <div className="primary-actions">
    <button>🚀 Start New Project</button>
    <button>🤝 Join Team</button>
  </div>
</div>
```

**Enhanced for Pomodoro:**
```tsx
// New PomodoroHero component
<div className="hero-content">
  {pomodoroState === 'idle' && <PomodoroSetup />}
  {pomodoroState === 'active' && <PomodoroActive />}
  {pomodoroState === 'complete' && <PomodoroComplete />}
</div>
```

### **Three Hero States to Implement**

#### **1. Setup State (Default)**
```tsx
<PomodoroSetup>
  <h1>🍅 Ready to Focus?</h1>
  <p>What's your intention for this session?</p>
  <VoiceIntentInput />
  <div className="primary-actions">
    <button onClick={startVoiceInput}>🎤 Voice Input</button>
    <button onClick={startSession}>🚀 Start Focus</button>
  </div>
</PomodoroSetup>
```

#### **2. Active State**
```tsx
<PomodoroActive>
  <h1>🍅 Deep Focus Mode</h1>
  <CircularTimer timeRemaining={timeLeft} />
  <p>📝 {currentIntent}</p>
  <div className="focus-stats">
    <span>📱 {currentApp}</span>
    <span>🎯 Focus: {focusPercentage}%</span>
  </div>
  <div className="session-actions">
    <button onClick={pauseSession}>⏸️ Pause</button>
    <button onClick={endSession}>⏹️ End</button>
  </div>
</PomodoroActive>
```

#### **3. Complete State**
```tsx
<PomodoroComplete>
  <h1>🎉 Session Complete!</h1>
  <div className="session-summary">
    <p>✨ {focusScore}% focus - {feedback}</p>
    <p>📊 {appBreakdown}</p>
  </div>
  <div className="reflection-actions">
    <button onClick={startVoiceReflection}>🎤 Quick Reflection</button>
    <button onClick={takeBreak}>☕ Take Break</button>
    <button onClick={startAnother}>🔄 Another Session</button>
  </div>
</PomodoroComplete>
```

---

## 💾 **Data Flow Implementation**

### **Essential Data Structures**

```typescript
// Core interfaces for Day 1
interface PomodoroSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  intent: string;
  duration: number; // planned minutes
  actualDuration?: number;
  focusScore?: number;
  appUsage: AppUsageEntry[];
  status: 'active' | 'paused' | 'completed' | 'abandoned';
}

interface AppUsageEntry {
  appName: string;
  windowTitle: string;
  timestamp: Date;
  duration: number; // seconds
  category?: 'productive' | 'neutral' | 'distraction';
}

interface VoiceIntent {
  transcription: string;
  processedIntent: string;
  confidence: number;
  suggestedDuration: number;
}
```

### **Core Functions to Implement**

```typescript
// Essential functions for Day 1
async function captureVoiceIntent(): Promise<VoiceIntent>
async function startPomodoroSession(intent: string): Promise<PomodoroSession>
async function monitorAppUsage(): Promise<AppUsageEntry[]>
async function calculateFocusScore(session: PomodoroSession): Promise<number>
async function generateSessionSummary(session: PomodoroSession): Promise<string>
```

---

## 🧪 **Testing Strategy**

### **Manual Tests for Demo**

```bash
✅ Voice Input Test:
   - Click voice button
   - Say: "I want to work on presentation slides"
   - Verify: Intent captured and processed

✅ Pomodoro Flow Test:
   - Start session with intent
   - Switch between apps (PowerPoint, email, Slack)
   - Verify: Real-time app tracking works
   - Complete session
   - Verify: Focus score and summary generated

✅ UI State Test:
   - Navigate through all three hero states
   - Verify: Smooth transitions and beautiful design
   - Test: All buttons work correctly
```

### **Data Validation Tests**

```bash
✅ Database Test:
   - Create pomodoro session
   - Verify: Data stored correctly
   - Retrieve session
   - Verify: Data integrity

✅ App Monitoring Test:
   - Open different applications
   - Verify: active-win captures correctly
   - Check: App categorization logic
```

---

## ⚠️ **Potential Challenges & Solutions**

### **1. Aqua SDK Complexity**
**Problem:** Aqua SDK might be complex to integrate quickly  
**Solution:** Use Web Speech API as fallback for Day 1 prototype  
```typescript
// Fallback implementation
const recognition = new webkitSpeechRecognition();
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  processVoiceIntent(transcript);
};
```

### **2. LangGraph Setup Time**
**Problem:** Full LangGraph might be overkill for Day 1  
**Solution:** Use simple OpenAI API call with structured prompt  
```typescript
// Simplified for Day 1
async function processIntent(voice: string): Promise<string> {
  const prompt = `Convert this voice input to a focus intention: "${voice}"`;
  const response = await openai.completions.create({...});
  return response.choices[0].text;
}
```

### **3. App Monitoring Permissions**
**Problem:** macOS might require accessibility permissions  
**Solution:** Graceful fallback with user guidance  
```typescript
// Fallback to manual app input if permissions denied
if (!hasAccessibilityPermission()) {
  showManualAppInput();
}
```

---

## 🎯 **Success Criteria for End of Day**

### **Must Have (Demo Ready)**
- [ ] Beautiful Pomodoro interface in Minimal Focus layout
- [ ] Voice intent capture (Web Speech API minimum)
- [ ] Real-time app monitoring during sessions
- [ ] Session completion with basic AI insights
- [ ] Smooth UI state transitions

### **Nice to Have (If Time Allows)**
- [ ] Full Aqua SDK integration
- [ ] Advanced LangGraph workflow
- [ ] Sophisticated focus scoring
- [ ] Voice reflection capture
- [ ] Persistent data storage

### **Demo Flow**
```bash
1. Open LifeOps → See beautiful Minimal Focus interface
2. Click "🎤 Voice Input" → Say "Work on presentation slides"
3. AI processes → Shows "Focus session: Presentation prep (25min)"
4. Start session → Beautiful timer with real-time app tracking
5. Switch apps → See focus percentage change in real-time
6. Complete session → Get AI insights: "94% focus, excellent work!"
```

---

## 📞 **Communication Protocol**

### **Check-ins with Damon**
- **Hour 4:** Database and monitoring setup complete
- **Hour 8:** LangGraph and voice integration working
- **Hour 12:** Full demo ready

### **Blocker Protocol**
If you hit a major blocker:
1. **Document the issue clearly**
2. **Propose 2-3 alternative approaches**
3. **Estimate time impact**
4. **Ask for guidance immediately**

### **Deliverable Format**
At end of day, provide:
```bash
✅ Working demo (screen recording)
✅ Code committed to repository
✅ Brief technical summary
✅ Next day's recommended priorities
```

---

## 🚀 **Final Notes**

- **Focus on the experience** - make it feel magical even if the AI is simple
- **Prioritize working demo** over perfect code
- **Use existing UI components** - don't rebuild what's already beautiful
- **Document assumptions** - if you make decisions, note them for future agents
- **Make it impressive** - this demo will show the potential of LifeOps

**Remember:** You're building the foundation that will make users fall in love with LifeOps. Make every interaction feel intelligent and delightful.

**Let's build something amazing! 🚀**