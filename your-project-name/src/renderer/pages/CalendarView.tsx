import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import './CalendarView.scss';

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: string[];
  status: 'confirmed' | 'tentative' | 'cancelled';
  type?: 'birthday' | 'event';
}

export default function CalendarView() {
  const [todaysEvents, setTodaysEvents] = useState<CalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBirthdays, setShowBirthdays] = useState(false);
  const [birthdayStats, setBirthdayStats] = useState<{ today: number; thisWeek: number } | null>(null);

  const goBack = () => {
    window.location.reload();
  };

  const handleSidebarNavigation = (item: string) => {
    if ((window as any).navigateToView) {
      (window as any).navigateToView(item);
    }
  };

  useEffect(() => {
    loadBirthdayStats();
  }, []);

  useEffect(() => {
    loadCalendarData();
  }, [showBirthdays]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      
      // Load today's events
      const todaysResult = await window.electron.ipcRenderer.invoke('calendar-get-todays-events');
      if (todaysResult.error) {
        throw new Error(todaysResult.error);
      }
      
      // Load upcoming events (next 3 days)
      const upcomingResult = await window.electron.ipcRenderer.invoke('calendar-get-upcoming-events', 72);
      if (upcomingResult.error) {
        throw new Error(upcomingResult.error);
      }

      // Parse dates from strings
      const parseEvents = (events: any[]) => events.map(event => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      }));

      let todaysCalendarEvents = parseEvents(todaysResult.events || []);
      let upcomingCalendarEvents = parseEvents(upcomingResult.events || []);

      // Filter out birthday events from Google Calendar if toggle is off
      if (!showBirthdays) {
        todaysCalendarEvents = todaysCalendarEvents.filter(event => {
          const isBirthday = event.type === 'birthday' || 
                            (event.summary && (
                              event.summary.includes('🎂') ||
                              event.summary.toLowerCase().includes('birthday') ||
                              event.summary.toLowerCase().includes('bday')
                            ));
          return !isBirthday;
        });
        upcomingCalendarEvents = upcomingCalendarEvents.filter(event => {
          const isBirthday = event.type === 'birthday' || 
                            (event.summary && (
                              event.summary.includes('🎂') ||
                              event.summary.toLowerCase().includes('birthday') ||
                              event.summary.toLowerCase().includes('bday')
                            ));
          return !isBirthday;
        });
      }

      // Only load additional birthdays from birthday API if toggle is enabled
      if (showBirthdays) {
        try {
          const birthdaysTodayResult = await window.electron.ipcRenderer.invoke('birthdays-get-today');
          const birthdaysUpcomingResult = await window.electron.ipcRenderer.invoke('birthdays-get-upcoming', 30);
          
          if (birthdaysTodayResult.events) {
            todaysCalendarEvents = [...todaysCalendarEvents, ...parseEvents(birthdaysTodayResult.events)];
          }
          
          if (birthdaysUpcomingResult.events) {
            upcomingCalendarEvents = [...upcomingCalendarEvents, ...parseEvents(birthdaysUpcomingResult.events)];
          }
        } catch (birthdayErr) {
          console.log('Could not load birthdays:', birthdayErr);
        }
      }

      setTodaysEvents(todaysCalendarEvents);
      setUpcomingEvents(upcomingCalendarEvents);
      setError(null);
    } catch (err) {
      console.error('Error loading calendar data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const loadBirthdayStats = async () => {
    try {
      const statsResult = await window.electron.ipcRenderer.invoke('birthdays-get-stats');
      if (statsResult && !statsResult.error) {
        setBirthdayStats({
          today: statsResult.today || 0,
          thisWeek: statsResult.thisWeek || 0
        });
      }
    } catch (err) {
      console.log('Could not load birthday stats:', err);
    }
  };

  const toggleBirthdays = () => {
    setShowBirthdays(prev => !prev);
    // Reload calendar data with new birthday state
    setTimeout(() => {
      loadCalendarData();
    }, 100);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const isAllDayEvent = (start: Date, end: Date) => {
    return start.getHours() === 0 && start.getMinutes() === 0 && 
           end.getHours() === 0 && end.getMinutes() === 0;
  };

  const getEventTypeIcon = (event: CalendarEvent) => {
    if (event.type === 'birthday' || (event.summary && event.summary.includes('🎂'))) return '🎂';
    if (event.attendees && event.attendees.length > 1) return '👥';
    if (event.location) return '📍';
    return '📅';
  };

  const EventCard = ({ event, showDate = false }: { event: CalendarEvent; showDate?: boolean }) => {
    const isBirthday = event.type === 'birthday' || (event.summary && event.summary.includes('🎂'));
    
    return (
      <div className={`event-card ${event.status} ${isBirthday ? 'birthday' : ''}`}>
      <div className="event-header">
        <div className="event-icon">{getEventTypeIcon(event)}</div>
        <div className="event-title">
          <h3>{event.summary}</h3>
          {showDate && (
            <span className="event-date">{formatDate(event.start)}</span>
          )}
        </div>
        <div className="event-time">
          {isAllDayEvent(event.start, event.end) ? (
            <span className="all-day">All Day</span>
          ) : (
            <span>{formatTime(event.start)} - {formatTime(event.end)}</span>
          )}
        </div>
      </div>
      
      {event.description && (
        <p className="event-description">{event.description}</p>
      )}
      
      {event.location && (
        <div className="event-location">
          <span className="location-icon">📍</span>
          {event.location}
        </div>
      )}
      
      {event.attendees && event.attendees.length > 0 && (
        <div className="event-attendees">
          <span className="attendees-icon">👥</span>
          {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="calendar-layout">
      <Sidebar activeItem="calendar" onItemClick={handleSidebarNavigation} />
      
      <div className="main-content">
        <div className="page-header">
          <div className="header-content">
            <h1>📅 LifeOps Calendar</h1>
            <p>Your smart schedule overview</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={loadCalendarData} disabled={loading}>
              🔄 Refresh Calendar
            </button>
            <button 
              className={`btn ${showBirthdays ? 'btn-primary' : 'btn-secondary'}`}
              onClick={toggleBirthdays}
            >
              {showBirthdays ? '🎂 Hide Birthdays' : (
                birthdayStats?.today ? `🎂 Show Birthdays (${birthdayStats.today} today)` :
                birthdayStats?.thisWeek ? `🎂 Show Birthdays (${birthdayStats.thisWeek} this week)` :
                '🎂 Show Birthdays'
              )}
            </button>
          </div>
        </div>

        <div className="quick-actions">
          <button className="action-btn email">📧 Email Analysis</button>
          <button className="action-btn dashboard">📊 Dashboard</button>
          <button className="action-btn calendar active">📅 Calendar</button>
        </div>

        <div className="content-body">
          {error && (
            <div className="error-message">
              <p>❌ {error}</p>
              <button onClick={loadCalendarData} className="btn-retry">
                Try Again
              </button>
            </div>
          )}

          {!error && !loading && (
            <>
              <div className="calendar-section">
                <h2>Today's Schedule</h2>
                
                {todaysEvents.length === 0 ? (
                  <div className="empty-state">
                    <p>🌟 No events scheduled for today. Great time for deep work!</p>
                  </div>
                ) : (
                  <div className="events-list">
                    {todaysEvents.map(event => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </div>

              <div className="calendar-section">
                <h2>Upcoming Events (Next 3 Days)</h2>
                
                {upcomingEvents.filter(event => !todaysEvents.find(te => te.id === event.id)).length === 0 ? (
                  <div className="empty-state">
                    <p>📅 No upcoming events in the next 3 days.</p>
                  </div>
                ) : (
                  <div className="events-list">
                    {upcomingEvents
                      .filter(event => !todaysEvents.find(te => te.id === event.id))
                      .map(event => (
                        <EventCard key={event.id} event={event} showDate={true} />
                      ))}
                  </div>
                )}
              </div>
            </>
          )}

          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading your calendar...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}