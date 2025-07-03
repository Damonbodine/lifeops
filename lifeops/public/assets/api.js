/**
 * LifeOps API Wrapper Functions
 * Modular API functions for dashboard functionality
 */

// Check-ins API wrapper
async function loadCheckIns(customConfig = null) {
    try {
        document.getElementById('weeklyGoal').textContent = 'Loading...';
        document.getElementById('priorityContacts').innerHTML = '<div style="text-align: center; color: #7f8c8d; padding: 20px;"><p>Analyzing your relationships...</p></div>';
        
        // Use custom config if provided, otherwise use current global config
        const config = customConfig || currentConfig;
        
        // Build query string
        const params = new URLSearchParams(config);
        const response = await fetch(`/api/check-ins?${params}`);
        const data = await response.json();
        
        // Update weekly goal
        document.getElementById('weeklyGoal').textContent = data.weeklyGoal;
        
        // Update contacts stats
        const statsElement = document.getElementById('contactsStats');
        const countElement = document.getElementById('contactsCount');
        const insightElement = document.getElementById('contactsInsight');
        
        if (data.totalContacts && data.totalContacts > 0) {
            statsElement.style.display = 'block';
            const filterText = data.resolvedContacts !== undefined ? 
                `${data.priorityContacts.length} of ${data.totalContacts} contacts shown (${data.resolvedContacts} with resolved names)` :
                `${data.priorityContacts.length} of ${data.totalContacts} contacts shown`;
            countElement.textContent = filterText;
            insightElement.textContent = data.insight || '';
        }
        
        // Update priority contacts with scrollable display
        const contactsContainer = document.getElementById('priorityContacts');
        if (data.priorityContacts && data.priorityContacts.length > 0) {
            contactsContainer.innerHTML = `
                <div class="contacts-header" style="margin-bottom: 15px;">
                    <small style="color: #7f8c8d;">Scroll to see more contacts ↓</small>
                </div>
            ` + data.priorityContacts.map((contact, index) => {
                const isBirthday = contact.birthdayContact;
                const borderStyle = isBirthday ? 'border: 3px solid #FFD700; background: linear-gradient(135deg, #FFF9E6 0%, #FFFBF0 100%);' : '';
                const priorityBadge = isBirthday ? 
                    '<span style="background: #FFD700; color: #B8860B; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; margin-left: 5px; font-weight: bold;">🎂 BIRTHDAY</span>' :
                    `<span style="background: #f0f0f0; padding: 2px 6px; border-radius: 10px; font-size: 0.8rem; margin-left: 8px;">#${index + 1}</span>`;
                
                const daysSinceText = isBirthday ? 
                    (contact.birthdayInfo && contact.birthdayInfo.daysUntilBirthday === 0 ? 
                        '🎉 Birthday is TODAY!' : 
                        `🎂 Birthday in ${contact.birthdayInfo?.daysUntilBirthday || 0} days`) :
                    `📅 ${contact.daysSince} days since last contact`;
                    
                const daysSinceColor = isBirthday ? '#D4AF37' : '#e74c3c';
                
                return `
                <div class="contact-item task-item" style="margin: 0; padding: 15px; ${borderStyle}">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; margin-bottom: 5px;">
                            ${contact.isResolved ? '👤' : '📱'} ${contact.name}
                            ${priorityBadge}
                            ${contact.isResolved ? 
                                '<span style="background: #e8f5e8; color: #2e7d32; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; margin-left: 5px;">✓ Named</span>' : 
                                '<span style="background: #fff3e0; color: #ef6c00; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; margin-left: 5px;">📞 Number</span>'
                            }
                            ${isBirthday && contact.birthdayInfo?.facebookUrl ? 
                                `<a href="${contact.birthdayInfo.facebookUrl}" target="_blank" style="margin-left: 5px; text-decoration: none;">
                                    <span style="background: #1877F2; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem;">📘 FB</span>
                                </a>` : ''
                            }
                        </div>
                        <div style="color: ${daysSinceColor}; font-size: 0.9rem; margin-bottom: 5px; font-weight: ${isBirthday ? 'bold' : 'normal'};">
                            ${daysSinceText}
                        </div>
                        <div style="color: #7f8c8d; font-size: 0.9rem; margin-bottom: 10px;">
                            ${contact.reason}
                            ${contact.messageCount ? `• ${contact.messageCount} messages total` : ''}
                        </div>
                        <div style="background: ${isBirthday ? '#FFF9E6' : '#f8f9fa'}; padding: 10px; border-radius: 6px; font-style: italic; border-left: ${isBirthday ? '4px solid #FFD700' : '4px solid #e9ecef'};">
                            💬 "${contact.suggestedMessage}"
                        </div>
                    </div>
                    <button class="btn btn-success" onclick="sendMessage('${contact.name}', '${contact.rawContact}', '${contact.isResolved}')" style="margin-left: 15px; white-space: nowrap;">
                        💌 Message
                    </button>
                    <button class="btn" onclick="getSmartMessage('${contact.name}', '${contact.rawContact}', '${contact.isResolved}')" style="margin-left: 10px; white-space: nowrap; background: #9b59b6; color: white;">
                        🤖 Smart Message
                    </button>
                </div>`
            }).join('');
        } else {
            contactsContainer.innerHTML = `
                <div style="text-align: center; color: #27ae60; padding: 20px;">
                    <p>🎉 You're doing great at staying connected!</p>
                    <p>No urgent check-ins needed right now.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading check-ins:', error);
        document.getElementById('priorityContacts').innerHTML = `
            <div style="text-align: center; color: #e74c3c; padding: 20px;">
                <p>❌ Error loading check-ins</p>
                <p>Make sure LifeOps has Full Disk Access permission</p>
            </div>
        `;
    }
}

// Email analysis API wrapper
async function analyzeEmails() {
    const loading = document.getElementById('email-loading');
    const emailGrid = document.getElementById('email-grid');
    const status = document.getElementById('email-status');
    const btn = event.target;

    // Show loading state
    btn.disabled = true;
    btn.textContent = 'Analyzing...';
    loading.style.display = 'block';
    emailGrid.innerHTML = '';
    status.style.display = 'none';

    try {
        const response = await fetch('/api/emails');
        const data = await response.json();

        if (data.error) {
            status.innerHTML = `Gmail Error: ${data.error}`;
            status.style.display = 'block';
        }

        if (data.emails && data.emails.length > 0) {
            displayEmails(data.emails);
        } else {
            status.innerHTML = 'No emails found to analyze';
            status.style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        status.innerHTML = '❌ Error analyzing emails. Please try again.';
        status.style.display = 'block';
    } finally {
        // Reset loading state
        btn.disabled = false;
        btn.textContent = '📧 Analyze Recent Emails';
        loading.style.display = 'none';
    }
}

// Relationship status API wrapper
async function loadRelationshipStatus() {
    try {
        const response = await fetch('/api/email-relationships/status');
        const status = await response.json();
        
        const statusContent = document.getElementById('status-content');
        const analysisBtn = document.getElementById('analysisBtn');
        
        if (status.processing) {
            const proc = status.processing;
            if (proc.status === 'running') {
                statusContent.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 20px; height: 20px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <div>
                            <strong>Analysis in Progress</strong><br>
                            📧 Processed: ${proc.emails_processed || 0} emails<br>
                            ⏱️ Started: ${new Date(proc.start_date).toLocaleString()}<br>
                            <span style="color: #27ae60; font-size: 0.9rem;">💡 Showing partial results below while processing continues</span>
                        </div>
                    </div>
                `;
                analysisBtn.disabled = true;
                analysisBtn.textContent = '⏳ Processing...';
                
                // Load partial results immediately, even while processing
                loadDormantRelationships();
                loadRelationshipInsights();
            } else if (proc.status === 'completed') {
                statusContent.innerHTML = `
                    <div>
                        <strong>✅ Analysis Complete!</strong><br>
                        📧 Processed: ${proc.emails_processed || 0} emails<br>
                        🏁 Completed: ${new Date(proc.end_date).toLocaleString()}
                    </div>
                `;
                analysisBtn.textContent = '🔄 Re-analyze Sent Emails';
                analysisBtn.disabled = false;
                
                // Load final results
                loadDormantRelationships();
                loadRelationshipInsights();
            }
        } else {
            statusContent.innerHTML = `
                <div>
                    <strong>🚀 Ready to Start</strong><br>
                    Click "Analyze Sent Emails" to process your outbound email history and discover people to reconnect with.
                </div>
            `;
            analysisBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error loading relationship status:', error);
        document.getElementById('status-content').innerHTML = `
            <div style="color: #ff6b6b;">
                ❌ Error loading status. Please try again.
            </div>
        `;
    }
}

