/**
 * Item ranking algorithm
 * Ranks items based on multiple matching dimensions with user-configurable weights
 */

import { SCORING_CONFIG } from '../../utils/constants.js';
import { store } from '../../stores/stateStore.js';

/**
 * Safe date conversion helper
 * @param {*} value - Value to convert to date
 * @returns {Date|null} Date object or null
 */
function toDateSafe(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    return new Date(value);
}

/**
 * Get availability range for an item
 * @param {Object} item - Item object
 * @returns {Object} Start and end dates
 */
function availabilityRange(item) {
    const start = toDateSafe(item?.availability?.startDate) || new Date(0);
    const end = toDateSafe(item?.availability?.endDate) || new Date(8640000000000000);
    return { start, end };
}

/**
 * Rank items based on multiple matching dimensions
 *
 * @param {Array} items - Array of item objects to rank
 * @param {string} searchQuery - User's search query
 * @param {Date} desiredStart - Desired rental start date
 * @param {Date} desiredEnd - Desired rental end date
 * @returns {Array} Sorted array of items with scoring metadata
 */
export function rankItems(items, searchQuery = '', desiredStart = null, desiredEnd = null) {
    // Update ranking context in store
    store.setLastRankingContext({
        query: searchQuery || '',
        desiredStart: desiredStart || null,
        desiredEnd: desiredEnd || null
    });

    const scoringConfig = {
        weights: { ...SCORING_CONFIG },
        recencyWindowDays: 30
    };

    const query = searchQuery.toLowerCase().trim();
    const now = new Date();
    const prefs = store.getUserPreferences() || {};
    const prefCategories = prefs.categories || [];
    const targetStart = desiredStart || prefs.dateFrom || null;
    const targetEnd = desiredEnd || prefs.dateTo || null;
    const prefWeights = prefs.weights || { price: 3, category: 3, availability: 3, urgency: 3 };
    const prefMaxPrice = typeof prefs.maxPrice === 'number' ? prefs.maxPrice : null;

    const popularityValues = items.map((i) => i?.views || 0);
    const maxPopularity = Math.max(...popularityValues, 0);

    return items
        .map((item) => {
            const nameLower = (item.name || '').toLowerCase();
            const descLower = (item.description || '').toLowerCase();
            const catLower = (item.category || '').toLowerCase();

            // Search query match
            let searchScore = 0;
            if (query) {
                if (catLower === query) searchScore = 1;
                else if (catLower.includes(query)) searchScore = 0.85;
                else if (nameLower.includes(query)) searchScore = 0.7;
                else if (descLower.includes(query)) searchScore = 0.4;
            }

            // Category preference match
            const categoryPreferenceScore = prefCategories.includes(item.category) ? 1 : 0;

            // Availability overlap
            const { start, end } = availabilityRange(item);
            let availabilityScore = 0.5;
            if (targetStart || targetEnd) {
                const desiredStartDate = targetStart ? toDateSafe(targetStart) : new Date(0);
                const desiredEndDate = targetEnd ? toDateSafe(targetEnd) : new Date(8640000000000000);
                const overlaps = desiredStartDate <= end && desiredEndDate >= start;
                availabilityScore = overlaps ? 1 : 0;
            }

            // User urgency (soonest desired start gets higher score)
            let urgencyScore = 0;
            if (targetStart) {
                const desiredDate = toDateSafe(targetStart);
                const daysUntil = (desiredDate - now) / (1000 * 60 * 60 * 24);
                if (daysUntil <= 1) urgencyScore = 1;
                else if (daysUntil <= 7) urgencyScore = 0.9;
                else if (daysUntil <= 30) urgencyScore = 0.6;
                else if (daysUntil <= 90) urgencyScore = 0.3;
                else urgencyScore = 0.1;
            }

            // Popularity
            const popularityScore = maxPopularity > 0 ? Math.min((item.views || 0) / maxPopularity, 1) : 0;

            // New item boost (recently created items)
            let newItemScore = 0;
            const createdAt = toDateSafe(item.createdAt);
            if (createdAt) {
                const ageDays = (now - createdAt) / (1000 * 60 * 60 * 24);
                newItemScore = Math.max(0, 1 - ageDays / scoringConfig.recencyWindowDays);
            }

            // Price sensitivity score
            let priceScore = 0.5;
            if (prefMaxPrice !== null && typeof item.price === 'number') {
                if (item.price <= prefMaxPrice) {
                    priceScore = 1;
                } else {
                    priceScore = Math.max(0, 1 - ((item.price - prefMaxPrice) / Math.max(prefMaxPrice, 1)));
                }
            }

            const weights = scoringConfig.weights;
            const multipliers = {
                price: (prefWeights.price ?? 3) / 5,
                categoryPreference: (prefWeights.category ?? 3) / 5,
                availabilityOverlap: (prefWeights.availability ?? 3) / 5,
                urgency: (prefWeights.urgency ?? 3) / 5
            };

            const weighted = {
                searchMatch: weights.searchMatch * searchScore,
                categoryPreference: weights.categoryPreference * multipliers.categoryPreference * categoryPreferenceScore,
                availabilityOverlap: weights.availabilityOverlap * multipliers.availabilityOverlap * availabilityScore,
                urgency: weights.urgency * multipliers.urgency * urgencyScore,
                popularity: weights.popularity * popularityScore,
                newItemBoost: weights.newItemBoost * newItemScore,
                price: weights.price * multipliers.price * priceScore
            };

            const totalWeight =
                weights.searchMatch +
                (weights.categoryPreference * multipliers.categoryPreference) +
                (weights.availabilityOverlap * multipliers.availabilityOverlap) +
                (weights.urgency * multipliers.urgency) +
                weights.popularity +
                weights.newItemBoost +
                (weights.price * multipliers.price);

            const compositeScore = Object.values(weighted).reduce((a, b) => a + b, 0) / (totalWeight || 1);

            const breakdown = {
                searchRelevance: Math.round(searchScore * 100),
                categoryPreferenceMatch: Math.round(categoryPreferenceScore * 100),
                availabilityMatch: Math.round(availabilityScore * 100),
                urgencyBonus: Math.round(urgencyScore * 100),
                popularityBonus: Math.round(popularityScore * 100),
                newItemBonus: Math.round(newItemScore * 100),
                priceSensitivity: Math.round(priceScore * 100)
            };

            return {
                ...item,
                _score: compositeScore,
                matchScore: Math.round(compositeScore * 100),
                breakdown
            };
        })
        .sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score;
            const aCreated = toDateSafe(a.createdAt) || new Date(0);
            const bCreated = toDateSafe(b.createdAt) || new Date(0);
            return bCreated - aCreated;
        });
}

