/**
 * Chat Renderer Module
 * Handles rendering of chat lists and chat navigation
 */

import {
    firebaseService,
    getDoc,
    getDocs,
    doc,
    collection,
    query,
    orderBy,
    limit
} from '../services/firebaseService.js';
import { store } from '../stores/stateStore.js';
import { formatTimeAgo } from '../utils/formatters.js';
import { ITEM_EMOJIS } from '../utils/constants.js';

const db = firebaseService.getDb();

/**
 * Get unread message count for a chat
 * @param {string} chatId - Chat ID
 * @returns {number} Number of unread messages
 */
async function getUnreadCount(chatId) {
    const currentUser = store.getCurrentUser();
    if (!currentUser || !chatId) return 0;

    try {
        // Get chat metadata to find lastRead timestamp
        const chatDocRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatDocRef);
        const lastReadTimestamp = chatDoc.exists()
            ? chatDoc.data()?.lastRead?.[currentUser.uid]
            : null;

        // Get all messages
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);

        let unreadCount = 0;
        messagesSnapshot.forEach((msgDoc) => {
            const msg = msgDoc.data();
            // Count messages sent by others that are newer than lastRead
            if (msg.senderId !== currentUser.uid) {
                if (!lastReadTimestamp || (msg.createdAt && msg.createdAt > lastReadTimestamp)) {
                    unreadCount++;
                }
            }
        });

        return unreadCount;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

/**
 * Load and render user's chats
 * Requires window.showView to be available
 */
export async function loadMyChats() {
    const currentUser = store.getCurrentUser();
    if (!currentUser) {
        console.error('No current user found when loading chats');
        return;
    }

    try {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) {
            console.error('chatsList element not found');
            return;
        }

        chatsList.innerHTML = '<div class="loading">Loading chats...</div>';

        // Get all items to build chat metadata
        const itemsSnapshot = await getDocs(collection(db, 'items'));
        const itemsMap = {};
        itemsSnapshot.forEach((doc) => {
            itemsMap[doc.id] = { id: doc.id, ...doc.data() };
        });

        // Get all chats involving the current user
        const chatsSnapshot = await getDocs(collection(db, 'chats'));
        const userChats = [];

        for (const chatDoc of chatsSnapshot.docs) {
            const chatId = chatDoc.id;
            const chatData = chatDoc.data();

            // Parse chat ID format: itemId_userId1_userId2
            const parts = chatId.split('_');
            if (parts.length < 3) continue;

            const itemId = parts[0];
            const user1 = parts[1];
            const user2 = parts[2];

            // Check if current user is part of this chat
            if (user1 !== currentUser.uid && user2 !== currentUser.uid) continue;

            // Get the other user
            const otherUserId = user1 === currentUser.uid ? user2 : user1;

            // Get item details
            const item = itemsMap[itemId];
            if (!item) continue;

            // Get last message
            const messagesRef = collection(db, 'chats', chatId, 'messages');
            const messagesQuery = query(messagesRef, orderBy('createdAt', 'desc'), limit(1));
            const messagesSnapshot = await getDocs(messagesQuery);

            let lastMessage = null;
            let lastMessageTime = null;
            if (!messagesSnapshot.empty) {
                const msgData = messagesSnapshot.docs[0].data();
                lastMessage = msgData.text;
                lastMessageTime = msgData.createdAt;
            }

            // Get unread count
            const unreadCount = await getUnreadCount(chatId);

            // Determine other user name
            const otherUserName = otherUserId === item.ownerId ? item.ownerName :
                                  (item.ownerId === currentUser.uid ?
                                   messagesSnapshot.docs[0]?.data()?.senderName || 'Unknown' :
                                   item.ownerName);

            userChats.push({
                chatId,
                itemId,
                itemName: item.name,
                itemEmoji: item.emoji || '📦',
                otherUserName,
                lastMessage,
                lastMessageTime,
                unreadCount
            });
        }

        // Sort by most recent message
        userChats.sort((a, b) => {
            if (!a.lastMessageTime) return 1;
            if (!b.lastMessageTime) return -1;
            return b.lastMessageTime - a.lastMessageTime;
        });

        if (userChats.length === 0) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-emoji">💬</div>
                    <p>No chats yet. Start chatting about items!</p>
                </div>
            `;
            return;
        }

        chatsList.innerHTML = userChats.map(chat => {
            const unreadBadge = chat.unreadCount > 0
                ? `<span class="unread-badge">${chat.unreadCount}</span>`
                : '';

            const lastMessagePreview = chat.lastMessage
                ? chat.lastMessage.substring(0, 50) + (chat.lastMessage.length > 50 ? '...' : '')
                : 'No messages yet';

            const timeAgo = chat.lastMessageTime
                ? formatTimeAgo(chat.lastMessageTime.toDate())
                : '';

            return `
                <div class="chat-list-item" onclick="openChatFromList('${chat.itemId}', '${chat.chatId}')">
                    <div class="chat-item-emoji">${chat.itemEmoji}</div>
                    <div class="chat-item-content">
                        <div class="chat-item-header">
                            <h3>${chat.itemName}</h3>
                            ${unreadBadge}
                        </div>
                        <div class="chat-item-subtitle">with ${chat.otherUserName}</div>
                        <div class="chat-item-preview">${lastMessagePreview}</div>
                    </div>
                    <div class="chat-item-time">${timeAgo}</div>
                </div>
            `;
        }).join('');

        // Show the view if function is available
        if (window.showView) {
            window.showView('myChatsView');
        }
    } catch (error) {
        console.error('Error loading chats:', error);
        const chatsList = document.getElementById('chatsList');
        if (chatsList) {
            chatsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-emoji">❌</div>
                    <p>Error loading chats. Please refresh.</p>
                </div>
            `;
        }
    }
}

/**
 * Open chat from the chat list
 * Requires window.openChat to be available
 * @param {string} itemId - Item ID
 * @param {string} chatId - Chat ID
 */
export async function openChatFromList(itemId, chatId) {
    try {
        // Load item data
        const itemDoc = await getDoc(doc(db, 'items', itemId));
        if (!itemDoc.exists()) {
            alert('Item not found');
            return;
        }

        const itemData = { id: itemDoc.id, ...itemDoc.data() };
        window.currentItemData = itemData;
        store.setCurrentItemData(itemData);

        // Open chat if function is available
        if (window.openChat) {
            // Pass the correct chatId from the list to avoid recalculation
            // Also pass 'myChatsView' to indicate we came from the chats list
            await window.openChat(itemId, chatId, 'myChatsView');
        } else {
            console.error('window.openChat not available');
        }
    } catch (error) {
        console.error('Error opening chat from list:', error);
        alert('Error opening chat');
    }
}
