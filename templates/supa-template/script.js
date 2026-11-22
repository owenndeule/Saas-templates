/* ============================================
   DYNAMIC SUPER TEMPLATE ENGINE
   ============================================ */

// Global variables for lightbox
let currentGalleryImages = [];
let currentGalleryItems = [];
let currentImageIndex = 0;
let lightbox, lightboxImage, lightboxPrev, lightboxNext;
let currentActiveCategory = '';
let currentActiveItem = null;
let globalConfig;
let bookingModal;
let bookingModalCloseBtn;
let lastFocusedElement = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize Lightbox Elements
    lightbox = document.getElementById('lightbox');
    lightboxImage = document.getElementById('lightboxImage');
    lightboxPrev = document.querySelector('.lightbox-prev');
    lightboxNext = document.querySelector('.lightbox-next');

    // Header scroll state must work even when config.json fails to load.
    initializeScrollEffects();

    try {
        const response = await fetch('./config.json');
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.status}`);
        }
        const config = await response.json();
        globalConfig = config;
        
        applyConfig(config);
        initializeMenu(config);
        renderNewArrivals(config);
        initializeMobileMenu();
        initializeForms(config);
        setCurrentYear();
        renderGallery(config);
        renderFooter(config);
        initializeBookingModal(config);
        renderTestimonials(config);
        injectSEOAndAnalytics(config);
        setupLightboxListeners();
    } catch (error) {
        console.error('Error loading config:', error);
        showConfigError(error);
    }
});

function showConfigError(error) {
    const hero = document.getElementById('home');
    if (hero) {
        hero.innerHTML = `
            <div class="hero-content" style="text-align: center; padding: 2rem;">
                <h2>Configuration Error</h2>
                <p style="color: #dc3545; font-weight: bold; font-size: 1.1rem;">Failed to load config.json. Please ensure you're running a local server.</p>
                <pre style="text-align: left; background: #f5f5f5; padding: 1rem; overflow: auto;">${error.message}</pre>
            </div>
        `;
    }
}

function applyConfig(config) {
    // Update UI elements from config
    document.title = `${config.businessName} | ${config.tagline}`;

    // Get text overrides for the current business type, with a fallback to 'other' or empty object
    const textOverrides = config.textOverrides?.[config.businessType] || config.textOverrides?.other || {};

    // SEO Meta Tags helper
    const updateMeta = (selector, attr, value, content) => {
        if (!content) return;
        let element = document.querySelector(selector);
        if (!element) {
            element = document.createElement('meta');
            element.setAttribute(attr, value);
            document.head.appendChild(element);
        }
        element.setAttribute('content', content);
    };

    updateMeta('meta[name="description"]', 'name', 'description', config.seoDescription);
    updateMeta('meta[name="keywords"]', 'name', 'keywords', textOverrides.keywords || config.keywords);
    updateMeta('meta[property="og:title"]', 'property', 'og:title', config.ogTitle || config.businessName);
    updateMeta('meta[property="og:description"]', 'property', 'og:description', config.ogDescription || config.seoDescription);
    updateMeta('meta[property="og:image"]', 'property', 'og:image', config.ogImage || config.heroImage);

    document.querySelectorAll('.business-name').forEach(el => el.textContent = config.businessName);
    document.querySelectorAll('.tagline').forEach(el => el.textContent = config.tagline);
    
    // Dynamically update hero tagline
    const heroTagline = document.getElementById('heroTagline');
    if (heroTagline) heroTagline.textContent = config.tagline;

    // Hero image
    const hero = document.getElementById('home');
    if (hero && config.heroImage) {
        hero.style.backgroundImage = `url('${config.heroImage}')`;
        document.documentElement.style.setProperty('--hero-background-image', `url('${config.heroImage}')`);
    }

    // Dynamically update hero CTA button text
    const heroCtaButton = document.getElementById('heroCtaButton');
    if (heroCtaButton && textOverrides.heroCtaButtonText) {
        heroCtaButton.textContent = textOverrides.heroCtaButtonText;
    }

    // Determine if hero CTA should open modal or go to WhatsApp
    const typesWithModal = ['restaurant', 'salon', 'spa', 'fitness', 'health', 'car wash', 'pet care', 'home services', 'professional services'];
    const heroCtaShouldOpenModal = typesWithModal.includes(config.businessType);

    if (heroCtaButton) {
        if (config.businessType === 'car dealership') {
            heroCtaButton.classList.remove('whatsapp-cta');
            heroCtaButton.href = '#menu';
        } else if (heroCtaShouldOpenModal) {
            heroCtaButton.classList.remove('whatsapp-cta');
            heroCtaButton.href = '#';
            heroCtaButton.addEventListener('click', (e) => {
                e.preventDefault();
                openBookingModal();
            });
        } else {
            heroCtaButton.classList.add('whatsapp-cta');
        }
    }

    // Dynamically update menu section subtitle
    const menuSectionSubtitle = document.getElementById('menuSectionSubtitle');
    if (menuSectionSubtitle && textOverrides.menuSectionSubtitle) {
        menuSectionSubtitle.textContent = textOverrides.menuSectionSubtitle;
    }

    // WhatsApp Link
    const waLink = `https://wa.me/${config.whatsappNumber}`;
    document.querySelectorAll('.whatsapp-cta').forEach(el => el.href = waLink);

    // Contact Info
    const phoneSpan = document.getElementById('contactPhone');
    const emailSpan = document.getElementById('contactEmail');
    const addressEl = document.getElementById('contactAddress');

    if (phoneSpan) {
        phoneSpan.textContent = config.phoneNumber;
        const phoneLink = document.getElementById('contactPhoneLink');
        if (phoneLink) phoneLink.href = `tel:${config.phoneNumber.replace(/[^\d+]/g, '')}`;
    }
    
    if (emailSpan) {
        emailSpan.textContent = config.email;
        const emailLink = document.getElementById('contactEmailLink');
        if (emailLink) emailLink.href = `mailto:${config.email}`;
    }

    if (addressEl) addressEl.innerHTML = config.address;

    // Copy Address Functionality
    const copyBtn = document.getElementById('copyAddressBtn');
    if (copyBtn && addressEl) {
        copyBtn.addEventListener('click', () => {
            const text = addressEl.innerText;
            navigator.clipboard.writeText(text).then(() => {
                const original = copyBtn.innerHTML;
                copyBtn.innerHTML = '<span style="font-size: 0.7rem; font-family: var(--font-sans);">Copied!</span>';
                setTimeout(() => copyBtn.innerHTML = original, 2000);
            }).catch(() => {
                // Fallback for clipboard API not available
                copyBtn.textContent = 'Failed to copy';
                setTimeout(() => copyBtn.innerHTML = original, 2000);
            });
        });
    }

    // Opening Hours
    renderOpeningHours(config.openingHours);

    // Map Integration
    const mapFrame = document.getElementById('mapFrame');
    if (mapFrame && config.mapUrl) mapFrame.src = config.mapUrl;

    // Theme Color
    document.documentElement.style.setProperty('--accent-color', config.primaryColor);

    // Business Type specific UI
    const bookingTitle = document.getElementById('bookingTitle');
    if (bookingTitle && textOverrides.bookingTitle) {
        bookingTitle.textContent = textOverrides.bookingTitle;
    }

    // Dynamically update booking CTA button text
    const bookingCtaButton = document.getElementById('bookingCtaButton');
    if (bookingCtaButton && textOverrides.bookingCtaButtonText) {
        bookingCtaButton.textContent = textOverrides.bookingCtaButtonText;
    }

    // Dynamically update contact block title and description
    const contactBlockTitle = document.getElementById('contactBlockTitle');
    if (contactBlockTitle && textOverrides.contactBlockTitle) {
        contactBlockTitle.textContent = textOverrides.contactBlockTitle;
    }
    const contactBlockDescription = document.getElementById('contactBlockDescription');
    if (contactBlockDescription && textOverrides.contactBlockDescription) {
        contactBlockDescription.innerHTML = textOverrides.contactBlockDescription + ' <a href="#" class="whatsapp-cta">Inquire on WhatsApp</a>.';
    }

    // Dynamically update hours note
    const hoursNote = document.getElementById('hoursNote');
    if (hoursNote && textOverrides.hoursNote) {
        hoursNote.textContent = textOverrides.hoursNote;
    }

    // Favicon and Touch Icons
    if (config.favicon) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = config.favicon;
    }

    if (config.appleTouchIcon) {
        let link = document.querySelector("link[rel~='apple-touch-icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'apple-touch-icon';
            document.head.appendChild(link);
        }
        link.href = config.appleTouchIcon;
    }

    // Update nav links text based on business type
    updateNavLinks(config.businessType, textOverrides);
}

