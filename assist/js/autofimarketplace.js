// Supra AutoFi Marketplace - Community Module Sharing
// Fetches modules from the main repository

// GitHub Configuration - Using main dev tool repo
const GITHUB_CONFIG = {
    owner: 'Supra-Labs',
    repo: 'Supra-Automation-assist',
    branch: 'main',
    filePath: 'marketplace/modules.json'  // Keep marketplace files organized
};

// Construct GitHub raw content URL
const MODULES_JSON_URL = `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${GITHUB_CONFIG.filePath}`;

// Fallback modules (used if GitHub fetch fails)
const fallbackModules = [
    {
        name: "FALL BACK",
        description: "This is a fallback module used when GitHub fetch fails. We will try to fetch the latest modules again shortly.",
        category: "Fallback",
        address: "0x1",
        module: "fallbackModule",
        githubRepo: "https://github.com/Supra-Labs/Supra-Automation-assist/issues",
        contributor: "Jatin (Sr. DevRel)",
        verified: true
    }
];

// State management
let marketplaceModules = [];
let filteredModules = [];
let currentSearchTerm = '';
let currentCategory = 'all';
let isLoading = true;

// Initialize marketplace on page load
async function initMarketplace() {
    console.log('Initializing Supra AutoFi Marketplace...');
    
    // Show loading state
    showLoadingState();
    
    // Fetch modules from GitHub
    await fetchModulesFromGitHub();
    
    // Set up event listeners
    const searchInput = document.getElementById('marketplaceSearch');
    const categoryFilter = document.getElementById('categoryFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', handleCategoryFilter);
    }
    
    // Initial render
    isLoading = false;
    filteredModules = [...marketplaceModules];
    updateMarketplaceStats();
    renderMarketplace();
    
    console.log('Marketplace initialized with', marketplaceModules.length, 'modules');
}

