/**
 * Data Cleaner Module
 * Handles clearing of analytics and session data for testing
 */

import {
    getFirestore,
    collection,
    getDocs,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Module state
let db = null;

/**
 * Initialize the data cleaner module
 */
export function initDataCleaner(firestoreInstance) {
    db = firestoreInstance;
}

/**
 * Clear all analytics data
 * Requires window.refreshDashboardData to be available
 */
export async function clearAnalyticsData() {
    const statusDiv = document.getElementById('clearDataStatus');

    if (!confirm('⚠️ Are you sure you want to delete ALL analytics data? This cannot be undone!')) {
        return;
    }

    try {
        if (statusDiv) {
            statusDiv.className = 'clear-status loading';
            statusDiv.textContent = '🔄 Deleting analytics data...';
        }

        const analyticsSnapshot = await getDocs(collection(db, 'analytics'));
        const deletePromises = [];

        analyticsSnapshot.forEach((doc) => {
            deletePromises.push(deleteDoc(doc.ref));
        });

        await Promise.all(deletePromises);

        if (statusDiv) {
            statusDiv.className = 'clear-status success';
            statusDiv.textContent = `✅ Successfully deleted ${deletePromises.length} analytics records`;
        }

        // Refresh dashboard if function is available
        if (window.refreshDashboardData) {
            await window.refreshDashboardData();
        }

        setTimeout(() => {
            if (statusDiv) {
                statusDiv.className = 'clear-status';
            }
        }, 5000);

    } catch (error) {
        console.error('Error clearing analytics:', error);
        if (statusDiv) {
            statusDiv.className = 'clear-status error';
            statusDiv.textContent = `❌ Error: ${error.message}`;
        }
    }
}

/**
 * Clear all sessions data (including events subcollections)
 * Requires window.refreshDashboardData to be available
 */
export async function clearSessionsData() {
    const statusDiv = document.getElementById('clearDataStatus');

    if (!confirm('⚠️ Are you sure you want to delete ALL session data? This cannot be undone!')) {
        return;
    }

    try {
        if (statusDiv) {
            statusDiv.className = 'clear-status loading';
            statusDiv.textContent = '🔄 Deleting sessions data...';
        }

        const sessionsSnapshot = await getDocs(collection(db, 'sessions'));
        const deletePromises = [];

        for (const sessionDoc of sessionsSnapshot.docs) {
            // Delete subcollection events first
            const eventsSnapshot = await getDocs(collection(db, 'sessions', sessionDoc.id, 'events'));
            eventsSnapshot.forEach((eventDoc) => {
                deletePromises.push(deleteDoc(eventDoc.ref));
            });

            // Delete session document
            deletePromises.push(deleteDoc(sessionDoc.ref));
        }

        await Promise.all(deletePromises);

        if (statusDiv) {
            statusDiv.className = 'clear-status success';
            statusDiv.textContent = `✅ Successfully deleted ${sessionsSnapshot.size} sessions with their events`;
        }

        // Refresh dashboard if function is available
        if (window.refreshDashboardData) {
            await window.refreshDashboardData();
        }

        setTimeout(() => {
            if (statusDiv) {
                statusDiv.className = 'clear-status';
            }
        }, 5000);

    } catch (error) {
        console.error('Error clearing sessions:', error);
        if (statusDiv) {
            statusDiv.className = 'clear-status error';
            statusDiv.textContent = `❌ Error: ${error.message}`;
        }
    }
}

/**
 * Clear all testing data (both analytics and sessions)
 * Requires window.refreshDashboardData to be available
 */
export async function clearAllTestingData() {
    const statusDiv = document.getElementById('clearDataStatus');

    if (!confirm('⚠️⚠️ WARNING ⚠️⚠️\n\nThis will delete ALL analytics AND session data!\n\nThis action CANNOT be undone.\n\nAre you absolutely sure?')) {
        return;
    }

    try {
        if (statusDiv) {
            statusDiv.className = 'clear-status loading';
            statusDiv.textContent = '🔄 Deleting all testing data...';
        }

        let totalDeleted = 0;

        // Delete analytics
        const analyticsSnapshot = await getDocs(collection(db, 'analytics'));
        const analyticsPromises = [];
        analyticsSnapshot.forEach((doc) => {
            analyticsPromises.push(deleteDoc(doc.ref));
        });
        await Promise.all(analyticsPromises);
        totalDeleted += analyticsPromises.length;

        // Delete sessions and their events
        const sessionsSnapshot = await getDocs(collection(db, 'sessions'));
        const sessionsPromises = [];

        for (const sessionDoc of sessionsSnapshot.docs) {
            const eventsSnapshot = await getDocs(collection(db, 'sessions', sessionDoc.id, 'events'));
            eventsSnapshot.forEach((eventDoc) => {
                sessionsPromises.push(deleteDoc(eventDoc.ref));
                totalDeleted++;
            });
            sessionsPromises.push(deleteDoc(sessionDoc.ref));
        }

        await Promise.all(sessionsPromises);
        totalDeleted += sessionsSnapshot.size;

        if (statusDiv) {
            statusDiv.className = 'clear-status success';
            statusDiv.textContent = `✅ Successfully deleted ${totalDeleted} total records (${analyticsPromises.length} analytics + ${sessionsSnapshot.size} sessions)`;
        }

        // Refresh dashboard if function is available
        if (window.refreshDashboardData) {
            await window.refreshDashboardData();
        }

        setTimeout(() => {
            if (statusDiv) {
                statusDiv.className = 'clear-status';
            }
        }, 5000);

    } catch (error) {
        console.error('Error clearing all data:', error);
        if (statusDiv) {
            statusDiv.className = 'clear-status error';
            statusDiv.textContent = `❌ Error: ${error.message}`;
        }
    }
}