function updateNavLinks(businessType, textOverrides) {
    const menuLabel = textOverrides.menuSectionTitle || 'Menu';
    const bookingLabel = textOverrides.bookingTitle || 'Book';
    
    const navElements = [
        document.getElementById('navMenuLink'),
        document.getElementById('mobileNavMenuLink'),
        document.getElementById('footerMenuLink')
    ].filter(Boolean);
    
    navElements.forEach(el => { el.textContent = menuLabel; });
    
    const bookingElements = [
        document.getElementById('navBookingLink'),
        document.getElementById('mobileNavBookingLink'),
        document.getElementById('footerBookingLink')
    ].filter(Boolean);
    
    bookingElements.forEach(el => { el.textContent = bookingLabel; });
}

const openBookingModal = () => {
    if (!bookingModal) return;
    lastFocusedElement = document.activeElement;
    bookingModal.hidden = false;
    bookingModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    window.history.pushState({ bookingModalOpen: true }, '');
    
    // Focus management
    setTimeout(() => {
        const closeBtn = document.getElementById('closeBookingModal');
        if (closeBtn) closeBtn.focus();
    }, 100);
};

const closeBookingModal = (isPopState = false) => {
    if (!bookingModal) return;
    if (!bookingModal.classList.contains('active')) return;

    bookingModal.classList.remove('active');
    document.body.style.overflow = '';
    
    setTimeout(() => {
        bookingModal.hidden = true;
    }, 300);
    
    if (!isPopState && window.history.state?.bookingModalOpen) {
        window.history.back();
    }
    
    // Return focus to trigger element
    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
};

