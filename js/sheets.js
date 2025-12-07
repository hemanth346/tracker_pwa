// Google Sheets API Integration
class SheetsManager {
    constructor() {
        this.spreadsheetId = CONFIG.SPREADSHEET_ID || null;
        this.sheetsLoaded = false;
    }

    // Initialize Google Sheets API
    async init() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://apis.google.com/js/api.js';
            script.onload = () => {
                gapi.load('client', async () => {
                    await gapi.client.init({
                        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
                    });
                    this.sheetsLoaded = true;
                    resolve();
                });
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Set access token
    setAccessToken(token) {
        if (this.sheetsLoaded) {
            gapi.client.setToken({ access_token: token });
        }
    }

    // Create new spreadsheet
    async createSpreadsheet() {
        try {
            const response = await gapi.client.sheets.spreadsheets.create({
                properties: {
                    title: CONFIG.SPREADSHEET_NAME,
                },
                sheets: [
                    {
                        properties: {
                            title: 'Loans',
                            gridProperties: {
                                frozenRowCount: 1,
                            },
                        },
                    },
                    {
                        properties: {
                            title: 'Interest Payments',
                            gridProperties: {
                                frozenRowCount: 1,
                            },
                        },
                    },
                ],
            });

            this.spreadsheetId = response.result.spreadsheetId;

            // Initialize headers
            await this.initializeHeaders();

            // Save spreadsheet ID
            localStorage.setItem('spreadsheetId', this.spreadsheetId);

            return this.spreadsheetId;
        } catch (error) {
            console.error('Error creating spreadsheet:', error);
            throw error;
        }
    }

    // Initialize sheet headers
    async initializeHeaders() {
        const loansHeaders = [
            'Loan ID',
            'Date Given',
            'Name',
            'Amount Lent',
            'Monthly Interest Rate (%)',
            'Details',
            'Via',
            'Has Pro Note',
            'Status',
            'Date of Closure',
            'Contacts (JSON)',
            'Last Interest Payment Date',
            'Total Interest Paid',
            'Paid Till Month',
            'Attachments'
        ];

        const paymentsHeaders = [
            'Payment Date',
            'Loan ID',
            'Borrower Name',
            'Amount Received',
            'Payment Type',
            'Payment Method',
            'Received By',
            'Attachments',
            'Notes'
        ];

        try {
            await gapi.client.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    valueInputOption: 'RAW',
                    data: [
                        {
                            range: 'Loans!A1:O1',
                            values: [loansHeaders],
                        },
                        {
                            range: 'Interest Payments!A1:I1',
                            values: [paymentsHeaders],
                        },
                    ],
                },
            });

