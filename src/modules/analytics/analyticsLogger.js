/**
 * Analytics Logger Module
 * Simple analytics logging for user actions
 */

import { firebaseService, collection, addDoc, serverTimestamp } from '../../services/firebaseService.js';
import { store } from '../../stores/stateStore.js';

/**
 * Log analytics event to Firestore
 * @param {string} action - Action name (e.g., 'item_view', 'search', 'booking_created')
 * @param {string|null} itemId - Optional item ID related to the action
 * @param {Object} additionalData - Additional data to log with the event
 */
export async function logAnalytics(action, itemId = null, additionalData = {}) {
    const currentUser = store.getCurrentUser();
    if (!currentUser) return;

    try {
        await firebaseService.addDoc(
            firebaseService.collection('analytics'),
            {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                itemId: itemId,
                action: action,
                timestamp: serverTimestamp(),
                ...additionalData
            }
        );
    } catch (error) {
        console.error('Error logging analytics:', error);
        // Non-critical error, don't interrupt user flow
    }
}
