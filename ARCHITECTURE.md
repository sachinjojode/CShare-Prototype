# 🏗️ CShare 架構文檔

## 系統架構概覽

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser / User                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                      HTML + CSS (View Layer)                    │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐      │
│  │ index.   │ login.   │ modals   │ forms    │ grids    │      │
│  │ html     │ html     │          │          │          │      │
│  └──────────┴──────────┴──────────┴──────────┴──────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                    src/app.js (Orchestrator)                    │
│                  - 協調所有模組                                   │
│                  - 設置事件監聽                                   │
│                  - 初始化應用                                     │
└─────────────────────────────────────────────────────────────────┘
            ↓               ↓               ↓               ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Modules   │  │  Services   │  │   Stores    │  │     UI      │
│   (核心)    │  │  (服務層)   │  │  (狀態)     │  │   (渲染)    │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

---

## 📦 分層架構 (Layered Architecture)

### 第 1 層: 表現層 (Presentation Layer)
**位置**: HTML/CSS 檔案
**職責**: 用戶界面結構和樣式

```
index.html          主應用頁面
login.html          登入頁面
styles.css          全局樣式
```

### 第 2 層: 應用協調層 (Application Orchestration)
**位置**: `src/app.js`
**職責**:
- 初始化應用
- 協調各模組
- 設置全局事件監聽
- 暴露函數給 HTML

```javascript
// src/app.js 的角色
┌──────────────────────────────────────┐
│  1. 導入所有模組                      │
│  2. 初始化 Firebase                   │
│  3. 設置認證監聽                      │
│  4. 初始化狀態管理                    │
│  5. 設置事件監聽器                    │
│  6. 暴露必要函數到 window             │
└──────────────────────────────────────┘
```

### 第 3 層: 業務邏輯層 (Business Logic Layer)

#### 3A. 核心模組 (`src/modules/`)
```
src/modules/
├── auth/                    認證與授權
│   └── authManager.js       • 登入/登出邏輯
│                           • 用戶狀態管理
│
├── ranking/                 排名與推薦系統
│   └── rankingAlgorithm.js  • 多維度評分
│                           • 權重計算
│                           • 排序算法
│
├── chat/                    即時聊天系統
│   └── chatManager.js       • 消息收發
│                           • 打字指示
│                           • 未讀計數
│
├── items/                   物品管理
│   └── itemManager.js       • CRUD 操作
│                           • 可用性管理
│                           • 移交時間
│
├── booking/                 預訂系統
│   └── bookingManager.js    • 預訂請求
│                           • 衝突檢測
│                           • 狀態管理
│
├── preferences/             用戶偏好
│   └── preferencesManager.js • 偏好設置
│                           • 權重配置
│
├── analytics/               分析追蹤
│   ├── analyticsLogger.js   • 事件記錄
│   └── sessionRecorder.js   • 會話追蹤
│
├── dashboard/               數據儀表板
│   ├── dashboardManager.js  • 數據展示
│   └── sessionReplay.js     • 會話重放
│
└── testing/                 測試工具
    ├── automatedTest.js     • 自動化測試
    ├── testDataGenerator.js • 資料生成
    └── dataCleaner.js       • 資料清理
```

#### 3B. UI 模組 (`src/ui/`)
```
src/ui/
├── viewManager.js           視圖切換管理
├── itemRenderer.js          物品列表渲染
├── chatRenderer.js          聊天列表渲染
└── modalManager.js          Modal 控制
```

### 第 4 層: 服務層 (Service Layer)
**位置**: `src/services/`
**職責**: 封裝外部服務調用

```javascript
// src/services/firebaseService.js
┌───────────────────────────────┐
│  Firebase Service (Singleton) │
├───────────────────────────────┤
│  • 封裝 Firebase SDK          │
│  • 統一數據庫操作             │
│  • 統一認證操作               │
│  • 錯誤處理                   │
└───────────────────────────────┘
```

### 第 5 層: 狀態管理層 (State Management)
**位置**: `src/stores/`
**職責**: 集中式狀態存儲

