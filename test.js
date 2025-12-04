/**
 * CShare Prototype - Comprehensive Test Suite
 *
 * This test suite validates core functionality of the CShare application
 * including utility functions, data structures, and business logic.
 *
 * Run with: node test.js
 */

// Test framework - simple assertion library
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.errors = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(
                message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
            );
        }
    }

    assertDeepEqual(actual, expected, message) {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
            throw new Error(
                message || `Expected ${expectedStr} but got ${actualStr}`
            );
        }
    }

    assertThrows(fn, message) {
        let threw = false;
        try {
            fn();
        } catch (e) {
            threw = true;
        }
        if (!threw) {
            throw new Error(message || 'Expected function to throw an error');
        }
    }

    async run() {
        console.log('\n🧪 CShare Prototype Test Suite\n');
        console.log('=' .repeat(60));

        for (const { name, fn } of this.tests) {
            try {
                await fn(this);
                this.passed++;
                console.log(`✅ ${name}`);
            } catch (error) {
                this.failed++;
                this.errors.push({ name, error: error.message });
                console.log(`❌ ${name}`);
                console.log(`   Error: ${error.message}`);
            }
        }

        console.log('=' .repeat(60));
        console.log(`\n📊 Test Results:`);
        console.log(`   Total: ${this.tests.length}`);
        console.log(`   Passed: ${this.passed} ✅`);
        console.log(`   Failed: ${this.failed} ❌`);
        console.log(`   Success Rate: ${((this.passed / this.tests.length) * 100).toFixed(1)}%\n`);

        if (this.failed > 0) {
            console.log('Failed Tests:');
            this.errors.forEach(({ name, error }) => {
                console.log(`   - ${name}: ${error}`);
            });
            console.log('');
        }

        return this.failed === 0;
    }
}

// Utility Functions (extracted from app.js for testing)

function formatPrice(price) {
    return price === 0 ? "FREE" : `$${parseFloat(price).toFixed(2)}/day`;
}

function weightDescriptor(value) {
    const descriptors = {
        0: "Off",
        1: "Very Low",
        2: "Low",
        3: "Medium",
        4: "High",
        5: "Very High"
    };
    return descriptors[value] || "Medium";
}

function buildLockIds(itemId, startDate, endDate) {
    const lockIds = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
        const dateString = currentDate.toISOString().split('T')[0];
        lockIds.push(`${itemId}_${dateString}`);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return lockIds;
}

