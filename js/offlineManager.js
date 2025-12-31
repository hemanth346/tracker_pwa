// Enhanced Offline Support Manager
class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.offlineData = {
            loans: [],
            payments: [],
            lastSync: null
        };
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.syncInProgress = false;
        this.conflictResolutionStrategy = 'client-wins'; // 'client-wins', 'server-wins', 'manual'
    }

    // Initialize offline manager
    init() {
        this.setupEventListeners();
        this.loadOfflineData();
        this.showConnectivityStatus();
        this.setupPeriodicSync();
    }

    // Setup event listeners
    setupEventListeners() {
        // Network status changes
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.onOnline();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.onOffline();
        });

        // Background sync (if supported)
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready.then(sw => {
                // Register for background sync
                return sw.sync.register('background-sync');
            }).catch(err => {
                console.log('Background sync not supported:', err);
            });
        }

        // Page visibility change - sync when app becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.isOnline) {
                this.syncWithServer();
            }
        });
    }

    // Handle going online
    onOnline() {
        console.log('App is now online');
        this.showConnectivityStatus();
        this.syncWithServer();
        
        // Show notification
        if (this.syncQueue.length > 0) {
            ui.showToast(`Back online! Syncing ${this.syncQueue.length} pending changes...`, 'info');
        } else {
            ui.showToast('Back online!', 'success');
        }
    }

    // Handle going offline
    onOffline() {
        console.log('App is now offline');
        this.showConnectivityStatus();
        ui.showToast('You are now offline. Changes will be saved locally and synced when online.', 'warning');
    }

    // Show connectivity status
    showConnectivityStatus() {
        const statusElement = this.getOrCreateStatusElement();
        
        if (this.isOnline) {
            statusElement.className = 'connectivity-status online';
            statusElement.innerHTML = '<span>🟢</span> Online';
        } else {
            statusElement.className = 'connectivity-status offline';
            statusElement.innerHTML = '<span>🔴</span> Offline';
        }

        // Show sync queue status
        if (this.syncQueue.length > 0) {
            statusElement.innerHTML += ` (${this.syncQueue.length} pending)`;
        }
    }

    // Get or create status element
    getOrCreateStatusElement() {
        let statusElement = document.getElementById('connectivity-status');
        
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'connectivity-status';
            
            // Add CSS
            if (!document.querySelector('#offline-styles')) {
                const style = document.createElement('style');
                style.id = 'offline-styles';
                style.textContent = `
                    .connectivity-status {
                        position: fixed;
                        top: 60px;
                        right: 1rem;
                        padding: 0.5rem 1rem;
                        border-radius: 20px;
                        font-size: 0.875rem;
                        font-weight: 500;
                        z-index: 1000;
                        transition: all 0.3s ease;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    
                    .connectivity-status.online {
                        background: #4CAF50;
                        color: white;
                    }
                    
                    .connectivity-status.offline {
                        background: #f44336;
                        color: white;
                    }
                    
                    .sync-progress {
                        position: fixed;
                        top: 100px;
                        right: 1rem;
                        padding: 0.75rem 1rem;
                        background: var(--primary);
                        color: white;
                        border-radius: 8px;
                        font-size: 0.875rem;
                        z-index: 1001;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    }
                    
                    .conflict-resolution {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: var(--surface);
                        padding: 2rem;
                        border-radius: 12px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                        z-index: 1002;
                        max-width: 500px;
                        width: 90%;
                    }
                    
                    .conflict-item {
                        margin-bottom: 1rem;
                        padding: 1rem;
                        border: 1px solid var(--border);
                        border-radius: 8px;
                    }
                    
                    .conflict-local,
                    .conflict-server {
                        background: rgba(0,0,0,0.05);
                        margin: 0.5rem 0;
                        padding: 0.75rem;
                        border-radius: 4px;
                        font-size: 0.875rem;
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(statusElement);
        }
        
        return statusElement;
    }

    // Queue operation for offline sync
    queueOperation(operation) {
        const queueItem = {
            id: Date.now() + Math.random(),
            operation: operation.type,
            data: operation.data,
            timestamp: Date.now(),
            retries: 0,
            originalId: operation.originalId || null
        };

        this.syncQueue.push(queueItem);
        this.saveOfflineData();
        this.showConnectivityStatus();

        console.log('Operation queued for sync:', queueItem);
    }

    // Sync with server
    async syncWithServer() {
        if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
            return;
        }

        this.syncInProgress = true;
        this.showSyncProgress();

        try {
            console.log(`Starting sync of ${this.syncQueue.length} operations`);
            
            const results = [];
            
            for (const item of [...this.syncQueue]) {
                try {
                    const result = await this.processSyncItem(item);
                    results.push({ item, result, success: true });
                    
                    // Remove from queue on success
                    this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
                    
                } catch (error) {
                    console.error('Sync item failed:', error);
                    
                    item.retries = (item.retries || 0) + 1;
                    
                    if (item.retries >= this.maxRetries) {
                        console.error('Max retries reached, removing from queue:', item);
                        results.push({ item, error, success: false, maxRetriesReached: true });
                        this.syncQueue = this.syncQueue.filter(q => q.id !== item.id);
                    } else {
                        results.push({ item, error, success: false });
                    }
                }
            }

            this.saveOfflineData();
            this.showSyncResults(results);
            
        } catch (error) {
            console.error('Sync failed:', error);
            ui.showToast('Sync failed. Will retry later.', 'error');
        } finally {
            this.syncInProgress = false;
            this.hideSyncProgress();
            this.showConnectivityStatus();
        }
    }

    // Process individual sync item
    async processSyncItem(item) {
        switch (item.operation) {
            case 'add_loan':
                return await sheetsManager.addLoan(item.data);
            
            case 'update_loan':
                return await sheetsManager.updateLoan(item.originalId, item.data);
            
            case 'add_payment':
                return await sheetsManager.addPayment(item.data);
            
            case 'update_payment':
                return await sheetsManager.updatePayment(item.originalId, item.data);
            
            default:
                throw new Error(`Unknown operation: ${item.operation}`);
        }
    }

    // Show sync progress
    showSyncProgress() {
        let progressElement = document.getElementById('sync-progress');
        
        if (!progressElement) {
            progressElement = document.createElement('div');
            progressElement.id = 'sync-progress';
            progressElement.className = 'sync-progress';
            document.body.appendChild(progressElement);
        }
        
        progressElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div class="spinner-sm"></div>
                Syncing ${this.syncQueue.length} changes...
            </div>
        `;
    }

    // Hide sync progress
    hideSyncProgress() {
        const progressElement = document.getElementById('sync-progress');
        if (progressElement) {
            progressElement.remove();
        }
    }

    // Show sync results
    showSyncResults(results) {
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        if (successful > 0 && failed === 0) {
            ui.showToast(`✅ Synced ${successful} changes successfully`, 'success');
        } else if (successful > 0 && failed > 0) {
            ui.showToast(`⚠️ Synced ${successful} changes, ${failed} failed`, 'warning');
        } else if (failed > 0) {
            ui.showToast(`❌ Failed to sync ${failed} changes`, 'error');
        }

        // Handle conflicts if any
        const conflicts = results.filter(r => r.error && r.error.type === 'conflict');
        if (conflicts.length > 0) {
            this.handleConflicts(conflicts);
        }
    }

    // Handle data conflicts
    async handleConflicts(conflicts) {
        if (this.conflictResolutionStrategy === 'client-wins') {
            // Force update with client data
            for (const conflict of conflicts) {
                conflict.item.data._forceUpdate = true;
                await this.processSyncItem(conflict.item);
            }
            ui.showToast('Conflicts resolved: Client data preserved', 'info');
            
        } else if (this.conflictResolutionStrategy === 'server-wins') {
            // Skip client updates, accept server data
            ui.showToast('Conflicts resolved: Server data preserved', 'info');
            
        } else {
            // Manual resolution
            this.showConflictResolutionDialog(conflicts);
        }
    }

    // Show conflict resolution dialog
    showConflictResolutionDialog(conflicts) {
        const modal = document.createElement('div');
        modal.className = 'conflict-resolution';
        modal.innerHTML = `
            <h3>Sync Conflicts Detected</h3>
            <p>Some data has been changed both locally and on the server. Please choose how to resolve:</p>
            
            ${conflicts.map((conflict, index) => `
                <div class="conflict-item">
                    <h4>Conflict ${index + 1}: ${conflict.item.operation}</h4>
                    
                    <div class="conflict-local">
                        <strong>Your changes:</strong>
                        <pre>${JSON.stringify(conflict.item.data, null, 2)}</pre>
                    </div>
                    
                    <div class="conflict-server">
                        <strong>Server data:</strong>
                        <pre>${JSON.stringify(conflict.error.serverData, null, 2)}</pre>
                    </div>
                    
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-primary btn-sm" onclick="offlineManager.resolveConflict(${index}, 'client')">
                            Keep My Changes
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="offlineManager.resolveConflict(${index}, 'server')">
                            Use Server Data
                        </button>
                    </div>
                </div>
            `).join('')}
            
            <div style="margin-top: 2rem; text-align: right;">
                <button class="btn btn-outline" onclick="this.parentElement.parentElement.remove()">
                    Resolve Later
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // Resolve individual conflict
    async resolveConflict(conflictIndex, resolution) {
        // Implementation for manual conflict resolution
        console.log(`Resolving conflict ${conflictIndex} with ${resolution}`);
        // Remove the dialog after resolution
        const modal = document.querySelector('.conflict-resolution');
        if (modal) modal.remove();
    }

    // Save offline data to localStorage
    saveOfflineData() {
        try {
            const offlineData = {
                syncQueue: this.syncQueue,
                lastUpdate: Date.now()
            };
            localStorage.setItem('offlineData', JSON.stringify(offlineData));
        } catch (error) {
            console.error('Error saving offline data:', error);
        }
    }

    // Load offline data from localStorage
    loadOfflineData() {
        try {
            const saved = localStorage.getItem('offlineData');
            if (saved) {
                const data = JSON.parse(saved);
                this.syncQueue = data.syncQueue || [];
                this.offlineData.lastSync = data.lastUpdate;
            }
        } catch (error) {
            console.error('Error loading offline data:', error);
        }
    }

    // Setup periodic sync
    setupPeriodicSync() {
        // Sync every 30 seconds when online
        setInterval(() => {
            if (this.isOnline && this.syncQueue.length > 0) {
                this.syncWithServer();
            }
        }, 30000);
    }

    // Manual sync trigger
    async manualSync() {
        if (!this.isOnline) {
            ui.showToast('Cannot sync while offline', 'warning');
            return;
        }

        ui.showToast('Starting manual sync...', 'info');
        await this.syncWithServer();
        
        // Also refresh data
        cacheManager.remove('loans');
        cacheManager.remove('payments');
        
        if (ui.currentView === 'loans') {
            ui.loadLoans();
        } else if (ui.currentView === 'payments') {
            ui.loadPayments();
        } else if (ui.currentView === 'analytics') {
            ui.loadAnalytics();
        }
    }

    // Get offline status summary
    getOfflineStatus() {
        return {
            isOnline: this.isOnline,
            pendingSync: this.syncQueue.length,
            lastSync: this.offlineData.lastSync,
            syncInProgress: this.syncInProgress
        };
    }

    // Clear offline data
    clearOfflineData() {
        this.syncQueue = [];
        this.saveOfflineData();
        this.showConnectivityStatus();
        ui.showToast('Offline data cleared', 'info');
    }
}

// Global offline manager instance
const offlineManager = new OfflineManager();