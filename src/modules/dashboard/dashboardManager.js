/**
 * Dashboard Manager
 * Handles testing dashboard, metrics, funnels, and visualizations
 */

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { store } from '../../stores/stateStore.js';
import { ITEM_EMOJIS } from '../../utils/constants.js';

// Get db instance from store (will be set by app.js)
let db = null;

export function initDashboard(firestoreInstance) {
    db = firestoreInstance;
}

/**
 * Load Advanced Testing Dashboard with funnels, charts, and session replay
 */
export async function loadTestingDashboard(
    showView,
    clearAnalyticsData,
    clearSessionsData,
    clearAllTestingData,
    replaySession,
    stopSessionReplay,
    setupPlaybackControls,
    populateSessionSelector
) {
    try {
        const viewFn = showView || window.showView || (() => {});
        const clearAnalyticsFn = clearAnalyticsData || window.clearAnalyticsData || (() => {});
        const clearSessionsFn = clearSessionsData || window.clearSessionsData || (() => {});
        const clearAllTestingDataFn = clearAllTestingData || window.clearAllTestingData || (() => {});
        const replaySessionFn = replaySession || window.replaySession || (() => {});
        const stopSessionReplayFn = stopSessionReplay || window.stopSessionReplay || (() => {});
        const setupPlaybackFn = setupPlaybackControls || window.setupPlaybackControls || (() => {});
        const populateSessionsFn = populateSessionSelector || window.populateSessionSelector || (() => {});

        viewFn('testingDashboardView');

        // Load all data
        await refreshDashboardData(populateSessionsFn);

        // Get current period from store
        const currentPeriod = store.getState('dashboard.currentPeriod');

        // Setup period toggle listeners
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                store.setState('dashboard.currentPeriod', e.target.dataset.period);
                await refreshDashboardData(populateSessionsFn);
            });
        });

        // Setup admin clear data buttons
        const clearAnalyticsBtn = document.getElementById('clearAnalyticsBtn');
        const clearSessionsBtn = document.getElementById('clearSessionsBtn');
        const clearAllTestDataBtn = document.getElementById('clearAllTestDataBtn');

        if (clearAnalyticsBtn) {
            clearAnalyticsBtn.addEventListener('click', clearAnalyticsFn);
        }
        if (clearSessionsBtn) {
            clearSessionsBtn.addEventListener('click', clearSessionsFn);
        }
        if (clearAllTestDataBtn) {
            clearAllTestDataBtn.addEventListener('click', clearAllTestingDataFn);
        }

        // Setup session replay listeners (analytics-based)
        const sessionSelector = document.getElementById('sessionSelector');
        const replayBtn = document.getElementById('replaySessionBtn');
        const stopBtn = document.getElementById('stopReplayBtn');

        sessionSelector.addEventListener('change', () => {
            replayBtn.disabled = !sessionSelector.value;
        });

        replayBtn.addEventListener('click', () => replaySessionFn(sessionSelector.value));
        stopBtn.addEventListener('click', stopSessionReplayFn);

        // Setup detailed session playback controls
        setupPlaybackFn();

    } catch (error) {
        console.error('Error loading testing dashboard:', error);
        alert('Error loading dashboard. Please try again.');
    }
}

/**
 * Refresh all dashboard data and visualizations
 */
