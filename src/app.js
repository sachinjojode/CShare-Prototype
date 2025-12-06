/**
 * CShare - Main Application Entry Point
 * Orchestrates all modules and initializes the application
 */

// Firebase Service
import { firebaseService } from './services/firebaseService.js';

// Stores
import { store } from './stores/stateStore.js';

// Auth Module
import { setupAuthListener, updateCurrentUserDisplay, logout } from './modules/auth/authManager.js';

// Ranking Module
import { rankItems, renderMatchBreakdown } from './modules/ranking/rankingAlgorithm.js';

// Items Module
import {
    loadItems,
    createListing,
    updateListing,
    loadMyItems,
    loadMyBookings,
    loadOwnerBookings,
    handleBookingAction
} from './modules/items/itemManager.js';

// Booking Module
import {
    openBookingModal,
    closeBookingModal,
    submitBookingRequest
} from './modules/booking/bookingManager.js';

// Chat Module
import {
    sendMessage,
    handleChatTyping,
    openChat
} from './modules/chat/chatManager.js';

// Preferences Module
import {
    loadUserPreferences,
    openPreferencesModal,
    closePreferencesModal,
    savePreferences,
    updatePreferencesPreview
} from './modules/preferences/preferencesManager.js';

// Analytics Module
import { logAnalytics } from './modules/analytics/analyticsLogger.js';
import {
    initSessionRecording,
    setupSessionRecording,
    trackSearch
} from './modules/analytics/sessionRecorder.js';

// Dashboard Module
import {
    loadTestingDashboard,
    initDashboard
} from './modules/dashboard/dashboardManager.js';
import { initSessionReplay } from './modules/dashboard/sessionReplay.js';

// UI Modules
import { showView } from './ui/viewManager.js';
import { renderItems, showItemDetail } from './ui/itemRenderer.js';
import { loadMyChats, openChatFromList } from './ui/chatRenderer.js';
import { setupModalCloseHandlers } from './ui/modalManager.js';

// Testing Modules
import {
    runAutomatedUserTest
} from './modules/testing/automatedTest.js';
import {
    generateFakeListings,
    clearMyListings,
    openTestListingsModal,
    closeTestListingsModal
} from './modules/testing/testDataGenerator.js';
import {
    clearAnalyticsData,
    clearSessionsData,
    clearAllTestingData
} from './modules/testing/dataCleaner.js';

// Import getUnreadCount from chat module
import { getUnreadCount } from './modules/chat/chatManager.js';

