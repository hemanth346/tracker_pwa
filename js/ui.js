// UI Components and Interactions
class UI {
    constructor() {
        this.currentView = 'loans';
        this.currentLoan = null;
        this.currentPayment = null;
    }

    // Initialize UI
    init() {
        this.setupEventListeners();
        this.showView('auth');
    }

    // Setup event listeners
    setupEventListeners() {
        // Auth events
        window.addEventListener('auth:success', (e) => this.onAuthSuccess(e.detail));
        window.addEventListener('auth:signout', () => this.onAuthSignout());
        window.addEventListener('auth:error', (e) => this.showToast(e.detail, 'error'));

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
    }

    // Show view
    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });

        const view = document.getElementById(`${viewName}-view`);
        if (view) {
            view.classList.remove('hidden');
        }

        this.currentView = viewName;
    }

    // Switch view with navigation update
    switchView(viewName) {
        this.showView(viewName);

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            }
        });

        // Load data for the view
        if (viewName === 'loans') {
            this.loadLoans();
        } else if (viewName === 'payments') {
            this.loadPayments();
        }
    }

    // On authentication success
    async onAuthSuccess(user) {
        this.showView('loading');

        try {
            // Initialize Sheets and Drive
            await sheetsManager.init();
            await driveManager.init();

            // Set access token
            sheetsManager.setAccessToken(auth.getAccessToken());

            // Get or create spreadsheet
            await sheetsManager.getOrCreateSpreadsheet();

            // Update UI with user info
            this.updateUserInfo(user);

            // Show main app
            this.showView('loans');
            this.loadLoans();

            this.showToast('Signed in successfully!', 'success');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showToast('Error initializing app. Please try again.', 'error');
            this.showView('auth');
        }
    }

    // On sign out
    onAuthSignout() {
        this.showView('auth');
        this.showToast('Signed out successfully', 'info');
    }

    // Update user info in header
    updateUserInfo(user) {
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');

        if (userAvatar && user.picture) {
            userAvatar.src = user.picture;
            userAvatar.alt = user.name;
        }

        if (userName) {
            userName.textContent = user.name;
        }
    }

    // Load loans
    async loadLoans() {
        try {
            this.showLoading('loans-list');
            const loans = await sheetsManager.getLoans();
            this.renderLoans(loans);
        } catch (error) {
            console.error('Error loading loans:', error);
            this.showToast('Error loading loans', 'error');
        }
    }

    // Render loans
    renderLoans(loans) {
        const container = document.getElementById('loans-list');
        if (!container) return;

        if (loans.length === 0) {
            container.innerHTML = `
        <div class="text-center" style="padding: 3rem;">
          <p class="text-secondary">No loans yet. Add your first loan to get started!</p>
        </div>
      `;
            return;
        }

        container.innerHTML = loans.map(loan => `
      <div class="list-item" data-row="${loan.rowIndex}">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${this.escapeHtml(loan.name)}</div>
            <div class="list-item-meta">
              <span>₹${this.formatNumber(loan.amount)}</span>
              <span>${loan.interestRate}% monthly</span>
              <span>${loan.dateGiven}</span>
            </div>
          </div>
          <span class="badge badge-${this.getStatusBadgeClass(loan.status)}">${loan.status}</span>
        </div>
        ${loan.details ? `<p style="margin: 0.5rem 0; color: var(--text-secondary);">${this.escapeHtml(loan.details)}</p>` : ''}
        <div class="list-item-meta" style="margin-top: 0.5rem;">
          ${loan.via ? `<span>Via: ${this.escapeHtml(loan.via)}</span>` : ''}
          ${loan.lastPaymentDate ? `<span>Last Payment: ${loan.lastPaymentDate}</span>` : ''}
          ${loan.totalInterestPaid > 0 ? `<span>Total Interest: ₹${this.formatNumber(loan.totalInterestPaid)}</span>` : ''}
          ${loan.paidTillMonth ? `<span>Paid Till: ${loan.paidTillMonth}</span>` : ''}
        </div>
        ${loan.contacts && loan.contacts.length > 0 ? `
          <div style="margin-top: 0.5rem; font-size: 0.875rem;">
            <strong>Contacts:</strong> ${loan.contacts.map(c => `${c.name} (${c.relation}): ${c.phone}`).join(', ')}
          </div>
        ` : ''}
      </div>
    `).join('');

        // Add click handlers
        container.querySelectorAll('.list-item').forEach(item => {
            item.addEventListener('click', () => {
                const rowIndex = parseInt(item.dataset.row);
                const loan = loans.find(l => l.rowIndex === rowIndex);
                this.showLoanDetails(loan);
            });
        });
    }

    // Load payments
    async loadPayments() {
        try {
            this.showLoading('payments-list');
            const payments = await sheetsManager.getPayments();
            this.renderPayments(payments);
        } catch (error) {
            console.error('Error loading payments:', error);
            this.showToast('Error loading payments', 'error');
        }
    }

    // Render payments
    renderPayments(payments) {
        const container = document.getElementById('payments-list');
        if (!container) return;

        if (payments.length === 0) {
            container.innerHTML = `
        <div class="text-center" style="padding: 3rem;">
          <p class="text-secondary">No payments recorded yet.</p>
        </div>
      `;
            return;
        }

        container.innerHTML = payments.map(payment => `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${this.escapeHtml(payment.borrowerName)}</div>
            <div class="list-item-meta">
              <span>₹${this.formatNumber(payment.amount)}</span>
              <span>${payment.paymentDate}</span>
            </div>
          </div>
          <span class="badge badge-${this.getPaymentTypeBadgeClass(payment.paymentType)}">${payment.paymentType}</span>
        </div>
        <div class="list-item-meta" style="margin-top: 0.5rem;">
          <span>${payment.paymentMethod}</span>
          <span>To: ${payment.receivedBy}</span>
        </div>
        ${payment.notes ? `<p style="margin-top: 0.5rem; color: var(--text-secondary);">${this.escapeHtml(payment.notes)}</p>` : ''}
      </div>
    `).join('');
    }

    // Show loan details modal
    showLoanDetails(loan) {
        // Implementation for detailed view
        this.showToast('Loan details view - Coming soon!', 'info');
    }

    // Show loading state
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
        <div class="text-center" style="padding: 3rem;">
          <div class="spinner" style="margin: 0 auto;"></div>
        </div>
      `;
        }
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
      <div style="flex: 1;">${this.escapeHtml(message)}</div>
      <button class="btn-icon" onclick="this.parentElement.remove()" style="background: transparent; color: var(--text-secondary);">×</button>
    `;

        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    // Show modal
    showModal(title, content, footer = '') {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${this.escapeHtml(title)}</h3>
          <button class="btn-icon" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

        document.body.appendChild(overlay);

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        return overlay;
    }

    // Helper: Get status badge class
    getStatusBadgeClass(status) {
        const statusMap = {
            'Active': 'success',
            'Closed': 'info',
            'Defaulted': 'error'
        };
        return statusMap[status] || 'info';
    }

    // Helper: Get payment type badge class
    getPaymentTypeBadgeClass(type) {
        const typeMap = {
            'Interest': 'warning',
            'Principal': 'info',
            'Both': 'success'
        };
        return typeMap[type] || 'info';
    }

    // Helper: Format number
    formatNumber(num) {
        return new Intl.NumberFormat('en-IN').format(num);
    }

    // Helper: Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Handle image selection
    async handleImageSelect(inputElement, callback) {
        const files = Array.from(inputElement.files);
        if (files.length === 0) return;

        try {
            this.showToast('Uploading images...', 'info');
            const uploadedImages = await driveManager.uploadMultipleImages(files);
            this.showToast(`${uploadedImages.length} image(s) uploaded successfully!`, 'success');

            if (callback) {
                callback(uploadedImages);
            }
        } catch (error) {
            console.error('Error uploading images:', error);
            this.showToast('Error uploading images', 'error');
        }
    }

    // Open spreadsheet in new tab
    openSpreadsheet() {
        const url = sheetsManager.getSpreadsheetUrl();
        if (url) {
            window.open(url, '_blank');
        }
    }

    // Open Drive folder in new tab
    openDriveFolder() {
        const url = driveManager.getFolderUrl();
        if (url) {
            window.open(url, '_blank');
        }
    }
}

// Export singleton instance
const ui = new UI();