/**
 * Get match metrics for an item
 * @param {Object} item - Item object with ranking data
 * @returns {Object} Match score and breakdown
 */
export function getMatchMetrics(item) {
    const defaultBreakdown = {
        searchRelevance: 0,
        categoryPreferenceMatch: 0,
        availabilityMatch: 0,
        urgencyBonus: 0,
        popularityBonus: 0,
        newItemBonus: 0,
        priceSensitivity: 0
    };

    const rawScore = typeof item?.matchScore === 'number'
        ? item.matchScore
        : Math.round(((item?._score || 0) * 100));

    const breakdown = { ...defaultBreakdown, ...(item?.breakdown || {}) };
    const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

    return {
        matchScore: clamp(rawScore),
        breakdown: Object.fromEntries(
            Object.entries(breakdown).map(([key, value]) => [key, clamp(value)])
        )
    };
}

/**
 * Get color for match score
 * @param {number} score - Match score (0-100)
 * @returns {string} Color hex code
 */
function getScoreColor(score) {
    if (score >= 70) return '#22c55e'; // Green
    if (score >= 40) return '#f59e0b'; // Yellow
    return '#9ca3af'; // Grey
}

/**
 * Render match breakdown HTML for an item
 * @param {Object} item - Item with ranking data
 * @returns {string} HTML string
 */
export function renderMatchBreakdown(item) {
    const { matchScore, breakdown } = getMatchMetrics(item);
    const color = getScoreColor(matchScore);
    const circumference = 2 * Math.PI * 28; // radius = 28
    const progress = ((100 - matchScore) / 100) * circumference;

    return `
        <div class="match-section">
            <div class="match-score">
                <div class="match-score-circle">
                    <svg width="70" height="70" viewBox="0 0 70 70">
                        <circle cx="35" cy="35" r="28" fill="none" stroke="#e5e7eb" stroke-width="6"/>
                        <circle cx="35" cy="35" r="28" fill="none" stroke="${color}" stroke-width="6"
                                stroke-dasharray="${circumference}" stroke-dashoffset="${progress}"
                                stroke-linecap="round"/>
                    </svg>
                    <div class="match-score-number">${matchScore}</div>
                </div>
                <div class="match-score-label">Match Score</div>
            </div>
            <details class="match-breakdown" onclick="event.stopPropagation()">
                <summary>Why this item matches?</summary>
                <ul>
                    <li><span>Search relevance</span><span>${breakdown.searchRelevance}/100</span></li>
                    <li><span>Category preference match</span><span>${breakdown.categoryPreferenceMatch}/100</span></li>
                    <li><span>Availability match</span><span>${breakdown.availabilityMatch}/100</span></li>
                    <li><span>Urgency bonus</span><span>${breakdown.urgencyBonus}/100</span></li>
                    <li><span>Popularity bonus</span><span>${breakdown.popularityBonus}/100</span></li>
                    <li><span>New-item bonus</span><span>${breakdown.newItemBonus}/100</span></li>
                    <li><span>Price sensitivity</span><span>${breakdown.priceSensitivity}/100</span></li>
                </ul>
            </details>
        </div>
    `;
}
