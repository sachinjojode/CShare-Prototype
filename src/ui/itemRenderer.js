/**
 * Item Renderer
 * Handles rendering of item cards and item details
 */

import {
    firebaseService,
    getDoc,
    getDocs,
    updateDoc,
    doc,
    collection,
    query,
    where
} from '../services/firebaseService.js';
import { store } from '../stores/stateStore.js';
import { cache } from '../stores/cacheStore.js';
import { renderMatchBreakdown } from '../modules/ranking/rankingAlgorithm.js';
import { formatPrice } from '../utils/formatters.js';

const db = firebaseService.getDb();

/**
 * Render items to the grid
 * @param {Array} itemsToRender - Array of items to display
 */
export function renderItems(itemsToRender) {
    const grid = document.getElementById('itemsGrid');

    // Update cache with ranking index
    const rankingIndex = {};
    itemsToRender.forEach(item => {
        if (item?.id) {
            rankingIndex[item.id] = item;
        }
    });
    cache.setRankingIndex(rankingIndex);

    if (itemsToRender.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-emoji">🔍</div>
                <p>No items found</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = itemsToRender.map(item => {
        const descriptionPreview = (item.description || '').substring(0, 80);
        const matchSection = renderMatchBreakdown(item);
        return `
            <div class="item-card" onclick="showItemDetail('${item.id}')">
                <div class="item-emoji">${item.emoji || '📦'}</div>
                <h3>${item.name}</h3>
                <span class="item-category">${item.category}</span>
                <p>${descriptionPreview}...</p>
                <div class="item-price">${formatPrice(item.price)}</div>
                ${matchSection}
                <div class="item-owner">Listed by ${item.ownerName}</div>
            </div>
        `;
    }).join('');
}

/**
 * Show item detail view
 * @param {string} itemId - ID of the item to show
 */
export async function showItemDetail(itemId) {
    try {
        const itemDoc = await getDoc(doc(db, 'items', itemId));

        if (!itemDoc.exists()) {
            alert('Item not found');
            return;
        }

        const item = { id: itemDoc.id, ...itemDoc.data() };

        // Get ranking data from cache if available
        const rankingIndex = cache.getRankingIndex();
        if (rankingIndex[itemId]) {
            Object.assign(item, rankingIndex[itemId]);
        }

        // Store current item
        store.setCurrentItemData(item);
        store.setCurrentItemId(itemId);

        // Log analytics (use global function if available)
        if (window.logAnalytics) {
            await window.logAnalytics('view_item', itemId, {
                itemName: item.name,
                itemCategory: item.category
            });
        }

        // Increment view count
        try {
            await updateDoc(doc(db, 'items', itemId), {
                views: (item.views || 0) + 1
            });
        } catch (error) {
            console.error('Error updating views:', error);
        }

        const currentUser = store.getCurrentUser();
        const isOwner = item.ownerId === currentUser?.uid;

        // Get unread count using global function
        let unreadBadge = '';
        if (window.getUnreadCount && currentUser) {
            try {
                const chatId = `${itemId}_${[item.ownerId, currentUser.uid].sort().join('_')}`;
                const unreadCount = await window.getUnreadCount(chatId);
                unreadBadge = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
            } catch (error) {
                console.error('Error getting unread count:', error);
            }
        }

        // Get booking status
        let borrowingStatusHTML = '';
        try {
            const now = new Date();
            const bookingsQuery = query(
                collection(db, 'bookings'),
                where('itemId', '==', itemId),
                where('status', '==', 'accepted')
            );
            const bookingsSnapshot = await getDocs(bookingsQuery);

            const activeBookings = [];
            const upcomingBookings = [];

            bookingsSnapshot.forEach(docSnap => {
                const booking = docSnap.data();
                const startDate = booking.startDate.toDate();
                const endDate = booking.endDate.toDate();

                if (now >= startDate && now <= endDate) {
                    activeBookings.push({ ...booking, startDate, endDate });
                } else if (startDate > now) {
                    upcomingBookings.push({ ...booking, startDate, endDate });
                }
            });

            upcomingBookings.sort((a, b) => a.startDate - b.startDate);

            if (activeBookings.length > 0 || upcomingBookings.length > 0) {
                let statusContent = '';

                if (activeBookings.length > 0) {
                    const booking = activeBookings[0];
                    statusContent += `
                        <div class="booking-status active">
                            <span class="status-indicator">🔴</span>
                            <strong>Currently Borrowed</strong>
                            <p>Until: ${booking.endDate.toLocaleDateString()}</p>
                            <small>Borrowed by: ${booking.renterName}</small>
                        </div>
                    `;
                }

                if (upcomingBookings.length > 0) {
                    const nextBookings = upcomingBookings.slice(0, 2);
                    nextBookings.forEach(booking => {
                        statusContent += `
                            <div class="booking-status upcoming">
                                <span class="status-indicator">🟡</span>
                                <strong>Upcoming Booking</strong>
                                <p>${booking.startDate.toLocaleDateString()} - ${booking.endDate.toLocaleDateString()}</p>
                                <small>Reserved by: ${booking.renterName}</small>
                            </div>
                        `;
                    });

                    if (upcomingBookings.length > 2) {
                        statusContent += `<small>+ ${upcomingBookings.length - 2} more upcoming booking(s)</small>`;
                    }
                }

                borrowingStatusHTML = `
                    <div class="item-borrowing-status">
                        <h3>Borrowing Status</h3>
                        ${statusContent}
                    </div>
                `;
            } else {
                borrowingStatusHTML = `
                    <div class="item-borrowing-status">
                        <h3>Borrowing Status</h3>
                        <div class="booking-status available">
                            <span class="status-indicator">🟢</span>
                            <strong>Available</strong>
                            <p>No active or upcoming bookings</p>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching booking status:', error);
        }

        // Format availability
        let availabilityHTML = '';
        if (item.availability) {
            const availability = item.availability;
            let availabilityContent = '';

            if (availability.type === 'recurring') {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const selectedDays = (availability.daysOfWeek || []).map(d => dayNames[d]).join(', ');
                availabilityContent = `<p>📅 <strong>Available Days:</strong> ${selectedDays}</p>`;
            } else if (availability.type === 'dateRange') {
                const startDate = availability.startDate ? availability.startDate.toDate().toLocaleDateString() : 'Now';
                const endDate = availability.endDate ? availability.endDate.toDate().toLocaleDateString() : 'Ongoing';
                availabilityContent = `<p>📅 ${startDate} - ${endDate}</p>`;
            } else {
                availabilityContent = `<p>📅 <strong>Always Available</strong></p>`;
            }

            availabilityHTML = `
                <div class="item-availability">
                    <h3>Availability Schedule</h3>
                    ${availabilityContent}
                </div>
            `;
        }

        // Format handover time
        let handoverTimeHTML = '';
        const handoverTime = item.handoverTime || {};
        const timeStart = handoverTime.start || item.availability?.timeStart;
        const timeEnd = handoverTime.end || item.availability?.timeEnd;

        if (timeStart && timeEnd) {
            handoverTimeHTML = `
                <div class="item-handover-time">
                    <h3>Handover Time</h3>
                    <div class="handover-time-box" style="background: #f0f9ff; padding: 12px; border-radius: 6px; border-left: 3px solid #3b82f6;">
                        <p style="margin: 0;">🕐 <strong>${timeStart} - ${timeEnd}</strong></p>
                        <small style="color: #666; display: block; margin-top: 6px;">
                            Please coordinate pickup & return within these hours each day
                        </small>
                    </div>
                </div>
            `;
        } else {
            handoverTimeHTML = `
                <div class="item-handover-time">
                    <h3>Handover Time</h3>
                    <p>🕐 <strong>Flexible</strong> - Coordinate with owner</p>
                </div>
            `;
        }

        const detailContent = document.getElementById('itemDetailContent');
        detailContent.innerHTML = `
            <div class="item-emoji">${item.emoji || '📦'}</div>
            <h2>${item.name}</h2>
            <span class="item-category">${item.category}</span>
            <div class="item-price">${formatPrice(item.price)}</div>
            ${renderMatchBreakdown(item)}
            <div class="item-description">
                <h3>Description</h3>
                <p>${item.description}</p>
            </div>
            ${borrowingStatusHTML}
            ${availabilityHTML}
            ${handoverTimeHTML}
            <div class="item-owner">
                <strong>Listed by:</strong> ${item.ownerName} (${item.ownerEmail})
            </div>
            <div class="detail-actions">
                ${isOwner ?
                `<button class="btn-primary" onclick="editItem('${itemId}')">✏️ Edit Listing</button>
                 <button class="btn-secondary" onclick="showView('homeView')">Back to Listings</button>` :
                `<button class="btn-primary" onclick="openBookingModal('${itemId}')">📅 Request to Book</button>
                 <button class="btn-primary chat-btn-with-badge" onclick="openChat('${itemId}')">💬 Chat with Owner${unreadBadge}</button>
                 <button class="btn-secondary" onclick="showView('homeView')">Back</button>`
            }
            </div>
        `;

        if (window.showView) {
            window.showView('itemDetailView');
        }
    } catch (error) {
        console.error('Error loading item:', error);
        alert('Error loading item details');
    }
}
