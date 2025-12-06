/**
 * Automated Testing Module
 * Handles automated user testing and test scenarios
 */

import {
    getFirestore,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { store } from '../../stores/stateStore.js';

// Module state
let db = null;
let currentUser = null;

// Automated test state
const automatedTestState = { running: false, scenarioId: null };

// Helper function for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Initialize the automated test module
 */
export function initAutomatedTest(firestoreInstance, user) {
    db = firestoreInstance;
    currentUser = user;
}

/**
 * Set automated test status message
 * @param {string} text - Status text to display
 */
export function setAutoTestStatus(text) {
    const el = document.getElementById('autoTestStatus');
    if (el) el.textContent = text;
}

/**
 * Append message to automated test log
 * @param {string} message - Log message
 */
export function appendAutoTestLog(message) {
    const logContainer = document.getElementById('autoTestLog');
    if (!logContainer) return;
    const entry = document.createElement('div');
    entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * Pick a test item for automated testing
 * @param {string} preferredCategory - Optional preferred category
 * @returns {Object} Selected item or null
 */
export async function pickTestItem(preferredCategory = null) {
    const rankingIndex = store.getState().ranking.index || {};
    const rankedItems = Object.values(rankingIndex);
    const ordered = preferredCategory
        ? rankedItems.filter(i => i.category === preferredCategory).concat(rankedItems)
        : rankedItems;

    const candidate = ordered.find(i => i.ownerId !== currentUser?.uid) || ordered[0];
    if (candidate) return candidate;

    // Fallback to database query
    const snapshot = await getDocs(collection(db, 'items'));
    let fallback = null;
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const item = { id: docSnap.id, ...data };
        if (!fallback || (currentUser && item.ownerId !== currentUser.uid)) {
            fallback = item;
        }
    });
    return fallback;
}

/**
 * Run automated user test scenario
 * Requires external functions to be passed via window object:
 * - window.logAnalytics
 * - window.searchItems
 * - window.showItemDetail
 * - window.openBookingModal
 * - window.submitBookingRequest
 */
export async function runAutomatedUserTest() {
    if (automatedTestState.running) {
        appendAutoTestLog('Test already running.');
        return;
    }
    if (!currentUser) {
        alert('Please sign in to run automated tests.');
        return;
    }

    automatedTestState.running = true;
    automatedTestState.scenarioId = `auto-${Date.now()}`;
    setAutoTestStatus('Running');
    appendAutoTestLog('Starting automated user test.');

    try {
        // Get user preferences from store
        const userPreferences = store.getState().preferences.data || {};
        const ITEM_EMOJIS = store.getState().constants?.ITEM_EMOJIS || {};

        // Search step
        const searchTerm = (userPreferences?.categories?.[0]) || Object.keys(ITEM_EMOJIS)[0] || 'Electronics';
        document.getElementById('searchInput').value = searchTerm;

        if (window.logAnalytics) {
            await window.logAnalytics('auto_test_step', null, {
                scenarioId: automatedTestState.scenarioId,
                step: 'search',
                searchTerm
            });
        }

        if (window.searchItems) {
            await window.searchItems();
        }

        appendAutoTestLog(`Searched for "${searchTerm}".`);
        await sleep(1000);

        // Pick test item
        const testItem = await pickTestItem(userPreferences?.categories?.[0]);
        if (!testItem) {
            appendAutoTestLog('No items available to test.');
            setAutoTestStatus('Idle');
            automatedTestState.running = false;
            return;
        }

        // View item step
        if (window.logAnalytics) {
            await window.logAnalytics('auto_test_step', testItem.id, {
                scenarioId: automatedTestState.scenarioId,
                step: 'view_item',
                itemName: testItem.name
            });
        }

        if (window.showItemDetail) {
            await window.showItemDetail(testItem.id);
        }

        appendAutoTestLog(`Opened item detail for ${testItem.name}.`);
        await sleep(1000);

        // Booking step (only if not owner)
        if (testItem.ownerId !== currentUser.uid) {
            if (window.openBookingModal) {
                window.openBookingModal(testItem.id);
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() + 1);
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 3);

            const startDateInput = document.getElementById('bookingStartDate');
            const endDateInput = document.getElementById('bookingEndDate');

            if (startDateInput && endDateInput) {
                startDateInput.value = startDate.toISOString().split('T')[0];
                endDateInput.value = endDate.toISOString().split('T')[0];
            }

            if (window.logAnalytics) {
                await window.logAnalytics('auto_test_step', testItem.id, {
                    scenarioId: automatedTestState.scenarioId,
                    step: 'booking_request',
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                });
            }

            if (window.submitBookingRequest) {
                await window.submitBookingRequest({ preventDefault: () => {} });
            }

            appendAutoTestLog('Submitted booking request.');
        } else {
            appendAutoTestLog('Skipped booking (user is owner).');
        }

        await sleep(1000);
        setAutoTestStatus('Idle');
        automatedTestState.running = false;
        appendAutoTestLog('Test completed successfully.');
    } catch (error) {
        console.error('Automated test error:', error);
        appendAutoTestLog(`Error: ${error.message}`);
        setAutoTestStatus('Error');
        automatedTestState.running = false;
    }
}

/**
 * Get current test state
 */
export function getTestState() {
    return { ...automatedTestState };
}

/**
 * Export the sleep helper for use by other modules
 */
export { sleep };