function initializeBookingModal(config) {
    bookingModal = document.getElementById('bookingModal');
    bookingModalCloseBtn = document.getElementById('closeBookingModal');
    const partySizeGroup = document.getElementById('partySizeGroup');
    if (!bookingModal) return;

    const typesWithModal = ['restaurant', 'salon', 'spa', 'fitness', 'health', 'car wash', 'pet care', 'home services', 'service', 'car dealership'];
    const useModal = typesWithModal.includes(config.businessType);

    // Hide restaurant-specific fields for non-restaurant businesses
    if (partySizeGroup) {
        partySizeGroup.hidden = config.businessType !== 'restaurant';
    }

    // Trigger on anything that looks like a "Book" button
    document.querySelectorAll('a, button').forEach(el => {
        const text = el.textContent.toLowerCase();
        const isBookLink = el.getAttribute('href') === '#reservations';

        // WhatsApp CTAs should keep their chat destination, even when their
        // visible label contains "Book".
        if (el.classList.contains('whatsapp-cta')) return;
        
        if (text.includes('book') || isBookLink) {
            if (useModal) {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    openBookingModal();
                });
            } else {
                el.classList.add('whatsapp-cta');
            }
        }
    });

    // Some WhatsApp CTAs are inserted while applying text overrides, after
    // the first link pass. Assign their destination after all markup exists.
    const whatsappUrl = `https://wa.me/${String(config.whatsappNumber || '').replace(/\D/g, '')}`;
    document.querySelectorAll('.whatsapp-cta').forEach(link => {
        link.href = whatsappUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
    });

    if (bookingModalCloseBtn) bookingModalCloseBtn.addEventListener('click', () => closeBookingModal());
    
    bookingModal.addEventListener('click', (e) => {
        if (e.target === bookingModal) closeBookingModal();
    });

    window.addEventListener('popstate', (e) => {
        if (bookingModal.classList.contains('active')) {
            closeBookingModal(true);
        }
    });

    // Trap focus in modal
    bookingModal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && bookingModal.classList.contains('active')) {
            trapFocus(e, bookingModal);
        }
        if (e.key === 'Escape') {
            closeBookingModal();
        }
    });
}

function trapFocus(e, container) {
    const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
    }
}

function getSocialIconSvg(platform) {
    const icons = {
        facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
        instagram: '<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.07 1.645.07 4.85s-.012 3.584-.07 4.85c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.252-.149-4.771-1.691-4.919-4.919-.058-1.265-.07-1.644-.07-4.85s.012-3.584.07-4.85c.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.07 4.85-.07zm0-2.163c-3.259 0-3.667.014-4.947.072C2.79 0.273 1.4 1.676 1.232 4.26c-.063 1.28-.076 1.683-.076 4.947s.013 3.667.076 4.947c.173 2.583 1.567 3.975 4.15 4.148 1.28.063 1.683.076 4.947.076s3.667-.013 4.947-.076c2.583-.173 3.975-1.567 4.148-4.15.063-1.28.076-1.683.076-4.947s-.013-3.667-.076-4.947c-.173-2.583-1.567-3.975-4.15-4.148-1.28-.063-1.683-.076-4.947-.076zm0 6.556c-3.313 0-6 2.687-6 6s2.687 6 6 6 6-2.687 6-6-2.687-6-6-6zm0 10c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zm6.406-11.845c-.796 0-1.443.647-1.443 1.443s.647 1.443 1.443 1.443 1.443-.647 1.443-1.443-.647-1.443-1.443-1.443z"/>',
        twitter: '<path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c11 3 21-10 21-17.5V3h-.01z"/>',
        x: '<path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c11 3 21-10 21-17.5V3h-.01z"/>',
        linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
        youtube: '<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>',
        tiktok: '<path d="M12.52 0h-1.24v3.92h-3.867v1.32h3.867v3.372h1.239v-3.372h3.92v-1.32h-3.92V0zm-.532 20.877c-.951 1.326-2.478 2.178-4.17 2.178-1.737 0-3.312-.951-3.92-2.103-1.212 1.326-2.739 2.253-4.41 2.253-2.436 0-4.41-1.698-4.41-3.867s1.974-3.867 4.41-3.867c1.677 0 3.198.951 4.41 2.178.078.156.156.234.234.312v3.444h1.161v-4.077h1.239v4.077h1.239v-1.32h-1.239v-3.444c.624-.858 1.794-1.716 3.276-1.716 2.178 0 3.744 1.56 3.744 3.666s-1.56 3.666-3.744 3.666c-.936 0-1.872-.39-2.484-1.014v1.014h-1.24v4.077h1.32zm-1.24-1.32c-.702 0-1.32-.468-1.32-1.014s.618-1.014 1.32-1.014 1.32.468 1.32 1.014-.618 1.014-1.32 1.014z"/>',
        github: '<path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.605-3.369-1.342-3.369-1.342-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.95 0-1.093.39-1.987 1.029-2.688-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.026.796-.223 1.653-.335 2.514-.338.86.003 1.717.112 2.514.338 1.909-1.295 2.748-1.026 2.748-1.026.546 1.377.202 2.394.1 2.647.64.7 1.028 1.595 1.028 2.688 0 3.842-2.339 4.687-4.566 4.942.359.309.678.92.678 1.853 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.482A10.007 10.007 0 0 0 22 12c0-5.523-4.477-10-10-10z"/>',
        whatsapp: '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>',
        pinterest: '<path d="M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.828-2.245 3.828-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>',
        snapchat: '<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.991 8.438c-.024.021-.048.046-.069.069l-4.02 4.02c-.065.066-.152.1-.24.1-.089 0-.173-.034-.239-.1l-3.03-3.03c-.127-.127-.127-.332 0-.458s.332-.127.458 0l2.32 2.32 3.437-3.437c.127-.127.332-.127.458 0s.127.332 0 .458l-3.76 3.76c-.066.066-.1.152-.1.24 0 .089.034.173.1.239l4.375 4.375c.021.024.046.048.069.069.12.12.314.12.434 0l6.096-6.096c.12-.12.12-.314 0-.434zm-.069-.069l-6.096 6.096c-.12.12-.314.12-.434 0l-4.375-4.375c-.024-.021-.048-.046-.069-.069-.089 0-.173-.034-.239-.1-.066-.066-.1-.152-.1-.24 0-.066.089-.034.173.1.239l3.76-3.76c.127-.127.332-.127.458 0s.127.332 0 .458l-3.437 3.437-2.32-2.32c-.127-.127-.332-.127-.458 0s-.127.332 0 .458l3.03 3.03c.066.066.1.152.1.24 0 .089-.034.173-.1.239l-4.02 4.02c-.021.024-.046.048-.069.069-.12.12-.314.12-.434 0L.48 17.434c-.12-.12-.12-.314 0-.434L17.921.979c.12-.12.314-.12.434 0z"/>',
        threads: '<path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13c0-.552-.448-1-1-1H7c-.552 0-1 .448-1 1v10c0 .552.448 1 1 1h4c.552 0 1-.448 1-1v-4h4c.552 0 1-.448 1-1v-2c0-.552-.448-1-1-1h-4V7c0-.552-.448-1-1-1z"/>'
    };
    return icons[platform] || '<path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3h2v6h-2V7zm0 7h2v2h-2v-2z"/>'; // Generic info icon
}