export async function refreshDashboardData(populateSessionSelector) {
    // Fetch all analytics and bookings data
    const analyticsSnapshot = await getDocs(collection(db, 'analytics'));
    const bookingsSnapshot = await getDocs(collection(db, 'bookings'));
    const itemsSnapshot = await getDocs(collection(db, 'items'));

    // Build items map
    const itemsMap = {};
    itemsSnapshot.forEach((doc) => {
        const item = doc.data();
        itemsMap[doc.id] = {
            id: doc.id,
            name: item.name,
            category: item.category,
            emoji: item.emoji
        };
    });

    // Process analytics events
    const events = [];
    analyticsSnapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date()
        });
    });

    // Process bookings for acceptance tracking
    const acceptedBookings = new Set();
    bookingsSnapshot.forEach((doc) => {
        const booking = doc.data();
        if (booking.status === 'accepted' || booking.status === 'confirmed') {
            acceptedBookings.add(booking.itemId);
        }
    });

    // Filter events by period
    const currentPeriod = store.getState('dashboard.currentPeriod');
    const filteredEvents = filterEventsByPeriod(events, currentPeriod);

    // Calculate metrics
    const metrics = calculateMetrics(filteredEvents, acceptedBookings);

    // Update UI
    updateQuickStats(metrics);
    renderFunnelChart(metrics.funnel);
    renderDropoffAnalysis(metrics.dropoff);
    renderTimelineChart(filteredEvents, currentPeriod);
    renderTopLists(filteredEvents, itemsMap);
    populateSessionSelector(events);

    // Store for later use
    store.setState('dashboard.dashboardData', { events: filteredEvents, itemsMap, metrics });
}

/**
 * Filter events by time period
 */
export function filterEventsByPeriod(events, period) {
    const now = new Date();
    let cutoff = new Date();

    switch (period) {
        case 'daily':
            cutoff.setDate(now.getDate() - 1);
            break;
        case 'weekly':
            cutoff.setDate(now.getDate() - 7);
            break;
        case 'monthly':
            cutoff.setMonth(now.getMonth() - 1);
            break;
    }

    return events.filter(e => e.timestamp >= cutoff);
}

/**
 * Calculate all metrics including funnel and drop-off
 */
export function calculateMetrics(events, acceptedBookings) {
    // Group events by user
    const userJourneys = {};

    events.forEach(event => {
        const userId = event.userId;
        if (!userJourneys[userId]) {
            userJourneys[userId] = {
                views: 0,
                chats: 0,
                bookings: 0,
                accepted: 0
            };
        }

        if (event.action === 'view_item') userJourneys[userId].views++;
        if (event.action === 'open_chat') userJourneys[userId].chats++;
        if (event.action === 'request_booking') {
            userJourneys[userId].bookings++;
            if (acceptedBookings.has(event.itemId)) {
                userJourneys[userId].accepted++;
            }
        }
    });

    // Calculate funnel
    const totalUsers = Object.keys(userJourneys).length;
    const usersWithViews = Object.values(userJourneys).filter(j => j.views > 0).length;
    const usersWithChats = Object.values(userJourneys).filter(j => j.chats > 0).length;
    const usersWithBookings = Object.values(userJourneys).filter(j => j.bookings > 0).length;
    const usersWithAccepted = Object.values(userJourneys).filter(j => j.accepted > 0).length;

    const funnel = {
        views: usersWithViews,
        chats: usersWithChats,
        bookings: usersWithBookings,
        accepted: usersWithAccepted
    };

    // Calculate drop-offs
    const dropoff = {
        'View → Chat': {
            started: usersWithViews,
            completed: usersWithChats,
            dropRate: usersWithViews > 0 ? ((usersWithViews - usersWithChats) / usersWithViews * 100).toFixed(1) : 0
        },
        'Chat → Booking': {
            started: usersWithChats,
            completed: usersWithBookings,
            dropRate: usersWithChats > 0 ? ((usersWithChats - usersWithBookings) / usersWithChats * 100).toFixed(1) : 0
        },
        'Booking → Accepted': {
            started: usersWithBookings,
            completed: usersWithAccepted,
            dropRate: usersWithBookings > 0 ? ((usersWithBookings - usersWithAccepted) / usersWithBookings * 100).toFixed(1) : 0
        }
    };

    // Overall metrics
    const totalViews = events.filter(e => e.action === 'view_item').length;
    const totalChats = events.filter(e => e.action === 'open_chat').length;
    const totalBookings = events.filter(e => e.action === 'request_booking').length;

    return { funnel, dropoff, totalViews, totalChats, totalBookings, totalAccepted: usersWithAccepted };
}

/**
 * Update quick stats cards
 */
