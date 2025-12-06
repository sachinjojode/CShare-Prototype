/**
 * Session Recorder Module
 * Records user sessions including interactions, clicks, scrolls, and navigation
 *
 * Firestore Schema:
 *
 * sessions/{sessionId}/
 * {
 *   userId: string,
 *   startTime: Timestamp,
 *   endTime: Timestamp,
 *   duration: number (ms),
 *   userAgent: string,
 *   screenResolution: { width, height },
 *   eventsCount: number,
 *   metadata: {
 *     initialUrl: string,
 *     finalUrl: string
 *   }
 * }
 *
 * sessions/{sessionId}/events/{eventId}/
 * {
 *   timestamp: Timestamp,
 *   relativeTime: number (ms from session start),
 *   type: 'view' | 'scroll' | 'click' | 'search' | 'item_view' | 'chat_open' | 'booking' | 'navigation',
 *   data: {
 *     url?: string,
 *     scrollX?: number,
 *     scrollY?: number,
 *     elementId?: string,
 *     elementClass?: string,
 *     elementText?: string,
 *     searchQuery?: string,
 *     itemId?: string,
 *     itemName?: string,
 *     chatId?: string,
 *     bookingId?: string,
 *     viewName?: string
 *   },
 *   timeSinceLastEvent: number (ms)
 * }
 */

import { firebaseService, serverTimestamp, arrayUnion } from '../../services/firebaseService.js';
import { store } from '../../stores/stateStore.js';

// Session state
let currentSessionId = null;
let sessionStartTime = null;
let lastScrollPosition = { x: 0, y: 0 };
let scrollDebounceTimer = null;
let lastEventTime = Date.now();

/**
 * Initialize session recording for current user
 * Creates a new session document and logs the initial page view
 */
export async function initSessionRecording() {
    const currentUser = store.getCurrentUser();
    if (!currentUser) return;

    // Generate unique session ID
    currentSessionId = `session_${currentUser.uid}_${Date.now()}`;
    sessionStartTime = Date.now();
    lastEventTime = sessionStartTime;

    // Store in state store
    store.setCurrentSessionId(currentSessionId);

    try {
        // Create session document
        await firebaseService.setDoc(
            firebaseService.doc('sessions', currentSessionId),
            {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                startTime: serverTimestamp(),
                endTime: null,
                duration: null,
                userAgent: navigator.userAgent,
                screenResolution: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                eventsCount: 0,
                metadata: {
                    initialUrl: window.location.pathname,
                    finalUrl: null
                }
            }
        );

        // Log initial page view
        await logSessionEvent('navigation', {
            url: window.location.pathname,
            viewName: 'homeView'
        });

        console.log(`📹 Session recording started: ${currentSessionId}`);
    } catch (error) {
        console.error('Error initializing session recording:', error);
    }
}

/**
 * Log a session event with debouncing for certain event types
 * @param {string} eventType - Type of event ('view', 'scroll', 'click', etc.)
 * @param {Object} data - Event-specific data
 * @param {boolean} debounce - Whether to debounce this event
 */
export async function logSessionEvent(eventType, data = {}, debounce = false) {
    if (!currentSessionId || !sessionStartTime) return;

    const now = Date.now();
    const relativeTime = now - sessionStartTime;
    const timeSinceLastEvent = now - lastEventTime;

    try {
        const eventsRef = firebaseService.collection('sessions/' + currentSessionId + '/events');
        await firebaseService.addDoc(eventsRef, {
            timestamp: serverTimestamp(),
            relativeTime,
            type: eventType,
            data,
            timeSinceLastEvent
        });

        // Update session stats
        await firebaseService.updateDoc(
            firebaseService.doc('sessions', currentSessionId),
            {
                eventsCount: arrayUnion(now), // Use array length for count
                endTime: serverTimestamp(),
                duration: relativeTime,
                'metadata.finalUrl': window.location.pathname
            }
        );

        lastEventTime = now;
    } catch (error) {
        console.error('Error logging session event:', error);
    }
}

/**
 * Track scroll position with debouncing
 * Only logs if scroll position changed significantly (>50px)
 */
export function trackScroll() {
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Only log if scroll position changed significantly (>50px)
    if (Math.abs(scrollX - lastScrollPosition.x) > 50 ||
        Math.abs(scrollY - lastScrollPosition.y) > 50) {

        if (scrollDebounceTimer) {
            clearTimeout(scrollDebounceTimer);
        }

        scrollDebounceTimer = setTimeout(() => {
            logSessionEvent('scroll', {
                scrollX,
                scrollY,
                url: window.location.pathname
            });

            lastScrollPosition = { x: scrollX, y: scrollY };
        }, 500); // 500ms debounce
    }
}

/**
 * Track clicks with element information
 * @param {Event} event - Click event
 */
export function trackClick(event) {
    const target = event.target;
    const data = {
        elementTag: target.tagName,
        elementId: target.id || null,
        elementClass: target.className || null,
        elementText: target.textContent?.substring(0, 50) || null,
        url: window.location.pathname,
        coordinates: {
            x: event.clientX,
            y: event.clientY
        }
    };

    logSessionEvent('click', data);
}

/**
 * Track view changes (navigation between views)
 * @param {string} viewId - ID of the view being navigated to
 */
export function trackViewChange(viewId) {
    logSessionEvent('navigation', {
        viewName: viewId,
        url: window.location.pathname
    });
}

/**
 * Track search queries
 * @param {string} query - Search query text
 */
export function trackSearch(query) {
    if (query && query.trim()) {
        logSessionEvent('search', {
            searchQuery: query,
            queryLength: query.length
        });
    }
}

/**
 * Track item views
 * @param {string} itemId - Item document ID
 * @param {string} itemName - Item name
 */
export function trackItemView(itemId, itemName) {
    logSessionEvent('item_view', {
        itemId,
        itemName,
        url: window.location.pathname
    });
}

/**
 * Track chat opens
 * @param {string} itemId - Item document ID
 * @param {string} itemName - Item name
 */
export function trackChatOpen(itemId, itemName) {
    logSessionEvent('chat_open', {
        itemId,
        itemName
    });
}

/**
 * Track booking attempts
 * @param {string} itemId - Item document ID
 * @param {string} itemName - Item name
 * @param {Date} startDate - Booking start date
 * @param {Date} endDate - Booking end date
 */
export function trackBookingAttempt(itemId, itemName, startDate, endDate) {
    logSessionEvent('booking', {
        itemId,
        itemName,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
    });
}

/**
 * End session recording
 * Finalizes the session document with end time and duration
 */
export async function endSessionRecording() {
    if (!currentSessionId) return;

    try {
        await firebaseService.updateDoc(
            firebaseService.doc('sessions', currentSessionId),
            {
                endTime: serverTimestamp(),
                duration: Date.now() - sessionStartTime
            }
        );

        console.log(`📹 Session recording ended: ${currentSessionId}`);

        // Reset session state
        currentSessionId = null;
        sessionStartTime = null;
        store.setCurrentSessionId(null);
    } catch (error) {
        console.error('Error ending session recording:', error);
    }
}

/**
 * Setup session recording event listeners
 * Attaches listeners for scroll, click, and page unload events
 */
export function setupSessionRecording() {
    // Track scrolls
    window.addEventListener('scroll', trackScroll, { passive: true });

    // Track clicks
    document.addEventListener('click', trackClick, true);

    // Track page unload
    window.addEventListener('beforeunload', () => {
        endSessionRecording();
    });
}

/**
 * Get current session ID
 * @returns {string|null} Current session ID
 */
export function getCurrentSessionId() {
    return currentSessionId;
}
