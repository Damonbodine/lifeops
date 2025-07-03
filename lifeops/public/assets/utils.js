// ============================================================================
// UTILITY FUNCTIONS - Extracted from dashboard.html for modularization
// ============================================================================
// These are pure utility functions with minimal dependencies that can be
// safely extracted without affecting the main application functionality.

// ============================================================================
// CLIPBOARD UTILITY
// ============================================================================
function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        const originalBg = element.style.background;
        element.style.background = '#d4edda';
        element.innerHTML = element.innerHTML.replace('Click to copy', '✅ Copied!');
        
        setTimeout(() => {
            element.style.background = originalBg;
            element.innerHTML = element.innerHTML.replace('✅ Copied!', 'Click to copy');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        element.innerHTML = element.innerHTML.replace('Click to copy', '✅ Copied!');
        setTimeout(() => {
            element.innerHTML = element.innerHTML.replace('✅ Copied!', 'Click to copy');
        }, 2000);
    });
}

// ============================================================================
// TIMER DISPLAY UTILITY
// ============================================================================
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    document.getElementById('timerDisplay').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================================================
// WEB AUDIO API NOTIFICATION SOUND
// ============================================================================
function playNotificationSound() {
    console.log('🔊 Attempting to play notification sound...');
    
    try {
        // Create audio context if it doesn't exist
        if (!window.audioContext) {
            window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('🎵 Created new AudioContext');
        }
        
        // Resume audio context if suspended (required by modern browsers)
        if (window.audioContext.state === 'suspended') {
            window.audioContext.resume().then(() => {
                console.log('🎵 AudioContext resumed');
                playActualSound();
            });
        } else {
            playActualSound();
        }
        
        function playActualSound() {
            console.log('🎵 Playing synthesized ding...');
            
            // Create a simple ding sound using Web Audio API
            const oscillator = window.audioContext.createOscillator();
            const gainNode = window.audioContext.createGain();
            
            // Connect oscillator to gain to output
            oscillator.connect(gainNode);
            gainNode.connect(window.audioContext.destination);
            
            // Configure the ding sound
            oscillator.frequency.setValueAtTime(800, window.audioContext.currentTime); // High pitch
            oscillator.frequency.exponentialRampToValueAtTime(200, window.audioContext.currentTime + 0.1); // Drop to lower pitch
            
            // Configure volume envelope (fade in/out)
            gainNode.gain.setValueAtTime(0, window.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, window.audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, window.audioContext.currentTime + 0.5);
            
            // Play the sound
            oscillator.start(window.audioContext.currentTime);
            oscillator.stop(window.audioContext.currentTime + 0.5);
            
            console.log('✅ Sound should be playing now');
        }
        
    } catch (error) {
        console.error('❌ Web Audio API failed:', error);
        
        // Fallback 1: Simple HTML5 audio with a beep
        try {
            console.log('🔄 Trying HTML5 audio fallback...');
            const audio = new Audio();
            audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwgBTuV2++9diMFl1n19tOKOwgWNK/l7qRTFAy6lpGv7J1WEwx';
            audio.volume = 0.5;
            audio.play().then(() => {
                console.log('✅ HTML5 audio played successfully');
            }).catch(audioError => {
                console.error('❌ HTML5 audio failed:', audioError);
                
                // Fallback 2: Browser notification with sound
                if ('Notification' in window) {
                    console.log('🔔 Trying browser notification...');
                    if (Notification.permission === 'granted') {
                        new Notification('🍅 Pomodoro Complete!', {
                            body: 'Your focus session has finished.',
                            icon: '🍅',
                            requireInteraction: true
                        });
                    } else if (Notification.permission !== 'denied') {
                        Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                                new Notification('🍅 Pomodoro Complete!', {
                                    body: 'Your focus session has finished.',
                                    icon: '🍅',
                                    requireInteraction: true
                                });
                            }
                        });
                    }
                }
            });
        } catch (fallbackError) {
            console.error('❌ All sound methods failed:', fallbackError);
            // Visual feedback as last resort
            document.body.style.backgroundColor = '#ff6b6b';
            setTimeout(() => {
                document.body.style.backgroundColor = '';
            }, 500);
        }
    }
}

// ============================================================================
// CONFIG DESCRIPTION FORMATTER
// ============================================================================
function getConfigDescription(config) {
    const parts = [];
    
    if (config.daysThreshold === 1) {
        parts.push('showing very recent contacts');
    } else if (config.daysThreshold <= 7) {
        parts.push('showing recent contacts');
    } else if (config.daysThreshold <= 30) {
        parts.push('showing contacts from past month');
    } else {
        parts.push(`showing contacts not contacted in ${config.daysThreshold}+ days`);
    }
    
    if (config.sortBy === 'messageCount') {
        parts.push('sorted by message frequency');
    } else if (config.sortBy === 'random') {
        parts.push('in random order');
    } else {
        parts.push('sorted by time since last contact');
    }
    
    if (config.filterType === 'resolved') {
        parts.push('(named contacts only)');
    } else if (config.filterType === 'unresolved') {
        parts.push('(phone numbers only)');
    }
    
    return parts.join(', ');
}