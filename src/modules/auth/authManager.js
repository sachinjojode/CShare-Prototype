/**
 * Authentication Manager Module
 * Handles user authentication state and logout
 */

import { store } from '../../stores/stateStore.js';
import { firebaseService } from '../../services/firebaseService.js';

/**
 * Setup authentication state listener
 * Monitors Firebase auth state changes and updates store
 * @param {Function} onAuthSuccess - Callback when user is authenticated
 * @param {Function} onAuthFailure - Callback when user is not authenticated
 * @returns {Function} Unsubscribe function
 */
export function setupAuthListener(onAuthSuccess, onAuthFailure) {
    return firebaseService.onAuthStateChanged((user) => {
        if (user && user.email.endsWith('.edu')) {
            store.setCurrentUser(user);
            if (onAuthSuccess) {
                onAuthSuccess(user);
            }
        } else {
            store.setCurrentUser(null);
            if (onAuthFailure) {
                onAuthFailure();
            }
        }
    });
}

/**
 * Logout current user
 * Signs out from Firebase and redirects to login page
 */
export async function logout() {
    try {
        // Finish session recording before auth state clears
        const maybeEndSessionRecording = await import('../analytics/sessionRecorder.js');
        if (maybeEndSessionRecording?.endSessionRecording) {
            await maybeEndSessionRecording.endSessionRecording();
        }

        await firebaseService.signOut();
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error signing out:', error);
        alert('Failed to sign out. Please try again.');
    }
}

/**
 * Get current user display name
 * @returns {string} User display name or email prefix
 */
export function getCurrentUserDisplayName() {
    const currentUser = store.getCurrentUser();
    if (!currentUser) return '';
    return currentUser.displayName || currentUser.email.split('@')[0];
}

/**
 * Update current user display in UI
 */
export function updateCurrentUserDisplay() {
    const userName = getCurrentUserDisplayName();
    const userNameElement = document.getElementById('currentUserName');
    if (userNameElement) {
        userNameElement.textContent = userName;
    }
}