            // Format headers (bold, background color)
            await this.formatHeaders();
        } catch (error) {
            console.error('Error initializing headers:', error);
            throw error;
        }
    }

    // Format headers
    async formatHeaders() {
        try {
            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 0, // Loans sheet
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.39, green: 0.4, blue: 0.95 },
                                        textFormat: {
                                            foregroundColor: { red: 1, green: 1, blue: 1 },
                                            bold: true,
                                        },
                                    },
                                },
                                fields: 'userEnteredFormat(backgroundColor,textFormat)',
                            },
                        },
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 1, // Interest Payments sheet
                                    startRowIndex: 0,
                                    endRowIndex: 1,
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.39, green: 0.4, blue: 0.95 },
                                        textFormat: {
                                            foregroundColor: { red: 1, green: 1, blue: 1 },
                                            bold: true,
                                        },
                                    },
                                },
                                fields: 'userEnteredFormat(backgroundColor,textFormat)',
                            },
                        },
                    ],
                },
            });
        } catch (error) {
            console.error('Error formatting headers:', error);
        }
    }

    // Get or create spreadsheet
    async getOrCreateSpreadsheet() {
        // Check if we have a saved spreadsheet ID
        const savedId = localStorage.getItem('spreadsheetId');
        if (savedId) {
            this.spreadsheetId = savedId;
            // Verify it exists
            try {
                await gapi.client.sheets.spreadsheets.get({
                    spreadsheetId: this.spreadsheetId,
                });
                return this.spreadsheetId;
            } catch (error) {
                console.log('Saved spreadsheet not found, creating new one');
            }
        }

        // Create new spreadsheet
        return await this.createSpreadsheet();
    }

    // Add loan
    async addLoan(loanData) {
        try {
            // Generate Loan ID: LOAN-YYYYMMDD-XXX
            const loans = await this.getLoans();
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const todayLoans = loans.filter(l => l.loanId && l.loanId.includes(today));
            const sequence = String(todayLoans.length + 1).padStart(3, '0');
            const loanId = `LOAN-${today}-${sequence}`;

            const row = [
                loanId,
                loanData.dateGiven,
                loanData.name,
                loanData.amount,
                loanData.interestRate,
                loanData.details,
                loanData.via,
                loanData.hasProNote ? 'Yes' : 'No',
                loanData.status || 'Active',
                loanData.dateOfClosure || '',
                JSON.stringify(loanData.contacts || []),
                '', // Last Interest Payment Date (calculated)
                0, // Total Interest Paid (calculated)
                '', // Paid Till Month (calculated)
                loanData.attachments || ''
            ];

            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'Loans!A:O',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [row],
                },
            });

            return loanId;
        } catch (error) {
            console.error('Error adding loan:', error);
            throw error;
        }
    }

    // Get all loans
    async getLoans() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Loans!A2:O',
            });

            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                rowIndex: index + 2,
                loanId: row[0] || '',
                dateGiven: row[1] || '',
                name: row[2] || '',
                amount: parseFloat(row[3]) || 0,
                interestRate: parseFloat(row[4]) || 0,
                details: row[5] || '',
                via: row[6] || '',
                hasProNote: row[7] === 'Yes',
                status: row[8] || 'Active',
                dateOfClosure: row[9] || '',
                contacts: this.parseJSON(row[10]) || [],
                lastPaymentDate: row[11] || '',
                totalInterestPaid: parseFloat(row[12]) || 0,
                paidTillMonth: row[13] || '',
                attachments: row[14] || ''
            }));
        } catch (error) {
            console.error('Error getting loans:', error);
            throw error;
        }
    }

    // Add interest payment
    async addPayment(paymentData) {
        try {
            const row = [
                paymentData.paymentDate,
                paymentData.loanId,
                paymentData.borrowerName,
                paymentData.amount,
                paymentData.paymentType,
                paymentData.paymentMethod,
                paymentData.receivedBy || 'Self',
                paymentData.attachments || '',
                paymentData.notes || ''
            ];

            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'Interest Payments!A:I',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [row],
                },
            });

            // Update loan calculated fields
            await this.updateLoanCalculatedFields(paymentData.loanId);

            return true;
        } catch (error) {
            console.error('Error adding payment:', error);
            throw error;
        }
    }

    // Get all payments
    async getPayments() {
        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Interest Payments!A2:I',
            });

            const rows = response.result.values || [];
            return rows.map((row, index) => ({
                rowIndex: index + 2,
                paymentDate: row[0] || '',
                loanId: row[1] || '',
                borrowerName: row[2] || '',
                amount: parseFloat(row[3]) || 0,
                paymentType: row[4] || '',
                paymentMethod: row[5] || '',
                receivedBy: row[6] || 'Self',
                attachments: row[7] || '',
                notes: row[8] || ''
            }));
        } catch (error) {
            console.error('Error getting payments:', error);
            throw error;
        }
    }

    // Update loan calculated fields
    async updateLoanCalculatedFields(loanId) {
        try {
            const loans = await this.getLoans();
            const payments = await this.getPayments();

            const loan = loans.find(l => l.loanId === loanId);
            if (!loan) return;

            // Get payments for this loan
            const loanPayments = payments.filter(p => p.loanId === loanId);

            if (loanPayments.length === 0) return;

            // Calculate fields
            const lastPaymentDate = loanPayments
                .map(p => new Date(p.paymentDate))
                .sort((a, b) => b - a)[0]
                .toLocaleDateString();

            const totalInterestPaid = loanPayments
                .filter(p => p.paymentType === 'Interest' || p.paymentType === 'Both')
                .reduce((sum, p) => sum + p.amount, 0);

            // Calculate paid till month
            const monthlyInterest = (loan.amount * loan.interestRate) / 100;
            const monthsPaid = monthlyInterest > 0 ? Math.floor(totalInterestPaid / monthlyInterest) : 0;
            const startDate = new Date(loan.dateGiven);
            const paidTillDate = new Date(startDate);
            paidTillDate.setMonth(paidTillDate.getMonth() + monthsPaid);
            const paidTillMonth = paidTillDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

            // Update the row
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `Loans!L${loan.rowIndex}:N${loan.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[lastPaymentDate, totalInterestPaid, paidTillMonth]],
                },
            });
        } catch (error) {
            console.error('Error updating calculated fields:', error);
        }
    }

    // Update loan
    async updateLoan(rowIndex, loanData) {
        try {
            const row = [
                loanData.loanId,
                loanData.dateGiven,
                loanData.name,
                loanData.amount,
                loanData.interestRate,
                loanData.details,
                loanData.via,
                loanData.hasProNote ? 'Yes' : 'No',
                loanData.status,
                loanData.dateOfClosure || '',
                JSON.stringify(loanData.contacts || []),
                loanData.lastPaymentDate || '',
                loanData.totalInterestPaid || 0,
                loanData.paidTillMonth || '',
                loanData.attachments || ''
            ];

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `Loans!A${rowIndex}:O${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [row],
                },
            });

            return true;
        } catch (error) {
            console.error('Error updating loan:', error);
            throw error;
        }
    }

    // Helper to parse JSON safely
    parseJSON(str) {
        try {
            return JSON.parse(str);
        } catch {
            return null;
        }
    }

    // Get spreadsheet URL
    getSpreadsheetUrl() {
        if (!this.spreadsheetId) return null;
        return `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}`;
    }
}

// Export singleton instance
const sheetsManager = new SheetsManager();