function renderFooter(config) {
    // Footer About Text
    const footerAboutTextEl = document.getElementById('footerAboutText');
    if (footerAboutTextEl && config.footerAboutText) {
        footerAboutTextEl.textContent = config.footerAboutText;
    }

    // Footer Contact Info
    const footerAddressEl = document.getElementById('footerAddress');
    if (footerAddressEl) footerAddressEl.textContent = config.address;

    const footerPhoneSpan = document.getElementById('footerPhone');
    if (footerPhoneSpan) {
        footerPhoneSpan.textContent = config.phoneNumber;
        const footerPhoneLink = document.getElementById('footerPhoneLink');
        if (footerPhoneLink) footerPhoneLink.href = `tel:${config.phoneNumber.replace(/[^\d+]/g, '')}`;
    }

    const footerEmailSpan = document.getElementById('footerEmail');
    if (footerEmailSpan) {
        footerEmailSpan.textContent = config.email;
        const footerEmailLink = document.getElementById('footerEmailLink');
        if (footerEmailLink) footerEmailLink.href = `mailto:${config.email}`;
    }

    // Footer Social Links
    const footerSocialLinksContainer = document.getElementById('footerSocialLinks');
    if (footerSocialLinksContainer && config.socialLinks) {
        footerSocialLinksContainer.innerHTML = '';
        for (const platform in config.socialLinks) {
            const profileUrl = config.socialLinks[platform]?.trim();
            if (profileUrl) {
                const link = document.createElement('a');
                link.href = /^https?:\/\//i.test(profileUrl)
                    ? profileUrl
                    : `https://${profileUrl.replace(/^\/+/, '')}`;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
                link.setAttribute('aria-label', platformName);
                link.title = `Visit our ${platformName} page`;
                link.innerHTML = `<svg class="social-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">${getSocialIconSvg(platform)}</svg>`;
                footerSocialLinksContainer.appendChild(link);
            }
        }
    }
}

function renderNewArrivals(config) {
    const grid = document.getElementById('newArrivalsGrid');
    const section = document.getElementById('new-arrivals');
    if (!grid || !section || !config.menuData) return;

    // Find all items with "New Arrival" badge across all categories
    let allNewArrivals = [];
    Object.values(config.menuData).forEach(category => {
        category.forEach(item => {
            if (item.badge === "New Arrival") {
                allNewArrivals.push(item);
            }
        });
    });

    if (allNewArrivals.length === 0) {
        section.hidden = true;
        return;
    }

    const LIMIT = 3;
    const itemsToDisplay = allNewArrivals.slice(0, LIMIT);

    section.hidden = false;
    grid.innerHTML = itemsToDisplay.map(item => `
        <div class="menu-card" role="listitem">
            <span class="menu-card-badge badge-new-arrival">New Arrival</span>
            <img src="${item.images ? item.images[0] : item.image}" alt="${item.name}" class="menu-card-image" loading="lazy">
            <div class="menu-card-content">
                <h3 class="menu-card-title">${item.name}</h3>
                <p class="menu-card-description">${item.description}</p>
                <div class="menu-card-price">${config.currencySymbol || ''}${item.price}</div>
                <button class="cta-button view-details-cta" aria-label="View details for ${item.name}">View Details</button>
            </div>
        </div>
    `).join('');

    // Setup click listeners
    grid.querySelectorAll('.menu-card').forEach((card, idx) => {
        const triggerOpen = () => {
            const item = itemsToDisplay[idx];
            currentGalleryImages = item.images || [item.image];
            currentActiveItem = item;
            openLightbox(currentGalleryImages[0], 0);
        };
        card.querySelector('.menu-card-image').addEventListener('click', triggerOpen);
        card.querySelector('.view-details-cta').addEventListener('click', triggerOpen);
    });
}

