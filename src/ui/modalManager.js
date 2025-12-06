/**
 * Modal Manager
 * Handles opening and closing of modal dialogs
 */

/**
 * Open a modal by ID
 * @param {string} modalId - The ID of the modal element
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    } else {
        console.warn(`Modal with ID "${modalId}" not found`);
    }
}

/**
 * Close a modal by ID
 * @param {string} modalId - The ID of the modal element
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    } else {
        console.warn(`Modal with ID "${modalId}" not found`);
    }
}

/**
 * Close all open modals
 */
export function closeAllModals() {
    const modals = document.querySelectorAll('.modal.active');
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
}

/**
 * Toggle modal state
 * @param {string} modalId - The ID of the modal element
 */
export function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.toggle('active');
    } else {
        console.warn(`Modal with ID "${modalId}" not found`);
    }
}

/**
 * Check if a modal is open
 * @param {string} modalId - The ID of the modal element
 * @returns {boolean} True if modal is open
 */
export function isModalOpen(modalId) {
    const modal = document.getElementById(modalId);
    return modal ? modal.classList.contains('active') : false;
}

/**
 * Setup modal close handlers
 * Allows clicking outside modal or on close button to close
 */
export function setupModalCloseHandlers() {
    // Click outside modal to close
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });

    // Close button handler
    document.querySelectorAll('.modal-close, .close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });
}
