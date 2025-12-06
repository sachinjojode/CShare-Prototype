/**
 * Test Data Generator Module
 * Handles generation of fake listings for testing
 */

import {
    getFirestore,
    collection,
    addDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { ITEM_EMOJIS } from '../../utils/constants.js';

// Module state
let db = null;
let currentUser = null;

/**
 * Initialize the test data generator module
 */
export function initTestDataGenerator(firestoreInstance, user) {
    db = firestoreInstance;
    currentUser = user;
}

/**
 * Generate fake listings data from seed data
 * @returns {Array} Array of fake item objects
 */
export function generateFakeListingsData() {
    // Helper function to get date X days from now
    function getDaysFromNow(days) {
        if (days === null) return null;
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
    }

    // Load seed data from seed-data.js (available globally via window)
    const fakeItems = window.seedItems;

    if (!fakeItems || !Array.isArray(fakeItems)) {
        console.error('seedItems not found or invalid. Make sure seed-data.js is loaded.');
        throw new Error('Seed data not available. Please refresh the page and try again.');
    }

    return fakeItems.map(item => {
        // Process availability based on type
        let availability;
        if (item.availability.type === 'dateRange') {
            availability = {
                type: 'dateRange',
                startDate: item.availability.startDateOffset !== null
                    ? Timestamp.fromDate(getDaysFromNow(item.availability.startDateOffset))
                    : null,
                endDate: item.availability.endDateOffset !== null
                    ? Timestamp.fromDate(getDaysFromNow(item.availability.endDateOffset))
                    : null
            };
        } else {
            availability = item.availability;
        }

        return {
            name: item.name,
            category: item.category,
            description: item.description,
            price: item.price,
            emoji: ITEM_EMOJIS[item.category],
            ownerId: currentUser.uid,
            ownerName: currentUser.displayName || currentUser.email.split('@')[0],
            ownerEmail: currentUser.email,
            availability: availability,
            handoverTime: item.handoverTime,
            views: 0,
            createdAt: serverTimestamp()
        };
    });
}

/**
 * Open test listings modal
 */
export function openTestListingsModal() {
    const modal = document.getElementById('testListingsModal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Close test listings modal
 */
export function closeTestListingsModal() {
    const modal = document.getElementById('testListingsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Generate fake listings in database
 * Requires window.loadItems to be available
 */
export async function generateFakeListings() {
    if (!confirm('This will create 10 test listings under your account. Continue?')) {
        return;
    }

    try {
        const fakeItems = generateFakeListingsData();

        for (const item of fakeItems) {
            await addDoc(collection(db, 'items'), item);
        }

        closeTestListingsModal();

        // Reload items if function is available
        if (window.loadItems) {
            await window.loadItems();
        }

        alert('✅ Successfully generated 10 test listings!');
    } catch (error) {
        console.error('Error generating fake listings:', error);
        alert('❌ Failed to generate listings. Please try again.');
    }
}

/**
 * Clear all my listings
 * Requires window.loadItems to be available
 */
export async function clearMyListings() {
    if (!confirm('This will DELETE ALL your listings permanently. Are you sure?')) {
        return;
    }

    try {
        const q = query(
            collection(db, 'items'),
            where('ownerId', '==', currentUser.uid)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert('You have no listings to delete.');
            return;
        }

        let count = 0;
        for (const itemDoc of querySnapshot.docs) {
            await deleteDoc(doc(db, 'items', itemDoc.id));
            count++;
        }

        closeTestListingsModal();

        // Reload items if function is available
        if (window.loadItems) {
            await window.loadItems();
        }

        alert(`✅ Successfully deleted ${count} listing(s)!`);
    } catch (error) {
        console.error('Error clearing listings:', error);
        alert('❌ Failed to clear listings. Please try again.');
    }
}