function initializeMenu(config) {
    const menuTabs = document.getElementById('menuTabs');
    const menuGrid = document.getElementById('menuGrid');
    if (!menuGrid) return;

    // Get text overrides for the current business type, with a fallback to 'other' or empty object
    const textOverrides = config.textOverrides?.[config.businessType] || config.textOverrides?.other || {};

    // Dynamically update menu section title
    const menuSectionTitle = document.getElementById('menuSectionTitle');
    if (menuSectionTitle && textOverrides.menuSectionTitle) {
        menuSectionTitle.textContent = textOverrides.menuSectionTitle;
    }

    const typesWithTabs = ['restaurant', 'car dealership'];
    if (typesWithTabs.includes(config.businessType)) {
        const categories = Object.keys(config.menuData);
        currentActiveCategory = categories[0];
        if (menuTabs) menuTabs.hidden = false;
        renderMenuTabs(config, categories);
        renderItems(config.menuData[currentActiveCategory], config);
    } else {
        // Service business: Hide tabs, render services directly
        if (menuTabs) menuTabs.hidden = true;
        // Flatten menuData for service businesses
        const allServices = Object.values(config.menuData).flat();
        renderItems(allServices, config);
    }
}

function renderMenuTabs(config, categories, showAll = false) {
    const menuTabs = document.getElementById('menuTabs');
    if (!menuTabs) return;

    const isMobile = window.innerWidth < 768;
    const LIMIT = 2;
    
    menuTabs.classList.toggle('is-expanded', showAll && isMobile);

    const catsToDisplay = (isMobile && !showAll) ? categories.slice(0, LIMIT) : categories;

    menuTabs.innerHTML = catsToDisplay.map(cat => `
        <button class="menu-tab ${cat === currentActiveCategory ? 'active' : ''}" data-category="${cat}" role="tab" aria-selected="${cat === currentActiveCategory}" aria-controls="menuGrid">
            ${cat.charAt(0).toUpperCase() + cat.slice(1)}
        </button>
    `).join('') + (isMobile && categories.length > LIMIT ? `
        <button class="menu-tab toggle-tabs-btn" style="background: var(--accent-color); color: white; border: none; font-weight: bold; flex: 0 0 auto;">
            ${showAll ? 'Less' : 'More+'}
        </button>
    ` : '');

    // Re-bind category click listeners
    menuTabs.querySelectorAll('.menu-tab[data-category]').forEach(tab => {
        tab.addEventListener('click', function() {
            currentActiveCategory = this.dataset.category;
            menuTabs.querySelectorAll('.menu-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');
            renderItems(config.menuData[currentActiveCategory], config);
        });
    });

    // Re-bind toggle button listener
    const toggleBtn = menuTabs.querySelector('.toggle-tabs-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            renderMenuTabs(config, categories, !showAll);
        });
    }
}