function getChatId(itemId, userId) {
    return [itemId, userId].sort().join('_');
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

// Simulated ranking function (core business logic)
function calculateMatchScore(item, preferences, searchQuery, desiredStart, desiredEnd) {
    const weights = {
        price: preferences?.priceWeight || 3,
        category: preferences?.categoryWeight || 3,
        availability: preferences?.availabilityWeight || 3,
        urgency: preferences?.urgencyWeight || 3
    };

    let score = 0;
    const breakdown = {};

    // Price score (0-100, inverse: lower price = higher score)
    if (weights.price > 0) {
        const maxPrice = 50; // Assuming max reasonable price
        const priceScore = item.price === 0
            ? 100
            : Math.max(0, 100 - (item.price / maxPrice) * 100);
        breakdown.price = priceScore;
        score += priceScore * weights.price;
    }

    // Category match (0 or 100)
    if (weights.category > 0 && preferences?.favoriteCategories) {
        const categoryScore = preferences.favoriteCategories.includes(item.category) ? 100 : 0;
        breakdown.category = categoryScore;
        score += categoryScore * weights.category;
    }

    // Availability score (mocked - would check against bookingLocks)
    if (weights.availability > 0) {
        const availabilityScore = item.available ? 100 : 0;
        breakdown.availability = availabilityScore;
        score += availabilityScore * weights.availability;
    }

    // Urgency score (closer desired dates = higher score)
    if (weights.urgency > 0 && desiredStart) {
        const daysUntilStart = Math.floor((new Date(desiredStart) - new Date()) / (1000 * 60 * 60 * 24));
        const urgencyScore = daysUntilStart <= 1 ? 100 : Math.max(0, 100 - daysUntilStart * 5);
        breakdown.urgency = urgencyScore;
        score += urgencyScore * weights.urgency;
    }

    // Normalize by total weight
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;

    return { score: normalizedScore, breakdown };
}

// Test Data
const mockItems = [
    {
        id: 'item1',
        name: 'Coffee Maker',
        category: 'Kitchen',
        price: 5,
        description: 'Drip coffee maker',
        available: true,
        owner: 'user1'
    },
    {
        id: 'item2',
        name: 'Vacuum Cleaner',
        category: 'Appliances',
        price: 0,
        description: 'Dyson vacuum',
        available: true,
        owner: 'user2'
    },
    {
        id: 'item3',
        name: 'Laptop Stand',
        category: 'Electronics',
        price: 3,
        description: 'Adjustable laptop stand',
        available: false,
        owner: 'user3'
    },
    {
        id: 'item4',
        name: 'Desk Chair',
        category: 'Furniture',
        price: 10,
        description: 'Ergonomic office chair',
        available: true,
        owner: 'user4'
    }
];

const mockPreferences = {
    priceWeight: 4,
    categoryWeight: 5,
    availabilityWeight: 3,
    urgencyWeight: 2,
    favoriteCategories: ['Kitchen', 'Electronics']
};

// Test Suite
const runner = new TestRunner();

// Utility Function Tests
runner.test('formatPrice - handles zero price', (t) => {
    t.assertEqual(formatPrice(0), 'FREE');
});

runner.test('formatPrice - formats regular price', (t) => {
    t.assertEqual(formatPrice(5), '$5.00/day');
});

runner.test('formatPrice - formats decimal price', (t) => {
    t.assertEqual(formatPrice(3.5), '$3.50/day');
});

runner.test('formatPrice - handles string input', (t) => {
    t.assertEqual(formatPrice('7.99'), '$7.99/day');
});

runner.test('weightDescriptor - returns correct descriptors', (t) => {
    t.assertEqual(weightDescriptor(0), 'Off');
    t.assertEqual(weightDescriptor(1), 'Very Low');
    t.assertEqual(weightDescriptor(2), 'Low');
    t.assertEqual(weightDescriptor(3), 'Medium');
    t.assertEqual(weightDescriptor(4), 'High');
    t.assertEqual(weightDescriptor(5), 'Very High');
});

runner.test('weightDescriptor - handles invalid input', (t) => {
    t.assertEqual(weightDescriptor(10), 'Medium');
    t.assertEqual(weightDescriptor(-1), 'Medium');
});

runner.test('buildLockIds - generates correct lock IDs for single day', (t) => {
    const lockIds = buildLockIds('item123', '2024-12-04', '2024-12-04');
    t.assertEqual(lockIds.length, 1);
    t.assertEqual(lockIds[0], 'item123_2024-12-04');
});

runner.test('buildLockIds - generates correct lock IDs for date range', (t) => {
    const lockIds = buildLockIds('item456', '2024-12-04', '2024-12-06');
    t.assertEqual(lockIds.length, 3);
    t.assertEqual(lockIds[0], 'item456_2024-12-04');
    t.assertEqual(lockIds[1], 'item456_2024-12-05');
    t.assertEqual(lockIds[2], 'item456_2024-12-06');
});

runner.test('buildLockIds - handles month boundary', (t) => {
    const lockIds = buildLockIds('item789', '2024-11-30', '2024-12-02');
    t.assertEqual(lockIds.length, 3);
    t.assert(lockIds.includes('item789_2024-11-30'));
    t.assert(lockIds.includes('item789_2024-12-01'));
    t.assert(lockIds.includes('item789_2024-12-02'));
});

runner.test('getChatId - generates consistent chat ID', (t) => {
    const chatId1 = getChatId('item1', 'user1');
    const chatId2 = getChatId('user1', 'item1');
    t.assertEqual(chatId1, chatId2);
});

runner.test('getChatId - different items produce different IDs', (t) => {
    const chatId1 = getChatId('item1', 'user1');
    const chatId2 = getChatId('item2', 'user1');
    t.assert(chatId1 !== chatId2);
});

runner.test('formatTimeAgo - returns "just now" for recent times', (t) => {
    const now = new Date();
    t.assertEqual(formatTimeAgo(now), 'just now');
});

runner.test('formatTimeAgo - formats minutes correctly', (t) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    t.assertEqual(formatTimeAgo(fiveMinutesAgo), '5m ago');
});

