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

            // Show bottom nav
            const nav = document.getElementById('main-nav');
            if (nav) nav.classList.remove('hidden');

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

        // Hide bottom nav
        const nav = document.getElementById('main-nav');
        if (nav) nav.classList.add('hidden');
    }

    // Update user info in header
    updateUserInfo(user) {
        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');

        if (userAvatar && user.picture) {
            userAvatar.src = user.picture;
            userAvatar.alt = user.name;
            // Fallback for broken images
            userAvatar.onerror = () => {
                userAvatar.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"><circle cx="12" cy="8" r="4"/><path d="M12 14c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"/></svg>';
            };
        }

        if (userName && user.name) {
            userName.textContent = user.name;
        } else {
            console.warn('User name element not found or user name is missing');
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

    // Render payments with grouping
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

        // Add filter controls
        const filterHtml = this.renderPaymentFilters();
        
        // Get current filter settings
        const groupBy = this.paymentGroupBy || 'loanId';
        const filterType = this.paymentFilterType || 'all';
        
        // Filter payments based on type
        const filteredPayments = this.filterPaymentsByType(payments, filterType);
        
        // Group payments
        const groupedPayments = this.groupPayments(filteredPayments, groupBy);
        
        // Render grouped payments
        const groupsHtml = this.renderPaymentGroups(groupedPayments, groupBy);
        
        container.innerHTML = filterHtml + groupsHtml;
        
        // Add event listeners for collapsible sections
        this.attachGroupToggleListeners();
    }

    // Render payment filter controls
    renderPaymentFilters() {
        return `
            <div class="payment-filters" style="margin-bottom: 1rem; padding: 1rem; background: var(--surface); border-radius: 8px; border: 1px solid var(--border);">
                <div class="grid grid-2" style="gap: 1rem;">
                    <div>
                        <label class="form-label" style="margin-bottom: 0.5rem; display: block;">Group By:</label>
                        <select id="group-by-select" class="form-select" style="width: 100%;">
                            <option value="loanId" ${(this.paymentGroupBy === 'loanId' || !this.paymentGroupBy) ? 'selected' : ''}>Loan ID</option>
                            <option value="borrower" ${this.paymentGroupBy === 'borrower' ? 'selected' : ''}>Borrower</option>
                            <option value="month" ${this.paymentGroupBy === 'month' ? 'selected' : ''}>Month</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label" style="margin-bottom: 0.5rem; display: block;">Payment Type:</label>
                        <select id="filter-type-select" class="form-select" style="width: 100%;">
                            <option value="all" ${(this.paymentFilterType === 'all' || !this.paymentFilterType) ? 'selected' : ''}>All Payments</option>
                            <option value="Interest" ${this.paymentFilterType === 'Interest' ? 'selected' : ''}>Interest Only</option>
                            <option value="Principal" ${this.paymentFilterType === 'Principal' ? 'selected' : ''}>Principal Only</option>
                            <option value="Both" ${this.paymentFilterType === 'Both' ? 'selected' : ''}>Both (I+P)</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    // Filter payments by type
    filterPaymentsByType(payments, filterType) {
        if (filterType === 'all') return payments;
        return payments.filter(payment => payment.paymentType === filterType);
    }

    // Group payments by specified criteria
    groupPayments(payments, groupBy) {
        const groups = {};
        
        payments.forEach(payment => {
            let groupKey;
            
            switch (groupBy) {
                case 'borrower':
                    groupKey = payment.borrowerName;
                    break;
                case 'month':
                    const date = new Date(payment.paymentDate);
                    groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'loanId':
                default:
                    groupKey = payment.loanReference || payment.borrowerName;
                    break;
            }
            
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    payments: [],
                    totalAmount: 0,
                    groupKey: groupKey
                };
            }
            
            groups[groupKey].payments.push(payment);
            groups[groupKey].totalAmount += parseFloat(payment.amount || 0);
        });
        
        return groups;
    }

    // Render payment groups with collapsible sections
    renderPaymentGroups(groups, groupBy) {
        if (Object.keys(groups).length === 0) {
            return '<div class="text-center" style="padding: 2rem;"><p class="text-secondary">No payments match the current filter.</p></div>';
        }
        
        return Object.entries(groups)
            .sort(([a], [b]) => b.localeCompare(a)) // Sort groups by key (newest first)
            .map(([groupKey, group]) => {
                const groupTitle = this.getGroupTitle(groupKey, groupBy);
                const isExpanded = this.expandedGroups?.has(groupKey) !== false; // Default to expanded
                
                return `
                    <div class="payment-group" style="margin-bottom: 1rem; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
                        <div class="payment-group-header" 
                             style="padding: 1rem; background: var(--surface); cursor: pointer; display: flex; justify-content: space-between; align-items: center;" 
                             onclick="ui.togglePaymentGroup('${groupKey}')">
                            <div>
                                <div class="payment-group-title" style="font-weight: 500; margin-bottom: 0.25rem;">
                                    <span class="group-toggle-icon" style="margin-right: 0.5rem; font-family: monospace;">${isExpanded ? '▼' : '▶'}</span>
                                    ${this.escapeHtml(groupTitle)}
                                </div>
                                <div class="payment-group-meta" style="font-size: 0.875rem; color: var(--text-secondary);">
                                    Total: ₹${this.formatNumber(group.totalAmount)} (${group.payments.length} payment${group.payments.length !== 1 ? 's' : ''})
                                </div>
                            </div>
                        </div>
                        <div class="payment-group-content" id="group-${groupKey}" style="${isExpanded ? '' : 'display: none;'}">
                            ${this.renderGroupPayments(group.payments)}
                        </div>
                    </div>
                `;
            }).join('');
    }

    // Render individual payments within a group
    renderGroupPayments(payments) {
        return payments
            .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)) // Sort by date (newest first)
            .map(payment => `
                <div class="payment-row" style="padding: 0.75rem 1rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="color: var(--text-secondary); min-width: 80px;">${payment.paymentDate}</span>
                        <span style="font-weight: 500; min-width: 80px;">₹${this.formatNumber(payment.amount)}</span>
                        <span class="badge badge-${this.getPaymentTypeBadgeClass(payment.paymentType)}" style="font-size: 0.75rem;">${payment.paymentType}</span>
                        <span style="color: var(--text-secondary);">${payment.paymentMethod}</span>
                    </div>
                    <div style="text-align: right; color: var(--text-secondary); font-size: 0.8rem;">
                        To: ${this.escapeHtml(payment.receivedBy)}
                    </div>
                </div>
                ${payment.notes ? `<div style="padding: 0 1rem 0.75rem 1rem; font-size: 0.8rem; color: var(--text-secondary); font-style: italic;">${this.escapeHtml(payment.notes)}</div>` : ''}
            `).join('');
    }

    // Get formatted group title
    getGroupTitle(groupKey, groupBy) {
        switch (groupBy) {
            case 'month':
                const [year, month] = groupKey.split('-');
                const date = new Date(year, month - 1);
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            case 'borrower':
                return groupKey;
            case 'loanId':
            default:
                return groupKey;
        }
    }

    // Toggle payment group visibility
    togglePaymentGroup(groupKey) {
        if (!this.expandedGroups) {
            this.expandedGroups = new Set();
        }
        
        const contentElement = document.getElementById(`group-${groupKey}`);
        const toggleIcon = contentElement?.parentElement.querySelector('.group-toggle-icon');
        
        if (contentElement) {
            const isExpanded = contentElement.style.display !== 'none';
            
            if (isExpanded) {
                contentElement.style.display = 'none';
                this.expandedGroups.delete(groupKey);
                if (toggleIcon) toggleIcon.textContent = '▶';
            } else {
                contentElement.style.display = 'block';
                this.expandedGroups.add(groupKey);
                if (toggleIcon) toggleIcon.textContent = '▼';
            }
        }
    }

    // Attach event listeners for filter changes
    attachGroupToggleListeners() {
        const groupBySelect = document.getElementById('group-by-select');
        const filterTypeSelect = document.getElementById('filter-type-select');
        
        if (groupBySelect) {
            groupBySelect.addEventListener('change', (e) => {
                this.paymentGroupBy = e.target.value;
                this.loadPayments(); // Reload with new grouping
            });
        }
        
        if (filterTypeSelect) {
            filterTypeSelect.addEventListener('change', (e) => {
                this.paymentFilterType = e.target.value;
                this.loadPayments(); // Reload with new filter
            });
        }
    }

    // Show loan details modal
    showLoanDetails(loan) {
        const content = `
            <div class="loan-details">
                <div class="detail-group">
                    <label>Status</label>
                    <span class="badge badge-${this.getStatusBadgeClass(loan.status)}">${loan.status}</span>
                </div>
                
                <div class="grid grid-2">
                    <div class="detail-group">
                        <label>Amount Lent</label>
                        <div class="detail-value">₹${this.formatNumber(loan.amount)}</div>
                    </div>
                    <div class="detail-group">
                        <label>Date Given</label>
                        <div class="detail-value">${loan.dateGiven}</div>
                    </div>
                    <div class="detail-group">
                        <label>Interest Rate</label>
                        <div class="detail-value">${loan.interestRate}% / month</div>
                    </div>
                    <div class="detail-group">
                        <label>Monthly Interest</label>
                        <div class="detail-value">₹${this.formatNumber((loan.amount * loan.interestRate) / 100)}</div>
                    </div>
                </div>

                <div class="detail-group">
                    <label>Borrower</label>
                    <div class="detail-value">${this.escapeHtml(loan.name)}</div>
                </div>

                ${loan.details ? `
                <div class="detail-group">
                    <label>Details/Purpose</label>
                    <div class="detail-value">${this.escapeHtml(loan.details)}</div>
                </div>` : ''}

                <div class="grid grid-2">
                    <div class="detail-group">
                        <label>Via</label>
                        <div class="detail-value">${this.escapeHtml(loan.via || '-')}</div>
                    </div>
                    <div class="detail-group">
                        <label>Pro Note</label>
                        <div class="detail-value">${loan.hasProNote ? 'Yes' : 'No'}</div>
                    </div>
                </div>

                <div class="detail-group">
                    <label>Contacts</label>
                    <div class="detail-value">
                        ${loan.contacts && loan.contacts.length > 0 ?
                loan.contacts.map(c => `<div>${c.name} (${c.relation}): <a href="tel:${c.phone}">${c.phone}</a></div>`).join('')
                : 'No contacts added'}
                    </div>
                </div>

                <hr style="border: 0; border-top: 1px solid var(--border); margin: 1rem 0;">

                <div class="grid grid-2">
                    <div class="detail-group">
                        <label>Total Interest Paid</label>
                        <div class="detail-value">₹${this.formatNumber(loan.totalInterestPaid)}</div>
                    </div>
                    <div class="detail-group">
                        <label>Paid Till</label>
                        <div class="detail-value">${loan.paidTillMonth || '-'}</div>
                    </div>
                    <div class="detail-group">
                        <label>Last Payment</label>
                        <div class="detail-value">${loan.lastPaymentDate || '-'}</div>
                    </div>
                </div>

                ${loan.attachments ? `
                <div class="detail-group">
                    <label>Attachments</label>
                    <div class="detail-value">
                        ${this.renderAttachmentsLinks(loan.attachments)}
                    </div>
                </div>` : ''}
            </div>
        `;

        const footer = `
            <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
            <button class="btn btn-primary" onclick="ui.editLoan(${loan.rowIndex})">Edit Loan</button>
        `;

        this.showModal(`Loan: ${loan.loanId}`, content, footer);
    }

    // Render attachments links
    renderAttachmentsLinks(attachmentsStr) {
        if (!attachmentsStr) return '';
        // Assuming attachments are comma-separated links or formula links
        // Simple heuristic to extract links
        const links = attachmentsStr.match(/https?:\/\/[^\s",]+/g);
        if (!links) return attachmentsStr; // specific logic might be needed for Drive links

        return links.map((link, i) => `<a href="${link}" target="_blank" class="attachment-link">Attachment ${i + 1}</a>`).join(', ');
    }

    // Edit loan mode
    async editLoan(rowIndex) {
        // Find loan data
        const loans = await sheetsManager.getLoans(); // Should be cached ideally
        const loan = loans.find(l => l.rowIndex === rowIndex);
        if (!loan) return;

        // Close existing modal
        document.querySelector('.modal-overlay')?.remove();

        const formHtml = `
            <form id="edit-loan-form" class="form">
                <input type="hidden" name="rowIndex" value="${loan.rowIndex}">
                <input type="hidden" name="loanId" value="${loan.loanId}">
                <input type="hidden" name="existingAttachments" value="${this.escapeHtml(loan.attachments || '')}">
                
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select name="status" class="form-select">
                        <option value="Active" ${loan.status === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="Closed" ${loan.status === 'Closed' ? 'selected' : ''}>Closed</option>
                        <option value="Defaulted" ${loan.status === 'Defaulted' ? 'selected' : ''}>Defaulted</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Date Given</label>
                    <input type="date" name="dateGiven" class="form-input" value="${loan.dateGiven}" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Borrower Name</label>
                    <input type="text" name="name" class="form-input" value="${this.escapeHtml(loan.name)}" required list="borrower-list">
                </div>

                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Amount Lent (₹)</label>
                        <input type="number" name="amount" class="form-input" value="${loan.amount}" required step="0.01">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Interest Rate (%)</label>
                        <input type="number" name="interestRate" class="form-input" value="${loan.interestRate}" required step="0.01">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Details</label>
                    <textarea name="details" class="form-textarea">${this.escapeHtml(loan.details)}</textarea>
                </div>

                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Via</label>
                        <input type="text" name="via" class="form-input" value="${this.escapeHtml(loan.via)}" list="via-list">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Pro Note</label>
                        <select name="hasProNote" class="form-select">
                            <option value="false" ${!loan.hasProNote ? 'selected' : ''}>No</option>
                            <option value="true" ${loan.hasProNote ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Date of Closure</label>
                    <input type="date" name="dateOfClosure" class="form-input" value="${loan.dateOfClosure}">
                </div>

                <div class="form-group">
                    <label class="form-label">Contacts (JSON)</label>
                    <textarea name="contactsJson" class="form-textarea" rows="3" placeholder='[{"name":"...", "relation":"...", "phone":"..."}]'>${JSON.stringify(loan.contacts || [])}</textarea>
                    <small class="text-secondary">Edit JSON directly for now</small>
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="app.submitEditLoanForm()">Save Changes</button>
        `;

        this.showModal(`Edit Loan: ${loan.loanId}`, formHtml, footer);

        // Trigger smart dropdowns population to ensure lists are ready
        if (app.populateSmartDropdowns) app.populateSmartDropdowns();
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

    // Helper: Close modal
    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    // Helper: Show button loading state
    showBtnLoading(btn) {
        if (!btn) return;
        btn.dataset.originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-sm"></span> Processing...';
    }

    // Helper: Hide button loading state
    hideBtnLoading(btn) {
        if (!btn) return;
        btn.disabled = false;
        if (btn.dataset.originalText) {
            btn.innerHTML = btn.dataset.originalText;
        }
    }
}

// Export singleton instance
const ui = new UI();
