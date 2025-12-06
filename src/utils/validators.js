/**
 * Validation utility functions
 */

import { AVAILABILITY_TYPES } from './constants.js';

/**
 * Build lock IDs for booking date range
 * @param {string} itemId - Item ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array<string>} Array of lock IDs
 */
export function buildLockIds(itemId, startDate, endDate) {
    const ids = [];
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    while (cursor <= end) {
        ids.push(`${itemId}_${cursor.toISOString().split('T')[0]}`);
        cursor.setDate(cursor.getDate() + 1);
    }
    return ids;
}

/**
 * Validate if dates are within item's availability
 * @param {Object} item - Item object with availability data
 * @param {Date} requestedStart - Requested start date
 * @param {Date} requestedEnd - Requested end date
 * @returns {Object} Validation result with { valid: boolean, message: string }
 */
export function validateAvailability(item, requestedStart, requestedEnd) {
    const availability = item.availability || {};

    if (availability.type === AVAILABILITY_TYPES.ALWAYS) {
        return { valid: true };
    }

    if (availability.type === AVAILABILITY_TYPES.DATE_RANGE) {
        const availStart = availability.startDate?.toDate();
        const availEnd = availability.endDate?.toDate();

        if (availStart && requestedStart < availStart) {
            return {
                valid: false,
                message: `Item is only available from ${availStart.toLocaleDateString()}`
            };
        }

        if (availEnd && requestedEnd > availEnd) {
            return {
                valid: false,
                message: `Item is only available until ${availEnd.toLocaleDateString()}`
            };
        }

        return { valid: true };
    }

    if (availability.type === AVAILABILITY_TYPES.RECURRING) {
        // Check if booking spans multiple days
        if (requestedStart.toDateString() !== requestedEnd.toDateString()) {
            return {
                valid: false,
                message: 'Recurring availability items can only be booked for same-day use'
            };
        }

        const dayOfWeek = requestedStart.getDay();
        const availableDays = availability.daysOfWeek || [];

        if (!availableDays.includes(dayOfWeek)) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const availableDayNames = availableDays.map(d => dayNames[d]).join(', ');
            return {
                valid: false,
                message: `Item is only available on: ${availableDayNames}`
            };
        }

        return { valid: true };
    }

    return { valid: false, message: 'Unknown availability type' };
}

/**
 * Validate booking dates
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Validation result
 */
export function validateBookingDates(startDate, endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
        return {
            valid: false,
            message: 'Start date cannot be in the past'
        };
    }

    if (endDate < startDate) {
        return {
            valid: false,
            message: 'End date must be after start date'
        };
    }

    return { valid: true };
}
