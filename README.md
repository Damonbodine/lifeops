# 🧐 LifeOps — Your Personal Operating System

**An AI-powered productivity system that understands your work, life, mood, and goals — then builds your most optimal day.**

---

## 🌟 Overview

LifeOps is your all-in-one command center — a self-optimizing daily assistant that listens to how you feel, watches how you spend your time, learns what matters to you, and helps you balance deep work, meaningful relationships, health, and self-care.

It combines app usage tracking, AI scheduling, voice input, mood analysis, and proactive life suggestions — built for people who want to live with focus, integrity, and intention.

---

## 🔧 Core Features

### 🤖 AI-Powered Productivity Orchestrator
- **Smart Schedule Builder**: LangChain-powered daily planning based on energy, mood, and calendar
- **Multi-Agent System**: Specialized agents for data collection, schedule analysis, and execution
- **Dynamic Task Management**: Intelligent 1-3-5 task prioritization and scheduling
- **Real-time Adaptability**: Adjusts plans based on current context and performance

### 📊 Health & Wellness Integration
- **Apple Health Analytics**: Comprehensive analysis of 2+ years of health data
- **Activity Tracking**: Exercise patterns, heart rate variability, and sleep analysis
- **Trend Analysis**: AI-powered insights into health patterns and correlations
- **Actionable Recommendations**: Specific, measurable health improvement suggestions

### 📧 Email Intelligence
- **Gmail Integration**: Secure OAuth2 connection with comprehensive email analysis
- **Relationship Mapping**: AI-powered analysis of email patterns and communication frequency
- **Smart Summarization**: Intelligent email summaries and action item extraction
- **Connection Tracking**: Relationship health monitoring and check-in suggestions

### 🌟 Social Planning & Relationship Management
- **Social Planner Agent**: Multi-LLM agent for comprehensive social planning
- **Birthday Integration**: Automatic birthday tracking and smart message suggestions
- **Contact Analysis**: Relationship strength assessment and communication optimization
- **Check-in Automation**: Proactive relationship maintenance suggestions

### 🍅 Focus & Productivity Tools
- **Smart Pomodoro**: Adaptive focus sessions with intent logging
- **Task Queue Management**: Intelligent task classification and scheduling
- **Productivity Scoring**: AI-powered daily performance evaluation
- **Notification Management**: Smart alerts and reminders

---

## 🏗️ Architecture

### Tech Stack
- **Backend**: Node.js/Express with SQLite database
- **Frontend**: HTML5/CSS3/JavaScript with modular component architecture
- **AI Integration**: LangChain with OpenAI, Anthropic, and Google AI models
- **APIs**: Gmail API, Google Calendar API, Apple Health export processing
- **Security**: OAuth2 authentication with secure token management

### Key Components

#### `/lifeops/` - Main Application
- `app.js` - Express server and API routes
- `services/` - Modular service architecture
- `public/` - Web interface and dashboard
- `routes/` - API endpoint definitions

#### Services Architecture
- **ProductivityOrchestrator**: Main AI coordinator for productivity workflow
- **SocialPlannerAgent**: Multi-LLM social planning system
- **HealthAnalytics**: Comprehensive health data analysis
- **EmailService**: Gmail integration and email management
- **BirthdayService**: Birthday tracking and message generation

#### Web Interface
- **Dashboard**: Real-time productivity metrics and schedule overview
- **Health Analytics**: Interactive health data visualization
- **Social Planner**: Relationship management and social planning
- **Calendar Integration**: Schedule visualization and editing

---

## 🚀 Getting Started

