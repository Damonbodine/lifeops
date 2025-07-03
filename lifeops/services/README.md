# Services Directory

This directory contains the core service modules for LifeOps functionality:

## Service Architecture

### Core Services
- `emailService.js` - Gmail API integration and email management
- `emailSummarizer.js` - AI-powered email analysis and summarization  
- `tokenManager.js` - Secure OAuth2 token storage and refresh

### Future Services (Roadmap)
- `calendarService.js` - Google Calendar integration
- `aiService.js` - LangChain and advanced AI features
- `voiceService.js` - Aqua SDK voice integration
- `analyticsService.js` - Data analysis and insights
- `automationService.js` - Workflow automation
- `notificationService.js` - Smart alerts and reminders

## Design Principles
- **Modular**: Each service is self-contained
- **Testable**: Each service can be tested independently
- **Extensible**: Easy to add new services
- **Robust**: Comprehensive error handling and retry logic
- **Secure**: Proper token management and data protection