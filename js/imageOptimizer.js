// Image Optimization Utilities
class ImageOptimizer {
    constructor() {
        this.maxWidth = 1920;
        this.maxHeight = 1080;
        this.quality = 0.8;
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.thumbnailSize = 150;
    }

    // Compress and resize image
    async optimizeImage(file, options = {}) {
        const {
            maxWidth = this.maxWidth,
            maxHeight = this.maxHeight,
            quality = this.quality,
            outputFormat = 'image/jpeg'
        } = options;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const img = new Image();
                
                img.onload = () => {
                    // Calculate new dimensions
                    const { width, height } = this.calculateDimensions(
                        img.width, 
                        img.height, 
                        maxWidth, 
                        maxHeight
                    );

                    // Create canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = width;
                    canvas.height = height;

                    // Enable image smoothing for better quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';

                    // Draw and compress
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve({
                                    blob,
                                    dataUrl: canvas.toDataURL(outputFormat, quality),
                                    originalSize: file.size,
                                    optimizedSize: blob.size,
                                    compressionRatio: Math.round((1 - blob.size / file.size) * 100),
                                    dimensions: { width, height },
                                    originalDimensions: { width: img.width, height: img.height }
                                });
                            } else {
                                reject(new Error('Failed to compress image'));
                            }
                        },
                        outputFormat,
                        quality
                    );
                };
                
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = event.target.result;
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Generate thumbnail
    async generateThumbnail(file, size = this.thumbnailSize) {
        return this.optimizeImage(file, {
            maxWidth: size,
            maxHeight: size,
            quality: 0.7,
            outputFormat: 'image/jpeg'
        });
    }

    // Calculate optimal dimensions while maintaining aspect ratio
    calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
        let width = originalWidth;
        let height = originalHeight;

        // Only resize if image is larger than max dimensions
        if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;

            if (width > height) {
                width = maxWidth;
                height = width / aspectRatio;
            } else {
                height = maxHeight;
                width = height * aspectRatio;
            }

            // Ensure dimensions don't exceed limits
            if (width > maxWidth) {
                width = maxWidth;
                height = width / aspectRatio;
            }
            if (height > maxHeight) {
                height = maxHeight;
                width = height * aspectRatio;
            }
        }

        return {
            width: Math.round(width),
            height: Math.round(height)
        };
    }

    // Validate file before processing
    validateFile(file) {
        const errors = [];

        // Check file type
        if (!file.type.startsWith('image/')) {
            errors.push('File must be an image');
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            errors.push(`File size must be less than ${this.formatFileSize(this.maxFileSize)}`);
        }

        // Check for supported formats
        const supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!supportedFormats.includes(file.type)) {
            errors.push('Unsupported image format. Please use JPEG, PNG, WebP, or GIF');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Format file size for display
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Convert blob to base64
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Lazy load images with intersection observer
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const src = img.dataset.src;
                        const srcset = img.dataset.srcset;

                        if (src) {
                            img.src = src;
                            img.removeAttribute('data-src');
                        }

                        if (srcset) {
                            img.srcset = srcset;
                            img.removeAttribute('data-srcset');
                        }

                        img.classList.remove('lazy');
                        observer.unobserve(img);

                        // Trigger fade-in effect
                        img.addEventListener('load', () => {
                            img.style.opacity = '1';
                        });
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });

            return imageObserver;
        }
    }

    // Create optimized image preview with metadata
    createImagePreview(optimizedResult, container) {
        const preview = document.createElement('div');
        preview.className = 'image-preview';
        preview.innerHTML = `
            <div class="image-container">
                <img src="${optimizedResult.dataUrl}" alt="Optimized image" style="max-width: 100%; height: auto; border-radius: 4px;">
                <div class="image-overlay">
                    <button class="btn btn-sm btn-outline" onclick="this.parentElement.parentElement.parentElement.remove()">Remove</button>
                </div>
            </div>
            <div class="image-metadata">
                <div class="metadata-row">
                    <span>Size:</span>
                    <span>${this.formatFileSize(optimizedResult.optimizedSize)} 
                    ${optimizedResult.compressionRatio > 0 ? `(${optimizedResult.compressionRatio}% smaller)` : ''}</span>
                </div>
                <div class="metadata-row">
                    <span>Dimensions:</span>
                    <span>${optimizedResult.dimensions.width} × ${optimizedResult.dimensions.height}px</span>
                </div>
            </div>
        `;

        // Add CSS if not already present
        if (!document.querySelector('#image-preview-styles')) {
            const style = document.createElement('style');
            style.id = 'image-preview-styles';
            style.textContent = `
                .image-preview {
                    margin: 1rem 0;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .image-container {
                    position: relative;
                }
                .image-overlay {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .image-container:hover .image-overlay {
                    opacity: 1;
                }
                .image-metadata {
                    padding: 0.75rem;
                    background: var(--surface);
                    font-size: 0.875rem;
                }
                .metadata-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.25rem;
                }
                .metadata-row:last-child {
                    margin-bottom: 0;
                }
            `;
            document.head.appendChild(style);
        }

        if (container) {
            container.appendChild(preview);
        }

        return preview;
    }

    // Process multiple files
    async processFiles(files, options = {}) {
        const results = [];
        
        for (const file of files) {
            try {
                // Validate file
                const validation = this.validateFile(file);
                if (!validation.isValid) {
                    results.push({
                        file,
                        error: validation.errors.join(', '),
                        success: false
                    });
                    continue;
                }

                // Optimize image
                const optimized = await this.optimizeImage(file, options);
                results.push({
                    file,
                    optimized,
                    success: true
                });

            } catch (error) {
                results.push({
                    file,
                    error: error.message,
                    success: false
                });
            }
        }

        return results;
    }

    // Convert canvas to WebP if supported
    supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').startsWith('data:image/webp');
    }

    // Get optimal format based on browser support
    getOptimalFormat() {
        if (this.supportsWebP()) {
            return 'image/webp';
        }
        return 'image/jpeg';
    }
}

// Global image optimizer instance
const imageOptimizer = new ImageOptimizer();