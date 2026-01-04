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
                        discoveryDocs: [
                            'https://sheets.googleapis.com/$discovery/rest?version=v4',
                            'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
                        ],
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
            console.log('[Sheets] Setting access token for GAPI client');
            gapi.client.setToken({ access_token: token });
        } else {
            console.warn('[Sheets] Cannot set access token: GAPI client not loaded');
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
            'Attachments',
            'Total Principal Paid',
            'Balance Amount'
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
                            range: 'Loans!A1:Q1',
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
            // First, get the spreadsheet to check sheet IDs
            const spreadsheet = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            const sheets = spreadsheet.result.sheets;
            console.log('Available sheets:', sheets.map(s => ({ title: s.properties.title, sheetId: s.properties.sheetId })));

            const loansSheet = sheets.find(s => s.properties.title === 'Loans');
            const paymentsSheet = sheets.find(s => s.properties.title === 'Interest Payments');

            if (!loansSheet || !paymentsSheet) {
                console.error('Required sheets not found:', { loansSheet: !!loansSheet, paymentsSheet: !!paymentsSheet });
                return;
            }

            await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.spreadsheetId,
                resource: {
                    requests: [
                        {
                            repeatCell: {
                                range: {
                                    sheetId: loansSheet.properties.sheetId, // Use actual sheet ID
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
                                    sheetId: paymentsSheet.properties.sheetId, // Use actual sheet ID
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
        console.log('[Sheets] Starting spreadsheet setup...');

        // 1. Check if we already have an ID (from localStorage or config)
        let idToVerify = localStorage.getItem('spreadsheetId') || this.spreadsheetId;

        if (idToVerify) {
            console.log('[Sheets] Verifying existing ID:', idToVerify);
            try {
                const response = await gapi.client.drive.files.get({
                    fileId: idToVerify,
                    fields: 'id, name, trashed, mimeType'
                });

                if (response.result.trashed) {
                    console.log('[Sheets] Spreadsheet is in trash, will search/create new one');
                } else {
                    console.log('[Sheets] Found valid active spreadsheet:', response.result.name);
                    this.spreadsheetId = idToVerify;
                    localStorage.setItem('spreadsheetId', this.spreadsheetId);
                    return this.spreadsheetId;
                }
            } catch (error) {
                console.warn('[Sheets] Verification of ID failed:', error.result?.error?.message || error.message);
                // Continue to search/create
            }
        }

        // 2. Search for existing spreadsheet by name
        try {
            console.log('[Sheets] Searching Drive for spreadsheet named:', CONFIG.SPREADSHEET_NAME);
            // We use a slightly more flexible query to ensure we find it
            const query = `name = '${CONFIG.SPREADSHEET_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
            const response = await gapi.client.drive.files.list({
                q: query,
                fields: 'files(id, name, modifiedTime)',
                spaces: 'drive',
                orderBy: 'modifiedTime desc'
            });

            const files = response.result?.files || [];
            if (files.length > 0) {
                this.spreadsheetId = files[0].id;
                console.log('[Sheets] Found existing spreadsheet in Drive:', files[0].name, '(', this.spreadsheetId, ')');
                localStorage.setItem('spreadsheetId', this.spreadsheetId);
                return this.spreadsheetId;
            }
            console.log('[Sheets] No matching spreadsheet found in Drive search.');
        } catch (error) {
            console.error('[Sheets] Drive search failed:', error);
        }

        // 3. Create new spreadsheet as last resort
        console.log('[Sheets] Creating a new spreadsheet named:', CONFIG.SPREADSHEET_NAME);
        return await this.createSpreadsheet();
    }

    // Manually link a spreadsheet by ID
    async linkSpreadsheet(id) {
        try {
            const response = await gapi.client.drive.files.get({
                fileId: id,
                fields: 'id, name, trashed, mimeType'
            });

            if (response.result?.trashed) {
                throw new Error('This spreadsheet is in the trash.');
            }

            if (response.result?.mimeType !== 'application/vnd.google-apps.spreadsheet') {
                throw new Error('Selected file is not a Google Spreadsheet.');
            }

            this.spreadsheetId = id;
            localStorage.setItem('spreadsheetId', this.spreadsheetId);

            // Re-initialize headers just in case it's an empty sheet
            // but first check if it's already structured
            try {
                await gapi.client.sheets.spreadsheets.get({ spreadsheetId: id });
            } catch (e) {
                console.log('[Sheets] New spreadsheet needs initialization');
                await this.initializeHeaders();
            }

            return response.result;
        } catch (error) {
            console.error('[Sheets] Error linking spreadsheet:', error);
            throw error;
        }
    }

    // Add loan
    async addLoan(loanData) {
        // Handle offline mode
        if (typeof offlineManager !== 'undefined' && !offlineManager.isOnline) {
            console.log('App is offline, queuing loan addition');

            // Generate a temporary ID if not present
            const tempId = loanData.loanId || `TEMP-LOAN-${Date.now()}`;
            const offlineLoan = { ...loanData, loanId: tempId };

            offlineManager.queueOperation({
                type: 'add_loan',
                data: offlineLoan
            });

            // Optimistically update cache instead of just removing it
            const cachedLoans = cacheManager.get('loans') || [];
            cachedLoans.unshift({
                ...offlineLoan,
                rowIndex: -1, // Temporary index
                status: 'Active'
            });
            cacheManager.set('loans', cachedLoans);

            return tempId;
        }

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
                loanData.attachments || '',
                0, // Total Principal Paid (calculated)
                loanData.amount // Balance Amount (calculated)
            ];

            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: 'Loans!A:O',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [row],
                },
            });

            // Invalidate cache after successful addition
            cacheManager.remove('loans');
            console.log('Loans cache invalidated after adding new loan');

            return loanId;
        } catch (error) {
            console.error('Error adding loan:', error);
            throw error;
        }
    }


    // Get all loans (with caching)
    async getLoans() {
        // Handle offline mode
        if (typeof offlineManager !== 'undefined' && !offlineManager.isOnline) {
            console.log('App is offline, returning cached loans');
            return cacheManager.get('loans') || [];
        }

        try {
            // Check cache first
            const cacheKey = 'loans';
            const cachedLoans = cacheManager.get(cacheKey);
            if (cachedLoans) {
                console.log('Loans loaded from cache');
                return cachedLoans;
            }

            console.log('Fetching loans from API...');
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Loans!A2:Q',
            });

            const rows = response.result.values || [];
            const loans = rows.map((row, index) => ({
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
                contacts: this.parseJSON(row[10]),
                lastPaymentDate: row[11] || '',
                totalInterestPaid: parseFloat(row[12]) || 0,
                paidTillMonth: row[13] || '',
                attachments: row[14] || '',
                totalPrincipalPaid: parseFloat(row[15]) || 0,
                balanceAmount: parseFloat(row[16]) || (parseFloat(row[3]) || 0)
            }));

            // Cache the results
            cacheManager.set(cacheKey, loans);
            console.log('Loans cached for future requests');

            return loans;
        } catch (error) {
            console.error('Error getting loans:', error);

            // Try to return cached data even if expired in case of network error
            const fallbackLoans = cacheManager.get('loans');
            if (fallbackLoans) {
                console.log('Returning cached loans due to API error');
                return fallbackLoans;
            }

            throw error;
        }
    }

    // Get distinct values from a column
    async getDistinctValues(sheetName, columnIndex) {
        // Handle offline mode
        if (typeof offlineManager !== 'undefined' && !offlineManager.isOnline) {
            console.log(`App is offline, getting distinct values from cache for ${sheetName}`);
            let data = [];
            if (sheetName === 'Loans') {
                data = cacheManager.get('loans') || [];
            } else if (sheetName === 'Interest Payments') {
                data = cacheManager.get('payments') || [];
            }

            if (data.length > 0) {
                let values = [];
                if (sheetName === 'Loans') {
                    // Column mapping for Loans: 2: name, 6: via
                    if (columnIndex === 2) values = data.map(l => l.name);
                    else if (columnIndex === 6) values = data.map(l => l.via);
                } else if (sheetName === 'Interest Payments') {
                    // Column mapping for Payments: 6: receivedBy
                    if (columnIndex === 6) values = data.map(p => p.receivedBy);
                }
                return [...new Set(values.filter(v => v))].sort();
            }
            return [];
        }

        try {
            const range = `${sheetName}!${this.getColumnLetter(columnIndex)}2:${this.getColumnLetter(columnIndex)}`;
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: range,
            });

            const values = response.result.values || [];
            // Flatten, filter empty, unique, sort
            return [...new Set(values.flat().filter(v => v))].sort();
        } catch (error) {
            console.error('Error getting distinct values:', error);
            return [];
        }
    }


    // Helper: Get column letter from index (0-based)
    getColumnLetter(index) {
        let temp, letter = '';
        while (index >= 0) {
            temp = index % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            index = (index - temp - 1) / 26;
        }
        return letter;
    }

    // Add interest payment
    async addPayment(paymentData) {
        // Handle offline mode
        if (typeof offlineManager !== 'undefined' && !offlineManager.isOnline) {
            console.log('App is offline, queuing payment addition');

            offlineManager.queueOperation({
                type: 'add_payment',
                data: paymentData
            });

            // Optimistically update cache
            const cachedPayments = cacheManager.get('payments') || [];
            cachedPayments.unshift({
                ...paymentData,
                rowIndex: -1
            });
            cacheManager.set('payments', cachedPayments);

            return true;
        }

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

            // Invalidate caches to ensure UI shows fresh data
            cacheManager.remove('payments');
            cacheManager.remove('loans');
            console.log('Caches invalidated after adding payment');

            return true;
        } catch (error) {
            console.error('Error adding payment:', error);
            throw error;
        }
    }


    // Get all payments (with caching)
    async getPayments() {
        // Handle offline mode
        if (typeof offlineManager !== 'undefined' && !offlineManager.isOnline) {
            console.log('App is offline, returning cached payments');
            return cacheManager.get('payments') || [];
        }

        try {
            // Check cache first
            const cacheKey = 'payments';
            const cachedPayments = cacheManager.get(cacheKey);
            if (cachedPayments) {
                console.log('Payments loaded from cache');
                return cachedPayments;
            }

            console.log('Fetching payments from API...');
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: 'Interest Payments!A2:I',
            });

            const rows = response.result.values || [];
            const payments = rows.map((row, index) => ({
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

            // Cache the results
            cacheManager.set(cacheKey, payments);
            console.log('Payments cached for future requests');

            return payments;
        } catch (error) {
            console.error('Error getting payments:', error);

            // Try to return cached data even if expired in case of network error
            const fallbackPayments = cacheManager.get('payments');
            if (fallbackPayments) {
                console.log('Returning cached payments due to API error');
                return fallbackPayments;
            }

            throw error;
        }
    }

    // Update loan calculated fields
    async updateLoanCalculatedFields(loanId) {
        try {
            // Force fetch without cache to get latest rows
            cacheManager.remove('loans');
            cacheManager.remove('payments');

            const loans = await this.getLoans();
            const payments = await this.getPayments();

            const loan = loans.find(l => l.loanId === loanId);
            if (!loan) return;

            // Get payments for this loan
            const loanPayments = payments.filter(p => p.loanId === loanId);

            if (loanPayments.length === 0) return;

            const totalInterestPaid = loanPayments
                .filter(p => p.paymentType === 'Interest' || p.paymentType === 'Both')
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

            const totalPrincipalPaid = loanPayments
                .filter(p => p.paymentType === 'Principal')
                .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

            const balanceAmount = (parseFloat(loan.amount) || 0) - totalPrincipalPaid;

            // Calculate paid till month
            const monthlyInterest = ((parseFloat(loan.amount) || 0) * (parseFloat(loan.interestRate) || 0)) / 100;
            const monthsPaid = monthlyInterest > 0 ? Math.floor(totalInterestPaid / monthlyInterest) : 0;
            const startDate = new Date(loan.dateGiven);
            const paidTillDate = new Date(startDate);
            paidTillDate.setMonth(paidTillDate.getMonth() + monthsPaid);
            const paidTillMonth = paidTillDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

            const lastPaymentDate = loanPayments
                .map(p => new Date(p.paymentDate))
                .sort((a, b) => b - a)[0]
                .toLocaleDateString();

            // Update the row
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `Loans!L${loan.rowIndex}:Q${loan.rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[lastPaymentDate, totalInterestPaid, paidTillMonth, loan.attachments, totalPrincipalPaid, balanceAmount]],
                },
            });
        } catch (error) {
            console.error('Error updating calculated fields:', error);
        }
    }

    // Update loan
    async updateLoan(rowIndex, loanData) {
        // Handle offline mode
        if (typeof offlineManager !== 'undefined' && !offlineManager.isOnline) {
            console.log('App is offline, queuing loan update');

            offlineManager.queueOperation({
                type: 'update_loan',
                originalId: rowIndex, // Using rowIndex as the originalId for updates
                data: loanData
            });

            // Optimistically update cache
            let cachedLoans = cacheManager.get('loans') || [];
            const index = cachedLoans.findIndex(l => l.rowIndex === rowIndex || l.loanId === loanData.loanId);
            if (index !== -1) {
                cachedLoans[index] = { ...cachedLoans[index], ...loanData };
            } else {
                cachedLoans.push({ ...loanData, rowIndex });
            }
            cacheManager.set('loans', cachedLoans);

            return true;
        }


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
                loanData.attachments || '',
                loanData.totalPrincipalPaid || 0,
                loanData.balanceAmount || loanData.amount
            ];

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `Loans!A${rowIndex}:Q${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [row],
                },
            });

            // Invalidate cache after successful update
            cacheManager.remove('loans');

            // Trigger recalculation to ensure metrics are fresh
            await this.updateLoanCalculatedFields(loanData.loanId);

            console.log('Loans cache invalidated and recalculated after updating loan');

            return true;
        } catch (error) {
            console.error('Error updating loan:', error);
            throw error;
        }
    }

    // Update interest payment
    async updatePayment(rowIndex, paymentData) {
        // Handle offline mode
        if (typeof offlineManager !== 'undefined' && !offlineManager.isOnline) {
            console.log('App is offline, queuing payment update');

            offlineManager.queueOperation({
                type: 'update_payment',
                originalId: rowIndex,
                data: paymentData
            });

            // Optimistically update cache
            let cachedPayments = cacheManager.get('payments') || [];
            const index = cachedPayments.findIndex(p => p.rowIndex === rowIndex);
            if (index !== -1) {
                cachedPayments[index] = { ...cachedPayments[index], ...paymentData };
            } else {
                cachedPayments.push({ ...paymentData, rowIndex });
            }
            cacheManager.set('payments', cachedPayments);

            return true;
        }


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

            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: `Interest Payments!A${rowIndex}:I${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [row],
                },
            });

            // Update loan calculated fields
            await this.updateLoanCalculatedFields(paymentData.loanId);

            // Invalidate caches
            cacheManager.remove('payments');
            cacheManager.remove('loans');

            return true;
        } catch (error) {
            console.error('Error updating payment:', error);
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