function renderItems(items, config, showAll = false) {
    const menuGrid = document.getElementById('menuGrid');
    const menuFooter = document.getElementById('menuFooter');
    const seeMoreBtn = document.getElementById('seeMoreMenu');
    if (!menuGrid || !menuFooter || !seeMoreBtn) return;

    const isMobile = window.innerWidth < 768;
    const LIMIT = 3;
    const itemsToDisplay = (isMobile && !showAll) ? items.slice(0, LIMIT) : items;

    if (itemsToDisplay.length === 0) {
        menuGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-light);">
            <p>No items found.</p>
        </div>`;
    } else {
        menuGrid.innerHTML = itemsToDisplay.map(item => `
            <div class="menu-card" role="listitem">
                ${item.badge ? `<span class="menu-card-badge badge-${item.badge.toLowerCase().replace(/\s+/g, '-')}">${item.badge}</span>` : ''}
                <img src="${item.images ? item.images[0] : item.image}" alt="${item.name}" class="menu-card-image" loading="lazy">
                <div class="menu-card-content">
                    <h3 class="menu-card-title">${item.name}</h3>
                    <p class="menu-card-description">${item.description}</p>
                    <div class="menu-card-price">${config.currencySymbol || ''}${item.price}</div>
                    <button class="cta-button view-details-cta" aria-label="View details for ${item.name}">View Details</button>
                </div>
            </div>
        `).join('');

        // Setup click listeners for both image and "View Details" button
        const cards = menuGrid.querySelectorAll('.menu-card');
        cards.forEach((card, idx) => {
            const triggerOpen = () => {
                const item = itemsToDisplay[idx];
                currentGalleryImages = item.images || [item.image];
                currentActiveItem = item;
                openLightbox(currentGalleryImages[0], 0);
            };
            
            card.querySelector('.menu-card-image').addEventListener('click', triggerOpen);
            card.querySelector('.view-details-cta').addEventListener('click', triggerOpen);
        });
    }

    if (isMobile && items.length > LIMIT) {
        menuFooter.hidden = false;
        if (showAll) {
            seeMoreBtn.textContent = 'See Less';
            seeMoreBtn.onclick = () => {
                renderItems(items, config, false);
                document.getElementById('menuTabs')?.scrollIntoView({ behavior: 'smooth' });
            };
        } else {
            seeMoreBtn.textContent = 'See More';
            seeMoreBtn.onclick = () => renderItems(items, config, true);
        }
    } else {
        menuFooter.hidden = true;
    }

    addScrollAnimations();
}

function renderTestimonials(config) {
    const grid = document.getElementById('testimonialsGrid');
    if (!grid || !config.testimonials) return;

    grid.innerHTML = config.testimonials.map(t => `
        <div class="testimonial-card" role="listitem">
            <div class="stars" aria-label="${t.stars} out of 5 stars">${'★'.repeat(t.stars)}${'☆'.repeat(5-t.stars)}</div>
            <p class="comment">"${t.comment}"</p>
            <h4 class="name">- ${t.name}</h4>
        </div>
    `).join('');
}

function injectSEOAndAnalytics(config) {
    // 1. JSON-LD Schema for Local SEO
    const schema = {
        "@context": "https://schema.org",
        "@type": config.businessType === 'restaurant' ? "Restaurant" : "LocalBusiness",
        "name": config.businessName,
        "description": config.seoDescription,
        "address": {
            "@type": "PostalAddress",
            "streetAddress": config.address
        },
        "telephone": config.phoneNumber,
        "url": window.location.href,
        "image": config.heroImage
    };
    const schemaScript = document.getElementById('seoSchema');
    if (schemaScript) schemaScript.textContent = JSON.stringify(schema);

    // 2. Google Analytics Injection
    if (config.analyticsId) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${config.analyticsId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', config.analyticsId);
    }
}

function renderOpeningHours(hours) {
    const list = document.getElementById('openingHoursList');
    const badge = document.getElementById('statusBadge');
    const hoursNote = document.getElementById('hoursNote');
    if (!list || !hours || !badge) return;

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const currentDayName = days[now.getDay()];
    const todayHours = hours[currentDayName];

    // 1. Render the list
    list.innerHTML = Object.entries(hours).map(([day, time]) => {
        const isToday = day.toLowerCase() === currentDayName.toLowerCase();
        return `<li class="${isToday ? 'today' : ''}">
            <span>${day}</span>
            <span>${time}</span>
        </li>`;
    }).join('');

    // 2. Determine Open/Closed Status
    if (!todayHours || todayHours.toLowerCase() === 'closed') {
        badge.textContent = 'Closed';
        badge.className = 'status-badge status-closed';
        if (hoursNote) hoursNote.classList.add('status-closed-text');
        return;
    }

    const parseTime = (timeStr) => {
        const [time, modifier] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    };

    try {
        const [openStr, closeStr] = todayHours.split(' - ');
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = parseTime(openStr);
        const closeMinutes = parseTime(closeStr);

        if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
            badge.textContent = 'Open Now';
            badge.className = 'status-badge status-open';
            if (hoursNote) hoursNote.classList.remove('status-closed-text');
        } else {
            badge.textContent = 'Closed';
            badge.className = 'status-badge status-closed';
            if (hoursNote) hoursNote.classList.add('status-closed-text');
        }
    } catch (e) {
        badge.style.display = 'none';
    }
}

function renderGallery(config, showAll = false) {
    const galleryGrid = document.getElementById('galleryGrid');
    const galleryFooter = document.getElementById('galleryFooter');
    const seeMoreBtn = document.getElementById('seeMoreGallery');
    if (!galleryGrid || !config.gallery || !galleryFooter) return;
    
    const INITIAL_LIMIT = 3;
    const imagesToDisplay = showAll ? config.gallery : config.gallery.slice(0, INITIAL_LIMIT);

    galleryGrid.innerHTML = imagesToDisplay.map((item, index) => {
        const isObject = typeof item === 'object' && item !== null;
        const imgUrl = isObject ? (item.images ? item.images[0] : item.image) : item;
        const name = isObject ? item.name : '';
        const hasMultiple = isObject && item.images && item.images.length > 1;

        return `
        <div class="gallery-card" role="listitem">
            <div class="gallery-item">
                <img src="${imgUrl}" alt="${name || 'Gallery image'}" loading="lazy" data-original-index="${index}" data-card-image-index="0">
                ${hasMultiple ? `
                    <button class="gallery-nav-btn gallery-prev" data-index="${index}" aria-label="Previous image for ${name}">&#10094;</button>
                    <button class="gallery-nav-btn gallery-next" data-index="${index}" aria-label="Next image for ${name}">&#10095;</button>
                ` : ''}
            </div>
            ${name ? `
                <div class="gallery-item-info">
                    <span class="gallery-item-name">${name}</span>
                </div>
            ` : ''}
        </div>
        `;
    }).join('');

    if (config.gallery.length > INITIAL_LIMIT) {
        galleryFooter.hidden = false;
        if (showAll) {
            seeMoreBtn.textContent = 'See Less';
            seeMoreBtn.onclick = () => {
                renderGallery(config, false);
                document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
            };
        } else {
            seeMoreBtn.textContent = 'See More';
            seeMoreBtn.onclick = () => renderGallery(config, true);
        }
    } else {
        galleryFooter.hidden = true;
    }
    addScrollAnimations();

    // Add navigation listeners for cards with multiple images
    galleryGrid.querySelectorAll('.gallery-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            const item = config.gallery[idx];
            const img = btn.parentElement.querySelector('img');
            const isNext = btn.classList.contains('gallery-next');
            
            let currentCardIdx = parseInt(img.dataset.cardImageIndex || 0);
            const totalImages = item.images.length;

            if (isNext) {
                currentCardIdx = (currentCardIdx + 1) % totalImages;
            } else {
                currentCardIdx = (currentCardIdx - 1 + totalImages) % totalImages;
            }

            img.src = item.images[currentCardIdx];
            img.dataset.cardImageIndex = currentCardIdx;
        });
    });

    // Add event listeners for lightbox
    document.querySelectorAll('.gallery-item img').forEach(imageElement => {
        imageElement.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.originalIndex);
            const item = config.gallery[idx];
            const cardImgIdx = parseInt(e.target.dataset.cardImageIndex || 0);
            
            const isObject = typeof item === 'object' && item !== null;
            currentActiveItem = isObject ? item : null;
            currentGalleryImages = currentActiveItem ? (item.images || [item.image]) : [e.target.src];
            
            openLightbox(currentGalleryImages[cardImgIdx], cardImgIdx);
        });
    });
}

function openLightbox(imageUrl, index) {
    if (!lightbox) return;
    lightboxImage.src = imageUrl;
    currentImageIndex = index;
    lightbox.hidden = false;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateLightboxEnquiryButton();

    // Focus management
    setTimeout(() => {
        const closeBtn = document.querySelector('.lightbox-close');
        if (closeBtn) closeBtn.focus();
    }, 100);

    // Smartphone Back Button Handling
    window.history.pushState({ lightboxOpen: true }, '');
}

function closeLightbox(isPopState = false) {
    if (!lightbox) return;
    if (!lightbox.classList.contains('active')) return;

    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    
    setTimeout(() => {
        lightbox.hidden = true;
    }, 300);

    if (!isPopState && window.history.state?.lightboxOpen) {
        window.history.back();
    }
}

function showNextImage() {
    if (!currentGalleryImages.length) return;
    currentImageIndex = (currentImageIndex + 1) % currentGalleryImages.length;
    lightboxImage.src = currentGalleryImages[currentImageIndex];
    updateLightboxEnquiryButton();
}

function showPrevImage() {
    if (!currentGalleryImages.length) return;
    currentImageIndex = (currentImageIndex - 1 + currentGalleryImages.length) % currentGalleryImages.length;
    lightboxImage.src = currentGalleryImages[currentImageIndex];
    updateLightboxEnquiryButton();
}

function updateLightboxEnquiryButton() {
    const btn = document.getElementById('lightboxEnquireBtn');
    const detailsPane = document.getElementById('lightboxDetails');
    const title = document.getElementById('lightboxTitle');
    const price = document.getElementById('lightboxPrice');
    const desc = document.getElementById('lightboxDesc');
    const specsPane = document.getElementById('lightboxSpecs');
    
    if (!detailsPane || !globalConfig) return;

    // Toggle navigation arrows visibility based on image count
    if (currentGalleryImages.length <= 1) {
        if (lightboxPrev) lightboxPrev.style.display = 'none';
        if (lightboxNext) lightboxNext.style.display = 'none';
    } else {
        if (lightboxPrev) lightboxPrev.style.display = 'flex';
        if (lightboxNext) lightboxNext.style.display = 'flex';
    }

    // Use the stored active item instead of the gallery index for details
    const item = currentActiveItem;
    if (item && item.name) {
        detailsPane.style.display = 'block';
        title.textContent = item.name;
        price.textContent = `${globalConfig.currencySymbol || ''}${item.price}`;
        desc.textContent = item.description;

        // Generate specs HTML
        let specsHtml = '';
        if (item.year) {
            specsHtml += `<div class="spec-item"><svg class="spec-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/></svg><span>${item.year}</span></div>`;
        }
        if (item.mileage) {
            specsHtml += `<div class="spec-item"><svg class="spec-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg><span>${item.mileage}</span></div>`;
        }
        if (item.fuelType) {
            specsHtml += `<div class="spec-item"><svg class="spec-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v7.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5z"/></svg><span>${item.fuelType}</span></div>`;
        }
        if (item.stock) {
            specsHtml += `<div class="spec-item stock-highlight"><svg class="spec-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.97 4.44c-.31.17-.69.17-1 0l-7.97-4.44c-.32-.17-.53-.5-.53-.88v-9c0-.38.21-.71.53-.88l7.97-4.44c.31-.17.69-.17 1 0l7.97 4.44c.32.17.53.5.53.88v9z"/></svg><span>${item.stock} Available</span></div>`;
        }
        
        if (specsPane) {
            specsPane.innerHTML = specsHtml;
            specsPane.style.display = specsHtml ? 'flex' : 'none';
        }

        const message = encodeURIComponent(
            `Hi, I'm interested in the ${item.name} priced at ${globalConfig.currencySymbol || ''}${item.price}. Is it still available?`
        );
        btn.href = `https://wa.me/${globalConfig.whatsappNumber}?text=${message}`;
        btn.textContent = `Enquire about ${item.name}`;
    } else {
        detailsPane.style.display = 'none';
    }
}

