/**
 * Item Manager Module
 * Handles item creation, updates, loading, and bookings management
 */

import { firebaseService, collection, query, where, orderBy, serverTimestamp, Timestamp, arrayUnion } from '../../services/firebaseService.js';
import { store } from '../../stores/stateStore.js';
import { ITEM_EMOJIS } from '../../utils/constants.js';
import { formatPrice } from '../../utils/formatters.js';
import { rankItems } from '../ranking/rankingAlgorithm.js';
import { renderItems } from '../../ui/itemRenderer.js';

/**
 * Load items from Firestore and render them
 * Fetches all items, ranks them, and displays in the items grid
 */
export async function loadItems() {
    try {
        const itemsSnapshot = await firebaseService.getDocs(
            firebaseService.collection('items')
        );
        const itemsArray = [];

        itemsSnapshot.forEach((doc) => {
            itemsArray.push({ id: doc.id, ...doc.data() });
        });

        // Rank items by popularity and availability
        const rankedItems = rankItems(itemsArray, '');
        renderItems(rankedItems);
    } catch (error) {
        console.error('Error loading items:', error);
        document.getElementById('itemsGrid').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-emoji">❌</div>
                <p>Error loading items. Please refresh the page.</p>
            </div>
        `;
    }
}

/**
 * Collect availability data from form
 * @param {string} prefix - Form field prefix ('edit' for edit form, '' for create form)
 * @returns {Object} Availability configuration
 */
export function collectAvailabilityData(prefix = '') {
    const typeId = prefix ? 'editAvailabilityType' : 'availabilityType';
    const type = document.getElementById(typeId).value;

    if (type === 'always') {
        return { type: 'always' };
    } else if (type === 'dateRange') {
        const fromId = prefix ? 'editAvailableFrom' : 'availableFrom';
        const untilId = prefix ? 'editAvailableUntil' : 'availableUntil';
        const availableFromStr = document.getElementById(fromId).value;
        const availableUntilStr = document.getElementById(untilId).value;

        const availability = {
            type: 'dateRange',
            startDate: availableFromStr ? Timestamp.fromDate(new Date(availableFromStr + 'T00:00:00')) : null,
            endDate: availableUntilStr ? Timestamp.fromDate(new Date(availableUntilStr + 'T00:00:00')) : null
        };

        // Validate dates
        if (availability.startDate && availability.endDate) {
            if (availability.endDate.toDate() <= availability.startDate.toDate()) {
                throw new Error('Available Until date must be after Available From date');
            }
        }

        return availability;
    } else if (type === 'recurring') {
        const days = [];
        const dayPrefix = prefix ? 'edit-day-' : 'day-';
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
            const checkbox = document.getElementById(dayPrefix + day);
            if (checkbox && checkbox.checked) {
                days.push(parseInt(checkbox.value));
            }
        });

        if (days.length === 0) {
            throw new Error('Please select at least one day of the week');
        }

        return {
            type: 'recurring',
            daysOfWeek: days
        };
    }
}

/**
 * Collect handover time data from form (separate from availability)
 * @param {string} prefix - Form field prefix ('edit' for edit form, '' for create form)
 * @returns {Object|null} Handover time configuration or null if not specified
 */
export function collectHandoverTime(prefix = '') {
    const timeStartId = prefix ? 'editHandoverTimeStart' : 'handoverTimeStart';
    const timeEndId = prefix ? 'editHandoverTimeEnd' : 'handoverTimeEnd';
    const timeStart = document.getElementById(timeStartId).value;
    const timeEnd = document.getElementById(timeEndId).value;

    // Validate time range if both provided
    if (timeStart && timeEnd && timeStart >= timeEnd) {
        throw new Error('Handover end time must be after start time');
    }

    // Return null if no time specified (flexible all day)
    if (!timeStart && !timeEnd) {
        return null;
    }

    return {
        start: timeStart || null,
        end: timeEnd || null
    };
}

/**
 * Create a new listing
 * @param {Event} event - Form submit event
 */
export async function createListing(event) {
    event.preventDefault();

    const currentUser = store.getCurrentUser();
    if (!currentUser) {
        alert('You must be logged in to create a listing');
        return;
    }

    const name = document.getElementById('itemName').value;
    const category = document.getElementById('itemCategory').value;
    const description = document.getElementById('itemDescription').value;
    const price = parseFloat(document.getElementById('itemPrice').value);

    try {
        const availability = collectAvailabilityData();
        const handoverTime = collectHandoverTime();

        await firebaseService.addDoc(
            firebaseService.collection('items'),
            {
                name,
                category,
                description,
                price,
                emoji: ITEM_EMOJIS[category],
                ownerId: currentUser.uid,
                ownerName: currentUser.displayName || currentUser.email.split('@')[0],
                ownerEmail: currentUser.email,
                availability,
                handoverTime,
                views: 0,
                createdAt: serverTimestamp()
            }
        );

        // Reset form
        event.target.reset();

        // Reload items and show home
        await loadItems();
        alert('✅ Listing created successfully!');

        // Call showView if it exists globally
        if (typeof window.showView === 'function') {
            window.showView('homeView');
        }
    } catch (error) {
        console.error('Error creating listing:', error);
        alert(error.message || 'Failed to create listing. Please try again.');
    }
}

/**
 * Update an existing listing
 * @param {Event} event - Form submit event
 */
export async function updateListing(event) {
    event.preventDefault();

    const itemId = document.getElementById('editItemId').value;
    const name = document.getElementById('editItemName').value;
    const category = document.getElementById('editItemCategory').value;
    const description = document.getElementById('editItemDescription').value;
    const price = parseFloat(document.getElementById('editItemPrice').value);

    try {
        const availability = collectAvailabilityData('edit');
        const handoverTime = collectHandoverTime('edit');

        await firebaseService.updateDoc(
            firebaseService.doc('items', itemId),
            {
                name,
                category,
                description,
                price,
                emoji: ITEM_EMOJIS[category],
                availability,
                handoverTime,
                updatedAt: serverTimestamp()
            }
        );

        alert('✅ Listing updated successfully!');

        // Call showView if it exists globally
        if (typeof window.showView === 'function') {
            window.showView('homeView');
        }

        await loadItems();
    } catch (error) {
        console.error('Error updating listing:', error);
        alert(error.message || 'Failed to update listing. Please try again.');
    }
}

/**
 * Load user's items
 * Displays all items owned by the current user
 */
export async function loadMyItems() {
    const currentUser = store.getCurrentUser();
    if (!currentUser) return;

    try {
        const q = query(
            firebaseService.collection('items'),
            where('ownerId', '==', currentUser.uid)
        );

        const querySnapshot = await firebaseService.getDocs(q);
        const myItems = [];

        querySnapshot.forEach((doc) => {
            myItems.push({ id: doc.id, ...doc.data() });
        });

        const grid = document.getElementById('myItemsGrid');

        if (myItems.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-emoji">📦</div>
                    <p>You haven't listed any items yet</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = myItems.map(item => `
            <div class="item-card" onclick="editItem('${item.id}')" style="cursor: pointer;">
                <div class="item-emoji">${item.emoji || '📦'}</div>
                <h3>${item.name}</h3>
                <span class="item-category">${item.category}</span>
                <p>${item.description.substring(0, 80)}...</p>
                <div class="item-price">${formatPrice(item.price)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading my items:', error);
        alert('Error loading your items');
    }
}

/**
 * Load bookings for renter dashboard
 * Displays all bookings made by the current user, organized by status
 */
export async function loadMyBookings() {
    const currentUser = store.getCurrentUser();
    if (!currentUser) return;

    try {
        const q = query(
            firebaseService.collection('bookings'),
            where('renterId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await firebaseService.getDocs(q);
        const groups = {
            pending: [],
            accepted: [],
            declined: [],
            archived: []
        };

        snapshot.forEach((docSnap) => {
            const booking = { id: docSnap.id, ...docSnap.data() };
            const normalized = booking.status === 'confirmed' ? 'accepted' : booking.status;
            const status = normalized || 'pending';
            if (groups[status]) {
                groups[status].push(booking);
            }
        });

        const sections = {
            pending: document.getElementById('myBookingsPending'),
            accepted: document.getElementById('myBookingsConfirmed'),
            declined: document.getElementById('myBookingsDeclined'),
            archived: document.getElementById('myBookingsArchived')
        };

        Object.entries(groups).forEach(([status, bookings]) => {
            const container = sections[status];
            if (!container) return;

            if (bookings.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-emoji">📅</div>
                        <p>No ${status} bookings</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = bookings.map(booking => {
                const startDate = booking.startDate.toDate().toLocaleDateString();
                const endDate = booking.endDate.toDate().toLocaleDateString();
                const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isBookedRange = status === 'accepted';
                const badge = isBookedRange
                    ? '<span class="booking-status status-unavailable">Unavailable (Booked)</span>'
                    : `<span class="booking-status status-${status}">${statusLabel}</span>`;

                return `
                    <div class="booking-request-card">
                        <div class="booking-header">
                            <h3>${booking.itemName}</h3>
                            ${badge}
                        </div>
                        <div class="booking-details">
                            <div class="booking-info">
                                <strong>Owner:</strong> ${booking.ownerName} (${booking.ownerEmail})
                            </div>
                            <div class="booking-info">
                                <strong>Dates:</strong> ${startDate} - ${endDate}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        });
    } catch (error) {
        console.error('Error loading my bookings:', error);
        alert('Error loading your bookings');
    }
}

/**
 * Load bookings for owner dashboard
 * Displays all booking requests for items owned by the current user
 */
export async function loadOwnerBookings() {
    const currentUser = store.getCurrentUser();
    if (!currentUser) return;

    try {
        const q = query(
            firebaseService.collection('bookings'),
            where('ownerId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await firebaseService.getDocs(q);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const groups = {
            pending: [],
            accepted: [],
            declined: [],
            archived: []
        };

        snapshot.forEach((docSnap) => {
            const booking = { id: docSnap.id, ...docSnap.data() };
            const normalized = booking.status === 'confirmed' ? 'accepted' : booking.status;
            const status = normalized || 'pending';
            const endDate = booking.endDate.toDate();
            if ((status === 'accepted' || status === 'pending') && endDate < today) {
                groups.archived.push(booking);
                return;
            }
            if (groups[status]) {
                groups[status].push(booking);
            } else {
                groups.archived.push(booking);
            }
        });

        const sectionIds = {
            pending: 'ownerPending',
            accepted: 'ownerConfirmed',
            declined: 'ownerDeclined',
            archived: 'ownerHistory'
        };

        Object.entries(sectionIds).forEach(([status, containerId]) => {
            const container = document.getElementById(containerId);
            if (!container) return;

            const bookings = groups[status] || [];
            if (bookings.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-emoji">📅</div>
                        <p>No ${status} bookings</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = bookings.map(booking => {
                const startDate = booking.startDate.toDate().toLocaleDateString();
                const endDate = booking.endDate.toDate().toLocaleDateString();
                const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

                const isBookedRange = status === 'accepted';
                const badge = isBookedRange
                    ? '<span class="booking-status status-unavailable">Unavailable (Booked)</span>'
                    : `<span class="booking-status status-${status}">${statusLabel}</span>`;

                const actions = status === 'pending' ? `
                        <div class="booking-actions">
                            <button class="btn-primary" onclick="handleBookingAction('${booking.id}', 'accepted')">✅ Accept</button>
                            <button class="btn-secondary" onclick="handleBookingAction('${booking.id}', 'declined')">❌ Decline</button>
                        </div>
                    ` : '';

                return `
                    <div class="booking-request-card">
                        <div class="booking-header">
                            <h3>${booking.itemName}</h3>
                            ${badge}
                        </div>
                        <div class="booking-details">
                            <div class="booking-info">
                                <strong>Renter:</strong> ${booking.renterName} (${booking.renterEmail})
                            </div>
                            <div class="booking-info">
                                <strong>Dates:</strong> ${startDate} - ${endDate}
                            </div>
                        </div>
                        ${actions}
                    </div>
                `;
            }).join('');
        });

        // Set initial tab to pending if setOwnerBookingsTab exists
        if (typeof window.setOwnerBookingsTab === 'function') {
            window.setOwnerBookingsTab('pending');
        }
    } catch (error) {
        console.error('Error loading owner bookings:', error);
        ['ownerPending', 'ownerConfirmed', 'ownerDeclined', 'ownerHistory'].forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-emoji">❌</div>
                        <p>Error loading bookings. Please refresh.</p>
                    </div>
                `;
            }
        });
    }
}

/**
 * Handle booking action (accept/decline)
 * @param {string} bookingId - Booking document ID
 * @param {string} newStatus - New status ('accepted' or 'declined')
 */
export async function handleBookingAction(bookingId, newStatus) {
    if (!['accepted', 'declined'].includes(newStatus)) return;

    const currentUser = store.getCurrentUser();
    if (!currentUser) return;

    try {
        const bookingRef = firebaseService.doc('bookings', bookingId);
        await firebaseService.updateDoc(bookingRef, {
            status: newStatus,
            statusHistory: arrayUnion({
                status: newStatus,
                at: Timestamp.now(),
                by: currentUser.uid
            }),
            updatedAt: serverTimestamp()
        });

        const statusText = newStatus === 'accepted' ? 'accepted' : 'declined';
        alert(`✅ Booking request ${statusText} successfully!`);

        // Reload booking requests
        loadOwnerBookings();
    } catch (error) {
        console.error('Error updating booking:', error);
        alert('Failed to update booking. Please try again.');
    }
}
