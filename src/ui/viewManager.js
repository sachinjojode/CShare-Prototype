/**
 * View Manager
 * Handles view switching and navigation
 */

import { store } from '../stores/stateStore.js';

/**
 * Show a specific view and hide all others
 * @param {string} viewId - ID of the view to show
 * @param {Function} trackViewChange - Optional callback to track view changes
 */
export function showView(viewId, trackViewChange = null) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');

    // Track view change in session recording if callback provided
    if (trackViewChange) {
        const currentSessionId = store.getCurrentSessionId();
        if (currentSessionId) {
            trackViewChange(viewId);
        }
    }
}
