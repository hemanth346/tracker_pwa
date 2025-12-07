// Google Drive API Integration for Image Uploads
class DriveManager {
    constructor() {
        this.folderId = null;
        this.driveLoaded = false;
    }

    // Initialize Google Drive API
    async init() {
        // Drive API is loaded with Sheets API
        this.driveLoaded = true;
        await this.getOrCreateFolder();
    }

    // Get or create attachments folder
    async getOrCreateFolder() {
        try {
            // Check if we have a saved folder ID
            const savedFolderId = localStorage.getItem('driveFolderId');
            if (savedFolderId) {
                // Verify it exists
                try {
                    await auth.makeAuthRequest(
                        `https://www.googleapis.com/drive/v3/files/${savedFolderId}`,
                        { method: 'GET' }
                    );
                    this.folderId = savedFolderId;
                    return this.folderId;
                } catch (error) {
                    console.log('Saved folder not found, creating new one');
                }
            }

            // Search for existing folder
            const searchResponse = await auth.makeAuthRequest(
                `https://www.googleapis.com/drive/v3/files?q=name='${CONFIG.DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                { method: 'GET' }
            );

            const searchData = await searchResponse.json();

            if (searchData.files && searchData.files.length > 0) {
                this.folderId = searchData.files[0].id;
                localStorage.setItem('driveFolderId', this.folderId);
                return this.folderId;
            }

            // Create new folder
            const createResponse = await auth.makeAuthRequest(
                'https://www.googleapis.com/drive/v3/files',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: CONFIG.DRIVE_FOLDER_NAME,
                        mimeType: 'application/vnd.google-apps.folder',
                    }),
                }
            );

            const createData = await createResponse.json();
            this.folderId = createData.id;
            localStorage.setItem('driveFolderId', this.folderId);

            return this.folderId;
        } catch (error) {
            console.error('Error getting/creating folder:', error);
            throw error;
        }
    }

    // Upload image to Drive
    async uploadImage(file, fileName) {
        try {
            if (!this.folderId) {
                await this.getOrCreateFolder();
            }

            // Create metadata
            const metadata = {
                name: fileName || file.name,
                parents: [this.folderId],
            };

            // Create form data
            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            formData.append('file', file);

            // Upload file
            const response = await auth.makeAuthRequest(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
                {
                    method: 'POST',
                    body: formData,
                }
            );

            if (!response.ok) {
                throw new Error('Failed to upload image');
            }

            const data = await response.json();

            // Make file publicly accessible (anyone with link can view)
            await this.makeFilePublic(data.id);

            // Get shareable link
            const viewLink = await this.getShareableLink(data.id);

            return {
                id: data.id,
                name: data.name,
                link: viewLink,
                webViewLink: data.webViewLink,
            };
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    }

    // Make file publicly accessible
    async makeFilePublic(fileId) {
        try {
            await auth.makeAuthRequest(
                `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        role: 'reader',
                        type: 'anyone',
                    }),
                }
            );
        } catch (error) {
            console.error('Error making file public:', error);
            // Non-critical error, continue
        }
    }

    // Get shareable link
    async getShareableLink(fileId) {
        // Return direct view link
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }

    // Upload multiple images
    async uploadMultipleImages(files, prefix = '') {
        const uploadPromises = files.map((file, index) => {
            const fileName = prefix ? `${prefix}_${index + 1}_${file.name}` : file.name;
            return this.uploadImage(file, fileName);
        });

        try {
            const results = await Promise.all(uploadPromises);
            return results;
        } catch (error) {
            console.error('Error uploading multiple images:', error);
            throw error;
        }
    }

    // Delete image from Drive
    async deleteImage(fileId) {
        try {
            await auth.makeAuthRequest(
                `https://www.googleapis.com/drive/v3/files/${fileId}`,
                { method: 'DELETE' }
            );
            return true;
        } catch (error) {
            console.error('Error deleting image:', error);
            throw error;
        }
    }

    // Get folder URL
    getFolderUrl() {
        if (!this.folderId) return null;
        return `https://drive.google.com/drive/folders/${this.folderId}`;
    }

    // Parse image links from string
    parseImageLinks(linksString) {
        if (!linksString) return [];
        try {
            return JSON.parse(linksString);
        } catch {
            // Legacy format: comma-separated links
            return linksString.split(',').filter(link => link.trim());
        }
    }

    // Format image links for storage
    formatImageLinks(links) {
        return JSON.stringify(links);
    }
}

// Export singleton instance
const driveManager = new DriveManager();