```javascript
// src/stores/stateStore.js
┌─────────────────────────────┐
│  State Store (Singleton)    │
├─────────────────────────────┤
│  State:                     │
│  • currentUser              │
│  • currentChatId            │
│  • currentItemId            │
│  • userPreferences          │
│  • session data             │
│  • dashboard data           │
│                             │
│  Methods:                   │
│  • subscribe(key, callback) │
│  • setState(key, value)     │
│  • getState(key)            │
└─────────────────────────────┘

// src/stores/cacheStore.js
┌─────────────────────────────┐
│  Cache Store (Singleton)    │
├─────────────────────────────┤
│  Cache:                     │
│  • rankingIndex {}          │
│  • items Map                │
│  • chats Map                │
│                             │
│  Methods:                   │
│  • getRankingIndex()        │
│  • setItem(id, data)        │
│  • clearAll()               │
└─────────────────────────────┘
```

### 第 6 層: 工具層 (Utility Layer)
**位置**: `src/utils/`
**職責**: 通用工具函數

```
src/utils/
├── constants.js        常量定義（Emoji, 狀態等）
├── formatters.js       格式化函數（價格、時間等）
└── validators.js       驗證函數（日期、可用性等）
```

### 第 7 層: 數據層 (Data Layer)
**位置**: Firebase Firestore
**職責**: 數據持久化

```
Firestore Collections:
├── items               物品集合
├── chats               聊天集合
│   └── [chatId]/messages  消息子集合
├── bookings            預訂集合
├── bookingLocks        預訂鎖集合
├── users               用戶集合
│   └── [uid]/preferences  偏好子集合
├── analytics           分析事件集合
└── sessions            會話集合
    └── [sessionId]/events 事件子集合
```

---

## 🔄 數據流 (Data Flow)

### 典型操作流程: 搜尋物品

```
User Input (搜尋框)
    ↓
[HTML] onChange event
    ↓
[app.js] searchItems()
    ↓
[firebaseService] getDocs('items')
    ↓
[Firestore] 返回物品資料
    ↓
[rankingAlgorithm] rankItems(items, query)
    ↓ (使用 userPreferences from store)
[stateStore] getUserPreferences()
    ↓
[rankingAlgorithm] 返回排序後的物品
    ↓
[itemRenderer] renderItems(rankedItems)
    ↓
[cacheStore] setRankingIndex(items)
    ↓
[HTML] 更新 DOM 顯示物品
```

### 典型操作流程: 提交預訂

```
User Action (點擊預訂按鈕)
    ↓
[HTML] onClick → openBookingModal(itemId)
    ↓
[bookingManager] openBookingModal()
    ↓
[HTML] 用戶填寫日期
    ↓
[HTML] onSubmit → submitBookingRequest()
    ↓
[bookingManager] submitBookingRequest()
    ↓ (1) 驗證日期
[validators] validateBookingDates()
    ↓ (2) 驗證可用性
[validators] validateAvailability(item, dates)
    ↓ (3) 檢查衝突
[validators] buildLockIds()
    ↓
[firebaseService] getDocs(bookingLocks)
    ↓ (4) 創建預訂
[firebaseService] batch.set(booking)
[firebaseService] batch.set(locks)
    ↓
[firebaseService] batch.commit()
    ↓ (5) 記錄分析
[analyticsLogger] logAnalytics('booking_attempt')
    ↓
[HTML] 顯示成功消息
```

### 狀態更新流程: 用戶偏好變更

```
User Action (調整偏好滑桿)
    ↓
[HTML] onInput → updatePreferencesPreview()
    ↓
[preferencesManager] updatePreferencesPreview()
    ↓ (實時更新 UI)
[HTML] 顯示權重描述
    ↓
User Action (保存偏好)
    ↓
[HTML] onSubmit → savePreferences()
    ↓
[preferencesManager] savePreferences()
    ↓
[firebaseService] setDoc(preferences)
    ↓
[stateStore] setUserPreferences(newPrefs)
    ↓ (觸發重新排名)
[itemManager] loadItems()
    ↓
[rankingAlgorithm] rankItems() (使用新偏好)
    ↓
[itemRenderer] renderItems()
    ↓
[HTML] 更新顯示（物品順序改變）
```

---

## 🔗 模組依賴圖

