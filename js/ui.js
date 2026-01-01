// UI Components and Interactions
class UI {
    constructor() {
        this.currentView = 'loans';
        this.currentLoan = null;
        this.currentPayment = null;

        // Pagination settings
        this.itemsPerPage = 20;
        this.loansPage = 1;
        this.paymentsPage = 1;
        this.allLoans = [];
        this.allPayments = [];
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
        } else if (viewName === 'analytics') {
            this.loadAnalytics();
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

    // Render loans with pagination
    renderLoans(loans, append = false) {
        const container = document.getElementById('loans-list');
        if (!container) return;

        // Store all loans for pagination
        if (!append) {
            this.allLoans = loans;
            this.loansPage = 1;
        }

        if (this.allLoans.length === 0) {
            container.innerHTML = `
        <div class="text-center" style="padding: 3rem;">
          <p class="text-secondary">No loans yet. Add your first loan to get started!</p>
        </div>
      `;
            return;
        }

        // Add filter controls only if not appending
        const filterHtml = append ? '' : this.renderLoanFilters();

        // Get current filter settings
        const groupBy = this.loanGroupBy || 'borrower';
        const statusFilter = this.loanFilterStatus || 'all';
        const amountFilter = this.loanFilterAmount || 'all';

        // Filter loans based on criteria
        const filteredLoans = this.filterLoansByType(this.allLoans, statusFilter, amountFilter);

        // Apply pagination to filtered loans
        const startIndex = (this.loansPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedLoans = filteredLoans.slice(0, endIndex);

        // Group loans
        const groupedLoans = this.groupLoans(paginatedLoans, groupBy);

        // Render grouped loans
        const groupsHtml = this.renderLoanGroups(groupedLoans, groupBy);

        // Add load more button if there are more items
        const hasMore = endIndex < filteredLoans.length;
        const loadMoreHtml = hasMore ? `
            <div class="text-center" style="margin-top: 1rem;">
                <button class="btn btn-outline" id="load-more-loans">
                    Load More (${filteredLoans.length - endIndex} remaining)
                </button>
            </div>
        ` : '';

        if (append) {
            // Find the existing content and replace just the groups
            const existingFilterHtml = container.querySelector('.loan-filters')?.outerHTML || '';
            container.innerHTML = existingFilterHtml + groupsHtml + loadMoreHtml;
        } else {
            container.innerHTML = filterHtml + groupsHtml + loadMoreHtml;
        }

        // Add event listener for load more button
        const loadMoreBtn = document.getElementById('load-more-loans');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loansPage++;
                this.renderLoans(this.allLoans, true);
            });
        }

        // Add event listeners for collapsible sections
        this.attachLoanGroupToggleListeners();