// Import editItem functionality
async function editItem(itemId) {
    try {
        const itemDoc = await firebaseService.getDoc(
            firebaseService.doc('items', itemId)
        );

        if (!itemDoc.exists()) {
            alert('Item not found');
            return;
        }

        const item = { id: itemDoc.id, ...itemDoc.data() };

        // Populate edit form
        document.getElementById('editItemName').value = item.name;
        document.getElementById('editItemCategory').value = item.category;
        document.getElementById('editItemDescription').value = item.description;
        document.getElementById('editItemPrice').value = item.price;
        document.getElementById('editItemId').value = itemId;

        // Handle availability
        const availability = item.availability || { type: 'always' };
        document.getElementById('editAvailabilityType').value = availability.type;

        if (availability.type === 'dateRange') {
            if (availability.startDate) {
                document.getElementById('editAvailableFrom').value =
                    availability.startDate.toDate().toISOString().split('T')[0];
            }
            if (availability.endDate) {
                document.getElementById('editAvailableUntil').value =
                    availability.endDate.toDate().toISOString().split('T')[0];
            }
        } else if (availability.type === 'recurring' && availability.daysOfWeek) {
            availability.daysOfWeek.forEach(day => {
                const checkbox = document.getElementById(`edit-day-${['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][day]}`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // Handle handover time
        const handoverTime = item.handoverTime || {};
        if (handoverTime.start) {
            document.getElementById('editHandoverTimeStart').value = handoverTime.start;
        }
        if (handoverTime.end) {
            document.getElementById('editHandoverTimeEnd').value = handoverTime.end;
        }

        // Trigger toggle to show correct fields
        if (window.toggleEditAvailabilityFields) {
            window.toggleEditAvailabilityFields();
        }

        showView('editItemView');
    } catch (error) {
        console.error('Error loading item for edit:', error);
        alert('Error loading item');
    }
}

// Initialize shared modules with Firestore instance
const firestoreDb = firebaseService.getDb();
initDashboard(firestoreDb);
initSessionReplay(firestoreDb);

// Make essential functions available globally for HTML onclick handlers
window.showView = showView;
window.renderItems = renderItems;
window.showItemDetail = showItemDetail;
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
window.openPreferencesModal = openPreferencesModal;
window.closePreferencesModal = closePreferencesModal;
window.openChat = openChat;
window.openChatFromList = openChatFromList;
window.handleBookingAction = handleBookingAction;
window.logAnalytics = logAnalytics;
window.openTestListingsModal = openTestListingsModal;
window.closeTestListingsModal = closeTestListingsModal;
window.renderMatchBreakdown = renderMatchBreakdown;
window.editItem = editItem;
window.getUnreadCount = getUnreadCount;
window.logout = logout;

/**
 * Initialize the application
 */
async function initApp() {
    try {
        const currentUser = store.getCurrentUser();

        if (!currentUser) {
            console.error('No user found in initApp');
            return;
        }

        // Update UI with current user
        updateCurrentUserDisplay();

        // Load user preferences
        await loadUserPreferences();

        // Load and render items
        await loadItems();

        // Setup event listeners
        setupEventListeners();

        // Setup session recording
        setupSessionRecording();

        // Setup modal handlers
        setupModalCloseHandlers();

        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Navigation buttons
    document.getElementById('createListingBtn')?.addEventListener('click', () => showView('createListingView'));
    document.getElementById('myItemsBtn')?.addEventListener('click', () => {
        loadMyItems();
        showView('myItemsView');
    });
    document.getElementById('myChatsBtn')?.addEventListener('click', () => loadMyChats());
    document.getElementById('myBookingsBtn')?.addEventListener('click', () => {
        loadMyBookings();
        showView('myBookingsView');
    });
    document.getElementById('ownerBookingsBtn')?.addEventListener('click', () => {
        loadOwnerBookings();
        showView('bookingRequestsView');
    });
    document.getElementById('testingDashboardBtn')?.addEventListener('click', () => loadTestingDashboard());
    document.getElementById('backFromTestingDashboardBtn')?.addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromDetailBtn')?.addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromCreateBtn')?.addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromMyItemsBtn')?.addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromMyBookingsBtn')?.addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromMyChatsBtn')?.addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromBookingRequestsBtn')?.addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromChatBtn')?.addEventListener('click', () => {
        const previousView = store.getState('chatPreviousView');
        if (previousView === 'myChatsView') {
            loadMyChats();
        } else {
            const itemId = store.getCurrentItemId();
            if (itemId) showItemDetail(itemId);
            else showView('homeView');
        }
    });

    // Search
    document.getElementById('searchBtn')?.addEventListener('click', searchItems);
    document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchItems();
    });

    // Preferences
    document.getElementById('preferencesBtn')?.addEventListener('click', openPreferencesModal);
    document.getElementById('preferencesForm')?.addEventListener('submit', savePreferences);
    document.getElementById('cancelPreferencesBtn')?.addEventListener('click', closePreferencesModal);

    // Preference weight sliders
    ['weightPrice', 'weightCategory', 'weightAvailability', 'weightUrgency'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updatePreferencesPreview);
    });

    // Create listing
    document.getElementById('createListingForm')?.addEventListener('submit', createListing);
    document.getElementById('cancelCreateListing')?.addEventListener('click', () => {
        document.getElementById('createListingForm')?.reset();
        showView('homeView');
    });

    // Edit listing
    document.getElementById('editListingForm')?.addEventListener('submit', updateListing);
    document.getElementById('backFromEditBtn')?.addEventListener('click', () => {
        document.getElementById('editListingForm')?.reset();
        showView('myItemsView');
    });

    // Booking
    document.getElementById('bookingForm')?.addEventListener('submit', submitBookingRequest);
    document.getElementById('cancelBookingBtn')?.addEventListener('click', closeBookingModal);

    // Chat
    document.getElementById('chatForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage();
    });
    document.getElementById('chatInput')?.addEventListener('input', handleChatTyping);
    document.getElementById('backToDetail')?.addEventListener('click', () => {
        const previousView = store.getState('chatPreviousView');
        if (previousView === 'myChatsView') {
            loadMyChats();
        } else {
            const itemId = store.getCurrentItemId();
            if (itemId) showItemDetail(itemId);
        }
    });

    // Messages scroll tracking
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        messagesContainer.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
            const isNear = scrollHeight - scrollTop - clientHeight < 100;
            store.setState('isNearBottom', isNear);
        });
    }

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to logout?')) {
            await logout();
        }
    });

    // Testing
    document.getElementById('runAutoTestBtn')?.addEventListener('click', runAutomatedUserTest);
    document.getElementById('generateTestListingsBtn')?.addEventListener('click', openTestListingsModal);
    document.getElementById('generateFakeListingsBtn')?.addEventListener('click', generateFakeListings);
    document.getElementById('closeTestModalBtn')?.addEventListener('click', closeTestListingsModal);
    document.getElementById('clearMyListingsBtn')?.addEventListener('click', clearMyListings);
    document.getElementById('clearAnalyticsBtn')?.addEventListener('click', clearAnalyticsData);
    document.getElementById('clearSessionsBtn')?.addEventListener('click', clearSessionsData);
    document.getElementById('clearAllTestDataBtn')?.addEventListener('click', clearAllTestingData);

    // Booking request tabs
    document.querySelectorAll('#bookingRequestsView .tab-btn').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.target.id;
            let status = 'pending';
            if (tabId === 'ownerTabConfirmed') status = 'accepted';
            else if (tabId === 'ownerTabDeclined') status = 'declined';
            else if (tabId === 'ownerTabHistory') status = 'archived';

            document.querySelectorAll('#bookingRequestsView .tab-btn').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            loadOwnerBookings(status);
        });
    });

    // Availability type toggles
    window.toggleAvailabilityFields = () => {
        const type = document.getElementById('availabilityType')?.value;
        const dateFields = document.getElementById('dateRangeFields');
        const recurFields = document.getElementById('recurringFields');
        if (dateFields) dateFields.style.display = type === 'dateRange' ? 'block' : 'none';
        if (recurFields) recurFields.style.display = type === 'recurring' ? 'block' : 'none';
    };

    window.toggleEditAvailabilityFields = () => {
        const type = document.getElementById('editAvailabilityType')?.value;
        const dateFields = document.getElementById('editDateRangeFields');
        const recurFields = document.getElementById('editRecurringFields');
        if (dateFields) dateFields.style.display = type === 'dateRange' ? 'block' : 'none';
        if (recurFields) recurFields.style.display = type === 'recurring' ? 'block' : 'none';
    };

    document.getElementById('availabilityType')?.addEventListener('change', window.toggleAvailabilityFields);
    document.getElementById('editAvailabilityType')?.addEventListener('change', window.toggleEditAvailabilityFields);
}

/**
 * Search items
 */
async function searchItems() {
    const query = document.getElementById('searchInput')?.value || '';

    // Track search in analytics
    trackSearch(query);

    try {
        const itemsSnapshot = await firebaseService.getDocs(
            firebaseService.collection('items')
        );

        const itemsArray = [];
        itemsSnapshot.forEach((doc) => {
            itemsArray.push({ id: doc.id, ...doc.data() });
        });

        const rankedItems = rankItems(itemsArray, query);
        renderItems(rankedItems);
        showView('homeView');
    } catch (error) {
        console.error('Error searching items:', error);
    }
}

// Make search available globally
window.searchItems = searchItems;

/**
 * Auth state change handler
 */
setupAuthListener(
    async () => {
        // User is authenticated with .edu email
        await initApp();
        // Initialize session recording
        await initSessionRecording();
    },
    () => {
        // User is not authenticated or doesn't have .edu email
        window.location.href = '/login.html';
    }
);

console.log('CShare application loaded - modular architecture');
