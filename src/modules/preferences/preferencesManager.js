/**
 * Preferences Manager Module
 * Handles user preferences loading, saving, and UI management
 */

import { store } from '../../stores/stateStore.js';
import { firebaseService, doc, Timestamp } from '../../services/firebaseService.js';
import { weightDescriptor } from '../../utils/formatters.js';
import { DEFAULT_WEIGHTS } from '../../utils/constants.js';

/**
 * Load user preferences from Firestore
 * Fetches and stores user preferences in the state store
 */
export async function loadUserPreferences() {
    const currentUser = store.getCurrentUser();
    if (!currentUser) return;

    try {
        const prefDocRef = doc(firebaseService.getDb(), 'users', currentUser.uid, 'preferences', 'default');
        const prefDoc = await firebaseService.getDoc(prefDocRef);

        if (prefDoc.exists()) {
            const data = prefDoc.data();
            const userPreferences = {
                categories: data.categories || [],
                maxPrice: typeof data.maxPrice === 'number' ? data.maxPrice : null,
                dateFrom: data.dateFrom ? data.dateFrom.toDate() : null,
                dateTo: data.dateTo ? data.dateTo.toDate() : null,
                weights: {
                    price: typeof data.weights?.price === 'number' ? data.weights.price : DEFAULT_WEIGHTS.price,
                    category: typeof data.weights?.category === 'number' ? data.weights.category : DEFAULT_WEIGHTS.category,
                    availability: typeof data.weights?.availability === 'number' ? data.weights.availability : DEFAULT_WEIGHTS.availability,
                    urgency: typeof data.weights?.urgency === 'number' ? data.weights.urgency : DEFAULT_WEIGHTS.urgency
                }
            };
            store.setUserPreferences(userPreferences);
        } else {
            // Set default preferences
            const defaultPreferences = {
                categories: [],
                maxPrice: null,
                dateFrom: null,
                dateTo: null,
                weights: { ...DEFAULT_WEIGHTS }
            };
            store.setUserPreferences(defaultPreferences);
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
        // Set default preferences on error
        const defaultPreferences = {
            categories: [],
            maxPrice: null,
            dateFrom: null,
            dateTo: null,
            weights: { ...DEFAULT_WEIGHTS }
        };
        store.setUserPreferences(defaultPreferences);
    }
}

/**
 * Open preferences modal and populate with current preferences
 */
export function openPreferencesModal() {
    const modal = document.getElementById('preferencesModal');
    if (!modal) return;

    modal.classList.add('active');

    const userPreferences = store.getUserPreferences();

    // Set category checkboxes
    const categories = userPreferences?.categories || [];
    document.querySelectorAll('input[name="prefCategory"]').forEach(box => {
        box.checked = categories.includes(box.value);
    });

    // Set weight sliders
    const weights = userPreferences?.weights || { ...DEFAULT_WEIGHTS };
    const sliders = [
        { id: 'weightPrice', value: weights.price },
        { id: 'weightCategory', value: weights.category },
        { id: 'weightAvailability', value: weights.availability },
        { id: 'weightUrgency', value: weights.urgency }
    ];
    sliders.forEach(({ id, value }) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
        const label = document.getElementById(`${id}Value`);
        if (label) label.textContent = value;
    });

    // Update preview with current weights
    updatePreferencesPreview();

    // Set max price
    const maxPriceInput = document.getElementById('preferencesMaxPrice');
    if (maxPriceInput) {
        maxPriceInput.value = userPreferences?.maxPrice ?? '';
    }

    // Set date range
    const dateFromInput = document.getElementById('preferencesDateFrom');
    const dateToInput = document.getElementById('preferencesDateTo');
    if (dateFromInput) {
        dateFromInput.value = userPreferences?.dateFrom ? userPreferences.dateFrom.toISOString().split('T')[0] : '';
    }
    if (dateToInput) {
        dateToInput.value = userPreferences?.dateTo ? userPreferences.dateTo.toISOString().split('T')[0] : '';
    }
}

/**
 * Close preferences modal
 */
export function closePreferencesModal() {
    const modal = document.getElementById('preferencesModal');
    if (!modal) return;

    modal.classList.remove('active');

    const form = document.getElementById('preferencesForm');
    if (form) {
        form.reset();
    }
}

/**
 * Update preferences preview with weight descriptors
 * Shows human-readable labels for weight sliders
 */
export function updatePreferencesPreview() {
    const price = weightDescriptor(parseInt(document.getElementById('weightPrice')?.value || 3));
    const category = weightDescriptor(parseInt(document.getElementById('weightCategory')?.value || 3));
    const availability = weightDescriptor(parseInt(document.getElementById('weightAvailability')?.value || 3));
    const urgency = weightDescriptor(parseInt(document.getElementById('weightUrgency')?.value || 3));

    const labelMap = {
        weightPrice: price,
        weightCategory: category,
        weightAvailability: availability,
        weightUrgency: urgency
    };

    Object.entries(labelMap).forEach(([id, val]) => {
        const label = document.getElementById(`${id}Value`);
        if (label) label.textContent = val;
    });
}

/**
 * Save user preferences to Firestore including multi-weight sliders
 * Weights are stored on a 0-5 scale for: price, category, availability, urgency
 * These weights adjust the ranking algorithm to personalize item recommendations
 * @param {Event} event - Form submission event
 */
export async function savePreferences(event) {
    event.preventDefault();

    const currentUser = store.getCurrentUser();
    if (!currentUser) {
        alert('You must be logged in to save preferences');
        return;
    }

    // Collect form data
    const categories = Array.from(document.querySelectorAll('input[name="prefCategory"]:checked')).map(c => c.value);
    const maxPriceValue = document.getElementById('preferencesMaxPrice')?.value;
    const dateFromStr = document.getElementById('preferencesDateFrom')?.value;
    const dateToStr = document.getElementById('preferencesDateTo')?.value;

    const weights = {
        price: parseInt(document.getElementById('weightPrice')?.value || DEFAULT_WEIGHTS.price, 10),
        category: parseInt(document.getElementById('weightCategory')?.value || DEFAULT_WEIGHTS.category, 10),
        availability: parseInt(document.getElementById('weightAvailability')?.value || DEFAULT_WEIGHTS.availability, 10),
        urgency: parseInt(document.getElementById('weightUrgency')?.value || DEFAULT_WEIGHTS.urgency, 10)
    };

    const maxPrice = maxPriceValue === '' ? null : parseFloat(maxPriceValue);
    const dateFrom = dateFromStr ? new Date(dateFromStr + 'T00:00:00') : null;
    const dateTo = dateToStr ? new Date(dateToStr + 'T00:00:00') : null;

    try {
        const prefDocRef = doc(firebaseService.getDb(), 'users', currentUser.uid, 'preferences', 'default');
        await firebaseService.setDoc(prefDocRef, {
            categories,
            maxPrice: Number.isNaN(maxPrice) ? null : maxPrice,
            dateFrom: dateFrom ? Timestamp.fromDate(dateFrom) : null,
            dateTo: dateTo ? Timestamp.fromDate(dateTo) : null,
            weights
        });

        // Update store
        const updatedPreferences = {
            categories,
            maxPrice: Number.isNaN(maxPrice) ? null : maxPrice,
            dateFrom,
            dateTo,
            weights
        };
        store.setUserPreferences(updatedPreferences);

        closePreferencesModal();

        // Reload items if loadItems function exists
        if (window.loadItems) {
            await window.loadItems();
        }

        alert('✅ Preferences saved');
    } catch (error) {
        console.error('Error saving preferences:', error);
        alert('Failed to save preferences. Please try again.');
    }
}