```
┌─────────────────────────────────────────────────────────────┐
│                          app.js                             │
└─────────────────────────────────────────────────────────────┘
         │
         ├──────────────────────────────────────────────┐
         │                                              │
         ↓                                              ↓
┌──────────────────┐                          ┌──────────────────┐
│  firebaseService │◄─────────────────────────│   stateStore     │
│                  │                          │                  │
│  (Singleton)     │                          │  (Singleton)     │
└──────────────────┘                          └──────────────────┘
         ↑                                              ↑
         │                                              │
    ┌────┴────┬────┬────┬────┬────┬────┬────┐         │
    │         │    │    │    │    │    │    │         │
    ↓         ↓    ↓    ↓    ↓    ↓    ↓    ↓         │
┌────────┐ ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐│
│  auth  │ │chat││items││book││pref││anal││dash││test││
│ Manager│ │Mgr ││Mgr  ││Mgr ││Mgr ││ytics││brd ││ing ││
└────────┘ └────┘└────┘└────┘└────┘└────┘└────┘└────┘│
                     │    │                            │
                     ↓    ↓                            │
              ┌──────────────┐                        │
              │  ranking     │                        │
              │  Algorithm   │◄───────────────────────┘
              └──────────────┘
                     ↑
                     │
         ┌───────────┴───────────┐
         │                       │
         ↓                       ↓
    ┌─────────┐           ┌──────────┐
    │ utils/  │           │   ui/    │
    │ • const │           │ • view   │
    │ • format│           │ • render │
    │ • valid │           │ • modal  │
    └─────────┘           └──────────┘
```

**依賴說明**:
- `→` 表示直接依賴
- 所有業務模組都依賴 `firebaseService` 和 `stateStore`
- `rankingAlgorithm` 是獨立模組，僅依賴 `stateStore` 和 `utils`
- `ui` 模組依賴 `utils` 和 `ranking` (用於渲染匹配分數)

---

## 🎯 設計模式

### 1. Singleton Pattern (單例模式)
**應用**: `firebaseService`, `stateStore`, `cacheStore`

```javascript
// 確保全局只有一個實例
class StateStore { /* ... */ }
export const store = new StateStore(); // 導出單例
```

**優點**:
- 全局狀態統一管理
- 避免重複初始化 Firebase
- 保證數據一致性

### 2. Module Pattern (模組模式)
**應用**: 所有 `src/modules/*` 模組

```javascript
// 每個模組封裝相關功能
export function loadItems() { /* ... */ }
export function createListing() { /* ... */ }
// 內部變量不暴露
```

**優點**:
- 封裝性好
- 避免全局污染
- 易於測試

### 3. Observer Pattern (觀察者模式)
**應用**: `stateStore` 的訂閱機制

```javascript
// 訂閱狀態變化
store.subscribe('currentUser', (user) => {
    console.log('User changed:', user);
});

// 發布變化
store.setState('currentUser', newUser); // 觸發訂閱者
```

**優點**:
- 解耦組件間通訊
- 響應式狀態更新

### 4. Facade Pattern (外觀模式)
**應用**: `firebaseService` 封裝 Firebase SDK

```javascript
// 簡化複雜的 Firebase 操作
class FirebaseService {
    async getDoc(docRef) {
        return getDoc(docRef); // 統一接口
    }
}
```

**優點**:
- 簡化複雜操作
- 統一錯誤處理
- 易於替換底層實現

### 5. Strategy Pattern (策略模式)
**應用**: 排名演算法的多維度評分

```javascript
// 不同評分策略
const scorers = {
    searchMatch: (item, query) => { /* ... */ },
    categoryPreference: (item, prefs) => { /* ... */ },
    availabilityOverlap: (item, dates) => { /* ... */ }
};
```

**優點**:
- 靈活的評分權重
- 易於添加新維度

---

## 🔐 安全考量

### 1. 認證驗證
```javascript
// authManager.js
setupAuthListener((user) => {
    if (user && user.email.endsWith('.edu')) {
        // 僅允許 .edu 郵箱
    } else {
        window.location.href = '/login.html';
    }
});
```

### 2. 數據驗證
```javascript
// validators.js
export function validateBookingDates(startDate, endDate) {
    // 防止過去日期
    if (startDate < today) {
        return { valid: false, message: '...' };
    }
}
```

### 3. Firestore 規則 (需配置)
```javascript
// firestore.rules (建議)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == resource.data.ownerId;
    }
  }
}
```

---

## ⚡ 性能優化

### 1. 緩存策略
```javascript
// cacheStore.js
// 緩存排名結果，避免重複計算
cache.setRankingIndex(rankedItems);
```

