/**
 * Firebase service layer - centralized Firebase operations
 */

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
    updateDoc,
    deleteDoc,
    deleteField,
    query,
    orderBy,
    where,
    limit,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    writeBatch,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import { firebaseConfig } from '../../env-config.js';

class FirebaseService {
    constructor() {
        this.app = initializeApp(firebaseConfig);
        this.auth = getAuth(this.app);
        this.db = getFirestore(this.app);

        // Bind instance methods that rely on `this` so destructuring won't lose context
        this.getAuth = this.getAuth.bind(this);
        this.getCurrentUser = this.getCurrentUser.bind(this);
        this.onAuthStateChanged = this.onAuthStateChanged.bind(this);
        this.signOut = this.signOut.bind(this);
        this.getDb = this.getDb.bind(this);
        this.collection = this.collection.bind(this);
        this.doc = this.doc.bind(this);
        this.writeBatch = this.writeBatch.bind(this);
    }

    // Auth methods
    getAuth() {
        return this.auth;
    }

    getCurrentUser() {
        return this.auth.currentUser;
    }

    onAuthStateChanged(callback) {
        return onAuthStateChanged(this.auth, callback);
    }

    async signOut() {
        return signOut(this.auth);
    }

    // Firestore methods
    getDb() {
        return this.db;
    }

    collection(path) {
        return collection(this.db, path);
    }

    doc(...pathSegments) {
        return doc(this.db, ...pathSegments);
    }

    async addDoc(collectionRef, data) {
        return addDoc(collectionRef, data);
    }

    async getDoc(docRef) {
        return getDoc(docRef);
    }

    async getDocs(queryRef) {
        return getDocs(queryRef);
    }

    async setDoc(docRef, data, options) {
        return setDoc(docRef, data, options);
    }

    async updateDoc(docRef, data) {
        return updateDoc(docRef, data);
    }

    async deleteDoc(docRef) {
        return deleteDoc(docRef);
    }

    query(collectionRef, ...queryConstraints) {
        return query(collectionRef, ...queryConstraints);
    }

    where(field, operator, value) {
        return where(field, operator, value);
    }

    orderBy(field, direction) {
        return orderBy(field, direction);
    }

    limit(limitNum) {
        return limit(limitNum);
    }

    onSnapshot(ref, callback, errorCallback) {
        return onSnapshot(ref, callback, errorCallback);
    }

    serverTimestamp() {
        return serverTimestamp();
    }

    Timestamp() {
        return Timestamp;
    }

    deleteField() {
        return deleteField();
    }

    writeBatch() {
        return writeBatch(this.db);
    }

    arrayUnion(...elements) {
        return arrayUnion(...elements);
    }
}

// Export singleton instance
export const firebaseService = new FirebaseService();

// Export commonly used Firestore utilities
export {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
    deleteField,
    arrayUnion
};