        // Add click handlers for individual loan rows
        container.querySelectorAll('.loan-row').forEach(item => {
            item.addEventListener('click', () => {
                const rowIndex = parseInt(item.dataset.row);
                const loan = this.allLoans.find(l => l.rowIndex === rowIndex);
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

    // Render payments with grouping and pagination
    renderPayments(payments, append = false) {
        const container = document.getElementById('payments-list');
        if (!container) return;

        // Store all payments for pagination
        if (!append) {
            this.allPayments = payments;
            this.paymentsPage = 1;
        }

        if (this.allPayments.length === 0) {
            container.innerHTML = `
        <div class="text-center" style="padding: 3rem;">
          <p class="text-secondary">No payments recorded yet.</p>
        </div>
      `;
            return;
        }

        // Add filter controls only if not appending
        const filterHtml = append ? '' : this.renderPaymentFilters();

        // Get current filter settings
        const groupBy = this.paymentGroupBy || 'loanId';
        const filterType = this.paymentFilterType || 'all';

        // Filter payments based on type
        const filteredPayments = this.filterPaymentsByType(this.allPayments, filterType);

        // Apply pagination to filtered payments
        const startIndex = (this.paymentsPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedPayments = filteredPayments.slice(0, endIndex);

        // Group payments
        const groupedPayments = this.groupPayments(paginatedPayments, groupBy);

        // Render grouped payments
        const groupsHtml = this.renderPaymentGroups(groupedPayments, groupBy);

        // Add load more button if there are more items
        const hasMore = endIndex < filteredPayments.length;
        const loadMoreHtml = hasMore ? `
            <div class="text-center" style="margin-top: 1rem;">
                <button class="btn btn-outline" id="load-more-payments">
                    Load More (${filteredPayments.length - endIndex} remaining)
                </button>
            </div>
        ` : '';

        if (append) {
            // Find the existing content and replace just the groups
            const existingFilterHtml = container.querySelector('.payment-filters')?.outerHTML || '';
            container.innerHTML = existingFilterHtml + groupsHtml + loadMoreHtml;
        } else {
            container.innerHTML = filterHtml + groupsHtml + loadMoreHtml;
        }

        // Add event listener for load more button
        const loadMoreBtn = document.getElementById('load-more-payments');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.paymentsPage++;
                this.renderPayments(this.allPayments, true);
            });
        }

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

    // ====== LOAN GROUPING AND FILTERING METHODS ======

    // Render loan filter controls with search (Compact Version)
    renderLoanFilters() {
        return `
            <div class="loan-filters-compact" style="margin-bottom: 1.5rem;">
                <div class="filter-main-bar" style="display: flex; gap: 0.5rem; align-items: center; background: var(--surface); padding: 0.5rem; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="flex: 1; position: relative;">
                        <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); opacity: 0.5;">🔍</span>
                        <input type="text" id="loan-search-input" class="form-input" placeholder="Search loans..." style="width: 100%; border: none; background: transparent; padding-left: 2.25rem;">
                    </div>
                    <button id="toggle-advanced-filters" class="btn btn-secondary btn-sm" style="padding: 0.5rem 0.75rem; border-radius: 8px;">
                        <span style="margin-right: 0.25rem;">⚙️</span> Filters
                    </button>
                    <button id="reset-loan-filters" class="btn btn-outline btn-sm" style="padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.75rem;">
                        Reset
                    </button>
                    <button id="clear-loan-search" class="btn btn-outline btn-sm" style="border: none; opacity: 0.7;">✕</button>
                </div>
                
                <div id="advanced-filters-panel" class="hidden" style="margin-top: 0.75rem; padding: 1rem; background: var(--surface); border-radius: 12px; border: 1px solid var(--border); animation: slideDown 0.2s ease-out;">
                    <div class="grid grid-4" style="gap: 1rem;">
                        <div>
                            <label class="form-label-xs">Group By</label>
                            <select id="loan-group-by-select" class="form-select select-sm">
                                <option value="borrower" ${(this.loanGroupBy === 'borrower' || !this.loanGroupBy) ? 'selected' : ''}>Borrower</option>
                                <option value="month" ${this.loanGroupBy === 'month' ? 'selected' : ''}>Month</option>
                                <option value="via" ${this.loanGroupBy === 'via' ? 'selected' : ''}>Via/Referrer</option>
                                <option value="status" ${this.loanGroupBy === 'status' ? 'selected' : ''}>Status</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label-xs">Status</label>
                            <select id="loan-filter-status-select" class="form-select select-sm">
                                <option value="all" ${(this.loanFilterStatus === 'all' || !this.loanFilterStatus) ? 'selected' : ''}>All</option>
                                <option value="Active" ${this.loanFilterStatus === 'Active' ? 'selected' : ''}>Active</option>
                                <option value="Closed" ${this.loanFilterStatus === 'Closed' ? 'selected' : ''}>Closed</option>
                                <option value="Defaulted" ${this.loanFilterStatus === 'Defaulted' ? 'selected' : ''}>Defaulted</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label-xs">Amount</label>
                            <select id="loan-filter-amount-select" class="form-select select-sm">
                                <option value="all" ${(this.loanFilterAmount === 'all' || !this.loanFilterAmount) ? 'selected' : ''}>Any</option>
                                <option value="small" ${this.loanFilterAmount === 'small' ? 'selected' : ''}>< 50k</option>
                                <option value="medium" ${this.loanFilterAmount === 'medium' ? 'selected' : ''}>50k - 2L</option>
                                <option value="large" ${this.loanFilterAmount === 'large' ? 'selected' : ''}>> 2L</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label-xs">Date Range</label>
                            <input type="date" id="loan-date-filter" class="form-input input-sm">
                        </div>
                    </div>
                </div>
                <div id="loan-search-summary" style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-secondary); text-align: right; padding-right: 0.5rem;"></div>
            </div>
            <style>
                .form-label-xs { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 0.25rem; display: block; }
                .select-sm, .input-sm { font-size: 0.875rem; padding: 0.35rem 0.5rem; border-radius: 6px; }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
            </style>
        `;
    }

    // Filter loans by status, amount, and search criteria
    filterLoansByType(loans, statusFilter, amountFilter) {
        // Get search criteria from inputs
        const searchInput = document.getElementById('loan-search-input');
        const dateFilter = document.getElementById('loan-date-filter');

        const searchCriteria = {
            query: searchInput ? searchInput.value : '',
            status: statusFilter !== 'all' ? statusFilter : '',
            dateFrom: dateFilter ? dateFilter.value : ''
        };

        // Add amount filter to search criteria
        let filteredLoans = loans;

        // Use search manager for comprehensive filtering
        if (searchCriteria.query || searchCriteria.status || searchCriteria.dateFrom) {
            filteredLoans = searchManager.searchLoans(loans, searchCriteria);
        }

        // Additional amount filter (legacy support)
        if (amountFilter !== 'all') {
            filteredLoans = filteredLoans.filter(loan => {
                const amount = parseFloat(loan.amount) || 0;
                switch (amountFilter) {
                    case 'small': return amount < 50000;
                    case 'medium': return amount >= 50000 && amount <= 200000;
                    case 'large': return amount > 200000;
                    default: return true;
                }
            });
        }

        // Update search summary
        this.updateLoanSearchSummary(loans.length, filteredLoans.length, searchCriteria);

        return filteredLoans;
    }

    // Update search summary display
    updateLoanSearchSummary(originalCount, filteredCount, searchCriteria) {
        const summaryElement = document.getElementById('loan-search-summary');
        if (summaryElement) {
            const summary = searchManager.getSearchSummary(originalCount, filteredCount, searchCriteria);
            summaryElement.textContent = summary;
        }
    }

    // Group loans by specified criteria
    groupLoans(loans, groupBy) {
        const groups = {};

        loans.forEach(loan => {
            let groupKey;

            switch (groupBy) {
                case 'month':
                    const date = new Date(loan.dateGiven);
                    groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                case 'via':
                    groupKey = loan.via || 'Direct/Not Specified';
                    break;
                case 'status':
                    groupKey = loan.status || 'Active';
                    break;
                case 'borrower':
                default:
                    groupKey = loan.name;
                    break;
            }

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    loans: [],
                    totalAmount: 0,
                    totalInterestPaid: 0,
                    groupKey: groupKey
                };
            }

            groups[groupKey].loans.push(loan);
            groups[groupKey].totalAmount += parseFloat(loan.amount || 0);
            groups[groupKey].totalInterestPaid += parseFloat(loan.totalInterestPaid || 0);
        });

        return groups;
    }

    // Render loan groups with collapsible sections
    renderLoanGroups(groups, groupBy) {
        if (Object.keys(groups).length === 0) {
            return '<div class="text-center" style="padding: 2rem;"><p class="text-secondary">No loans match the current filter.</p></div>';
        }

        return Object.entries(groups)
            .sort(([a], [b]) => {
                // Sort by group key - for months, sort by date descending
                if (groupBy === 'month') {
                    return b.localeCompare(a);
                }
                return a.localeCompare(b);
            })
            .map(([groupKey, group]) => {
                const groupTitle = this.getLoanGroupTitle(groupKey, groupBy);
                const isExpanded = this.expandedLoanGroups?.has(groupKey) !== false; // Default to expanded

                return `
                    <div class="loan-group" style="margin-bottom: 1rem; border: 1px solid var(--border); border-radius: 8px; overflow: hidden;">
                        <div class="loan-group-header" 
                             style="padding: 1rem; background: var(--surface); cursor: pointer; display: flex; justify-content: space-between; align-items: center;" 
                             onclick="ui.toggleLoanGroup('${groupKey}')">
                            <div>
                                <div class="loan-group-title" style="font-weight: 500; margin-bottom: 0.25rem;">
                                    <span class="loan-group-toggle-icon" style="margin-right: 0.5rem; font-family: monospace;">${isExpanded ? '▼' : '▶'}</span>
                                    ${this.escapeHtml(groupTitle)}
                                </div>
                                <div class="loan-group-meta" style="font-size: 0.875rem; color: var(--text-secondary);">
                                    Total Amount: ₹${this.formatNumber(group.totalAmount)} | 
                                    Total Interest Received: ₹${this.formatNumber(group.totalInterestPaid)} | 
                                    ${group.loans.length} loan${group.loans.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="loan-group-content" id="loan-group-${groupKey}" style="${isExpanded ? '' : 'display: none;'}">
                            ${this.renderGroupLoans(group.loans)}
                        </div>
                    </div>
                `;
            }).join('');
    }

    // Render individual loans within a group
    renderGroupLoans(loans) {
        return loans
            .sort((a, b) => new Date(b.dateGiven) - new Date(a.dateGiven)) // Sort by date (newest first)
            .map(loan => `
                <div class="loan-row" data-row="${loan.rowIndex}" style="padding: 1rem; border-top: 1px solid var(--border); cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='rgba(99, 102, 241, 0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <div style="font-weight: 500; margin-bottom: 0.5rem;">${this.escapeHtml(loan.name)}</div>
                            <div style="display: flex; gap: 1rem; font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                                <span>₹${this.formatNumber(loan.amount)}</span>
                                <span>${loan.interestRate}% monthly</span>
                                <span>${loan.dateGiven}</span>
                                ${loan.via ? `<span>Via: ${this.escapeHtml(loan.via)}</span>` : ''}
                            </div>
                            ${loan.details ? `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.5rem;">${this.escapeHtml(loan.details)}</div>` : ''}
                            <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
                                ${loan.lastPaymentDate ? `<span>Last Payment: ${loan.lastPaymentDate}</span>` : ''}
                                ${loan.totalInterestPaid > 0 ? `<span>Total Interest: ₹${this.formatNumber(loan.totalInterestPaid)}</span>` : ''}
                                ${loan.paidTillMonth ? `<span>Paid Till: ${loan.paidTillMonth}</span>` : ''}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="badge badge-${this.getStatusBadgeClass(loan.status)}">${loan.status}</span>
                        </div>
                    </div>
                    ${loan.contacts && loan.contacts.length > 0 ? `
                        <div style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--text-secondary);">
                            <strong>Contacts:</strong> ${loan.contacts.map(c => `${c.name} (${c.relation}): ${c.phone}`).join(', ')}
                        </div>
                    ` : ''}
                </div>
            `).join('');
    }

    // Get formatted loan group title
    getLoanGroupTitle(groupKey, groupBy) {
        switch (groupBy) {
            case 'month':
                const [year, month] = groupKey.split('-');
                const date = new Date(year, month - 1);
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            case 'via':
                return groupKey;
            case 'status':
                return groupKey;
            case 'borrower':
            default:
                return groupKey;
        }
    }

    // Toggle loan group visibility
    toggleLoanGroup(groupKey) {
        if (!this.expandedLoanGroups) {
            this.expandedLoanGroups = new Set();
        }

        const contentElement = document.getElementById(`loan-group-${groupKey}`);
        const toggleIcon = contentElement?.parentElement.querySelector('.loan-group-toggle-icon');

        if (contentElement) {
            const isExpanded = contentElement.style.display !== 'none';

            if (isExpanded) {
                contentElement.style.display = 'none';
                this.expandedLoanGroups.delete(groupKey);
                if (toggleIcon) toggleIcon.textContent = '▶';
            } else {
                contentElement.style.display = 'block';
                this.expandedLoanGroups.add(groupKey);
                if (toggleIcon) toggleIcon.textContent = '▼';
            }
        }
    }

    // Attach event listeners for loan filter changes and search
    attachLoanGroupToggleListeners() {
        const groupBySelect = document.getElementById('loan-group-by-select');
        const filterStatusSelect = document.getElementById('loan-filter-status-select');
        const filterAmountSelect = document.getElementById('loan-filter-amount-select');
        const searchInput = document.getElementById('loan-search-input');
        const clearSearchBtn = document.getElementById('clear-loan-search');
        const dateFilter = document.getElementById('loan-date-filter');

        if (groupBySelect) {
            groupBySelect.addEventListener('change', (e) => {
                this.loanGroupBy = e.target.value;
                this.loadLoans(); // Reload with new grouping
            });
        }

        if (filterStatusSelect) {
            filterStatusSelect.addEventListener('change', (e) => {
                this.loanFilterStatus = e.target.value;
                this.loadLoans(); // Reload with new filter
            });
        }

        if (filterAmountSelect) {
            filterAmountSelect.addEventListener('change', (e) => {
                this.loanFilterAmount = e.target.value;
                this.loadLoans(); // Reload with new filter
            });
        }

        // Debounced search input
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchManager.debounce(() => {
                    this.renderLoans(this.allLoans);
                }, searchManager.searchDebounceTime, 'loan-search');
            });
        }

        // Toggle advanced filters
        const toggleBtn = document.getElementById('toggle-advanced-filters');
        const panel = document.getElementById('advanced-filters-panel');
        if (toggleBtn && panel) {
            toggleBtn.addEventListener('click', () => {
                panel.classList.toggle('hidden');
                toggleBtn.classList.toggle('active');
            });
        }

        // Reset filters
        const resetBtn = document.getElementById('reset-loan-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // Reset internal state
                this.loanGroupBy = 'borrower';
                this.loanFilterStatus = 'all';
                this.loanFilterAmount = 'all';
                this.loansPage = 1;

                // Reset UI elements
                if (searchInput) searchInput.value = '';
                const dateFilter = document.getElementById('loan-date-filter');
                if (dateFilter) dateFilter.value = '';

                // Refresh view
                this.loadLoans();
                this.showToast('Filters reset', 'info');
            });
        }

        // Clear search button
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                }
                if (dateFilter) {
                    dateFilter.value = '';
                }
                this.renderLoans(this.allLoans);
            });
        }

        // Date filter
        if (dateFilter) {
            dateFilter.addEventListener('change', () => {
                this.renderLoans(this.allLoans);
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
            <button class="btn btn-outline" onclick="ui.recordPaymentForLoan('${loan.loanId}')">Record Payment</button>
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
        // cleanup existing modals first
        document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

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

    // Record payment for specific loan
    recordPaymentForLoan(loanId) {
        // Close current modal
        this.closeModal();

        // Show payment form with pre-selected loan
        setTimeout(() => {
            app.showAddPaymentForm(loanId);
        }, 100); // Small delay to allow modal to close
    }

    // ====== ANALYTICS METHODS ======

    // Load analytics view
    async loadAnalytics() {
        try {
            this.showLoading('analytics-content');

            // Get fresh data
            const loans = await sheetsManager.getLoans();
            const payments = await sheetsManager.getPayments();

            // Initialize analytics
            analyticsManager.init(loans, payments);

            // Render analytics dashboard
            this.renderAnalytics();
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showToast('Error loading analytics', 'error');
        }
    }

    // Render analytics dashboard
    renderAnalytics() {
        const container = document.getElementById('analytics-content');
        if (!container) return;

        const metrics = analyticsManager.getSummaryMetrics();
        const performance = analyticsManager.getPerformanceMetrics();
        const topBorrowers = analyticsManager.getTopBorrowers();
        const statusDistribution = analyticsManager.getLoanStatusDistribution();

        container.innerHTML = `
            <!-- Summary Cards -->
            <div class="analytics-summary">
                <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Portfolio Summary</h3>
                <div class="analytics-grid">
                    <div class="analytics-card primary">
                        <div class="analytics-icon">💰</div>
                        <div class="analytics-content">
                            <div class="analytics-value">₹${this.formatNumber(metrics.totalAmountLent)}</div>
                            <div class="analytics-label">Total Amount Lent</div>
                        </div>
                    </div>
                    
                    <div class="analytics-card success">
                        <div class="analytics-icon">📈</div>
                        <div class="analytics-content">
                            <div class="analytics-value">₹${this.formatNumber(metrics.totalInterestEarned)}</div>
                            <div class="analytics-label">Interest Earned</div>
                        </div>
                    </div>
                    
                    <div class="analytics-card info">
                        <div class="analytics-icon">📊</div>
                        <div class="analytics-content">
                            <div class="analytics-value">${metrics.totalLoans}</div>
                            <div class="analytics-label">Total Loans</div>
                        </div>
                    </div>
                    
                    <div class="analytics-card warning">
                        <div class="analytics-icon">⏰</div>
                        <div class="analytics-content">
                            <div class="analytics-value">₹${this.formatNumber(metrics.expectedMonthlyIncome)}</div>
                            <div class="analytics-label">Monthly Expected</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Active vs Closed Loans -->
            <div class="analytics-section">
                <h3>Loan Status Distribution</h3>
                <div class="analytics-row">
                    <div class="analytics-chart-container">
                        <div class="loan-status-chart">
                            ${this.renderStatusBars(statusDistribution)}
                        </div>
                    </div>
                    <div class="analytics-stats">
                        <div class="stat-item">
                            <div class="stat-label">Active Loans</div>
                            <div class="stat-value">${metrics.activeLoans}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Closed Loans</div>
                            <div class="stat-value">${metrics.closedLoans}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Default Rate</div>
                            <div class="stat-value">${metrics.defaultRate.toFixed(1)}%</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">ROI</div>
                            <div class="stat-value">${metrics.roiPercentage.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Top Borrowers -->
            <div class="analytics-section">
                <h3>Top Borrowers</h3>
                <div class="top-borrowers-list">
                    ${topBorrowers.map((borrower, index) => `
                        <div class="borrower-item">
                            <div class="borrower-rank">#${index + 1}</div>
                            <div class="borrower-info">
                                <div class="borrower-name">${this.escapeHtml(borrower.name)}</div>
                                <div class="borrower-stats">
                                    ${borrower.loanCount} loan${borrower.loanCount !== 1 ? 's' : ''} • 
                                    ₹${this.formatNumber(borrower.totalInterestPaid)} interest paid
                                </div>
                            </div>
                            <div class="borrower-amount">₹${this.formatNumber(borrower.totalAmount)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Performance Metrics -->
            <div class="analytics-section">
                <h3>Performance Metrics</h3>
                <div class="performance-grid">
                    <div class="performance-card">
                        <div class="performance-label">Average Loan Tenure</div>
                        <div class="performance-value">${performance.averageLoanTenure} months</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-label">Collection Efficiency</div>
                        <div class="performance-value">${performance.collectionEfficiency.toFixed(1)}%</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-label">Portfolio Value</div>
                        <div class="performance-value">₹${this.formatNumber(performance.totalPortfolioValue)}</div>
                    </div>
                    <div class="performance-card">
                        <div class="performance-label">Portfolio Growth</div>
                        <div class="performance-value">${performance.portfolioGrowthRate}%</div>
                    </div>
                </div>
            </div>

            <!-- Risk Analysis -->
            <div class="analytics-section">
                <h3>Risk Analysis</h3>
                <div class="risk-analysis">
                    <div class="risk-item ${metrics.overdueLoans > 0 ? 'risk-high' : 'risk-low'}">
                        <div class="risk-label">Overdue Loans</div>
                        <div class="risk-value">${metrics.overdueLoans}</div>
                        <div class="risk-note">${metrics.overdueLoans > 0 ? 'Requires attention' : 'All up to date'}</div>
                    </div>
                    <div class="risk-item ${metrics.defaultRate > 10 ? 'risk-high' : metrics.defaultRate > 5 ? 'risk-medium' : 'risk-low'}">
                        <div class="risk-label">Default Rate</div>
                        <div class="risk-value">${metrics.defaultRate.toFixed(1)}%</div>
                        <div class="risk-note">${metrics.defaultRate > 10 ? 'High risk' : metrics.defaultRate > 5 ? 'Moderate risk' : 'Low risk'}</div>
                    </div>
                </div>
            </div>
        `;

        // Add CSS for analytics if not already present
        this.addAnalyticsCSS();

        // Add refresh button listener
        const refreshBtn = document.getElementById('refresh-analytics-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                // Clear cache and reload
                cacheManager.remove('loans');
                cacheManager.remove('payments');
                this.loadAnalytics();
                this.showToast('Analytics refreshed', 'success');
            });
        }
    }

    // Render status bars
    renderStatusBars(statusDistribution) {
        return statusDistribution.map(status => {
            const color = status.label === 'Active' ? '#4CAF50' :
                status.label === 'Closed' ? '#2196F3' : '#f44336';

            return `
                <div class="status-bar">
                    <div class="status-info">
                        <span class="status-label">${status.label}</span>
                        <span class="status-count">${status.value} (${status.percentage}%)</span>
                    </div>
                    <div class="status-progress">
                        <div class="status-fill" style="width: ${status.percentage}%; background: ${color};"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Add analytics CSS
    addAnalyticsCSS() {
        if (document.querySelector('#analytics-styles')) return;

        const style = document.createElement('style');
        style.id = 'analytics-styles';
        style.textContent = `
            .analytics-summary { margin-bottom: 2rem; }
            
            .analytics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            
            .analytics-card {
                background: var(--surface);
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                display: flex;
                align-items: center;
                gap: 1rem;
                border-left: 4px solid var(--primary);
            }
            
            .analytics-card.success { border-left-color: #4CAF50; }
            .analytics-card.info { border-left-color: #2196F3; }
            .analytics-card.warning { border-left-color: #FF9800; }
            
            .analytics-icon {
                font-size: 2rem;
                opacity: 0.8;
            }
            
            .analytics-value {
                font-size: 1.5rem;
                font-weight: 600;
                color: var(--text-primary);
            }
            
            .analytics-label {
                font-size: 0.875rem;
                color: var(--text-secondary);
            }
            
            .analytics-section {
                margin-bottom: 2rem;
                background: var(--surface);
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .analytics-section h3 {
                margin-bottom: 1rem;
                color: var(--text-primary);
                border-bottom: 2px solid var(--primary);
                padding-bottom: 0.5rem;
            }
            
            .analytics-row {
                display: grid;
                grid-template-columns: 1fr 200px;
                gap: 2rem;
                align-items: start;
            }
            
            .status-bar {
                margin-bottom: 1rem;
            }
            
            .status-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 0.5rem;
                font-size: 0.875rem;
            }
            
            .status-progress {
                background: var(--border);
                height: 8px;
                border-radius: 4px;
                overflow: hidden;
            }
            
            .status-fill {
                height: 100%;
                transition: width 0.3s ease;
            }
            
            .analytics-stats {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            
            .stat-item {
                text-align: center;
                padding: 1rem;
                background: rgba(99, 102, 241, 0.1);
                border-radius: 8px;
            }
            
            .stat-label {
                font-size: 0.75rem;
                color: var(--text-secondary);
                margin-bottom: 0.25rem;
            }
            
            .stat-value {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--primary);
            }
            
            .top-borrowers-list {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            
            .borrower-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: rgba(255,255,255,0.5);
                border-radius: 8px;
                border: 1px solid var(--border);
            }
            
            .borrower-rank {
                width: 2rem;
                height: 2rem;
                border-radius: 50%;
                background: var(--primary);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 0.875rem;
            }
            
            .borrower-info {
                flex: 1;
            }
            
            .borrower-name {
                font-weight: 600;
                color: var(--text-primary);
            }
            
            .borrower-stats {
                font-size: 0.875rem;
                color: var(--text-secondary);
                margin-top: 0.25rem;
            }
            
            .borrower-amount {
                font-weight: 600;
                color: var(--primary);
            }
            
            .performance-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
            }
            
            .performance-card {
                text-align: center;
                padding: 1rem;
                background: rgba(255,255,255,0.5);
                border-radius: 8px;
                border: 1px solid var(--border);
            }
            
            .performance-label {
                font-size: 0.875rem;
                color: var(--text-secondary);
                margin-bottom: 0.5rem;
            }
            
            .performance-value {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--text-primary);
            }
            
            .risk-analysis {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }
            
            .risk-item {
                padding: 1rem;
                border-radius: 8px;
                text-align: center;
            }
            
            .risk-low { background: rgba(76, 175, 80, 0.1); border: 1px solid #4CAF50; }
            .risk-medium { background: rgba(255, 152, 0, 0.1); border: 1px solid #FF9800; }
            .risk-high { background: rgba(244, 67, 54, 0.1); border: 1px solid #f44336; }
            
            .risk-label {
                font-size: 0.875rem;
                color: var(--text-secondary);
                margin-bottom: 0.5rem;
            }
            
            .risk-value {
                font-size: 1.5rem;
                font-weight: 600;
                margin-bottom: 0.25rem;
            }
            
            .risk-low .risk-value { color: #4CAF50; }
            .risk-medium .risk-value { color: #FF9800; }
            .risk-high .risk-value { color: #f44336; }
            
            .risk-note {
                font-size: 0.75rem;
                opacity: 0.8;
            }
            
            @media (max-width: 768px) {
                .analytics-row {
                    grid-template-columns: 1fr;
                    gap: 1rem;
                }
                
                .analytics-grid {
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                }
                
                .performance-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .risk-analysis {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
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