// Dormant relationships API wrapper
async function loadDormantRelationships() {
    try {
        const response = await fetch('/api/email-relationships/dormant?days=30&minEmailsSent=3');
        const data = await response.json();
        
        const container = document.getElementById('dormant-relationships');
        
        // Check if we got an error response
        if (data.error) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ff6b6b;">
                    ❌ ${data.error}<br>
                    <small>${data.message || ''}</small>
                </div>
            `;
            return;
        }
        
        // Handle the API response format {success: true, suggestions: [...]}
        const relationships = data.suggestions || data || [];
        
        if (relationships.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">✅</div>
                    <p>Great! You're staying in touch well.<br>No neglected connections found.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = relationships.map(rel => `
            <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #e74c3c;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${rel.name || rel.email}</strong><br>
                        <small style="color: #7f8c8d;">${rel.email}</small>
                        ${rel.lastSubject ? `<br><small style="color: #95a5a6; font-style: italic;">"${rel.lastSubject}"</small>` : ''}
                    </div>
                    <div style="text-align: right; font-size: 0.9rem; color: #7f8c8d;">
                        ${rel.daysSinceLastContact} days ago<br>
                        Health: ${rel.healthScore}/100<br>
                        <span style="color: #3498db; font-weight: bold;">${rel.suggestion_reason}</span>
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <button onclick="suggestMessage('${rel.email}')" style="background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
                        💡 Suggest Message
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading dormant relationships:', error);
        document.getElementById('dormant-relationships').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ff6b6b;">
                ❌ Error loading dormant relationships
            </div>
        `;
    }
}

// Relationship insights API wrapper
async function loadRelationshipInsights() {
    try {
        const response = await fetch('/api/email-relationships/insights');
        const data = await response.json();
        
        const container = document.getElementById('relationship-insights');
        
        // Check if we got an error response
        if (data.error) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ff6b6b;">
                    ❌ ${data.error}<br>
                    <small>${data.message || ''}</small>
                </div>
            `;
            return;
        }
        
        const insights = data.insights || {};
        
        container.innerHTML = `
            <div style="padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50;">📊 Communication Overview</h4>
                    <div style="font-size: 0.9rem; line-height: 1.5;">
                        • <strong>${insights.overview?.totalRelationships || 0}</strong> relationships tracked<br>
                        • <strong>${insights.dormantRelationships?.count || 0}</strong> need attention<br>
                        • Database: <strong>${insights.overview?.databaseSize || 'Unknown'}</strong>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50;">💡 AI Recommendations</h4>
                    <div style="font-size: 0.85rem; line-height: 1.4;">
                        ${insights.recommendations?.map(rec => `• ${rec}`).join('<br>') || 'No recommendations available'}
                    </div>
                </div>
                
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50;">🎯 Quick Actions</h4>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="loadDormantRelationships()" style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                            🔍 View ${insights.dormantRelationships?.count || 0} Dormant
                        </button>
                        <button onclick="loadRelationshipStatus()" style="background: #27ae60; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                            🔄 Refresh
                        </button>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading relationship insights:', error);
        document.getElementById('relationship-insights').innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ff6b6b;">
                ❌ Error loading insights
            </div>
        `;
    }
}

// Configuration presets API wrapper
async function loadPresets() {
    try {
        const response = await fetch('/api/check-ins/presets');
        const data = await response.json();
        if (data.success) {
            presets = data.presets;
        }
    } catch (error) {
        console.error('Error loading presets:', error);
    }
}