/**
 * Formatting utility functions
 */

/**
 * Format price for display
 * @param {number} price - Price per day
 * @returns {string} Formatted price string
 */
export function formatPrice(price) {
    return price === 0 ? "FREE" : `$${parseFloat(price).toFixed(2)}/day`;
}

/**
 * Format Firestore timestamp to time string
 * @param {Object} timestamp - Firestore Timestamp object
 * @returns {string} Formatted time string
 */
export function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format timestamp as relative time (e.g., "5m ago", "2h ago")
 * @param {Date} date - Date to format
 * @returns {string} Relative time string
 */
export function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;

    return date.toLocaleDateString();
}

/**
 * Convert a numeric weight value (0-5) to a human-readable descriptor
 * @param {number} value - Weight value from 0 (off) to 5 (very high)
 * @returns {string} Human-readable descriptor
 */
export function weightDescriptor(value) {
    if (value >= 5) return 'Very high';
    if (value === 4) return 'High';
    if (value === 3) return 'Medium';
    if (value === 2) return 'Low';
    if (value === 1) return 'Very low';
    return 'Off';
}