export function updateQuickStats(metrics) {
    document.getElementById('metricViews').textContent = metrics.totalViews;
    document.getElementById('metricChats').textContent = metrics.totalChats;
    document.getElementById('metricBookings').textContent = metrics.totalBookings;
    document.getElementById('metricAccepted').textContent = metrics.totalAccepted;

    const conversionRate = metrics.totalViews > 0
        ? ((metrics.totalBookings / metrics.totalViews) * 100).toFixed(1)
        : 0;
    document.getElementById('metricConversion').textContent = `${conversionRate}%`;
}

/**
 * Render funnel chart using Canvas
 */
export function renderFunnelChart(funnel) {
    const canvas = document.getElementById('funnelChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Funnel data
    const stages = [
        { label: 'Viewed Item', value: funnel.views, color: '#2d5a3d' },
        { label: 'Opened Chat', value: funnel.chats, color: '#3d7a52' },
        { label: 'Requested Booking', value: funnel.bookings, color: '#4ade80' },
        { label: 'Booking Accepted', value: funnel.accepted, color: '#22c55e' }
    ];

    const maxValue = Math.max(...stages.map(s => s.value), 1);
    const stageHeight = 80;
    const startY = 20;
    const maxWidth = 500;

    // Draw funnel stages
    stages.forEach((stage, index) => {
        const y = startY + (index * stageHeight);
        const widthPercent = stage.value / maxValue;
        const stageWidth = maxWidth * widthPercent;
        const x = (width - stageWidth) / 2;

        // Draw bar
        ctx.fillStyle = stage.color;
        ctx.fillRect(x, y, stageWidth, 60);

        // Draw label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(stage.label, width / 2, y + 25);

        // Draw count
        ctx.font = 'bold 20px Inter';
        ctx.fillText(stage.value.toString(), width / 2, y + 50);

        // Draw conversion rate
        if (index > 0) {
            const prevValue = stages[index - 1].value;
            const convRate = prevValue > 0 ? ((stage.value / prevValue) * 100).toFixed(1) : 0;
            ctx.fillStyle = '#666666';
            ctx.font = '12px Inter';
            ctx.fillText(`${convRate}% conversion`, width / 2, y - 5);
        }
    });

    // Update stats below chart
    const statsContainer = document.getElementById('funnelStats');
    const overallConversion = funnel.views > 0
        ? ((funnel.accepted / funnel.views) * 100).toFixed(1)
        : 0;

    statsContainer.innerHTML = `
        <div class="funnel-stat">
            <strong>Overall Conversion:</strong> ${overallConversion}% (View → Accepted)
        </div>
        <div class="funnel-stat">
            <strong>Drop-off Points:</strong>
            View→Chat: ${funnel.views - funnel.chats} users |
            Chat→Booking: ${funnel.chats - funnel.bookings} users |
            Booking→Accepted: ${funnel.bookings - funnel.accepted} users
        </div>
    `;
}

/**
 * Render drop-off analysis
 */
export function renderDropoffAnalysis(dropoff) {
    const container = document.getElementById('dropoffAnalysis');
    if (!container) return;

    const sortedSteps = Object.entries(dropoff)
        .sort((a, b) => parseFloat(b[1].dropRate) - parseFloat(a[1].dropRate));

    if (sortedSteps.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No drop-off data yet</p></div>';
        return;
    }

    container.innerHTML = sortedSteps.map(([step, data], index) => {
        const severity = data.dropRate > 50 ? 'critical' : data.dropRate > 25 ? 'warning' : 'ok';
        return `
            <div class="dropoff-item ${severity}">
                <div class="dropoff-rank">#${index + 1}</div>
                <div class="dropoff-content">
                    <h4>${step}</h4>
                    <div class="dropoff-stats">
                        <span>${data.started} started</span>
                        <span>→</span>
                        <span>${data.completed} completed</span>
                    </div>
                </div>
                <div class="dropoff-rate">
                    <div class="dropoff-percentage ${severity}">${data.dropRate}%</div>
                    <div class="dropoff-label">drop-off</div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Render timeline chart showing activity over time
 */
export function renderTimelineChart(events, currentPeriod) {
    const canvas = document.getElementById('timelineChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (events.length === 0) {
        ctx.fillStyle = '#666666';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('No activity data yet', width / 2, height / 2);
        return;
    }

    // Group events by hour/day based on period
    const now = new Date();
    const buckets = {};
    const bucketSize = currentPeriod === 'daily' ? 3600000 : // 1 hour
                       currentPeriod === 'weekly' ? 86400000 : // 1 day
                       86400000 * 7; // 1 week

    events.forEach(event => {
        const bucketKey = Math.floor(event.timestamp.getTime() / bucketSize) * bucketSize;
        if (!buckets[bucketKey]) {
            buckets[bucketKey] = { views: 0, chats: 0, bookings: 0 };
        }
        if (event.action === 'view_item') buckets[bucketKey].views++;
        if (event.action === 'open_chat') buckets[bucketKey].chats++;
        if (event.action === 'request_booking') buckets[bucketKey].bookings++;
    });

    const sortedBuckets = Object.entries(buckets)
        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
        .slice(-20); // Show last 20 buckets

    if (sortedBuckets.length === 0) return;

    const maxValue = Math.max(
        ...sortedBuckets.map(([, data]) => Math.max(data.views, data.chats, data.bookings)),
        1
    );

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const barWidth = chartWidth / sortedBuckets.length / 3.5;

    // Draw axes
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw bars
    sortedBuckets.forEach(([timestamp, data], index) => {
        const x = padding.left + (index * chartWidth / sortedBuckets.length);
        const drawBar = (value, offset, color) => {
            const barHeight = (value / maxValue) * chartHeight;
            ctx.fillStyle = color;
            ctx.fillRect(
                x + offset,
                height - padding.bottom - barHeight,
                barWidth,
                barHeight
            );
        };

        drawBar(data.views, 0, '#2d5a3d');
        drawBar(data.chats, barWidth + 2, '#4ade80');
        drawBar(data.bookings, (barWidth + 2) * 2, '#22c55e');
    });

    // Draw legend
    const legends = [
        { label: 'Views', color: '#2d5a3d' },
        { label: 'Chats', color: '#4ade80' },
        { label: 'Bookings', color: '#22c55e' }
    ];

    legends.forEach((legend, index) => {
        const legendX = width - 150 + (index === 0 ? -100 : index === 1 ? -50 : 0);
        ctx.fillStyle = legend.color;
        ctx.fillRect(legendX, 10, 15, 15);
        ctx.fillStyle = '#666666';
        ctx.font = '12px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(legend.label, legendX + 20, 22);
    });

    // Y-axis labels
    ctx.fillStyle = '#666666';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const value = Math.round((maxValue / 5) * i);
        const y = height - padding.bottom - (chartHeight / 5) * i;
        ctx.fillText(value.toString(), padding.left - 5, y + 3);
    }
}

/**
 * Render top items and categories lists
 */
export function renderTopLists(events, itemsMap) {
    // Top items by views
    const itemViewCounts = {};
    const categoryInterest = {};

    events.forEach(event => {
        if (event.action === 'view_item' && event.itemId) {
            itemViewCounts[event.itemId] = (itemViewCounts[event.itemId] || 0) + 1;
            const item = itemsMap[event.itemId];
            if (item?.category) {
                categoryInterest[item.category] = (categoryInterest[item.category] || 0) + 1;
            }
        }
    });

    const topItems = Object.entries(itemViewCounts)
        .map(([itemId, count]) => ({ itemId, count, item: itemsMap[itemId] }))
        .filter(entry => entry.item)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const topItemsList = document.getElementById('topItemsList');
    if (topItems.length === 0) {
        topItemsList.innerHTML = '<div class="empty-state"><p>No item views yet</p></div>';
    } else {
        topItemsList.innerHTML = topItems.map((entry, index) => `
            <div class="top-list-item">
                <span class="rank">#${index + 1}</span>
                <span class="item-emoji">${entry.item.emoji || '📦'}</span>
                <span class="item-name">${entry.item.name}</span>
                <span class="item-count">${entry.count} views</span>
            </div>
        `).join('');
    }

    // Top categories
    const topCategories = Object.entries(categoryInterest)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    const topCategoriesList = document.getElementById('topCategoriesList');
    if (topCategories.length === 0) {
        topCategoriesList.innerHTML = '<div class="empty-state"><p>No category data yet</p></div>';
    } else {
        topCategoriesList.innerHTML = topCategories.map((entry, index) => `
            <div class="top-list-item">
                <span class="rank">#${index + 1}</span>
                <span class="item-emoji">${ITEM_EMOJIS[entry.category] || '📦'}</span>
                <span class="category-name">${entry.category}</span>
                <span class="item-count">${entry.count} views</span>
            </div>
        `).join('');
    }
}

/**
 * Populate session selector with available sessions
 */
export function populateSessionSelector(events) {
    const sessionSelector = document.getElementById('sessionSelector');
    if (!sessionSelector) return;

    // Group events by scenarioId (from automated tests)
    const sessions = {};
    events.forEach(event => {
        const sessionId = event.scenarioId || event.userId;
        if (sessionId && event.action) {
            if (!sessions[sessionId]) {
                sessions[sessionId] = {
                    id: sessionId,
                    events: [],
                    firstEvent: event.timestamp
                };
            }
            sessions[sessionId].events.push(event);
        }
    });

    // Sort by most recent
    const sortedSessions = Object.values(sessions)
        .sort((a, b) => b.firstEvent - a.firstEvent)
        .slice(0, 20); // Show last 20 sessions

    sessionSelector.innerHTML = '<option value="">Select a session...</option>' +
        sortedSessions.map(session => {
            const eventCount = session.events.length;
            const timeStr = session.firstEvent.toLocaleString();
            const label = session.id.startsWith('auto-')
                ? `🤖 Automated Test - ${timeStr} (${eventCount} events)`
                : `👤 User Session - ${timeStr} (${eventCount} events)`;
            return `<option value="${session.id}">${label}</option>`;
        }).join('');
}

/**
 * Replay a session chronologically
 */
export function replaySession(sessionId) {
    const dashboardData = store.getState('dashboard.dashboardData');
    if (!sessionId || !dashboardData) return;

    const allEvents = dashboardData.events;
    const sessionEvents = allEvents
        .filter(e => (e.scenarioId || e.userId) === sessionId)
        .sort((a, b) => a.timestamp - b.timestamp);

    if (sessionEvents.length === 0) {
        alert('No events found for this session');
        return;
    }

    const replayLog = document.getElementById('replayLog');
    const stopBtn = document.getElementById('stopReplayBtn');
    const replayBtn = document.getElementById('replaySessionBtn');

    replayLog.innerHTML = '';
    replayBtn.disabled = true;
    stopBtn.disabled = false;

    let currentIndex = 0;

    const playNextEvent = () => {
        if (currentIndex >= sessionEvents.length) {
            stopSessionReplay();
            return;
        }

        const event = sessionEvents[currentIndex];
        const logEntry = document.createElement('div');
        logEntry.className = 'replay-event';

        const timeStr = event.timestamp.toLocaleTimeString();
        const actionName = event.action.replace(/_/g, ' ').toUpperCase();

        let details = '';
        if (event.itemName) details += ` - ${event.itemName}`;
        if (event.searchQuery) details += ` - "${event.searchQuery}"`;

        logEntry.innerHTML = `
            <span class="replay-time">${timeStr}</span>
            <span class="replay-action">${actionName}</span>
            <span class="replay-details">${details}</span>
        `;

        replayLog.appendChild(logEntry);
        replayLog.scrollTop = replayLog.scrollHeight;

        currentIndex++;
        const replayInterval = store.getState('dashboard.replayInterval');
        store.setState('dashboard.replayInterval', setTimeout(playNextEvent, 800)); // 800ms between events
    };

    playNextEvent();
}

/**
 * Stop session replay
 */
export function stopSessionReplay() {
    const replayInterval = store.getState('dashboard.replayInterval');
    if (replayInterval) {
        clearTimeout(replayInterval);
        store.setState('dashboard.replayInterval', null);
    }

    const replayBtn = document.getElementById('replaySessionBtn');
    const stopBtn = document.getElementById('stopReplayBtn');

    if (replayBtn) replayBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
}
