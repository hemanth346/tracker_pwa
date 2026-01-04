// Analytics and Insights Dashboard
class AnalyticsManager {
    constructor() {
        this.loans = [];
        this.payments = [];
        this.initialized = false;
    }

    // Initialize analytics with data
    init(loans, payments) {
        this.loans = loans || [];
        this.payments = payments || [];
        this.initialized = true;
    }

    // Calculate summary metrics
    getSummaryMetrics() {
        const activeLoans = this.loans.filter(loan => loan.status === 'Active');
        const closedLoans = this.loans.filter(loan => loan.status === 'Closed');
        const defaultedLoans = this.loans.filter(loan => loan.status === 'Defaulted');

        const totalAmountLent = this.loans.reduce((sum, loan) => sum + (parseFloat(loan.amount) || 0), 0);
        const activeAmount = activeLoans.reduce((sum, loan) => sum + (parseFloat(loan.balanceAmount) || 0), 0);
        const totalInterestEarned = this.payments
            .filter(payment => payment.paymentType === 'Interest' || payment.paymentType === 'Both')
            .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);

        // Calculate expected monthly income from active loans
        const expectedMonthlyIncome = activeLoans.reduce((sum, loan) => {
            const principal = parseFloat(loan.balanceAmount) || 0;
            const rate = parseFloat(loan.interestRate) || 0;
            return sum + (principal * rate / 100);
        }, 0);

