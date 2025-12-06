/**
 * Cache store for frequently accessed data
 */

class CacheStore {
    constructor() {
        this.cache = {
            rankingIndex: {},
            items: new Map(),
            chats: new Map(),
            bookings: new Map()
        };
    }

    /**
     * Get ranking index cache
     */
    getRankingIndex() {
        return this.cache.rankingIndex;
    }

    /**
     * Set ranking index cache
     * @param {Object} index - Ranking index object
     */
    setRankingIndex(index) {
        this.cache.rankingIndex = index;
    }

    /**
     * Update a single item in ranking index
     * @param {string} itemId - Item ID
     * @param {Object} itemData - Item data with ranking
     */
    updateRankingIndexItem(itemId, itemData) {
        this.cache.rankingIndex[itemId] = itemData;
    }

    /**
     * Clear ranking index cache
     */
    clearRankingIndex() {
        this.cache.rankingIndex = {};
    }

    /**
     * Get cached item
     * @param {string} itemId - Item ID
     */
    getItem(itemId) {
        return this.cache.items.get(itemId);
    }

    /**
     * Set cached item
     * @param {string} itemId - Item ID
     * @param {Object} itemData - Item data
     */
    setItem(itemId, itemData) {
        this.cache.items.set(itemId, itemData);
    }

    /**
     * Clear items cache
     */
    clearItems() {
        this.cache.items.clear();
    }

    /**
     * Get cached chat
     * @param {string} chatId - Chat ID
     */
    getChat(chatId) {
        return this.cache.chats.get(chatId);
    }

    /**
     * Set cached chat
     * @param {string} chatId - Chat ID
     * @param {Object} chatData - Chat data
     */
    setChat(chatId, chatData) {
        this.cache.chats.set(chatId, chatData);
    }

    /**
     * Clear chats cache
     */
    clearChats() {
        this.cache.chats.clear();
    }

    /**
     * Clear all caches
     */
    clearAll() {
        this.clearRankingIndex();
        this.clearItems();
        this.clearChats();
        this.cache.bookings.clear();
    }
}

// Export singleton instance
export const cache = new CacheStore();
