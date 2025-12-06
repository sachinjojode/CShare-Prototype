/**
 * Constants used throughout the application
 */

export const ITEM_EMOJIS = {
    "Appliances": "🧹",
    "Electronics": "🖥️",
    "Furniture": "🪑",
    "Kitchen": "🍳",
    "Other": "📦"
};

export const BOOKING_STATUSES = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    ARCHIVED: 'archived'
};

export const AVAILABILITY_TYPES = {
    ALWAYS: 'always',
    DATE_RANGE: 'dateRange',
    RECURRING: 'recurring'
};

export const DEFAULT_WEIGHTS = {
    price: 3,
    category: 3,
    availability: 3,
    urgency: 3
};

export const SCORING_CONFIG = {
    searchMatch: 0.30,
    categoryPreference: 0.20,
    availabilityOverlap: 0.20,
    urgency: 0.10,
    popularity: 0.10,
    newItemBoost: 0.10,
    price: 0.10
};