// Fetch modules from GitHub JSON file
async function fetchModulesFromGitHub() {
    try {
        console.log('Fetching modules from GitHub:', MODULES_JSON_URL);
        
        const response = await fetch(MODULES_JSON_URL, {
            cache: 'no-cache',  // Always get fresh data
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Validate data structure
        if (data && Array.isArray(data.modules)) {
            marketplaceModules = data.modules;
            console.log('Successfully loaded', marketplaceModules.length, 'modules from GitHub');
        } else {
            throw new Error('Invalid data structure in modules.json');
        }
        
    } catch (error) {
        console.warn('Failed to fetch modules from GitHub:', error.message);
        console.log('Using fallback modules');
        marketplaceModules = fallbackModules;
        
        // Show notification
        showMarketplaceNotification(
            'Using cached modules. Some modules may be outdated.',
            'info'
        );
    }
}

// Show loading state in marketplace
function showLoadingState() {
    const grid = document.getElementById('marketplaceGrid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
            <div class="loading-spinner" style="width: 40px; height: 40px; margin: 0 auto 1rem;"></div>
            <div style="color: #9EABB5; font-size: 1rem;">
                Loading community modules...
            </div>
        </div>
    `;
}

// Handle search functionality
function handleSearch(event) {
    currentSearchTerm = event.target.value.toLowerCase();
    filterAndRender();
}

// Handle category filter
function handleCategoryFilter(event) {
    currentCategory = event.target.value;
    filterAndRender();
}

// Filter modules based on search and category
function filterAndRender() {
    filteredModules = marketplaceModules.filter(module => {
        const matchesSearch = 
            module.name.toLowerCase().includes(currentSearchTerm) ||
            module.description.toLowerCase().includes(currentSearchTerm) ||
            module.contributor.toLowerCase().includes(currentSearchTerm);
        
        const matchesCategory = 
            currentCategory === 'all' || 
            module.category === currentCategory;
        
        return matchesSearch && matchesCategory;
    });
    
    renderMarketplace();
}

// Update marketplace statistics
function updateMarketplaceStats() {
    const totalModules = marketplaceModules.length;
    const uniqueContributors = new Set(marketplaceModules.map(m => m.contributor)).size;
    
    const totalModulesEl = document.getElementById('totalModules');
    const totalContributorsEl = document.getElementById('totalContributors');
    
    if (totalModulesEl) totalModulesEl.textContent = totalModules;
    if (totalContributorsEl) totalContributorsEl.textContent = uniqueContributors;
}

// Render marketplace grid
function renderMarketplace() {
    const grid = document.getElementById('marketplaceGrid');
    
    if (!grid) {
        console.error('Marketplace grid element not found');
        return;
    }
    
    if (filteredModules.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.6;">🔍</div>
                <div style="color: #ffffff; font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">
                    No modules found
                </div>
                <div style="color: #9EABB5; font-size: 0.9rem;">
                    Try adjusting your search or filter
                </div>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredModules.map((module, index) => createMarketplaceItemHTML(module, index)).join('');
    
    // Attach event listeners to buttons
    filteredModules.forEach((module, index) => {
        const useBtn = document.getElementById(`use-module-${index}`);
        const viewBtn = document.getElementById(`view-code-${index}`);
        
        if (useBtn) {
            useBtn.addEventListener('click', () => useModule(module));
        }
        
        if (viewBtn) {
            viewBtn.addEventListener('click', () => viewModuleCode(module));
        }
    });
}

// Create HTML for a marketplace item
function createMarketplaceItemHTML(module, index) {
    const verifiedBadge = module.verified 
        ? '<span style="color: #00ff88; font-size: 1rem; margin-left: 0.5rem;" title="Verified Module">✓</span>'
        : '';
    
    return `
        <div class="marketplace-item">
            <div class="marketplace-item-header">
                <div>
                    <div class="marketplace-item-title">
                        ${module.name}
                        ${verifiedBadge}
                    </div>
                </div>
            </div>
            
            <div class="marketplace-item-desc">
                ${module.description}
            </div>
            
            <div class="marketplace-item-meta">
<div class="meta-row">
<span class="marketplace-item-category">${module.category}</span>
</div>
            <div class="meta-row">
                    <span class="meta-label">Module:</span>
                    <span class="meta-value" title="${module.module}">${module.module}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">Address:</span>
                    <span class="meta-value" title="${module.address}">${module.address.slice(0, 10)}...${module.address.slice(-8)}</span>
                </div>
                <div class="meta-row">
                    <span class="meta-label">By:</span>
                    <span class="meta-value">${module.contributor}</span>
                </div>
            </div>
            
            <div class="marketplace-item-actions">
                <button class="use-module-btn" id="use-module-${index}">
                    ⚡ Use Module
                </button>
                <button class="view-code-btn" id="view-code-${index}">
                    📄 View Code
                </button>
            </div>
        </div>
    `;
}

// Use module - populate wizard with module data
function useModule(module) {
    console.log('Using module:', module.name);
    
    // Show notification
    showMarketplaceNotification(`Loading ${module.name}...`, 'info');
    
    // Set the manual address input
    const manualAddressInput = document.getElementById('manualAddress');
    if (manualAddressInput) {
        manualAddressInput.value = module.address;
    }
    
    // Trigger the "Use Address" button click
    setTimeout(() => {
        const useAddressBtn = document.getElementById('useManualAddress');
        if (useAddressBtn) {
            useAddressBtn.click();
            
            // Scroll to wizard
            setTimeout(() => {
                const wizardSection = document.querySelector('.automation-section');
                if (wizardSection) {
                    wizardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                
                showMarketplaceNotification(
                    `${module.name} loaded! Select the "${module.module}" module to continue.`,
                    'success'
                );
            }, 1000);
        }
    }, 500);
}

// View module code - open GitHub repo
function viewModuleCode(module) {
    console.log('Viewing code for:', module.name);
    window.open(module.githubRepo, '_blank');
    showMarketplaceNotification(`Opening GitHub repository...`, 'info');
}

// Refresh marketplace data
async function refreshMarketplace() {
    console.log('Refreshing marketplace data...');
    showMarketplaceNotification('Refreshing modules...', 'info');
    
    showLoadingState();
    await fetchModulesFromGitHub();
    
    filteredModules = [...marketplaceModules];
    updateMarketplaceStats();
    renderMarketplace();
    
    showMarketplaceNotification('Marketplace updated!', 'success');
}

// Show marketplace-specific notifications
function showMarketplaceNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">
                ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <div class="notification-message">${message}</div>
        </div>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: ${type === 'success' ? 'rgba(0, 255, 136, 0.1)' : type === 'error' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(221, 20, 56, 0.1)'};
        border: 1px solid ${type === 'success' ? 'rgba(0, 255, 136, 0.3)' : type === 'error' ? 'rgba(255, 107, 107, 0.3)' : 'rgba(221, 20, 56, 0.3)'};
        color: ${type === 'success' ? '#00ff88' : type === 'error' ? '#ff6b6b' : '#DD1438'};
        padding: 1rem;
        border-radius: 8px;
        backdrop-filter: blur(20px);
        z-index: 1000;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.4s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Export functions for use in other scripts if needed
window.marketplaceAPI = {
    initMarketplace,
    useModule,
    viewModuleCode,
    refreshMarketplace,
    getModules: () => marketplaceModules,
    getFilteredModules: () => filteredModules
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMarketplace);
} else {
    initMarketplace();
}