function setupLightboxListeners() {
    if (!lightbox) return;

    // Close button
    const closeBtn = document.querySelector('.lightbox-close');
    if (closeBtn) closeBtn.addEventListener('click', () => closeLightbox());

    // Navigation Arrows
    if (lightboxPrev) lightboxPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        showPrevImage();
    });
    if (lightboxNext) lightboxNext.addEventListener('click', (e) => {
        e.stopPropagation();
        showNextImage();
    });

    // Close on background click
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
            closeLightbox();
        }
    });

    // Smartphone System Back Button Support
    window.addEventListener('popstate', () => {
        closeLightbox(true);
    });

    // Keyboard navigation
    lightbox.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowRight') {
            showNextImage();
        } else if (e.key === 'ArrowLeft') {
            showPrevImage();
        } else if (e.key === 'Tab') {
            trapFocus(e, lightbox);
        }
    });

    // Swipe gesture navigation for mobile
    let touchStartX = 0;
    let touchStartY = 0;

    lightbox.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        lightboxImage.style.transition = 'none';
    }, { passive: true });

    lightbox.addEventListener('touchmove', e => {
        const touchX = e.touches[0].screenX;
        const dx = touchStartX - touchX;
        
        // Move the image with the finger for visual feedback
        lightboxImage.style.transform = `translateX(${-dx}px)`;
    }, { passive: true });

    lightbox.addEventListener('touchend', e => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        const dx = touchStartX - touchEndX;
        const dy = touchStartY - touchEndY;

        lightboxImage.style.transition = 'transform 0.3s ease';

        // Horizontal swipe for next/prev
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            dx > 0 ? showNextImage() : showPrevImage();
        }
        // Vertical swipe down to close
        else if (dy < -100) {
            closeLightbox();
        }

        // Snap back to center position
        lightboxImage.style.transform = 'translateX(0)';
        setTimeout(() => {
            if (lightboxImage) lightboxImage.style.transition = '';
        }, 300);
    }, { passive: true });
}

function initializeMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');
    if (!mobileMenuToggle || !mobileNav) return;

    const navLinks = mobileNav.querySelectorAll('.nav-link');

    // Toggle menu
    mobileMenuToggle.addEventListener('click', function() {
        const isExpanded = mobileMenuToggle.classList.toggle('active');
        mobileNav.classList.toggle('active');
        mobileMenuToggle.setAttribute('aria-expanded', isExpanded);
    });

    // Close menu when a link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            mobileMenuToggle.classList.remove('active');
            mobileNav.classList.remove('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.header')) {
            mobileMenuToggle.classList.remove('active');
            mobileNav.classList.remove('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Keyboard support for mobile menu toggle
    mobileMenuToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            mobileMenuToggle.click();
        }
    });
}

function initializeScrollEffects() {
    const scrollTopBtn = document.getElementById('scrollTop');
    const header = document.querySelector('.header');

    const updateHeader = () => {
        if (header) header.classList.toggle('scrolled', window.scrollY > 0);
    };
    updateHeader();
    
    window.addEventListener('scroll', () => {
        updateHeader();
        // Show/Hide Scroll to Top button
        if (window.scrollY > 500) {
            scrollTopBtn.hidden = false;
            scrollTopBtn.classList.add('show');
        } else {
            scrollTopBtn.classList.remove('show');
            setTimeout(() => { scrollTopBtn.hidden = true; }, 300);
        }
    });

    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
}

// Keyboard navigation for lightbox (global handler for when lightbox is open)
document.addEventListener('keydown', (e) => {
    if (lightbox && lightbox.classList.contains('active')) {
        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowRight') {
            showNextImage();
        } else if (e.key === 'ArrowLeft') {
            showPrevImage();
        }
    }
});

// ============================================
// FORM FUNCTIONALITY
// ============================================

function initializeForms(config) {
    const reservationForm = document.getElementById('reservationForm');
    const contactForm = document.getElementById('contactForm');

    if (reservationForm) {
        reservationForm.addEventListener('submit', (e) => handleBookingSubmit(e, config));
    }

    if (contactForm) {
        contactForm.addEventListener('submit', handleContactSubmit);
    }
}

function handleBookingSubmit(event, config) {
    event.preventDefault();

    const date = document.getElementById('reservationDate').value;
    const time = document.getElementById('reservationTime').value;
    const partySize = document.getElementById('partySize')?.value;

    // Get text overrides for the current business type, with a fallback to 'other' or empty object
    const textOverrides = config.textOverrides?.[config.businessType] || config.textOverrides?.other || {};
    const whatsappBookingMessage = textOverrides.whatsappBookingMessage || "a booking"; // Default fallback

    // WhatsApp-first booking logic
    let message = `Hello, I'd like to book ${whatsappBookingMessage} on ${date} at ${time}.`;
    if (config.businessType === 'restaurant' && partySize) {
        message += ` Party size: ${partySize}`;
    }

    const waUrl = `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(message)}`;
    
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    alert(`Booking intent sent via WhatsApp!`);

    // Reset form
    event.target.reset();
}

function handleContactSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('contactName').value;
    const email = document.getElementById('contactEmail').value;
    const message = document.getElementById('contactMessage').value;

    // [DEV] INTEGRATION POINT:
    // Use EmailJS, Formspree, or your own backend here.
    
    console.log('Contact form submitted:', { name, email, message });
    alert(`Thank you, ${name}! We've received your message.`);

    // Reset form
    event.target.reset();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function setCurrentYear() {
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

// ============================================
// SCROLL ANIMATIONS
// ============================================

// Single observer instance to be reused
const menuObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            menuObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

// Optional: Add scroll animations for menu items
function addScrollAnimations() {
    document.querySelectorAll('.menu-card, .gallery-item').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        menuObserver.observe(card);
    });
}
