/**
 * Chat Manager Module
 * Handles real-time chat functionality including messages, typing indicators, and unread counts
 */

import { store } from '../../stores/stateStore.js';
import { firebaseService, collection, doc, query, orderBy, serverTimestamp, deleteField } from '../../services/firebaseService.js';
import { formatTime } from '../../utils/formatters.js';

/**
 * Generate chat ID from item and user IDs
 * Chat ID format: itemId_userId1_userId2 (users sorted for consistency)
 * @param {string} itemId - Item ID
 * @param {string} userId - Current user ID
 * @returns {string|null} Chat ID or null if item data not available
 */
export function getChatId(itemId, userId) {
    const item = store.getCurrentItemData();
    if (!item) return null;

    // Chat ID is combination of item and the two users (sorted for consistency)
    const users = [item.ownerId, userId].sort();
    return `${itemId}_${users[0]}_${users[1]}`;
}

/**
 * Update the last read timestamp for the current user in a chat
 * Used to track which messages are unread
 * @param {string} chatId - Chat ID
 */
export async function updateLastRead(chatId) {
    const currentUser = store.getCurrentUser();
    if (!currentUser || !chatId) return;

    try {
        const chatRef = doc(firebaseService.getDb(), 'chats', chatId);
        const lastReadField = `lastRead.${currentUser.uid}`;
        await firebaseService.setDoc(chatRef, {
            [lastReadField]: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error updating last read:', error);
    }
}

/**
 * Get the count of unread messages in a chat for the current user
 * @param {string} chatId - The chat ID to check
 * @returns {Promise<number>} Number of unread messages
 */
export async function getUnreadCount(chatId) {
    const currentUser = store.getCurrentUser();
    if (!currentUser || !chatId) return 0;

    try {
        // Get chat metadata to find lastRead timestamp (force server fetch to avoid cache)
        const chatDocRef = doc(firebaseService.getDb(), 'chats', chatId);
        const chatDoc = await firebaseService.getDoc(chatDocRef);
        const lastReadTimestamp = chatDoc.exists()
            ? chatDoc.data()?.lastRead?.[currentUser.uid]
            : null;

        // Get all messages
        const messagesRef = collection(firebaseService.getDb(), 'chats', chatId, 'messages');
        const messagesSnapshot = await firebaseService.getDocs(messagesRef);

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
 * Set typing indicator status for current user in a chat
 * @param {string} chatId - The chat ID
 * @param {boolean} isTyping - Whether user is currently typing
 */
export async function setTypingIndicator(chatId, isTyping) {
    const currentUser = store.getCurrentUser();
    if (!currentUser || !chatId) return;

    try {
        const chatRef = doc(firebaseService.getDb(), 'chats', chatId);
        const typingField = `typing.${currentUser.uid}`;

        if (isTyping) {
            await firebaseService.setDoc(chatRef, {
                [typingField]: {
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    timestamp: serverTimestamp()
                }
            }, { merge: true });
        } else {
            await firebaseService.updateDoc(chatRef, {
                [typingField]: deleteField()
            });
        }
    } catch (error) {
        console.error('Error setting typing indicator:', error);
    }
}

/**
 * Listen to messages in real-time for a chat
 * Sets up listeners for both messages and typing indicators
 * @param {string} chatId - Chat ID to listen to
 */
export function listenToMessages(chatId) {
    const currentUser = store.getCurrentUser();
    if (!currentUser || !chatId) return;

    // Unsubscribe from previous listeners if exists
    const unsubMessages = store.getUnsubscriber('messages');
    const unsubTyping = store.getUnsubscriber('typingIndicator');

    if (unsubMessages) {
        unsubMessages();
    }
    if (unsubTyping) {
        unsubTyping();
    }

    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    // Track scroll position to enable smart auto-scroll
    let isNearBottom = true;
    messagesContainer.addEventListener('scroll', () => {
        const threshold = 100; // px from bottom
        const position = messagesContainer.scrollTop + messagesContainer.clientHeight;
        const height = messagesContainer.scrollHeight;
        isNearBottom = (height - position) < threshold;
        store.setState('isNearBottom', isNearBottom);
    });

    // Listen to messages
    const messagesRef = collection(firebaseService.getDb(), 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribeMessages = firebaseService.onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            messagesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-emoji">💬</div>
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `;
            return;
        }

        const previousScrollHeight = messagesContainer.scrollHeight;
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

        // Smart auto-scroll: only scroll if user was near bottom or if new message is from current user
        if (isNearBottom || snapshot.docChanges().some(change => {
            return change.type === 'added' && change.doc.data().senderId === currentUser.uid;
        })) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            // Maintain scroll position when new messages arrive from others
            messagesContainer.scrollTop = messagesContainer.scrollHeight - previousScrollHeight;
        }
    }, (error) => {
        console.error('Error listening to messages:', error);
    });

    // Store unsubscriber
    store.setUnsubscriber('messages', unsubscribeMessages);

    // Listen to typing indicators
    const chatRef = doc(firebaseService.getDb(), 'chats', chatId);
    const unsubscribeTypingIndicator = firebaseService.onSnapshot(chatRef, (docSnap) => {
        const typingContainer = document.getElementById('typingIndicatorContainer');
        if (!typingContainer) return;

        if (docSnap.exists()) {
            const chatData = docSnap.data();
            const typingUsers = chatData.typing || {};

            // Filter out current user and get other users who are typing
            const otherTypingUsers = Object.entries(typingUsers)
                .filter(([uid]) => uid !== currentUser.uid)
                .map(([, data]) => data.name);

            if (otherTypingUsers.length > 0) {
                const names = otherTypingUsers.join(', ');
                typingContainer.innerHTML = `<div class="typing-indicator">${names} ${otherTypingUsers.length === 1 ? 'is' : 'are'} typing...</div>`;
                typingContainer.style.display = 'block';
            } else {
                typingContainer.innerHTML = '';
                typingContainer.style.display = 'none';
            }
        }
    });

    // Store unsubscriber
    store.setUnsubscriber('typingIndicator', unsubscribeTypingIndicator);
}

/**
 * Send a message in the current chat
 */
export async function sendMessage() {
    const currentUser = store.getCurrentUser();
    const currentChatId = store.getCurrentChatId();
    const currentItemId = store.getCurrentItemId();

    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text || !currentChatId) return;

    try {
        // Clear typing indicator before sending
        await setTypingIndicator(currentChatId, false);
        const typingTimeout = store.getState('typingTimeout');
        if (typingTimeout) {
            clearTimeout(typingTimeout);
            store.setState('typingTimeout', null);
        }

        const messagesRef = collection(firebaseService.getDb(), 'chats', currentChatId, 'messages');

        await firebaseService.addDoc(messagesRef, {
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email.split('@')[0],
            senderEmail: currentUser.email,
            createdAt: serverTimestamp()
        });

        // Log analytics if function exists
        if (window.logAnalytics) {
            await window.logAnalytics('send_message', currentItemId, {
                chatId: currentChatId,
                messageLength: text.length
            });
        }

        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

/**
 * Handle typing events in chat input to show/hide typing indicator
 */
export function handleChatTyping() {
    const currentChatId = store.getCurrentChatId();
    if (!currentChatId) return;

    // Set typing indicator
    setTypingIndicator(currentChatId, true);

    // Clear existing timeout
    const existingTimeout = store.getState('typingTimeout');
    if (existingTimeout) {
        clearTimeout(existingTimeout);
    }

    // Clear typing indicator after 3 seconds of inactivity
    const typingTimeout = setTimeout(() => {
        setTypingIndicator(currentChatId, false);
        store.setState('typingTimeout', null);
    }, 3000);

    store.setState('typingTimeout', typingTimeout);
}

/**
 * Open chat for an item
 * @param {string} itemId - Item ID
 * @param {string|null} forceChatId - Optional chat ID to use
 * @param {string|null} fromView - View to return to on back
 */
export async function openChat(itemId, forceChatId = null, fromView = null) {
    const item = store.getCurrentItemData();
    const currentUser = store.getCurrentUser();

    if (!item || !currentUser) return;

    // Import analytics and session functions dynamically to avoid circular dependencies
    const { logAnalytics } = await import('../analytics/analyticsLogger.js');
    const { trackChatOpen } = await import('../analytics/sessionRecorder.js');
    const { showView } = await import('../../ui/viewManager.js');

    // Log analytics
    await logAnalytics('open_chat', itemId, {
        itemName: item.name,
        ownerId: item.ownerId
    });

    // Track chat open in session recording
    const sessionId = store.getState('session')?.sessionId;
    if (sessionId) {
        trackChatOpen(itemId, item.name);
    }

    // Use forceChatId if provided, otherwise calculate chatId
    const chatId = forceChatId || getChatId(itemId, currentUser.uid);
    store.setCurrentChatId(chatId);
    store.setCurrentItemId(itemId);

    // Store where we came from for back navigation
    if (fromView) {
        store.setState('chatPreviousView', fromView);
    } else {
        store.setState('chatPreviousView', null);
    }

    // Determine the other user for chat header
    let otherUserName = item.ownerName;
    if (forceChatId && currentUser.uid === item.ownerId) {
        // If current user is owner, the other user is the renter
        try {
            const chatRef = doc(firebaseService.getDb(), 'chats', chatId);
            const chatDoc = await firebaseService.getDoc(chatRef);
            if (chatDoc.exists()) {
                const chatData = chatDoc.data();
                otherUserName = chatData.renterName || 'Renter';
            }
        } catch (error) {
            console.error('Error fetching chat data:', error);
            otherUserName = 'Renter';
        }
    }

    // Update chat header
    const chatHeader = document.getElementById('chatHeader');
    if (chatHeader) {
        chatHeader.innerHTML = `
            <div><strong>Chat about:</strong> ${item.name}</div>
            <div><strong>With:</strong> ${otherUserName}</div>
        `;
    }

    // Mark messages as read
    await updateLastRead(chatId);

    // Listen to messages in real-time
    listenToMessages(chatId);

    showView('chatView');
}
