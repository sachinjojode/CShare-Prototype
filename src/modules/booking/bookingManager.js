/**
 * Booking Manager Module
 * Handles booking request submission and validation
 */

import { store } from '../../stores/stateStore.js';
import { firebaseService, doc, Timestamp, serverTimestamp } from '../../services/firebaseService.js';
import { buildLockIds, validateAvailability, validateBookingDates } from '../../utils/validators.js';

/**
 * Submit booking request for an item
 * Validates dates, checks availability, creates booking and locks
 * @param {Event} event - Form submission event
 */
export async function submitBookingRequest(event) {
    event.preventDefault();

    const currentUser = store.getCurrentUser();
    const currentItemId = store.getCurrentItemId();
    const item = store.getCurrentItemData();

    if (!currentUser) {
        alert('You must be logged in to submit a booking request');
        return;
    }

    if (!item) {
        alert('Item not found');
        return;
    }

    if (item.ownerId === currentUser.uid) {
        alert('You cannot book your own item.');
        return;
    }

    // Get form values
    const startDateStr = document.getElementById('bookingStartDate')?.value;
    const endDateStr = document.getElementById('bookingEndDate')?.value;

    if (!startDateStr || !endDateStr) {
        alert('Please select both start and end dates');
        return;
    }

    // Parse dates in local timezone to avoid timezone offset issues
    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T00:00:00');

    // Validate basic date requirements
    const dateValidation = validateBookingDates(startDate, endDate);
    if (!dateValidation.valid) {
        alert(dateValidation.message);
        return;
    }

    // Validate against item availability if set
    if (item.availability) {
        const availability = item.availability;

        if (availability.type === 'dateRange') {
            // Validate date range availability
            if (availability.startDate) {
                const itemStartDate = availability.startDate.toDate();
                // Only compare dates, not times
                const itemStartDateOnly = new Date(itemStartDate.getFullYear(), itemStartDate.getMonth(), itemStartDate.getDate());
                const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

                if (startDateOnly < itemStartDateOnly) {
                    alert(`Item is only available from ${itemStartDate.toLocaleDateString()}`);
                    return;
                }
            }

            if (availability.endDate) {
                const itemEndDate = availability.endDate.toDate();
                // Only compare dates, not times
                const itemEndDateOnly = new Date(itemEndDate.getFullYear(), itemEndDate.getMonth(), itemEndDate.getDate());
                const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

                if (endDateOnly > itemEndDateOnly) {
                    alert(`Item is only available until ${itemEndDate.toLocaleDateString()}`);
                    return;
                }
            }
        } else if (availability.type === 'recurring') {
            // Recurring type only allows same-day borrowing
            const availableDays = availability.daysOfWeek || [];

            // Check if it's same-day booking using date string comparison
            const startDateOnly = startDate.toISOString().split('T')[0];
            const endDateOnly = endDate.toISOString().split('T')[0];

            if (startDateOnly !== endDateOnly) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const availableDayNames = availableDays.map(d => dayNames[d]).join(', ');
                alert(`This item only allows same-day borrowing on: ${availableDayNames}. Please select the same date for pickup and return.`);
                return;
            }

            // Check if the selected day is in the available days
            const dayOfWeek = startDate.getDay();
            if (!availableDays.includes(dayOfWeek)) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const selectedDay = dayNames[dayOfWeek];
                const availableDayNames = availableDays.map(d => dayNames[d]).join(', ');
                alert(`This item is only available on: ${availableDayNames}. You selected: ${selectedDay}`);
                return;
            }
        }
        // For 'always' type, no validation needed
    }

    try {
        // Check for booking conflicts
        const lockIds = buildLockIds(currentItemId, startDate, endDate);
        const conflictChecks = lockIds.map(id => firebaseService.getDoc(doc(firebaseService.getDb(), 'bookingLocks', id)));
        const snapshots = await Promise.all(conflictChecks);
        const existingLocks = snapshots.filter(snap => snap.exists());

        if (existingLocks.length > 0) {
            alert('❌ Sorry, some of the dates you selected are already booked by others. Please choose different dates.');
            return;
        }

        // Create booking and locks in a batch
        const batch = firebaseService.writeBatch();
        const bookingRef = doc(firebaseService.collection('bookings'));

        batch.set(bookingRef, {
            itemId: currentItemId,
            itemName: item.name,
            renterId: currentUser.uid,
            renterName: currentUser.displayName || currentUser.email.split('@')[0],
            renterEmail: currentUser.email,
            ownerId: item.ownerId,
            ownerName: item.ownerName,
            ownerEmail: item.ownerEmail,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(endDate),
            status: 'pending',
            statusHistory: [{ status: 'pending', at: Timestamp.now(), by: currentUser.uid }],
            lockIds,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // Create locks for each date in the booking range
        lockIds.forEach(id => {
            batch.set(doc(firebaseService.getDb(), 'bookingLocks', id), {
                bookingId: bookingRef.id,
                itemId: currentItemId,
                date: id.split('_')[1],
                ownerId: item.ownerId,
                createdAt: serverTimestamp()
            });
        });

        await batch.commit();

        // Log analytics if function exists
        if (window.logAnalytics) {
            const daysDuration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            await window.logAnalytics('request_booking', currentItemId, {
                itemName: item.name,
                ownerId: item.ownerId,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                durationDays: daysDuration
            });
        }

        // Track booking attempt in session recording if function exists
        if (window.trackBookingAttempt && store.getCurrentSessionId()) {
            window.trackBookingAttempt(currentItemId, item.name, startDate, endDate);
        }

        // Close modal and show success
        if (window.closeBookingModal) {
            window.closeBookingModal();
        }
        alert('✅ Booking request submitted successfully!');
    } catch (error) {
        console.error('Error submitting booking request:', error);
        alert('Failed to submit booking request. Please try again.');
    }
}

/**
 * Open booking modal for an item
 * @param {string} itemId - Item ID to book
 */
export function openBookingModal(itemId) {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;

    const item = store.getCurrentItemData();
    if (!item) return;

    // Display handover time notice if available
    const handoverTime = item.handoverTime || {};
    const legacyTimeStart = item.availability?.timeStart;
    const legacyTimeEnd = item.availability?.timeEnd;
    const timeStart = handoverTime.start || legacyTimeStart;
    const timeEnd = handoverTime.end || legacyTimeEnd;

    // Clear any previous notices
    const existingNotice = modal.querySelector('.booking-notice');
    if (existingNotice) {
        existingNotice.remove();
    }

    if (timeStart && timeEnd) {
        const timeNoticeHTML = `
            <div class="booking-notice" style="background: #fffbeb; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #f59e0b; font-size: 0.9rem;">
                <strong>⚠️ Owner's Handover Time</strong>
                <p style="margin: 6px 0 0 0;">
                    Please ensure you can pick up and return the item between
                    <strong>${timeStart} - ${timeEnd}</strong> each day.
                </p>
            </div>
        `;

        // Insert notice after the modal title
        const modalTitle = modal.querySelector('.modal-content h3');
        if (modalTitle) {
            modalTitle.insertAdjacentHTML('afterend', timeNoticeHTML);
        }
    }

    modal.classList.add('active');

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('bookingStartDate');
    const endDateInput = document.getElementById('bookingEndDate');
    if (startDateInput) startDateInput.setAttribute('min', today);
    if (endDateInput) endDateInput.setAttribute('min', today);
}

/**
 * Close booking modal
 */
export function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;

    modal.classList.remove('active');

    const form = document.getElementById('bookingForm');
    if (form) {
        form.reset();
    }
}
