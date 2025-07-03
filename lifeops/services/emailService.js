const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Robust EmailService class adapted from main LifeOps project
 * Handles Gmail API integration with proper token management and error handling
 */
class EmailService {
  constructor() {
    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob' // Desktop app redirect
    );

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    this.isAuthenticated = false;

    // Gmail API scopes
    this.SCOPES = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    // Load stored tokens on initialization
    this.loadStoredTokens();
  }

  /**
   * Generate authorization URL for OAuth2 flow
   */
  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.SCOPES,
      prompt: 'consent'
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async authenticate(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      await this.storeTokens(tokens);
      this.isAuthenticated = true;
      console.log('✅ Gmail authentication successful!');
      return true;
    } catch (error) {
      console.error('❌ Authentication error:', error);
      return false;
    }
  }

  /**
   * Check if service is authenticated
   */
  isAuth() {
    return this.isAuthenticated && !!this.oauth2Client.credentials.access_token;
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded() {
    try {
      if (!this.oauth2Client.credentials.refresh_token) {
        console.log('No refresh token available');
        return false;
      }

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      await this.storeTokens(credentials);
      console.log('✅ Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * Get user profile information
   */
  async getProfile() {
    try {
      const response = await this.gmail.users.getProfile({ userId: 'me' });
      return response.data;
    } catch (error) {
      console.error('Error getting profile:', error);
      await this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Fetch emails from inbox with advanced options
   */
  async getEmails(options = {}) {
    try {
      const {
        maxResults = 10,
        pageToken,
        query = 'in:inbox',
        labelIds
      } = options;

      console.log(`📧 Fetching emails with query: ${query}`);

      // Get message list
      const listResponse = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        pageToken,
        q: query,
        labelIds
      });

      const messages = [];
      
      if (listResponse.data.messages) {
        console.log(`📧 Found ${listResponse.data.messages.length} messages`);
        
        // Fetch full message details in parallel (but limit concurrency)
        const messagePromises = listResponse.data.messages.map(async (msg) => {
          try {
            const fullMessage = await this.gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'full'
            });
            
            return this.parseEmailMessage(fullMessage.data);
          } catch (error) {
            console.error(`Error fetching message ${msg.id}:`, error);
            return null;
          }
        });

        const fetchedMessages = await Promise.all(messagePromises);
        messages.push(...fetchedMessages.filter(msg => msg !== null));
      }

      return {
        messages,
        nextPageToken: listResponse.data.nextPageToken
      };
    } catch (error) {
      console.error('❌ Error fetching emails:', error);
      await this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Get unread emails
   */
  async getUnreadEmails(maxResults = 10) {
    const result = await this.getEmails({
      maxResults,
      query: 'in:inbox is:unread'
    });
    return result.messages;
  }

  /**
   * Get recent emails (last 24 hours)
   */
  async getRecentEmails(maxResults = 10) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const formattedDate = yesterday.toISOString().split('T')[0].replace(/-/g, '/');
    
    const result = await this.getEmails({
      maxResults,
      query: `in:inbox after:${formattedDate}`
    });
    return result.messages;
  }

  /**
   * Mark email as read
   */
  async markAsRead(messageId) {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });
      return true;
    } catch (error) {
      console.error('Error marking email as read:', error);
      await this.handleApiError(error);
      return false;
    }
  }

  /**
   * Parse Gmail API message into standardized format
   */
  parseEmailMessage(apiMessage) {
    const headers = apiMessage.payload.headers;
    const getHeader = (name) => headers.find(h => h.name === name)?.value || '';

    // Extract email body (handle multipart emails)
    let body = '';
    let htmlBody = '';
    
    if (apiMessage.payload.body.data) {
      body = Buffer.from(apiMessage.payload.body.data, 'base64').toString();
    } else if (apiMessage.payload.parts) {
      for (const part of apiMessage.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          body = Buffer.from(part.body.data, 'base64').toString();
        } else if (part.mimeType === 'text/html' && part.body.data) {
          htmlBody = Buffer.from(part.body.data, 'base64').toString();
        }
      }
    }

    return {
      id: apiMessage.id,
      threadId: apiMessage.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: new Date(getHeader('Date')),
      body: body.trim(),
      htmlBody: htmlBody.trim() || undefined,
      labels: apiMessage.labelIds || [],
      isRead: !apiMessage.labelIds.includes('UNREAD'),
      hasAttachments: !!apiMessage.payload.parts?.some(part => part.filename)
    };
  }

  /**
   * Handle API errors and token refresh
   */
  async handleApiError(error) {
    if (error.code === 401) {
      console.log('🔄 Token expired, attempting refresh...');
      const refreshed = await this.refreshTokenIfNeeded();
      if (!refreshed) {
        this.isAuthenticated = false;
        console.log('❌ Token refresh failed, re-authentication required');
      }
    }
  }

  /**
   * Store OAuth tokens securely in user data directory
   */
  async storeTokens(tokens) {
    try {
      const tokenPath = path.join(os.homedir(), '.lifeops', 'gmail-tokens.json');
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(tokenPath), { recursive: true });
      
      await fs.writeFile(tokenPath, JSON.stringify(tokens, null, 2));
      console.log('✅ Tokens stored successfully');
    } catch (error) {
      console.error('❌ Error storing tokens:', error);
    }
  }

  /**
   * Load stored OAuth tokens
   */
  async loadStoredTokens() {
    try {
      const tokenPath = path.join(os.homedir(), '.lifeops', 'gmail-tokens.json');
      
      const tokenData = await fs.readFile(tokenPath, 'utf8');
      const tokens = JSON.parse(tokenData);
      
      this.oauth2Client.setCredentials(tokens);
      this.isAuthenticated = true;
      
      // Check if token needs refresh
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        console.log('🔄 Token expired, refreshing...');
        await this.refreshTokenIfNeeded();
      } else {
        console.log('✅ Gmail tokens loaded successfully');
      }
    } catch (error) {
      console.log('⚠️ No stored tokens found or error loading tokens');
      this.isAuthenticated = false;
    }
  }

  /**
   * Get authentication status for API responses
   */
  getAuthStatus() {
    return {
      authenticated: this.isAuth(),
      hasRefreshToken: !!this.oauth2Client.credentials?.refresh_token,
      tokenExpiry: this.oauth2Client.credentials?.expiry_date
    };
  }
}

// Export singleton instance
module.exports = new EmailService();