        // Calculate overdue loans (simplified - loans with no payments in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const overdueLoans = activeLoans.filter(loan => {
            const lastPayment = this.getLastPaymentDate(loan.loanId);
            return !lastPayment || new Date(lastPayment) < thirtyDaysAgo;
        });

        return {
            totalLoans: this.loans.length,
            activeLoans: activeLoans.length,
            closedLoans: closedLoans.length,
            defaultedLoans: defaultedLoans.length,
            totalAmountLent,
            activeAmount,
            totalInterestEarned,
            expectedMonthlyIncome,
            overdueLoans: overdueLoans.length,
            averageInterestRate: this.getAverageInterestRate(),
            defaultRate: this.loans.length > 0 ? (defaultedLoans.length / this.loans.length * 100) : 0,
            roiPercentage: totalAmountLent > 0 ? (totalInterestEarned / totalAmountLent * 100) : 0
        };
    }

    // Get average interest rate
    getAverageInterestRate() {
        if (this.loans.length === 0) return 0;
        const totalRate = this.loans.reduce((sum, loan) => sum + (parseFloat(loan.interestRate) || 0), 0);
        return totalRate / this.loans.length;
    }

    // Get last payment date for a loan
    getLastPaymentDate(loanId) {
        const loanPayments = this.payments
            .filter(payment => payment.loanId === loanId)
            .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

        return loanPayments.length > 0 ? loanPayments[0].paymentDate : null;
    }

    // Get loan status distribution data for pie chart
    getLoanStatusDistribution() {
        const statusCounts = {};
        this.loans.forEach(loan => {
            const status = loan.status || 'Active';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        return Object.entries(statusCounts).map(([status, count]) => ({
            label: status,
            value: count,
            percentage: Math.round((count / this.loans.length) * 100)
        }));
    }

    // Get monthly interest earnings for bar chart
    getMonthlyInterestEarnings() {
        const monthlyData = {};

        this.payments.forEach(payment => {
            if (payment.paymentType !== 'Interest' && payment.paymentType !== 'Both') return;

            const date = new Date(payment.paymentDate);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = 0;
            }
            monthlyData[monthKey] += parseFloat(payment.amount) || 0;
        });

        // Convert to array and sort by month
        return Object.entries(monthlyData)
            .map(([month, amount]) => ({
                month: month,
                amount: amount,
                formatted: this.formatMonth(month)
            }))
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-12); // Last 12 months
    }

    // Get lending trends over time for line chart
    getLendingTrends() {
        const monthlyData = {};

        this.loans.forEach(loan => {
            const date = new Date(loan.dateGiven);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { count: 0, amount: 0 };
            }
            monthlyData[monthKey].count += 1;
            monthlyData[monthKey].amount += parseFloat(loan.amount) || 0;
        });

        // Convert to array and sort by month
        return Object.entries(monthlyData)
            .map(([month, data]) => ({
                month: month,
                loanCount: data.count,
                totalAmount: data.amount,
                formatted: this.formatMonth(month)
            }))
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-12); // Last 12 months
    }

    // Get top borrowers by amount
    getTopBorrowers(limit = 5) {
        const borrowerData = {};

        this.loans.forEach(loan => {
            const name = loan.name || 'Unknown';
            if (!borrowerData[name]) {
                borrowerData[name] = {
                    name: name,
                    totalAmount: 0,
                    loanCount: 0,
                    activeLoans: 0,
                    totalInterestPaid: 0
                };
            }

            borrowerData[name].totalAmount += parseFloat(loan.amount) || 0;
            borrowerData[name].loanCount += 1;
            if (loan.status === 'Active') {
                borrowerData[name].activeLoans += 1;
            }
        });

        // Add interest payments data
        this.payments.forEach(payment => {
            if (payment.paymentType !== 'Interest' && payment.paymentType !== 'Both') return;

            const name = payment.borrowerName || 'Unknown';
            if (borrowerData[name]) {
                borrowerData[name].totalInterestPaid += parseFloat(payment.amount) || 0;
            }
        });

        // Convert to array and sort by total amount
        return Object.values(borrowerData)
            .sort((a, b) => b.totalAmount - a.totalAmount)
            .slice(0, limit);
    }

    // Get performance metrics
    getPerformanceMetrics() {
        const activeLoans = this.loans.filter(loan => loan.status === 'Active');
        const closedLoans = this.loans.filter(loan => loan.status === 'Closed');

        // Calculate average loan tenure for closed loans
        const avgTenure = closedLoans.length > 0 ?
            closedLoans.reduce((sum, loan) => {
                const start = new Date(loan.dateGiven);
                const end = new Date(loan.dateOfClosure);
                const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 +
                    (end.getMonth() - start.getMonth());
                return sum + monthsDiff;
            }, 0) / closedLoans.length : 0;

        // Calculate collection efficiency
        const totalExpected = this.loans.reduce((sum, loan) => {
            if (loan.status === 'Closed') {
                // For closed loans, calculate based on tenure
                const start = new Date(loan.dateGiven);
                const end = new Date(loan.dateOfClosure);
                const months = (end.getFullYear() - start.getFullYear()) * 12 +
                    (end.getMonth() - start.getMonth());
                return sum + (parseFloat(loan.amount) * parseFloat(loan.interestRate) / 100) * months;
            }
            return sum;
        }, 0);

        const totalCollected = this.payments
            .filter(p => p.paymentType === 'Interest' || p.paymentType === 'Both')
            .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
        const collectionEfficiency = totalExpected > 0 ? (totalCollected / totalExpected * 100) : 0;

        return {
            averageLoanTenure: Math.round(avgTenure * 10) / 10,
            collectionEfficiency: Math.round(collectionEfficiency * 100) / 100,
            totalPortfolioValue: this.loans.reduce((sum, loan) => sum + (parseFloat(loan.balanceAmount) || 0), 0),
            portfolioGrowthRate: this.calculatePortfolioGrowthRate()
        };
    }

    // Calculate portfolio growth rate
    calculatePortfolioGrowthRate() {
        const currentYear = new Date().getFullYear();
        const lastYear = currentYear - 1;

        const currentYearLoans = this.loans.filter(loan =>
            new Date(loan.dateGiven).getFullYear() === currentYear
        );
        const lastYearLoans = this.loans.filter(loan =>
            new Date(loan.dateGiven).getFullYear() === lastYear
        );

        const currentYearAmount = currentYearLoans.reduce((sum, loan) => sum + (parseFloat(loan.amount) || 0), 0);
        const lastYearAmount = lastYearLoans.reduce((sum, loan) => sum + (parseFloat(loan.amount) || 0), 0);

        if (lastYearAmount === 0) return 0;
        return Math.round(((currentYearAmount - lastYearAmount) / lastYearAmount) * 100);
    }

    // Format month for display
    formatMonth(monthString) {
        const [year, month] = monthString.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    // Format number with commas
    formatNumber(number) {
        return new Intl.NumberFormat('en-IN').format(number);
    }

    // Export analytics data
    exportAnalyticsData() {
        return {
            summary: this.getSummaryMetrics(),
            statusDistribution: this.getLoanStatusDistribution(),
            monthlyEarnings: this.getMonthlyInterestEarnings(),
            lendingTrends: this.getLendingTrends(),
            topBorrowers: this.getTopBorrowers(),
            performance: this.getPerformanceMetrics(),
            generatedAt: new Date().toISOString()
        };
    }
}

// Global analytics manager instance
const analyticsManager = new AnalyticsManager();