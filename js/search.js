// Search and Filter Utilities
class SearchManager {
    constructor() {
        this.searchDebounceTime = 300; // 300ms
        this.searchTimeouts = new Map();
    }

    // Debounced search function
    debounce(func, delay, key = 'default') {
        // Clear existing timeout
        if (this.searchTimeouts.has(key)) {
            clearTimeout(this.searchTimeouts.get(key));
        }

        // Set new timeout
        const timeoutId = setTimeout(() => {
            func();
            this.searchTimeouts.delete(key);
        }, delay);

        this.searchTimeouts.set(key, timeoutId);
    }

    // Search loans by multiple criteria
    searchLoans(loans, searchCriteria) {
        const {
            query = '',
            status = 'all',
            dateFrom = '',
            dateTo = '',
            amountMin = '',
            amountMax = '',
            via = '',
            borrowerName = ''
        } = searchCriteria;

        return loans.filter(loan => {
            // Text search across multiple fields
            if (query) {
                const searchText = query.toLowerCase();
                const searchableText = `
                    ${loan.loanId || ''} 
                    ${loan.name || ''} 
                    ${loan.details || ''} 
                    ${loan.via || ''}
                `.toLowerCase();

                if (!searchableText.includes(searchText)) {
                    return false;
                }
            }

            // Status filter
            if (status !== 'all' && loan.status !== status) {
                return false;
            }

            // Date range filter
            if (dateFrom && loan.dateGiven < dateFrom) {
                return false;
            }
            if (dateTo && loan.dateGiven > dateTo) {
                return false;
            }

            // Amount range filter
            if (amountMin && loan.amount < parseFloat(amountMin)) {
                return false;
            }
            if (amountMax && loan.amount > parseFloat(amountMax)) {
                return false;
            }

            // Via filter
            if (via && loan.via !== via) {
                return false;
            }

            // Borrower name filter
            if (borrowerName && !loan.name.toLowerCase().includes(borrowerName.toLowerCase())) {
                return false;
            }

            return true;
        });
    }

    // Search payments by multiple criteria
    searchPayments(payments, searchCriteria) {
        const {
            query = '',
            type = 'all',
            method = 'all',
            dateFrom = '',
            dateTo = '',
            amountMin = '',
            amountMax = '',
            borrowerName = '',
            loanId = ''
        } = searchCriteria;

        return payments.filter(payment => {
            // Text search across multiple fields
            if (query) {
                const searchText = query.toLowerCase();
                const searchableText = `
                    ${payment.loanId || ''} 
                    ${payment.borrowerName || ''} 
                    ${payment.paymentMethod || ''}
                    ${payment.notes || ''}
                `.toLowerCase();

                if (!searchableText.includes(searchText)) {
                    return false;
                }
            }

            // Payment type filter
            if (type !== 'all' && payment.paymentType !== type) {
                return false;
            }

            // Payment method filter
            if (method !== 'all' && payment.paymentMethod !== method) {
                return false;
            }

            // Date range filter
            if (dateFrom && payment.paymentDate < dateFrom) {
                return false;
            }
            if (dateTo && payment.paymentDate > dateTo) {
                return false;
            }

            // Amount range filter
            if (amountMin && payment.amount < parseFloat(amountMin)) {
                return false;
            }
            if (amountMax && payment.amount > parseFloat(amountMax)) {
                return false;
            }

            // Borrower name filter
            if (borrowerName && !payment.borrowerName.toLowerCase().includes(borrowerName.toLowerCase())) {
                return false;
            }

            // Loan ID filter
            if (loanId && payment.loanId !== loanId) {
                return false;
            }

            return true;
        });
    }

    // Get unique values for filter dropdowns
    getUniqueValues(data, field) {
        const values = data.map(item => item[field]).filter(value => value && value.trim() !== '');
        return [...new Set(values)].sort();
    }

    // Advanced search with sorting
    advancedSearch(data, searchCriteria, sortOptions = {}) {
        let results = Array.isArray(data) ? [...data] : [];

        // Apply search filters
        if (data.length > 0) {
            const firstItem = data[0];
            if (firstItem.loanId !== undefined) {
                // It's loans data
                results = this.searchLoans(results, searchCriteria);
            } else if (firstItem.paymentDate !== undefined) {
                // It's payments data
                results = this.searchPayments(results, searchCriteria);
            }
        }

        // Apply sorting
        if (sortOptions.field) {
            results.sort((a, b) => {
                let aVal = a[sortOptions.field];
                let bVal = b[sortOptions.field];

                // Handle different data types
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }

                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortOptions.direction === 'desc' ? bVal - aVal : aVal - bVal;
                }

                if (aVal < bVal) return sortOptions.direction === 'desc' ? 1 : -1;
                if (aVal > bVal) return sortOptions.direction === 'desc' ? -1 : 1;
                return 0;
            });
        }

        return results;
    }

    // Save search filters to localStorage
    saveSearchFilters(type, filters) {
        try {
            const key = `searchFilters_${type}`;
            localStorage.setItem(key, JSON.stringify(filters));
        } catch (error) {
            console.error('Error saving search filters:', error);
        }
    }

    // Load search filters from localStorage
    loadSearchFilters(type) {
        try {
            const key = `searchFilters_${type}`;
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Error loading search filters:', error);
            return {};
        }
    }

    // Clear all timeouts
    clearAllTimeouts() {
        this.searchTimeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.searchTimeouts.clear();
    }

    // Generate search summary
    getSearchSummary(originalCount, filteredCount, searchCriteria) {
        if (originalCount === filteredCount) {
            return `Showing all ${originalCount} items`;
        }

        const activeFilters = Object.entries(searchCriteria)
            .filter(([key, value]) => value && value !== 'all' && value !== '')
            .map(([key, value]) => {
                if (key === 'query') return `search: "${value}"`;
                return `${key}: ${value}`;
            });

        const filtersText = activeFilters.length > 0 ? ` (${activeFilters.join(', ')})` : '';
        return `Showing ${filteredCount} of ${originalCount} items${filtersText}`;
    }
}

// Global search manager instance
const searchManager = new SearchManager();