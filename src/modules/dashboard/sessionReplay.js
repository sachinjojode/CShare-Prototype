/**
 * Detailed Session Playback Tool
 * Provides timeline scrubbing, event jump navigation, and UI state simulation
 */

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { store } from '../../stores/stateStore.js';

// Get db instance from store (will be set by app.js)
let db = null;

export function initSessionReplay(firestoreInstance) {
    db = firestoreInstance;
}

// Load all recorded sessions into selector
export async function loadRecordedSessions() {
    const detailedSessionSelector = document.getElementById('detailedSessionSelector');
    if (!detailedSessionSelector) return;

    try {
        const sessionsSnapshot = await getDocs(collection(db, 'sessions'));
        detailedSessionSelector.innerHTML = '<option value="">Select a recorded session...</option>';

        const sessions = [];
        sessionsSnapshot.forEach((doc) => {
            sessions.push({ id: doc.id, ...doc.data() });
        });

        // Sort by start time (most recent first)
        sessions.sort((a, b) => {
            const aTime = a.startTime?.toMillis() || 0;
            const bTime = b.startTime?.toMillis() || 0;
            return bTime - aTime;
        });

        sessions.forEach((session) => {
            const option = document.createElement('option');
            option.value = session.id;
            const startTime = session.startTime ? new Date(session.startTime.toMillis()).toLocaleString() : 'Unknown';
            const duration = session.duration ? `${(session.duration / 1000).toFixed(0)}s` : 'In progress';
            option.textContent = `${session.userEmail} - ${startTime} (${duration})`;
            detailedSessionSelector.appendChild(option);
        });

        document.getElementById('loadPlaybackBtn').disabled = false;
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

// Load selected session for playback
export async function loadSessionForPlayback() {
    const detailedSessionSelector = document.getElementById('detailedSessionSelector');
    const sessionId = detailedSessionSelector.value;

    if (!sessionId) return;

    try {
        // Load session metadata
        const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
        if (!sessionDoc.exists()) {
            alert('Session not found');
            return;
        }

        const currentPlaybackSession = { id: sessionDoc.id, ...sessionDoc.data() };
        store.setState('replay.currentPlaybackSession', currentPlaybackSession);

        // Load all events for this session
        const eventsSnapshot = await getDocs(
            query(
                collection(db, 'sessions', sessionId, 'events'),
                orderBy('relativeTime', 'asc')
            )
        );

        const currentPlaybackEvents = [];
        eventsSnapshot.forEach((doc) => {
            currentPlaybackEvents.push({ id: doc.id, ...doc.data() });
        });
        store.setState('replay.currentPlaybackEvents', currentPlaybackEvents);

        // Reset playback state
        store.setState('replay.playbackIndex', 0);
        store.setState('replay.isPlaying', false);
        store.setState('replay.playbackSpeed', 1);

        // Show playback container
        document.getElementById('playbackContainer').classList.remove('hidden');

        // Update header info
        const startTime = currentPlaybackSession.startTime
            ? new Date(currentPlaybackSession.startTime.toMillis()).toLocaleString()
            : 'Unknown';
        const duration = currentPlaybackSession.duration
            ? `${(currentPlaybackSession.duration / 1000).toFixed(1)}s`
            : `${(currentPlaybackEvents[currentPlaybackEvents.length - 1]?.relativeTime / 1000).toFixed(1)}s`;

        document.getElementById('playbackUser').textContent = `👤 ${currentPlaybackSession.userEmail}`;
        document.getElementById('playbackDuration').textContent = `⏱️ Duration: ${duration}`;
        document.getElementById('playbackEvents').textContent = `📊 ${currentPlaybackEvents.length} events`;

        // Setup timeline
        const timelineScrubber = document.getElementById('timelineScrubber');
        timelineScrubber.max = currentPlaybackEvents.length - 1;
        timelineScrubber.value = 0;

        // Render events list and timeline markers
        renderEventsList();
        renderTimelineMarkers();

        // Enable controls
        document.getElementById('playBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('resetBtn').disabled = false;

        // Reset UI state display
        updateUIStateDisplay(null);

    } catch (error) {
        console.error('Error loading session for playback:', error);
        alert('Error loading session. Please try again.');
    }
}

// Render events list
export function renderEventsList() {
    const currentPlaybackEvents = store.getState('replay.currentPlaybackEvents');
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '';

    currentPlaybackEvents.forEach((event, index) => {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event-item';
        eventDiv.dataset.index = index;

        const timeLabel = `${(event.relativeTime / 1000).toFixed(1)}s`;
        const eventIcon = getEventIcon(event.type);
        const eventDesc = getEventDescription(event);

        eventDiv.innerHTML = `
            <div class="event-time">${timeLabel}</div>
            <div class="event-content">
                <span class="event-icon">${eventIcon}</span>
                <span class="event-desc">${eventDesc}</span>
            </div>
        `;

        // Click to jump to event
        eventDiv.addEventListener('click', () => {
            jumpToEvent(index);
        });

        eventsList.appendChild(eventDiv);
    });
}

// Render timeline markers
export function renderTimelineMarkers() {
    const currentPlaybackEvents = store.getState('replay.currentPlaybackEvents');
    const timelineMarkers = document.getElementById('timelineMarkers');
    timelineMarkers.innerHTML = '';

    const totalEvents = currentPlaybackEvents.length;
    const maxDuration = currentPlaybackEvents[totalEvents - 1]?.relativeTime || 1;

    currentPlaybackEvents.forEach((event, index) => {
        const marker = document.createElement('div');
        marker.className = `timeline-marker marker-${event.type}`;
        const position = (event.relativeTime / maxDuration) * 100;
        marker.style.left = `${position}%`;
        marker.title = `${(event.relativeTime / 1000).toFixed(1)}s - ${event.type}`;

        marker.addEventListener('click', () => {
            jumpToEvent(index);
        });

        timelineMarkers.appendChild(marker);
    });
}

// Get icon for event type
export function getEventIcon(type) {
    const icons = {
        'view': '📄',
        'scroll': '🖱️',
        'click': '👆',
        'search': '🔍',
        'item_view': '👁️',
        'chat_open': '💬',
        'booking': '📅',
        'navigation': '🧭'
    };
    return icons[type] || '📌';
}

// Get event description
export function getEventDescription(event) {
    switch (event.type) {
        case 'view':
            return `Navigated to ${event.data?.viewId || 'unknown view'}`;
        case 'scroll':
            return `Scrolled to (${event.data?.scrollX}, ${event.data?.scrollY})`;
        case 'click':
            return `Clicked ${event.data?.elementType || 'element'}${event.data?.elementId ? ` #${event.data.elementId}` : ''}`;
        case 'search':
            return `Searched: "${event.data?.query}"`;
        case 'item_view':
            return `Viewed item: ${event.data?.itemName}`;
        case 'chat_open':
            return `Opened chat for: ${event.data?.itemName}`;
        case 'booking':
            return `Requested booking for: ${event.data?.itemName}`;
        default:
            return `${event.type}`;
    }
}

// Update UI state display
export function updateUIStateDisplay(event) {
    const stateView = document.getElementById('stateView');
    const stateScroll = document.getElementById('stateScroll');
    const stateItem = document.getElementById('stateItem');
    const stateSearch = document.getElementById('stateSearch');
    const stateChat = document.getElementById('stateChat');

    if (!event) {
        stateView.textContent = '-';
        stateScroll.textContent = '-';
        stateItem.textContent = '-';
        stateSearch.textContent = '-';
        stateChat.textContent = '-';
        return;
    }

    // Update based on event type
    if (event.type === 'view') {
        stateView.textContent = event.data?.viewId || '-';
    } else if (event.type === 'scroll') {
        stateScroll.textContent = `X: ${event.data?.scrollX || 0}, Y: ${event.data?.scrollY || 0}`;
    } else if (event.type === 'item_view') {
        stateItem.textContent = event.data?.itemName || '-';
    } else if (event.type === 'search') {
        stateSearch.textContent = event.data?.query || '-';
    } else if (event.type === 'chat_open') {
        stateChat.textContent = event.data?.itemName || '-';
    } else if (event.type === 'booking') {
        stateItem.textContent = `${event.data?.itemName} (Booking: ${event.data?.startDate} - ${event.data?.endDate})`;
    }
}

// Jump to specific event
export function jumpToEvent(index) {
    store.setState('replay.playbackIndex', index);
    updatePlaybackPosition();
    highlightCurrentEvent();
    const currentPlaybackEvents = store.getState('replay.currentPlaybackEvents');
    updateUIStateDisplay(currentPlaybackEvents[index]);
}

// Update playback position (scrubber and progress)
export function updatePlaybackPosition() {
    const playbackIndex = store.getState('replay.playbackIndex');
    const currentPlaybackEvents = store.getState('replay.currentPlaybackEvents');
    const timelineScrubber = document.getElementById('timelineScrubber');
    const timelineProgress = document.getElementById('timelineProgress');

    timelineScrubber.value = playbackIndex;
    const progressPercent = (playbackIndex / (currentPlaybackEvents.length - 1)) * 100;
    timelineProgress.style.width = `${progressPercent}%`;
}

// Highlight current event in list
function highlightCurrentEvent() {
    const playbackIndex = store.getState('replay.playbackIndex');
    document.querySelectorAll('.event-item').forEach((item, index) => {
        if (index === playbackIndex) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

// Play session
export function playSession() {
    store.setState('replay.isPlaying', true);
    document.getElementById('playBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;

    function playNextEvent() {
        const isPlaying = store.getState('replay.isPlaying');
        const playbackIndex = store.getState('replay.playbackIndex');
        const currentPlaybackEvents = store.getState('replay.currentPlaybackEvents');
        const playbackSpeed = store.getState('replay.playbackSpeed');

        if (!isPlaying || playbackIndex >= currentPlaybackEvents.length - 1) {
            pauseSession();
            return;
        }

        const currentEvent = currentPlaybackEvents[playbackIndex];
        const nextEvent = currentPlaybackEvents[playbackIndex + 1];

        // Calculate delay to next event (adjusted by playback speed)
        const delay = (nextEvent.relativeTime - currentEvent.relativeTime) / playbackSpeed;

        const playbackInterval = setTimeout(() => {
            const newIndex = store.getState('replay.playbackIndex') + 1;
            store.setState('replay.playbackIndex', newIndex);
            updatePlaybackPosition();
            highlightCurrentEvent();
            const events = store.getState('replay.currentPlaybackEvents');
            updateUIStateDisplay(events[newIndex]);
            playNextEvent();
        }, delay);

        store.setState('replay.playbackInterval', playbackInterval);
    }

    playNextEvent();
}

// Pause session
export function pauseSession() {
    store.setState('replay.isPlaying', false);
    const playbackInterval = store.getState('replay.playbackInterval');
    if (playbackInterval) {
        clearTimeout(playbackInterval);
        store.setState('replay.playbackInterval', null);
    }
    document.getElementById('playBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
}

// Reset session
export function resetSession() {
    pauseSession();
    store.setState('replay.playbackIndex', 0);
    updatePlaybackPosition();
    highlightCurrentEvent();
    updateUIStateDisplay(null);
}

// Setup playback controls
export function setupPlaybackControls() {
    const detailedSessionSelector = document.getElementById('detailedSessionSelector');
    const loadPlaybackBtn = document.getElementById('loadPlaybackBtn');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const timelineScrubber = document.getElementById('timelineScrubber');

    if (!detailedSessionSelector || !loadPlaybackBtn) return;

    // Load sessions on dashboard load
    loadRecordedSessions();

    // Enable load button when session selected
    detailedSessionSelector.addEventListener('change', () => {
        loadPlaybackBtn.disabled = !detailedSessionSelector.value;
    });

    // Load session button
    loadPlaybackBtn.addEventListener('click', loadSessionForPlayback);

    // Playback controls
    if (playBtn) playBtn.addEventListener('click', playSession);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseSession);
    if (resetBtn) resetBtn.addEventListener('click', resetSession);

    // Timeline scrubber
    if (timelineScrubber) {
        timelineScrubber.addEventListener('input', (e) => {
            pauseSession();
            const index = parseInt(e.target.value);
            store.setState('replay.playbackIndex', index);
            updatePlaybackPosition();
            highlightCurrentEvent();
            const currentPlaybackEvents = store.getState('replay.currentPlaybackEvents');
            updateUIStateDisplay(currentPlaybackEvents[index]);
        });
    }

    // Speed controls
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const speed = parseFloat(e.target.dataset.speed);
            store.setState('replay.playbackSpeed', speed);
        });
    });
}
