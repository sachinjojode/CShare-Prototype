# Firebase Setup Guide for CShare

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `cshare-cornell` (or your preferred name)
4. Disable Google Analytics (optional for now)
5. Click "Create project"

## Step 2: Enable Authentication

1. In Firebase Console, click "Build" → "Authentication"
2. Click "Get started"
3. Select "Email/Password" sign-in method
4. Enable "Email/Password" toggle
5. Click "Save"

## Step 3: Create Firestore Database

1. Click "Build" → "Firestore Database"
2. Click "Create database"
3. Select "Start in test mode" (we'll add security rules later)
4. Choose a location (us-central1 recommended for Cornell)
5. Click "Enable"

## Step 4: Set Up Security Rules

### Firestore Rules
Replace the default rules with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check .edu email
    function isEduUser() {
      return request.auth != null && 
             request.auth.token.email.matches(".*\\.edu$");
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isEduUser();
      allow write: if isEduUser() && request.auth.uid == userId;
    }
    
    // Items collection
    match /items/{itemId} {
      allow read: if isEduUser();
      allow create: if isEduUser() && 
                       request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if isEduUser() && 
                               resource.data.ownerId == request.auth.uid;
    }
    
    // Messages collection
    match /messages/{messageId} {
      allow read: if isEduUser();
      allow create: if isEduUser() && 
                       request.resource.data.senderId == request.auth.uid;
    }
    
    // Chats collection (for organizing messages)
    match /chats/{chatId} {
      allow read: if isEduUser();
      allow write: if isEduUser();
      
      match /messages/{messageId} {
        allow read: if isEduUser();
        allow create: if isEduUser();
      }
    }
  }
}
```

Click "Publish" to save the rules.

## Step 5: Get Your Firebase Config

1. In Firebase Console, click the gear icon (⚙️) next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (`</>`) to add a web app
5. Register app with nickname: "CShare Web"
6. Copy the `firebaseConfig` object
7. Paste it into `firebase-config.js` and `login.html`

Your config will look like:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 6: Update Configuration Files

Replace the placeholder config in these files:
- `login.html` (line ~202)
- `firebase-config.js` (line 5)

## Step 7: Test Your Setup

1. Open `login.html` in your browser
2. Try to sign up with a .edu email
3. Check Firebase Console → Authentication → Users to see if user was created
4. Check Firestore Database → users collection to see user data

## Step 8: Create Test Users

Create a few test accounts:
1. student1@cornell.edu
2. student2@cornell.edu
3. student3@cornell.edu

Use different browsers or incognito windows to test chat functionality between users.

## Firestore Collections Structure

### users
```javascript
{
  uid: "user-id",
  name: "Student Name",
  email: "student@cornell.edu",
  createdAt: timestamp
}
```

### items
```javascript
{
  id: "item-id",
  name: "Item Name",
  category: "Category",
  description: "Description",
  price: 0,
  ownerId: "user-id",
  ownerName: "Owner Name",
  ownerEmail: "owner@cornell.edu",
  emoji: "📦",
  createdAt: timestamp
}
```

### chats/{chatId}/messages
Where chatId = `${itemId}_${userId1}_${userId2}` (sorted)

```javascript
{
  text: "Message text",
  senderId: "user-id",
  senderName: "Sender Name",
  senderEmail: "sender@cornell.edu",
  createdAt: timestamp
}
```

## Troubleshooting

### Issue: "Firebase: Error (auth/configuration-not-found)"
- Solution: Make sure you've replaced the placeholder config with your actual Firebase config

### Issue: "Missing or insufficient permissions"
- Solution: Check that your Firestore security rules are published correctly

### Issue: "auth/email-already-in-use"
- Solution: This email is already registered. Use login instead of signup.

### Issue: Chat messages not showing
- Solution: 
  - Check browser console for errors
  - Verify Firestore rules allow read access
  - Make sure both users are logged in with .edu emails

## Next Steps

1. Deploy to Firebase Hosting (optional):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init hosting
   firebase deploy
   ```

2. Add custom domain (optional)
3. Enable Google Sign-In for easier login
4. Add email verification requirement
5. Implement password reset functionality
