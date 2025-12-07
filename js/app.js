// Main Application
class App {
    constructor() {
        this.initialized = false;
    }

    // Initialize the application
    async init() {
        try {
            // Register service worker
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('Service Worker registered:', reg))
                    .catch(err => console.error('Service Worker registration failed:', err));
            }

            // Initialize auth
            await auth.init();

            // Initialize UI
            ui.init();

            // Setup app event listeners
            this.setupEventListeners();

            // Check for install prompt
            this.setupInstallPrompt();

            this.initialized = true;
        } catch (error) {
            console.error('Error initializing app:', error);
            ui.showToast('Error initializing application', 'error');
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Sign in button
        const signInBtn = document.getElementById('sign-in-btn');
        if (signInBtn) {
            signInBtn.addEventListener('click', () => auth.signIn());
        }

        // Sign out button
        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', () => auth.signOut());
        }

        // Add loan button
        const addLoanBtn = document.getElementById('add-loan-btn');
        if (addLoanBtn) {
            addLoanBtn.addEventListener('click', () => this.showAddLoanForm());
        }

        // Add payment button
        const addPaymentBtn = document.getElementById('add-payment-btn');
        if (addPaymentBtn) {
            addPaymentBtn.addEventListener('click', () => this.showAddPaymentForm());
        }

        // Open spreadsheet button
        const openSheetBtn = document.getElementById('open-sheet-btn');
        if (openSheetBtn) {
            openSheetBtn.addEventListener('click', () => ui.openSpreadsheet());
        }
    }

    // Setup PWA install prompt
    setupInstallPrompt() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;

            // Show install button
            const installBtn = document.getElementById('install-btn');
            if (installBtn) {
                installBtn.classList.remove('hidden');
                installBtn.addEventListener('click', async () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        console.log(`User response to install prompt: ${outcome}`);
                        deferredPrompt = null;
                        installBtn.classList.add('hidden');
                    }
                });
            }
        });

        window.addEventListener('appinstalled', () => {
            console.log('PWA installed');
            ui.showToast('App installed successfully!', 'success');
        });
    }

    // Show add loan form
    showAddLoanForm() {
        const formHtml = `
      <form id="add-loan-form" class="form">
        <div class="form-group">
          <label class="form-label">Date Given *</label>
          <input type="date" name="dateGiven" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
        </div>
        
        <div class="form-group">
          <label class="form-label">Borrower Name *</label>
          <input type="text" name="name" class="form-input" required placeholder="Enter borrower name">
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Amount Lent (₹) *</label>
            <input type="number" name="amount" class="form-input" required placeholder="10000" min="0" step="0.01">
          </div>
          
          <div class="form-group">
            <label class="form-label">Monthly Interest Rate (%) *</label>
            <input type="number" name="interestRate" class="form-input" required placeholder="2" min="0" step="0.01">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Details/Purpose</label>
          <textarea name="details" class="form-textarea" placeholder="Purpose of loan, terms, etc."></textarea>
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Via (Referrer/Surety)</label>
            <input type="text" name="via" class="form-input" placeholder="Who referred or is backing">
          </div>
          
          <div class="form-group">
            <label class="form-label">Has Pro Note?</label>
            <select name="hasProNote" class="form-select">
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Contacts</label>
          <div id="contacts-container">
            <div class="contact-entry grid grid-2" style="gap: 0.5rem; margin-bottom: 0.5rem;">
              <input type="text" class="form-input" placeholder="Name" data-contact="name">
              <input type="text" class="form-input" placeholder="Relation" data-contact="relation">
              <input type="tel" class="form-input" placeholder="Phone" data-contact="phone" style="grid-column: span 2;">
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="app.addContactField()">+ Add Another Contact</button>
        </div>
        
        <div class="form-group">
          <label class="form-label">Attachments (Pro Note, Documents)</label>
          <input type="file" id="loan-attachments" class="form-input" accept="image/*" multiple>
          <div id="loan-attachments-preview" class="mt-sm"></div>
        </div>
      </form>
    `;

        const footer = `
      <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="app.submitLoanForm()">Add Loan</button>
    `;

        ui.showModal('Add New Loan', formHtml, footer);

        // Handle image preview
        const fileInput = document.getElementById('loan-attachments');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const preview = document.getElementById('loan-attachments-preview');
                if (preview) {
                    const files = Array.from(e.target.files);
                    preview.innerHTML = files.map(f => `<small>${f.name}</small>`).join('<br>');
                }
            });
        }
    }

    // Add contact field
    addContactField() {
        const container = document.getElementById('contacts-container');
        if (container) {
            const entry = document.createElement('div');
            entry.className = 'contact-entry grid grid-2';
            entry.style.cssText = 'gap: 0.5rem; margin-bottom: 0.5rem;';
            entry.innerHTML = `
        <input type="text" class="form-input" placeholder="Name" data-contact="name">
        <input type="text" class="form-input" placeholder="Relation" data-contact="relation">
        <input type="tel" class="form-input" placeholder="Phone" data-contact="phone" style="grid-column: span 2;">
      `;
            container.appendChild(entry);
        }
    }

    // Submit loan form
    async submitLoanForm() {
        const form = document.getElementById('add-loan-form');
        if (!form || !form.checkValidity()) {
            ui.showToast('Please fill in all required fields', 'error');
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);

        // Collect contacts
        const contacts = [];
        document.querySelectorAll('.contact-entry').forEach(entry => {
            const name = entry.querySelector('[data-contact="name"]').value;
            const relation = entry.querySelector('[data-contact="relation"]').value;
            const phone = entry.querySelector('[data-contact="phone"]').value;

            if (name || relation || phone) {
                contacts.push({ name, relation, phone });
            }
        });

        // Handle image uploads
        let attachments = '';
        const fileInput = document.getElementById('loan-attachments');
        if (fileInput && fileInput.files.length > 0) {
            try {
                ui.showToast('Uploading attachments...', 'info');
                const uploadedImages = await driveManager.uploadMultipleImages(
                    Array.from(fileInput.files),
                    `loan_${formData.get('name')}`
                );
                attachments = driveManager.formatImageLinks(uploadedImages.map(img => img.link));
            } catch (error) {
                ui.showToast('Error uploading attachments', 'error');
                return;
            }
        }

        const loanData = {
            dateGiven: formData.get('dateGiven'),
            name: formData.get('name'),
            amount: parseFloat(formData.get('amount')),
            interestRate: parseFloat(formData.get('interestRate')),
            details: formData.get('details'),
            via: formData.get('via'),
            hasProNote: formData.get('hasProNote') === 'true',
            status: 'Active',
            contacts: contacts,
            attachments: attachments
        };

        try {
            await sheetsManager.addLoan(loanData);
            ui.showToast('Loan added successfully!', 'success');
            document.querySelector('.modal-overlay').remove();
            ui.loadLoans();
        } catch (error) {
            console.error('Error adding loan:', error);
            ui.showToast('Error adding loan', 'error');
        }
    }

    // Show add payment form
    showAddPaymentForm() {
        const formHtml = `
      <form id="add-payment-form" class="form">
        <div class="form-group">
          <label class="form-label">Payment Date *</label>
          <input type="date" name="paymentDate" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
        </div>
        
        <div class="form-group">
          <label class="form-label">Borrower Name *</label>
          <input type="text" name="borrowerName" class="form-input" required placeholder="Enter borrower name" list="borrower-list">
          <datalist id="borrower-list"></datalist>
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Amount Received (₹) *</label>
            <input type="number" name="amount" class="form-input" required placeholder="1000" min="0" step="0.01">
          </div>
          
          <div class="form-group">
            <label class="form-label">Payment Type *</label>
            <select name="paymentType" class="form-select" required>
              <option value="Interest">Interest</option>
              <option value="Principal">Principal</option>
              <option value="Both">Both</option>
            </select>
          </div>
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Payment Method *</label>
            <select name="paymentMethod" class="form-select" required>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Received By</label>
            <input type="text" name="receivedBy" class="form-input" placeholder="Self" value="Self">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea name="notes" class="form-textarea" placeholder="Additional notes"></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">Attachments (Receipts, Screenshots)</label>
          <input type="file" id="payment-attachments" class="form-input" accept="image/*" multiple>
          <div id="payment-attachments-preview" class="mt-sm"></div>
        </div>
      </form>
    `;

        const footer = `
      <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      <button type="button" class="btn btn-primary" onclick="app.submitPaymentForm()">Add Payment</button>
    `;

        ui.showModal('Record Interest Payment', formHtml, footer);

        // Populate borrower list
        this.populateBorrowerList();

        // Handle image preview
        const fileInput = document.getElementById('payment-attachments');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const preview = document.getElementById('payment-attachments-preview');
                if (preview) {
                    const files = Array.from(e.target.files);
                    preview.innerHTML = files.map(f => `<small>${f.name}</small>`).join('<br>');
                }
            });
        }
    }

    // Populate borrower list
    async populateBorrowerList() {
        try {
            const loans = await sheetsManager.getLoans();
            const datalist = document.getElementById('borrower-list');
            if (datalist) {
                datalist.innerHTML = loans
                    .map(loan => `<option value="${loan.name}">`)
                    .join('');
            }
        } catch (error) {
            console.error('Error loading borrowers:', error);
        }
    }

    // Submit payment form
    async submitPaymentForm() {
        const form = document.getElementById('add-payment-form');
        if (!form || !form.checkValidity()) {
            ui.showToast('Please fill in all required fields', 'error');
            form.reportValidity();
            return;
        }

        const formData = new FormData(form);

        // Handle image uploads
        let attachments = '';
        const fileInput = document.getElementById('payment-attachments');
        if (fileInput && fileInput.files.length > 0) {
            try {
                ui.showToast('Uploading attachments...', 'info');
                const uploadedImages = await driveManager.uploadMultipleImages(
                    Array.from(fileInput.files),
                    `payment_${formData.get('borrowerName')}`
                );
                attachments = driveManager.formatImageLinks(uploadedImages.map(img => img.link));
            } catch (error) {
                ui.showToast('Error uploading attachments', 'error');
                return;
            }
        }

        const paymentData = {
            paymentDate: formData.get('paymentDate'),
            borrowerName: formData.get('borrowerName'),
            loanReference: formData.get('borrowerName'), // Using name as reference
            amount: parseFloat(formData.get('amount')),
            paymentType: formData.get('paymentType'),
            paymentMethod: formData.get('paymentMethod'),
            receivedBy: formData.get('receivedBy') || 'Self',
            notes: formData.get('notes'),
            attachments: attachments
        };

        try {
            await sheetsManager.addPayment(paymentData);
            ui.showToast('Payment recorded successfully!', 'success');
            document.querySelector('.modal-overlay').remove();

            // Refresh both views
            if (ui.currentView === 'payments') {
                ui.loadPayments();
            } else {
                ui.loadLoans();
            }
        } catch (error) {
            console.error('Error adding payment:', error);
            ui.showToast('Error recording payment', 'error');
        }
    }
}

// Create and initialize app
const app = new App();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}
