/**
 * Centralized state management store
 */

import { DEFAULT_WEIGHTS } from '../utils/constants.js';

class StateStore {
    constructor() {
        this.state = {
            currentUser: null,
            currentChatId: null,
            currentItemId: null,
            currentItemData: null,
            userPreferences: {
                categories: [],
                maxPrice: null,
                dateFrom: null,
                dateTo: null,
                weights: { ...DEFAULT_WEIGHTS }
            },
            lastRankingContext: {
                query: '',
                desiredStart: null,
                desiredEnd: null
            },
            isNearBottom: true,
            chatPreviousView: null,
            unsubscribers: {
                messages: null,
                typingIndicator: null
            },
            typingTimeout: null,
            session: {
                currentSessionId: null,
                sessionStartTime: null,
                lastEventTime: null
            },
            dashboard: {
                currentPeriod: 'daily',
                dashboardData: null
            },
            replay: {
                currentPlaybackSession: null,
                currentPlaybackEvents: null,
                playbackIndex: 0,
                playbackInterval: null,
                playbackSpeed: 1,
                isPlaying: false
            },
            scroll: {
                lastScrollPosition: 0,
                scrollDebounceTimer: null
            },
            automatedTest: {
                running: false,
                scenarioId: null
            }
        };

        this.subscribers = new Map();
    }

    /**
     * Subscribe to state changes
     * @param {string} key - State key to watch
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }
        this.subscribers.get(key).push(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Set state value and notify subscribers
     * @param {string} key - State key
     * @param {*} value - New value
     */
    setState(key, value) {
        const keys = key.split('.');
        let current = this.state;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = value;
        this.notifySubscribers(key, value);
    }

    /**
     * Get state value
     * @param {string} key - State key (supports dot notation)
     * @returns {*} State value
     */
    getState(key) {
        const keys = key.split('.');
        let current = this.state;

        for (const k of keys) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[k];
        }

        return current;
    }

    /**
     * Notify all subscribers of a state change
     * @param {string} key - State key
     * @param {*} value - New value
     */
    notifySubscribers(key, value) {
        const callbacks = this.subscribers.get(key);
        if (callbacks) {
            callbacks.forEach(cb => cb(value));
        }
    }

    // Convenience getters/setters for common state
    getCurrentUser() {
        return this.state.currentUser;
    }

    setCurrentUser(user) {
        this.setState('currentUser', user);
    }

    getCurrentChatId() {
        return this.state.currentChatId;
    }

    setCurrentChatId(chatId) {
        this.setState('currentChatId', chatId);
    }

    getCurrentItemId() {
        return this.state.currentItemId;
    }

    setCurrentItemId(itemId) {
        this.setState('currentItemId', itemId);
    }

    getCurrentItemData() {
        return this.state.currentItemData;
    }

    setCurrentItemData(itemData) {
        this.setState('currentItemData', itemData);
        // Also set on window for backward compatibility
        window.currentItemData = itemData;
    }

    getUserPreferences() {
        return this.state.userPreferences;
    }

    setUserPreferences(preferences) {
        this.setState('userPreferences', preferences);
    }

    getLastRankingContext() {
        return this.state.lastRankingContext;
    }

    setLastRankingContext(context) {
        this.setState('lastRankingContext', context);
    }

    getUnsubscriber(key) {
        return this.state.unsubscribers[key];
    }

    setUnsubscriber(key, unsubscriber) {
        this.setState(`unsubscribers.${key}`, unsubscriber);
    }

    getCurrentSessionId() {
        return this.state.session.currentSessionId;
    }

    setCurrentSessionId(sessionId) {
        this.setState('session.currentSessionId', sessionId);
    }

    getAutomatedTestState() {
        return this.state.automatedTest;
    }

    setAutomatedTestState(testState) {
        this.setState('automatedTest', testState);
    }
}

// Export singleton instance
export const store = new StateStore();