runner.test('formatTimeAgo - formats hours correctly', (t) => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    t.assertEqual(formatTimeAgo(threeHoursAgo), '3h ago');
});

runner.test('formatTimeAgo - formats days correctly', (t) => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    t.assertEqual(formatTimeAgo(twoDaysAgo), '2d ago');
});

// Ranking Algorithm Tests
runner.test('calculateMatchScore - free items score higher with price weight', (t) => {
    const freeItem = { ...mockItems[1], price: 0, category: 'Other', available: true };
    const paidItem = { ...mockItems[0], price: 10, category: 'Other', available: true };

    const prefs = { priceWeight: 5, categoryWeight: 0, availabilityWeight: 0, urgencyWeight: 0 };

    const freeScore = calculateMatchScore(freeItem, prefs, '', null, null);
    const paidScore = calculateMatchScore(paidItem, prefs, '', null, null);

    t.assert(freeScore.score > paidScore.score, 'Free item should score higher');
});

runner.test('calculateMatchScore - favorite categories score higher', (t) => {
    const favoriteItem = { ...mockItems[0], category: 'Kitchen', price: 5, available: true };
    const otherItem = { ...mockItems[3], category: 'Furniture', price: 5, available: true };

    const result1 = calculateMatchScore(favoriteItem, mockPreferences, '', null, null);
    const result2 = calculateMatchScore(otherItem, mockPreferences, '', null, null);

    t.assert(result1.score > result2.score, 'Favorite category should score higher');
});

runner.test('calculateMatchScore - unavailable items score lower', (t) => {
    const availableItem = { ...mockItems[0], available: true, price: 5, category: 'Other' };
    const unavailableItem = { ...mockItems[0], available: false, price: 5, category: 'Other' };

    const prefs = { priceWeight: 0, categoryWeight: 0, availabilityWeight: 5, urgencyWeight: 0 };

    const result1 = calculateMatchScore(availableItem, prefs, '', null, null);
    const result2 = calculateMatchScore(unavailableItem, prefs, '', null, null);

    t.assert(result1.score > result2.score, 'Available item should score higher');
});

runner.test('calculateMatchScore - returns score breakdown', (t) => {
    const item = mockItems[0];
    const result = calculateMatchScore(item, mockPreferences, '', null, null);

    t.assert(typeof result.score === 'number', 'Score should be a number');
    t.assert(typeof result.breakdown === 'object', 'Should have breakdown object');
    t.assert('price' in result.breakdown, 'Should have price breakdown');
});

runner.test('calculateMatchScore - score is between 0 and 100', (t) => {
    const item = mockItems[0];
    const result = calculateMatchScore(item, mockPreferences, '', null, null);

    t.assert(result.score >= 0 && result.score <= 100, `Score ${result.score} should be between 0 and 100`);
});

runner.test('calculateMatchScore - handles missing preferences gracefully', (t) => {
    const item = mockItems[0];
    const result = calculateMatchScore(item, null, '', null, null);

    t.assert(typeof result.score === 'number', 'Should return a score even without preferences');
});

