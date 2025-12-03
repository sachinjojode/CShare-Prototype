// Firebase App with Real-time Chat
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    setDoc,
    query,
    orderBy,
    where,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// Firebase configuration - REPLACE WITH YOUR CONFIG
const firebaseConfig = {
    apiKey: "YOUR-API-KEY",
    authDomain: "YOUR-PROJECT.firebaseapp.com",
    projectId: "YOUR-PROJECT-ID",
    storageBucket: "YOUR-PROJECT.appspot.com",
    messagingSenderId: "SENDER-ID",
    appId: "APP-ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global state
let currentUser = null;
let currentChatId = null;
let currentItemId = null;
let unsubscribeMessages = null;

// Category emojis
const itemEmojis = {
    "Appliances": "🧹",
    "Electronics": "🖥️",
    "Furniture": "🪑",
    "Kitchen": "🍳",
    "Other": "📦"
};

// Auth state listener
onAuthStateChanged(auth, (user) => {
    if (user && user.email.endsWith('.edu')) {
        currentUser = user;
        initializeApp();
    } else {
        // Redirect to login if not authenticated
        window.location.href = '/login.html';
    }
});

// Initialize the app
async function initializeApp() {
    updateCurrentUserDisplay();
    await loadItems();
    setupEventListeners();
}

// Update user display
function updateCurrentUserDisplay() {
    const userName = currentUser.displayName || currentUser.email.split('@')[0];
    document.getElementById('currentUserName').textContent = userName;
}

// Utility Functions
function formatPrice(price) {
    return price === 0 ? "FREE" : `$${parseFloat(price).toFixed(2)}/day`;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getChatId(itemId, userId) {
    const item = window.currentItemData;
    if (!item) return null;

    // Chat ID is combination of item and the two users (sorted for consistency)
    const users = [item.ownerId, userId].sort();
    return `${itemId}_${users[0]}_${users[1]}`;
}

// View Management
function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
}

// Load items from Firestore
async function loadItems() {
    try {
        const itemsSnapshot = await getDocs(collection(db, 'items'));
        const itemsArray = [];

        itemsSnapshot.forEach((doc) => {
            itemsArray.push({ id: doc.id, ...doc.data() });
        });

        renderItems(itemsArray);
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

// Render items
function renderItems(itemsToRender) {
    const grid = document.getElementById('itemsGrid');

    if (itemsToRender.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-emoji">🔍</div>
                <p>No items found</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = itemsToRender.map(item => `
        <div class="item-card" onclick="showItemDetail('${item.id}')">
            <div class="item-emoji">${item.emoji || '📦'}</div>
            <h3>${item.name}</h3>
            <span class="item-category">${item.category}</span>
            <p>${item.description.substring(0, 80)}...</p>
            <div class="item-price">${formatPrice(item.price)}</div>
            <div class="item-owner">Listed by ${item.ownerName}</div>
        </div>
    `).join('');
}

// Show item detail
window.showItemDetail = async function (itemId) {
    try {
        const itemDoc = await getDoc(doc(db, 'items', itemId));

        if (!itemDoc.exists()) {
            alert('Item not found');
            return;
        }

        const item = { id: itemDoc.id, ...itemDoc.data() };
        window.currentItemData = item;

        const isOwner = item.ownerId === currentUser.uid;

        const detailContent = document.getElementById('itemDetailContent');
        detailContent.innerHTML = `
            <div class="item-emoji">${item.emoji || '📦'}</div>
            <h2>${item.name}</h2>
            <span class="item-category">${item.category}</span>
            <div class="item-price">${formatPrice(item.price)}</div>
            <div class="item-description">
                <h3>Description</h3>
                <p>${item.description}</p>
            </div>
            <div class="item-owner">
                <strong>Listed by:</strong> ${item.ownerName} (${item.ownerEmail})
            </div>
            <div class="detail-actions">
                ${isOwner ?
                '<button class="btn-secondary" onclick="showView(\'homeView\')">Back to Listings</button>' :
                `<button class="btn-primary" onclick="openChat('${itemId}')">💬 Chat with Owner</button>
                     <button class="btn-secondary" onclick="showView('homeView')">Back</button>`
            }
            </div>
        `;

        showView('itemDetailView');
    } catch (error) {
        console.error('Error loading item:', error);
        alert('Error loading item details');
    }
};

// Open chat
window.openChat = async function (itemId) {
    const item = window.currentItemData;
    if (!item) return;

    const chatId = getChatId(itemId, currentUser.uid);
    currentChatId = chatId;
    currentItemId = itemId;

    // Update chat header
    document.getElementById('chatHeader').innerHTML = `
        <div><strong>Chat about:</strong> ${item.name}</div>
        <div><strong>With:</strong> ${item.ownerName}</div>
    `;

    // Listen to messages in real-time
    listenToMessages(chatId);

    showView('chatView');
};

// Listen to messages in real-time
function listenToMessages(chatId) {
    // Unsubscribe from previous listener if exists
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        const messagesContainer = document.getElementById('chatMessages');

        if (snapshot.empty) {
            messagesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-emoji">💬</div>
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `;
            return;
        }

        messagesContainer.innerHTML = '';
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isSent = msg.senderId === currentUser.uid;

            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
            messageDiv.innerHTML = `
                ${!isSent ? `<div class="message-sender">${msg.senderName}</div>` : ''}
                <div class="message-content">${msg.text}</div>
                <div class="message-time">${formatTime(msg.createdAt)}</div>
            `;

            messagesContainer.appendChild(messageDiv);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, (error) => {
        console.error('Error listening to messages:', error);
    });
}

// Send message
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text || !currentChatId) return;

    try {
        const messagesRef = collection(db, 'chats', currentChatId, 'messages');

        await addDoc(messagesRef, {
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email.split('@')[0],
            senderEmail: currentUser.email,
            createdAt: serverTimestamp()
        });

        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Create listing
async function createListing(event) {
    event.preventDefault();

    const name = document.getElementById('itemName').value;
    const category = document.getElementById('itemCategory').value;
    const description = document.getElementById('itemDescription').value;
    const price = parseFloat(document.getElementById('itemPrice').value);

    try {
        await addDoc(collection(db, 'items'), {
            name,
            category,
            description,
            price,
            emoji: itemEmojis[category],
            ownerId: currentUser.uid,
            ownerName: currentUser.displayName || currentUser.email.split('@')[0],
            ownerEmail: currentUser.email,
            createdAt: serverTimestamp()
        });

        // Reset form
        event.target.reset();

        // Reload items and show home
        await loadItems();
        alert('✅ Listing created successfully!');
        showView('homeView');
    } catch (error) {
        console.error('Error creating listing:', error);
        alert('Failed to create listing. Please try again.');
    }
}

// Load user's items
async function loadMyItems() {
    try {
        const q = query(
            collection(db, 'items'),
            where('ownerId', '==', currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
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
            <div class="item-card">
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

// Search items
async function searchItems() {
    const query = document.getElementById('searchInput').value.toLowerCase();

    try {
        const itemsSnapshot = await getDocs(collection(db, 'items'));
        const allItems = [];

        itemsSnapshot.forEach((doc) => {
            allItems.push({ id: doc.id, ...doc.data() });
        });

        if (!query) {
            renderItems(allItems);
            return;
        }

        const filtered = allItems.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        );

        renderItems(filtered);
    } catch (error) {
        console.error('Error searching items:', error);
    }
}

// Logout
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error logging out:', error);
        alert('Failed to logout');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.getElementById('createListingBtn').addEventListener('click', () => showView('createListingView'));
    document.getElementById('myItemsBtn').addEventListener('click', () => {
        loadMyItems();
        showView('myItemsView');
    });

    // Back buttons
    document.getElementById('backFromDetailBtn').addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromCreateBtn').addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromMyItemsBtn').addEventListener('click', () => showView('homeView'));
    document.getElementById('backFromChatBtn').addEventListener('click', () => {
        if (unsubscribeMessages) {
            unsubscribeMessages();
        }
        if (currentItemId) {
            showItemDetail(currentItemId);
        } else {
            showView('homeView');
        }
    });

    // Search
    document.getElementById('searchBtn').addEventListener('click', searchItems);
    document.getElementById('searchInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') searchItems();
    });

    // Create listing form
    document.getElementById('createListingForm').addEventListener('submit', createListing);

    // Chat
    document.getElementById('sendMessageBtn').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}

// Make functions globally accessible
window.showView = showView;