### Prerequisites
- macOS Ventura+ (for Apple Health integration)
- Node.js 18+ and npm
- Gmail/Google Calendar API credentials
- OpenAI API key
- Optional: Anthropic API key for enhanced AI capabilities

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/lifeops.git
   cd lifeops
   ```

2. **Install dependencies**
   ```bash
   cd lifeops
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and credentials
   ```

4. **Google API Setup**
   - Create a Google Cloud project
   - Enable Gmail and Calendar APIs
   - Create OAuth2 credentials
   - Add credentials to `.env`

5. **Apple Health Export** (Optional)
   - Export Health data from iPhone
   - Place `export.xml` in `apple_health_export/` directory

### Running the Application

```bash
# Start the server
npm run server

# Open in browser
open http://localhost:3000
```

---

## 💡 Key Features in Detail

### 🧠 AI-Powered Schedule Building
The ProductivityOrchestrator uses multiple AI agents to create optimal daily schedules:
- **Interview Agent**: Gathers user preferences and goals
- **Data Collection Agent**: Analyzes email, calendar, and health data
- **Schedule Analysis Agent**: Evaluates current patterns and productivity
- **Schedule Builder Agent**: Creates optimized daily plans

### 📈 Health Analytics
Comprehensive analysis of Apple Health data including:
- Sleep patterns and quality metrics
- Exercise frequency and intensity
- Heart rate variability and recovery
- Activity trends and correlations
- Personalized health recommendations

### 🤝 Relationship Intelligence
Advanced relationship management features:
- Email communication pattern analysis
- Relationship strength assessment
- Birthday and important date tracking
- Smart check-in suggestions
- Social planning optimization

### 🎯 Smart Task Management
Intelligent task prioritization and scheduling:
- 1-3-5 task framework (1 big, 3 medium, 5 small)
- Context-aware task scheduling
- Energy-based task assignment
- Progress tracking and optimization

---

## 🔧 Configuration

### Environment Variables
```env
# API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key

# Gmail/Calendar
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret

# Optional Services
SLACK_TOKEN=your_slack_token
```

### Health Data Setup
1. Export Apple Health data from iPhone
2. Place `export.xml` in `lifeops/apple_health_export/`
3. Application will automatically parse and analyze data

---

## 🛠️ Development

### Project Structure
```
lifeops/
├── app.js                 # Main server application
├── package.json           # Dependencies and scripts
├── services/              # Core service modules
│   ├── productivityOrchestrator.js
│   ├── socialPlannerAgent.js
│   ├── healthAnalytics.js
│   └── emailService.js
├── public/                # Web interface
│   ├── dashboard.html
│   ├── health.html
│   └── assets/
├── routes/                # API endpoints
└── apple_health_export/   # Health data directory
```

### Adding New Features
1. Create service module in `services/`
2. Add API routes in `routes/`
3. Update web interface in `public/`
4. Test integration with existing agents

---

## 📊 Performance & Optimization

### Memory Management
- Health data caching (10-minute cache duration)
- Concurrent loading prevention
- Efficient data parsing and aggregation

### AI Model Optimization
- Multi-LLM support for different use cases
- Temperature and model selection per agent
- Conversation history management
- Memory-efficient prompt engineering

---

## 🔐 Security & Privacy

### Data Protection
- Local-first architecture for sensitive data
- Secure OAuth2 token management
- Encrypted credential storage
- No unnecessary data transmission

### Privacy Features
- Apple Health data processed locally
- Email analysis happens on-device
- Optional cloud AI processing with explicit consent
- Comprehensive data retention policies

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new functionality
5. Submit a pull request

### Development Guidelines
- Follow existing code patterns
- Add comprehensive error handling
- Include documentation for new features
- Test with real data scenarios

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🙏 Acknowledgments

- LangChain team for the excellent AI framework
- OpenAI, Anthropic, and Google for AI model access
- Apple for comprehensive health data export
- Google for Gmail and Calendar API access

---

## 📧 Support

For questions, issues, or feature requests:
- Open an issue on GitHub
- Check the documentation in `CLAUDE.md`
- Review implementation logs in the `lifeops/` directory

---

*Built with ❤️ for people who want to optimize their lives with AI while maintaining privacy and control over their data.*