// Data Structure Tests
runner.test('mockItems - all items have required fields', (t) => {
    const requiredFields = ['id', 'name', 'category', 'price', 'description', 'available', 'owner'];

    mockItems.forEach(item => {
        requiredFields.forEach(field => {
            t.assert(field in item, `Item ${item.id} should have ${field} field`);
        });
    });
});

runner.test('mockItems - prices are non-negative', (t) => {
    mockItems.forEach(item => {
        t.assert(item.price >= 0, `Item ${item.id} price should be non-negative`);
    });
});

runner.test('mockItems - categories are valid', (t) => {
    const validCategories = ['Appliances', 'Electronics', 'Furniture', 'Kitchen', 'Other'];

    mockItems.forEach(item => {
        t.assert(
            validCategories.includes(item.category),
            `Item ${item.id} category ${item.category} should be valid`
        );
    });
});

// Edge Cases
runner.test('buildLockIds - handles same start and end date', (t) => {
    const lockIds = buildLockIds('item1', '2024-12-04', '2024-12-04');
    t.assertEqual(lockIds.length, 1);
});

runner.test('getChatId - handles empty strings', (t) => {
    const chatId = getChatId('', '');
    t.assertEqual(chatId, '_');
});

runner.test('formatPrice - handles very large numbers', (t) => {
    const result = formatPrice(999999.99);
    t.assertEqual(result, '$999999.99/day');
});

runner.test('formatPrice - handles negative numbers (edge case)', (t) => {
    const result = formatPrice(-5);
    t.assertEqual(result, '$-5.00/day');
});

// Integration Tests
runner.test('Integration - complete ranking workflow', (t) => {
    const items = [...mockItems];
    const scores = items.map(item => ({
        item,
        ...calculateMatchScore(item, mockPreferences, '', null, null)
    }));

    scores.sort((a, b) => b.score - a.score);

    // Verify sorting worked
    for (let i = 0; i < scores.length - 1; i++) {
        t.assert(scores[i].score >= scores[i + 1].score, 'Items should be sorted by score descending');
    }
});

runner.test('Integration - chat ID consistency in workflow', (t) => {
    const itemId = 'item123';
    const userId = 'user456';

    // Simulate multiple chat opens
    const chatId1 = getChatId(itemId, userId);
    const chatId2 = getChatId(itemId, userId);
    const chatId3 = getChatId(userId, itemId); // reversed order

    t.assertEqual(chatId1, chatId2, 'Multiple calls should return same ID');
    t.assertEqual(chatId1, chatId3, 'Order should not matter');
});

runner.test('Integration - booking lock generation for week-long rental', (t) => {
    const startDate = '2024-12-04';
    const endDate = '2024-12-10';
    const lockIds = buildLockIds('item999', startDate, endDate);

    t.assertEqual(lockIds.length, 7, 'Week should generate 7 lock IDs');

    // Verify all dates are included
    const expectedDates = [
        '2024-12-04', '2024-12-05', '2024-12-06', '2024-12-07',
        '2024-12-08', '2024-12-09', '2024-12-10'
    ];

    expectedDates.forEach((date, index) => {
        t.assertEqual(lockIds[index], `item999_${date}`, `Lock ID ${index} should match`);
    });
});

// Performance Tests
runner.test('Performance - formatPrice handles 1000 calls efficiently', (t) => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
        formatPrice(Math.random() * 100);
    }
    const duration = Date.now() - start;

    t.assert(duration < 100, `1000 calls should complete in <100ms (took ${duration}ms)`);
});

runner.test('Performance - calculateMatchScore handles 100 items efficiently', (t) => {
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
        calculateMatchScore(mockItems[0], mockPreferences, '', null, null);
    }
    const duration = Date.now() - start;

    t.assert(duration < 100, `100 score calculations should complete in <100ms (took ${duration}ms)`);
});

// Run all tests
runner.run().then(success => {
    process.exit(success ? 0 : 1);
});