### 2. 防抖 (Debouncing)
```javascript
// sessionRecorder.js
// 滾動事件防抖，減少日誌寫入
let scrollDebounceTimer;
function trackScroll() {
    clearTimeout(scrollDebounceTimer);
    scrollDebounceTimer = setTimeout(() => {
        logSessionEvent('scroll', data);
    }, 500);
}
```

### 3. 智能滾動
```javascript
// chatManager.js
// 僅在用戶接近底部時自動滾動
if (isNearBottom) {
    scrollToBottom();
}
```

### 4. 批量操作
```javascript
// bookingManager.js
// 使用 Firestore batch 減少網絡請求
const batch = writeBatch(db);
batch.set(bookingRef, bookingData);
lockIds.forEach(id => batch.set(lockRef, lockData));
await batch.commit(); // 一次性提交
```

---

## 📈 可擴展性

### 添加新模組範例

**場景**: 添加「收藏功能」

```javascript
// 1. 創建模組
// src/modules/favorites/favoritesManager.js
import { firebaseService } from '../../services/firebaseService.js';
import { store } from '../../stores/stateStore.js';

export async function addToFavorites(itemId) {
    const user = store.getCurrentUser();
    await firebaseService.setDoc(
        firebaseService.doc('users', user.uid, 'favorites', itemId),
        { itemId, createdAt: serverTimestamp() }
    );
}

export async function loadFavorites() {
    // ...
}

// 2. 在 app.js 中集成
import { addToFavorites, loadFavorites } from './modules/favorites/favoritesManager.js';
window.addToFavorites = addToFavorites;

// 3. 在 HTML 中使用
<button onclick="addToFavorites('item123')">❤️ 收藏</button>
```

---

## 🧪 測試策略

### 單元測試 (建議使用 Jest)
```javascript
// __tests__/utils/formatters.test.js
import { formatPrice } from '../../src/utils/formatters.js';

describe('formatPrice', () => {
    it('should format free items', () => {
        expect(formatPrice(0)).toBe('FREE');
    });

    it('should format paid items', () => {
        expect(formatPrice(5.5)).toBe('$5.50/day');
    });
});
```

### 集成測試 (建議使用 Playwright)
```javascript
// e2e/booking.spec.js
test('should submit booking request', async ({ page }) => {
    await page.goto('http://localhost:8000');
    await page.click('#searchBtn');
    await page.click('.item-card:first-child');
    await page.click('#bookingBtn');
    await page.fill('#bookingStartDate', '2025-12-10');
    await page.fill('#bookingEndDate', '2025-12-12');
    await page.click('#submitBooking');
    await expect(page.locator('.success-message')).toBeVisible();
});
```

---

## 📊 監控與日誌

### 分析追蹤
```javascript
// 自動追蹤的事件
- navigation: 視圖切換
- click: 用戶點擊
- scroll: 頁面滾動
- search: 搜尋查詢
- view_item: 查看物品
- chat_open: 打開聊天
- booking_attempt: 預訂嘗試
```

### 會話重放
```javascript
// 記錄的數據
- 事件時間戳
- 事件類型
- 事件數據
- 用戶路徑
- 可在儀表板重放
```

---

## 🎓 最佳實踐

### 1. 模組獨立性
✅ 每個模組應該能獨立測試
✅ 最小化模組間依賴
✅ 通過 `stateStore` 共享狀態

### 2. 錯誤處理
✅ 所有 async 函數使用 try-catch
✅ 友好的用戶錯誤提示
✅ 詳細的控制台日誌

### 3. 代碼風格
✅ 使用 ES6+ 語法
✅ 清晰的函數命名
✅ JSDoc 註釋
✅ 一致的縮排 (2 或 4 空格)

### 4. 性能
✅ 避免不必要的重新渲染
✅ 使用防抖/節流
✅ 緩存計算結果

---

## 🔮 未來展望

### Phase 1: TypeScript 遷移
- 添加類型定義
- 更好的 IDE 支持
- 減少運行時錯誤

### Phase 2: 打包優化
- 使用 Vite 打包
- 代碼分割
- Tree shaking

### Phase 3: PWA 功能
- Service Worker
- 離線支持
- 推送通知

### Phase 4: 自動化測試
- 單元測試覆蓋
- E2E 測試
- CI/CD 流程

---

**文檔版本**: 1.0
**最後更新**: 2025-12-06
**維護者**: CShare Team
