let updateInterval;
let countdownInterval;
let epochData = {};
let nextEpochTime = null;
let maxTaskDuration = 7 * 24 * 60 * 60;
let supraSdkClient = null;
let wizardState = {
    walletConnected: false,
    walletAddress: '',
    selectedModule: '',
    selectedFunction: '',
    moduleABI: null,
    functionParams: [],
    hasGenerics: false,
    typeArgs: [],
    walletProvider: null
};

// ===== INITIALIZATION =====
function init() {
    console.log('Initializing Supra Automation Assist...');
    console.log('Environment:', {
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        isProduction: window.location.hostname.includes('vercel') || window.location.hostname.includes('.app'),
        timestamp: new Date().toISOString()
    });
    
    initializeSupraSDK();
    createFloatingLetters();
    createParticleSystem();
    setupNavigationListeners();
    setupMobileSidebar();
    updateDisplay();
    updateInterval = setInterval(updateDisplay, 5000);
    countdownInterval = setInterval(updateCountdown, 1000);
}

// ===== SDK INITIALIZATION =====
async function initializeSupraSDK() {
    try {
        if (window.supraSDKError) {
            throw new Error('SDK failed to load from CDN');
        }
        let attempts = 0;
        console.log('Waiting for Supra SDK to load...');
        while (!window.SupraClient && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }        
        if (!window.SupraClient) {
            throw new Error('Supra SDK not available after waiting');
        }        
        supraSdkClient = new window.SupraClient('https://rpc-testnet.supra.com');
        console.log('Supra SDK initialized successfully');
        const testResponse = await fetch('https://rpc-testnet.supra.com/rpc/v2/accounts/0x1');
        if (!testResponse.ok) {
            throw new Error('RPC endpoint not accessible');
        }
        console.log('RPC endpoint verified');
        if (!window.BCS || !window.HexString) {
            throw new Error('BCS or HexString not available');
        }
        console.log('BCS and HexString modules verified');
        
    } catch (error) {
        console.error('Failed to initialize Supra SDK:', error);
        showNotification('SDK initialization failed - transaction signing unavailable', 'error');
        const signBtn = document.getElementById('signTransaction');
        if (signBtn) {
            signBtn.disabled = true;
            signBtn.innerHTML = '<span class="btn-icon">⚠️</span><span class="btn-text">SDK Not Available</span>';
            signBtn.title = 'Supra SDK failed to load - use CLI command instead';
        }
    }
}

// ===== NAVIGATION =====
function setupNavigationListeners() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.getAttribute('data-section');
            navigateToSection(section);
        });
    });
}

function navigateToSection(sectionName) {
    // Update navigation active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === sectionName) {
            item.classList.add('active');
        }
    });
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Update page title
        const titles = {
            'dashboard': { title: 'Get Started with Supra AutoFi', subtitle: 'Monitor network stats and automation metrics' },
            'automation': { title: 'Create Automation Task', subtitle: 'Deploy smart automations with ease' },
            'marketplace': { title: 'AutoFi Marketplace', subtitle: 'Discover community automation modules' },
            'tasks': { title: 'My Completed Automation Tasks', subtitle: 'View your successfully executed automation tasks' }
        };
        
        if (titles[sectionName]) {
            document.getElementById('pageTitle').textContent = titles[sectionName].title;
            document.getElementById('pageSubtitle').textContent = titles[sectionName].subtitle;
        }
    }
    
    // Close mobile sidebar if open
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.remove('open');
        }
    }
}

function setupMobileSidebar() {
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.querySelector('.sidebar');
    
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }
            }
        });
    }
}

// ===== FLOW VISUALIZATION =====
function updateFlowStage(stageNumber, status, message) {
    const flowStage = document.getElementById(`flowStage${stageNumber}`);
    const nodeStatus = document.getElementById(`nodeStatus${stageNumber}`);
    
    if (!flowStage || !nodeStatus) return;
    
    // Remove all status classes
    flowStage.classList.remove('active', 'completed', 'error');
    
    // Add new status
    if (status === 'active') {
        flowStage.classList.add('active');
    } else if (status === 'completed') {
        flowStage.classList.add('completed');
        message = '✓ ' + message;
    } else if (status === 'error') {
        flowStage.classList.add('error');
    }
    
    nodeStatus.textContent = message;
}

function enableStep(stepNumber) {
    const step = document.getElementById(`step-${stepNumber}`);
    if (step) {
        // Hide all steps
        document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
        // Show current step
        step.classList.add('active');
        
        // Update flow visualization (only 4 stages now)
        for (let i = 1; i <= 4; i++) {
            if (i < stepNumber) {
                updateFlowStage(i, 'completed', 'Done');
            } else if (i === stepNumber) {
                updateFlowStage(i, 'active', 'In Progress');
            } else {
                updateFlowStage(i, 'pending', 'Pending');
            }
        }
    }
}

// ===== BACKGROUND EFFECTS =====
function createFloatingLetters() {
    const container = document.querySelector('.floating-letters');
    if (!container) return;
    
    const characters = [
        '0', '1', '0', '1', '1', '0', '1', '0',
        'S', 'U', 'P', 'R', 'A', 'S', 'U', 'P', 'R', 'A',
        '{', '}', '(', ')', ';', ':', '=', '+', '-', '*',
        'fn', 'let', 'mut', 'pub', 'use', 'mod'
    ];
    
    function createLetter() {
        const letter = document.createElement('div');
        letter.className = 'letter';
        
        const char = characters[Math.floor(Math.random() * characters.length)];
        letter.textContent = char;
        
        if (char === '0' || char === '1') {
            letter.classList.add('binary');
        } else if ('SUPRA'.includes(char)) {
            letter.classList.add('supra-char');
        } else {
            letter.classList.add('code-char');
        }
        
        letter.style.left = Math.random() * 100 + '%';
        letter.style.animationDuration = (Math.random() * 15 + 10) + 's';
        letter.style.animationDelay = Math.random() * 5 + 's';
        
        container.appendChild(letter);
        
        setTimeout(() => {
            if (letter.parentNode) {
                letter.parentNode.removeChild(letter);
            }
        }, 25000);
    }
    
    setInterval(createLetter, 200);
    for (let i = 0; i < 20; i++) {
        setTimeout(createLetter, i * 100);
    }
}

function createParticleSystem() {
    const container = document.querySelector('.particle-system');
    if (!container) return;
    
    function createParticle() {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = (Math.random() * 8 + 6) + 's';
        particle.style.animationDelay = Math.random() * 3 + 's';
        
        container.appendChild(particle);
        
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, 14000);
    }
    
    setInterval(createParticle, 150);
    for (let i = 0; i < 30; i++) {
        setTimeout(createParticle, i * 50);
    }
}

// ===== NETWORK DATA =====
async function fetchEpochData() {
    try {
        const response = await fetch('https://rpc-testnet.supra.com/rpc/v2/accounts/1/resources/0x1%3A%3Areconfiguration%3A%3AConfiguration');
        const data = await response.json();
        
        if (data.data) {
            epochData.lastReconfigurationTime = parseInt(data.data.last_reconfiguration_time);
            epochData.epochInterval = 7200;
            epochData.buffer = 300;
            const lastReconfigSecs = Math.floor(epochData.lastReconfigurationTime / 1000000);
            nextEpochTime = lastReconfigSecs + epochData.epochInterval;
            
            document.getElementById('networkStatus').textContent = 'Connected';
            document.getElementById('networkStatus').style.color = 'var(--success)';
            return true;
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Error fetching epoch data:', error);
        document.getElementById('networkStatus').textContent = 'Error';
        document.getElementById('networkStatus').style.color = 'var(--error)';
        return false;
    }
}

async function fetchMaxTaskDuration() {
    try {
        const response = await fetch('https://rpc-testnet.supra.com/rpc/v2/accounts/1/resources/0x1%3A%3Aautomation_registry%3A%3AActiveAutomationRegistryConfig');
        const data = await response.json();
        
        if (data.data && data.data.task_duration_cap_in_secs) {
            maxTaskDuration = parseInt(data.data.task_duration_cap_in_secs);
        }
    } catch (error) {
        console.error('Error fetching max task duration:', error);
    }
}

async function fetchAutomationFee() {
    try {
        const maxGasAmount = document.getElementById('maxGasAmount')?.value || '5000';
        
        const response = await fetch('https://rpc-testnet.supra.com/rpc/v2/view', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "function": "0x1::automation_registry::estimate_automation_fee",
                "type_arguments": [],
                "arguments": [maxGasAmount]
            })
        });
        
        const data = await response.json();
        if (data.result && data.result[0]) {
            return parseInt(data.result[0]);
        } else {
            throw new Error('Invalid fee response');
        }
    } catch (error) {
        console.error('Error fetching automation fee:', error);
        return 1929736800; 
    }
}

function calculateTimeToNextEpoch() {
    if (!nextEpochTime) return null;
    const now = Math.floor(Date.now() / 1000);  
    const timeLeft = nextEpochTime - now;
    return Math.max(0, timeLeft);  
}

function calculateExpiryTime() {
    if (!nextEpochTime) return null;
    return nextEpochTime + epochData.buffer;
}

function formatDuration(seconds) {
    if (seconds <= 0) return "Epoch ended";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

function updateCountdown() {
    const timeLeft = calculateTimeToNextEpoch();
    if (timeLeft !== null) {
        document.getElementById('timeToNext').textContent = formatDuration(timeLeft);
        
        if (timeLeft <= 0) {
            console.log('Epoch ended, refreshing data...');
            updateDisplay();
        }
    }
}

async function updateDisplay() {
    console.log('Updating display...');
    
    const epochSuccess = await fetchEpochData();
    if (!epochSuccess) return;
    
    await fetchMaxTaskDuration();
    const automationFee = await fetchAutomationFee();
    
    const expiryTime = calculateExpiryTime();
    const feeInSupra = (automationFee / 1000000).toFixed(2);
    document.getElementById('estimatedFee').textContent = `${feeInSupra} SUPRA`;
    
    document.getElementById('expiryTimeValue').textContent = expiryTime || 'Error';
    document.getElementById('feeCapValue').textContent = automationFee;
    
    const cliTemplate = `supra move automation register \\
  --task-max-gas-amount 5000 \\
  --task-gas-price-cap 200 \\
  --task-expiry-time-secs ${expiryTime} \\
  --task-automation-fee-cap ${automationFee} \\
  --function-id "YOUR_ADDRESS::MODULE::FUNCTION" \\
  --rpc-url https://rpc-testnet.supra.com`;
    
    document.getElementById('cliTemplate').textContent = cliTemplate;
    
    console.log('Display updated successfully');
}

async function copyToClipboard(elementId, button) {
    const element = document.getElementById(elementId);
    const text = element.textContent;
    
    try {
        await navigator.clipboard.writeText(text);
        const originalText = button.textContent;
        const originalHTML = button.innerHTML;
        button.innerHTML = '<span class="copy-icon">✓</span> Copied!';
        button.classList.add('success');
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('success');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        button.textContent = 'Error';
        setTimeout(() => {
            button.innerHTML = '<span class="copy-icon">📋</span> Copy';
        }, 2000);
    }
}

// ===== WALLET FUNCTIONS =====
function getStarkeyProvider() {
    if ('starkey' in window) {
        const provider = window.starkey?.supra;
        if (provider) {
            return provider;
        }
    }
    return null;
}

async function connectStarkeyWallet() {
    try { 
        updateFlowStage(1, 'active', 'Connecting...');
        
        const provider = getStarkeyProvider();
        
        if (!provider) {
            showNotification('Starkey wallet not found. Redirecting to installation...', 'info');
            window.open('https://starkey.app/', '_blank');
            updateFlowStage(1, 'error', 'Wallet not found');
            throw new Error('Starkey wallet not found. Please install Starkey extension.');
        } 
        
        showNotification('Connecting to Starkey wallet...', 'info');
        const accounts = await provider.connect();
        
        if (accounts && accounts.length > 0) {
            const address = accounts[0];
            console.log('Verifying account exists on network...', address);
            try {
                const accountCheck = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${address}`);
                const accountData = await accountCheck.json();
                console.log('Account verification response:', accountData);
                
                if (!accountData || accountData.error) {
                    throw new Error(`Account ${address} does not exist on Supra testnet.`);
                }
                console.log('Account verified on network');
            } catch (accountError) {
                console.error('Account verification failed:', accountError);
                showNotification(`Account verification failed: ${accountError.message}`, 'error');
                updateFlowStage(1, 'error', 'Verification failed');
                throw accountError;
            }
            
            wizardState.walletConnected = true;
            wizardState.walletAddress = address;
            wizardState.walletProvider = provider;
            
            // Update UI
            document.getElementById('walletAddress').textContent = `${address.slice(0, 10)}...${address.slice(-8)}`;
            document.getElementById('walletStatus').style.display = 'block';
            document.getElementById('connectWallet').style.display = 'none';
            document.getElementById('autoScanStatus').style.display = 'flex';
            document.getElementById('autoScanStatus').innerHTML = '<div class="loading-spinner"></div><span>Scanning for modules...</span>';
            
            // Show disconnect button
            const disconnectBtn = document.getElementById('disconnectWallet');
            if (disconnectBtn) {
                disconnectBtn.style.display = 'flex';
            }
            
            updateFlowStage(1, 'completed', 'Connected');
            
            setTimeout(() => {
                autoScanWalletModules(address);
            }, 1000);
            
            showNotification('Wallet connected! Scanning for your modules...', 'success');
            
            provider.on('accountChanged', (newAccounts) => {
                if (newAccounts.length > 0) {
                    wizardState.walletAddress = newAccounts[0];
                    document.getElementById('walletAddress').textContent = `${newAccounts[0].slice(0, 10)}...${newAccounts[0].slice(-8)}`;
                    showNotification(`Switched to account ${newAccounts[0].slice(0, 6)}...${newAccounts[0].slice(-4)}`, 'info');
                    autoScanWalletModules(newAccounts[0]);
                }
            });
            return true;
        } else {
            throw new Error('No accounts returned from Starkey wallet');
        }
    } catch (error) {
        console.error('Wallet connection error:', error);
        
        if (error.code === 4001) {
            showNotification('Connection rejected by user', 'error');
        } else {
            showNotification(`Connection failed: ${error.message}`, 'error');
        }
        
        updateFlowStage(1, 'error', 'Connection failed');
        return false;
    }
}

// ===== DISCONNECT WALLET =====
async function disconnectWallet() {
    try {
        console.log('Disconnecting wallet...');
        
        // Disconnect using StarKey provider
        if (wizardState.walletProvider && typeof wizardState.walletProvider.disconnect === 'function') {
            await wizardState.walletProvider.disconnect();
        } else if (window.starkey && window.starkey.supra && typeof window.starkey.supra.disconnect === 'function') {
            await window.starkey.supra.disconnect();
        }
        
        // Reset wizard state
        wizardState.walletConnected = false;
        wizardState.walletAddress = '';
        wizardState.selectedModule = '';
        wizardState.selectedFunction = '';
        wizardState.moduleABI = null;
        wizardState.functionParams = [];
        wizardState.hasGenerics = false;
        wizardState.typeArgs = [];
        wizardState.walletProvider = null;
        
        // Hide disconnect button
        const disconnectBtn = document.getElementById('disconnectWallet');
        if (disconnectBtn) disconnectBtn.style.display = 'none';
        
        // Reset wizard UI
        enableStep(1);
        updateFlowStage(1, 'pending', 'Connect Wallet');
        updateFlowStage(2, 'pending', 'Pending');
        updateFlowStage(3, 'pending', 'Pending');
        updateFlowStage(4, 'pending', 'Pending');
        
        // Show connect button, hide wallet status
        const connectBtn = document.getElementById('connectWallet');
        const walletStatus = document.getElementById('walletStatus');
        const autoScanStatus = document.getElementById('autoScanStatus');
        if (connectBtn) connectBtn.style.display = 'block';
        if (walletStatus) walletStatus.style.display = 'none';
        if (autoScanStatus) autoScanStatus.style.display = 'none';
        
        // Clear modules and functions
        const modulesList = document.getElementById('modulesList');
        const functionsList = document.getElementById('functionsList');
        if (modulesList) modulesList.innerHTML = '';
        if (functionsList) functionsList.innerHTML = '';
        
        // Clear tasks
        const tasksList = document.getElementById('automatedTasksList');
        const noTasksState = document.getElementById('noTasksState');
        if (tasksList) tasksList.innerHTML = '';
        if (noTasksState) noTasksState.style.display = 'block';
        
        // Clear summary
        const summaryModule = document.getElementById('summaryModule');
        const summaryFunction = document.getElementById('summaryFunction');
        if (summaryModule) summaryModule.textContent = '-';
        if (summaryFunction) summaryFunction.textContent = '-';
        
        console.log('Wallet disconnected successfully');
        showNotification('Wallet disconnected successfully', 'success');
        
    } catch (error) {
        console.error('Error disconnecting wallet:', error);
        showNotification('Failed to disconnect: ' + error.message, 'error');
    }
}

function useManualAddress() {
    const manualAddress = document.getElementById('manualAddress').value.trim();
    
    if (!manualAddress) {
        showNotification('Please enter a valid address', 'error');
        return;
    }

    if (!manualAddress.startsWith('0x') || manualAddress.length !== 66) {
        showNotification('Invalid address format. Address should start with 0x and be 66 characters long', 'error');
        return;
    }
    
    updateFlowStage(1, 'active', 'Validating...');
    
    wizardState.walletConnected = true;
    wizardState.walletAddress = manualAddress;
    
    document.getElementById('walletAddress').textContent = `${manualAddress.slice(0, 10)}...${manualAddress.slice(-8)} (Manual)`;
    document.getElementById('walletStatus').style.display = 'block';
    document.getElementById('connectWallet').style.display = 'none';
    document.getElementById('autoScanStatus').style.display = 'flex';
    document.getElementById('autoScanStatus').innerHTML = '<div class="loading-spinner"></div><span>Scanning for modules...</span>';
    
    // Update top bar
    const topBarWallet = document.getElementById('topBarWallet');
    const topBarAddress = document.getElementById('topBarAddress');
    if (topBarWallet && topBarAddress) {
        topBarWallet.style.display = 'flex';
        topBarAddress.textContent = `${manualAddress.slice(0, 6)}...${manualAddress.slice(-4)}`;
    }
    
    updateFlowStage(1, 'completed', 'Connected');
    
    setTimeout(() => {
        autoScanWalletModules(manualAddress);
    }, 1000);
    
    showNotification('Manual address set! Scanning for modules...', 'success');
}

// Continue in next part...

// ===== MODULE SCANNING =====
async function autoScanWalletModules(walletAddress) {
    try {
        updateFlowStage(2, 'active', 'Scanning...');
        
        const moduleCountInput = document.getElementById('moduleCount');
        const moduleCount = moduleCountInput ? parseInt(moduleCountInput.value) || 20 : 20;
        
        document.getElementById('autoScanStatus').innerHTML = `<div class="loading-spinner"></div><span>Fetching ${moduleCount} modules...</span>`;
        
        let modules = [];
        let apiUsed = '';
        
        try {
            const responseV3 = await fetch(`https://rpc-testnet.supra.com/rpc/v3/accounts/${walletAddress}/modules?count=${moduleCount}`);
            if (responseV3.ok) {
                const dataV3 = await responseV3.json();
                console.log('v3 API response:', dataV3);
                modules = parseModulesFromResponse(dataV3, 'v3');
                apiUsed = 'v3';
                console.log(`Successfully fetched ${modules.length} modules from v3 API`);
            }
        } catch (error) {
            console.log('v3 API error:', error);
        }
        
        if (modules.length === 0) {
            console.log('Trying v2 API as fallback...');
            try {
                const responseV2 = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${walletAddress}/modules`);
                if (responseV2.ok) {
                    const dataV2 = await responseV2.json();
                    modules = parseModulesFromResponse(dataV2, 'v2');
                    apiUsed = 'v2';
                }
            } catch (error) {
                throw new Error('Both v2 and v3 APIs failed');
            }
        }
        
        const validModules = modules.filter(module => {
            return module.name && 
                   module.name.trim() !== '' &&
                   module.name !== 'Unknown' &&
                   module.name !== 'cursor' &&
                   module.name !== 'modules';
        });
        
        if (validModules.length > 0) {
            document.getElementById('autoScanStatus').innerHTML = `<div class="status-badge success"><span class="status-icon">✓</span><span>Found ${validModules.length} modules!</span></div>`;
            displayModules(validModules, walletAddress);
            enableStep(2);
            updateFlowStage(2, 'completed', `${validModules.length} modules`);
            
            try {
                await fetchAutomatedTasks(walletAddress);
            } catch (error) {
                console.log('Could not fetch automated tasks:', error);
            }
            showNotification(`Found ${validModules.length} modules!`, 'success');
        } else {
            throw new Error('No modules found at address');
        }
        
    } catch (error) {
        console.error('Auto-scan error:', error);
        updateFlowStage(2, 'error', 'Scan failed');
        
        // Demo mode fallback
        const demoModules = [
            { name: 'auto_incr', bytecode: 'Available' },
            { name: 'auto_counter', bytecode: 'Available' },
            { name: 'auto_topup', bytecode: 'Available' },
            { name: 'dice_roll', bytecode: 'Available' },
            { name: 'HelloWorld', bytecode: 'Available' }
        ];
        
        displayModules(demoModules, walletAddress);
        enableStep(2);
        updateFlowStage(2, 'completed', `${demoModules.length} demo modules`);
        
        showNotification('Demo modules loaded', 'info');
    }
}

function parseModulesFromResponse(data, apiVersion) {
    let modules = [];
    
    if (Array.isArray(data)) {
        modules = data.map((module, index) => parseModuleItem(module, index));
    } else if (data && data.data && Array.isArray(data.data)) {
        modules = data.data.map((module, index) => parseModuleItem(module, index));
    } else if (data && data.modules && Array.isArray(data.modules)) {
        modules = data.modules.map((module, index) => parseModuleItem(module, index));
    }
    
    return modules;
}

function parseModuleItem(module, index) {
    let moduleName = `Module_${index + 1}`;
    
    if (typeof module === 'string') {
        moduleName = module;
    } else if (module && typeof module === 'object') {
        if (module.abi && module.abi.name) {
            moduleName = module.abi.name;
        }
    }
    
    return {
        name: moduleName,
        bytecode: module.bytecode || 'Available',
        abi: module.abi || module,
        raw: module
    };
}

function displayModules(modules, baseAddress) {
    const modulesList = document.getElementById('modulesList');
    modulesList.innerHTML = '';
    modules.forEach(module => {
        const moduleCard = document.createElement('div');
        moduleCard.className = 'module-card';
        moduleCard.innerHTML = `
            <div class="module-name">${module.name}</div>
            <div class="module-desc">Click to explore functions</div>
        `;
        moduleCard.addEventListener('click', (event) => selectModule(module.name, baseAddress, event));
        modulesList.appendChild(moduleCard);
    });
    
    // Auto-select module if coming from marketplace
    if (window.pendingMarketplaceModule) {
        const targetModuleName = window.pendingMarketplaceModule.module;
        const matchingModule = modules.find(m => m.name.includes(targetModuleName) || targetModuleName.includes(m.name));
        
        if (matchingModule) {
            setTimeout(() => {
                const moduleCards = Array.from(modulesList.children);
                const cardToClick = moduleCards.find(card => 
                    card.querySelector('.module-name').textContent === matchingModule.name
                );
                if (cardToClick) {
                    cardToClick.click();
                }
            }, 500);
        }
    }
}

async function selectModule(moduleName, baseAddress, event) {
    document.querySelectorAll('.module-card').forEach(card => card.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    updateFlowStage(3, 'active', 'Loading...');
    
    wizardState.selectedModule = moduleName;
    
    await fetchAutomatedTasks(baseAddress);
    
    document.getElementById('abiLoading').style.display = 'flex';
    
    try {
        let response, data;
        
        try {
            response = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${baseAddress}/modules/${moduleName}`);
            if (response.ok) {
                data = await response.json();
            }
        } catch (err) {
            console.log('Standard endpoint failed');
        }
        
        if (!data || !response?.ok) {
            response = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${baseAddress}/modules`);
            if (response.ok) {
                const allModules = await response.json();
                if (Array.isArray(allModules)) {
                    data = allModules.find(module => {
                        return module.name === moduleName || 
                               (module.abi && module.abi.name === moduleName);
                    });
                }
            }
        }

        let moduleABI = null;
        if (data) {
            if (data.abi) moduleABI = data.abi;
            else if (data.module && data.module.abi) moduleABI = data.module.abi;
            else if (data.exposed_functions) moduleABI = data;
            else if (typeof data === 'object') moduleABI = data;
        }
        
        if (moduleABI) {
            wizardState.moduleABI = moduleABI;
            const entryFunctions = extractEntryFunctions(moduleABI);
            if (entryFunctions.length > 0) {
                displayFunctions(entryFunctions);
                enableStep(3);
                updateFlowStage(3, 'completed', `${entryFunctions.length} functions`);
                showNotification(`Found ${entryFunctions.length} entry functions!`, 'success');
                return;
            }
        }
        throw new Error('Could not load functions');
    } catch (error) {
        console.error('ABI fetch error:', error);
        
        // Demo functions
        const demoFunctions = [
            { name: 'execute', params: ['&signer'], is_entry: true, generic_type_params: [] },
            { name: 'process', params: ['&signer', 'u64'], is_entry: true, generic_type_params: [] }
        ];
        
        displayFunctions(demoFunctions);
        enableStep(3);
        updateFlowStage(3, 'completed', 'Demo functions');
        showNotification('Loaded demo functions', 'info');
    } finally {
        document.getElementById('abiLoading').style.display = 'none';
    }
}

function extractEntryFunctions(abi) {
    try {
        let functions = [];
        if (abi.exposed_functions && Array.isArray(abi.exposed_functions)) {
            functions = abi.exposed_functions;
        } else if (Array.isArray(abi)) {
            functions = abi;
        } else if (abi.functions && Array.isArray(abi.functions)) {
            functions = abi.functions;
        }
        
        return functions
            .filter(func => func.is_entry === true)
            .map(func => ({
                name: func.name,
                params: func.params || func.parameters || func.arguments || [],
                visibility: func.visibility,
                is_entry: func.is_entry,
                generic_type_params: func.generic_type_params || []
            }));
    } catch (error) {
        console.error('ABI parsing error:', error);
        return [];
    }
}

function displayFunctions(functions) {
    const functionsList = document.getElementById('functionsList');
    functionsList.innerHTML = '';
    functions.forEach(func => {
        const functionCard = document.createElement('div');
        functionCard.className = 'function-card';
        const nonSignerParams = func.params.filter(param => param !== '&signer');
        const hasGenerics = func.generic_type_params && func.generic_type_params.length > 0;
        
        functionCard.innerHTML = `
            <div class="function-name">${func.name}</div>
            <div class="function-desc">
                ${nonSignerParams.length} parameters
                ${hasGenerics ? ' • Has generics' : ''}
            </div>
        `;
        functionCard.addEventListener('click', (event) => selectFunction(func, event));
        functionsList.appendChild(functionCard);
    });
    
    // Auto-select first function if coming from marketplace
    if (window.pendingMarketplaceModule && functions.length > 0) {
        setTimeout(() => {
            const firstCard = functionsList.querySelector('.function-card');
            if (firstCard) {
                firstCard.click();
                // Clear pending module after selection
                window.pendingMarketplaceModule = null;
            }
        }, 500);
    }
}

function selectFunction(func, event) {
    document.querySelectorAll('.function-card').forEach(card => card.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    updateFlowStage(4, 'active', 'Configuring...');
    
    wizardState.selectedFunction = func.name;
    wizardState.functionParams = func.params;
    wizardState.hasGenerics = func.generic_type_params && func.generic_type_params.length > 0;
    
    generateParameterInputs(func.params, func.generic_type_params || []);
    updateAutomationParams();
    enableStep(4);
    updateFlowStage(4, 'completed', 'Ready');
}

// ===== PARAMETER GENERATION =====
function generateParameterInputs(params, genericParams = []) {
    const container = document.getElementById('functionParams');
    container.innerHTML = '';
    const nonSignerParams = params.filter(param => param !== '&signer');
    
    nonSignerParams.forEach((paramType, index) => {
        const paramRow = document.createElement('div');
        paramRow.className = 'param-row';
        
        // Check if this is a String type (could be a collection)
        const isStringType = paramType.toLowerCase().includes('vector<u8>');
        
        if (isStringType) {
            // For String parameters, add option to use collection search
            const inputType = 'number';
            const placeholder = 'Enter value';
            const hint = 'Text parameter';
            
            paramRow.innerHTML = `
                <label>
                    Parameter ${index + 1} (${paramType})
                    <span class="hint-icon" title="${hint}">?</span>
                </label>
                <div class="string-param-container">
                    <input type="${inputType}" 
                           class="param-input" 
                           data-param-index="${index}" 
                           data-param-type="${paramType}"
                           placeholder="${placeholder}"
                           required>
                    <button type="button" class="collection-search-toggle" 
                            onclick="toggleCollectionSearch(this)"
                            title="Enable NFT Collection Search">
                        🔍 Search Collections
                    </button>
                </div>
                <small>Type: ${paramType}</small>
                <small>• Click button to search NFT collections.</small>                
                <small>• Check <a href="https://crystara.trade/marketplace" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline;">Crystara.trade</a> for more info on collections.</small>
            `;
            container.appendChild(paramRow);
            
        } else {
            // Regular parameter input
            const inputType = getInputTypeForMoveType(paramType);
            const placeholder = getPlaceholderForType(paramType);
            const hint = getHintForType(paramType);
            
            paramRow.innerHTML = `
                <label>
                    Parameter ${index + 1} (${paramType})
                    <span class="hint-icon" title="${hint}">?</span>
                </label>
                <input type="${inputType}" 
                       class="param-input" 
                       data-param-index="${index}" 
                       data-param-type="${paramType}"
                       placeholder="${placeholder}"
                       required>
                <small>Type: ${paramType}</small>
            `;
            container.appendChild(paramRow);
        }
    });
    
    if (genericParams.length > 0) {
        const typeArgsSection = document.createElement('div');
        typeArgsSection.className = 'type-args-section';
        typeArgsSection.innerHTML = `<h5>Type Arguments (Generics) <span class="hint-icon" title="Specify the concrete types for generic parameters">?</span></h5>`;
        
        genericParams.forEach((_, index) => {
            const typeArgInput = document.createElement('input');
            typeArgInput.type = 'text';
            typeArgInput.className = 'param-input';
            typeArgInput.placeholder = `Type argument ${index + 1} (e.g., 0x1::coin::CoinType)`;
            typeArgInput.dataset.typeArgIndex = index;
            typeArgInput.required = true;
            typeArgsSection.appendChild(typeArgInput);
        });
        
        container.appendChild(typeArgsSection);
    }
}

// Toggle between regular input and collection search
function toggleCollectionSearch(button) {
    const container = button.parentElement;
    const currentInput = container.querySelector('.param-input');
    const dataIndex = currentInput.getAttribute('data-param-index');
    const dataType = currentInput.getAttribute('data-param-type');
    const currentValue = currentInput.value;
    
    // Check if already in collection search mode
    if (container.querySelector('.collection-search-input')) {
        // Switch back to regular input
        container.innerHTML = `
            <input type="text" 
                   class="param-input" 
                   data-param-index="${dataIndex}" 
                   data-param-type="${dataType}"
                   value="${currentValue}"
                   placeholder="Enter string value"
                   required>
            <button type="button" class="collection-search-toggle" 
                    onclick="toggleCollectionSearch(this)"
                    title="Enable NFT Collection Search">
                🔍 Search Collections
            </button>
        `;
    } else {
        // Switch to collection search mode
        container.innerHTML = `
            <div class="collection-search-wrapper">
                <input type="text" 
                       class="param-input collection-search-input" 
                       data-param-index="${dataIndex}" 
                       data-param-type="${dataType}"
                       value="${currentValue}"
                       placeholder="Search collections..."
                       autocomplete="off">
                <div class="collection-dropdown" style="display: none;"></div>
                <div class="collection-loading" style="display: none;">🔄 Loading...</div>
            </div>
            <button type="button" class="collection-search-toggle active" 
                    onclick="toggleCollectionSearch(this)"
                    title="Use Regular Text Input">
                ✏️ Regular Input
            </button>
        `;
        
        // Setup collection search for the new input
        const newInput = container.querySelector('.collection-search-input');
        if (newInput) {
            setupCollectionSearch(newInput);
        }
    }
}

function getInputTypeForMoveType(moveType) {
    if (moveType.includes('u8') || moveType.includes('u16') || 
        moveType.includes('u32') || moveType.includes('u64') || 
        moveType.includes('u128') || moveType.includes('u256')) {
        return 'number';
    }
    if (moveType === 'bool') return 'checkbox';
    return 'text';
}

function getPlaceholderForType(moveType) {
    if (moveType === 'address') return '0x1234...';
    if (moveType.includes('u')) return 'Enter a positive number';
    if (moveType === 'bool') return 'true/false';
    if (moveType.includes('vector')) return 'Enter comma-separated values';
    return `Enter ${moveType} value`;
}

function getHintForType(moveType) {
    const hints = {
        'address': 'A 32-byte address starting with 0x',
        'u8': 'Unsigned 8-bit integer (0 to 255)',
        'u64': 'Unsigned 64-bit integer',
        'bool': 'Boolean value: true or false',
        'vector<u8>': 'Array of bytes'
    };
    return hints[moveType] || `Value of type ${moveType}`;
}

function validateParameter(value, type) {
    if (!value && type !== 'bool') return { valid: false, error: 'This field is required' };
    if (type === 'address') {
        if (!value.startsWith('0x') || value.length !== 66) {
            return { valid: false, error: 'Address must start with 0x and be 66 characters long' };
        }
    }
    if (type.includes('u')) {
        const num = parseInt(value);
        if (isNaN(num) || num < 0) {
            return { valid: false, error: 'Must be a positive number' };
        }
    }
    return { valid: true };
}

function updateAutomationParams() {
    const currentTime = Math.floor(Date.now() / 1000);
    const maxExpiryTime = currentTime + maxTaskDuration;
    const calculatedExpiryTime = calculateExpiryTime();
    const expiryTime = calculatedExpiryTime ? Math.min(calculatedExpiryTime, maxExpiryTime) : maxExpiryTime;
    
    document.getElementById('expiryTimeAuto').value = expiryTime;
    document.getElementById('expiryTimeAuto').max = maxExpiryTime;
    
    const automationFee = document.getElementById('feeCapValue').textContent;
    document.getElementById('automationFeeAuto').value = automationFee || 'Calculating...';
    
    // Update summary badges in Step 4
    const summaryModule = document.getElementById('summaryModule');
    const summaryFunction = document.getElementById('summaryFunction');
    if (summaryModule && summaryFunction) {
        summaryModule.textContent = wizardState.selectedModule || '-';
        summaryFunction.textContent = wizardState.selectedFunction || '-';
    }
    
    enableStep(4);
    updateFlowStage(4, 'completed', 'Ready to deploy');
}

// ===== TRANSACTION FUNCTIONS =====
function convertParameterToBCS(value, type) {
    if (!window.BCS) throw new Error('BCS module not loaded');
    
    try {
        if (type === 'address') {
            return new window.HexString(value).toUint8Array();
        } else if (type.includes('u8')) {
            return window.BCS.bcsSerializeUint8(parseInt(value));
        } else if (type.includes('u64')) {
            return window.BCS.bcsSerializeUint64(BigInt(value));
        } else if (type.includes('u128')) {
            return window.BCS.bcsSerializeUint128(BigInt(value));
        } else if (type.includes('u256')) {
            return window.BCS.bcsSerializeUint256(BigInt(value));
        } else if (type === 'bool') {
            return window.BCS.bcsSerializeBool(value === 'true');
        } else if (type.includes('vector<u8>')) {
            return window.BCS.bcsSerializeStr(value);
        } else {
            return window.BCS.bcsSerializeStr(value);
        }
    } catch (error) {
        console.error(`Error converting parameter ${value} of type ${type}:`, error);
        throw error;
    }
}

async function getAccountSequenceNumber(address) {
    try {
        const response = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${address}`);
        const data = await response.json();
        if (data && data.sequence_number !== undefined) {
            return BigInt(data.sequence_number);
        } else {
            throw new Error('Could not fetch sequence number');
        }
    } catch (error) {
        console.error('Error fetching sequence number:', error);
        return BigInt(0);
    }
}

async function switchToSupraTestnet() {
    try {
        const response = await wizardState.walletProvider.changeNetwork({ chainId: '6' });
        return true;
    } catch (error) {
        console.error('Network switch failed:', error);
        return false;
    }
}

async function signAutomationTransaction() {
    const signBtn = document.getElementById('signTransaction');
    const transactionStatus = document.getElementById('transactionStatus');
    
    try {
        signBtn.disabled = true;
        signBtn.innerHTML = '<div class="loading-spinner"></div><span class="btn-text">Creating Transaction...</span>';
        updateFlowStage(4, 'active', 'Signing...');
        
        // Validate parameters
        const paramInputs = document.querySelectorAll('#functionParams .param-input');
        let allValid = true;
        const functionArgs = [];
        const functionTypes = [];
        
        paramInputs.forEach(input => {
            const value = input.value.trim();
            const type = input.getAttribute('data-param-type');
            input.classList.remove('invalid');
            
            const validation = validateParameter(value, type);
            if (!validation.valid) {
                allValid = false;
                input.classList.add('invalid');
            } else if (value) {
                functionArgs.push(value);
                functionTypes.push(type);
            }
        });
        
        const typeArgInputs = document.querySelectorAll('.type-arg-input');
        const typeArgs = [];
        typeArgInputs.forEach(input => {
            const value = input.value.trim();
            if (!value) {
                allValid = false;
                input.classList.add('invalid');
            } else {
                typeArgs.push(value);
            }
        });
        
        if (!allValid) {
            throw new Error('Please fix validation errors');
        }
        
        if (!wizardState.walletProvider) {
            throw new Error('Wallet not connected');
        }
        
        // Check network
        const chainIdResponse = await wizardState.walletProvider.getChainId();
        let walletChainId = chainIdResponse.chainId;
        if (typeof walletChainId === 'string') {
            walletChainId = walletChainId.startsWith('0x') ? parseInt(walletChainId, 16) : parseInt(walletChainId, 10);
        }
        
        if (walletChainId !== 6) {
            showNotification('Switching to Supra testnet...', 'info');
            const switched = await switchToSupraTestnet();
            if (!switched) {
                throw new Error('Please switch to Supra testnet manually');
            }
            showNotification('Switched to testnet! Sign again.', 'success');
            setTimeout(() => {
                signBtn.disabled = false;
                signBtn.innerHTML = '<span class="btn-icon">📦</span><span class="btn-text">Register from Starkey</span>';
            }, 3000);
            return;
        }
        
        // Convert parameters
        const bcsArgs = [];
        for (let i = 0; i < functionArgs.length; i++) {
            const bcsArg = convertParameterToBCS(functionArgs[i], functionTypes[i]);
            bcsArgs.push(bcsArg);
        }
        
        const senderSequenceNumber = await getAccountSequenceNumber(wizardState.walletAddress);
        
        const automationMaxGasAmount = BigInt(document.getElementById('maxGasAmount').value);
        const automationGasPriceCap = BigInt(document.getElementById('gasPriceCap').value);
        const automationFeeCap = BigInt(document.getElementById('automationFeeAuto').value.replace(/,/g, ''));
        const automationExpiryTime = BigInt(document.getElementById('expiryTimeAuto').value);
        const automationAuxData = [];
        
        const serializedTx = supraSdkClient.createSerializedAutomationRegistrationTxPayloadRawTxObject(
            new window.HexString(wizardState.walletAddress),
            senderSequenceNumber,
            wizardState.walletAddress,
            wizardState.selectedModule,
            wizardState.selectedFunction,
            typeArgs,
            bcsArgs,
            automationMaxGasAmount,
            automationGasPriceCap,
            automationFeeCap,
            automationExpiryTime,
            automationAuxData
        );
        
        // Convert to hex
        let txHex;
        if (window.Buffer && typeof window.Buffer.from === 'function') {
            txHex = window.Buffer.from(serializedTx).toString('hex');
        } else {
            const uint8Array = new Uint8Array(serializedTx);
            txHex = Array.from(uint8Array, byte => byte.toString(16).padStart(2, '0')).join('');
        }
        
        const txParams = {
            data: txHex,
            from: wizardState.walletAddress,
            chainId: chainIdResponse.chainId,
            options: { waitForTransaction: true }
        };
        
        showNotification('Please confirm in wallet...', 'info');
        
        const txHash = await wizardState.walletProvider.sendTransaction(txParams);
        
        showNotification('Transaction submitted!', 'success');
        
        const txResult = await wizardState.walletProvider.waitForTransactionWithResult({ hash: txHash });
        
        transactionStatus.style.display = 'block';
        
        if (txResult && txResult.status === 'Success') {
            updateFlowStage(4, 'completed', 'Success!');
            transactionStatus.className = 'transaction-status success';
            transactionStatus.innerHTML = `
                <div style="background: rgba(0, 255, 136, 0.1); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid rgba(0, 255, 136, 0.3);">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                        <div style="font-size: 2rem;">✅</div>
                        <div>
                            <div style="color: var(--success); font-weight: 700; font-size: 1.1rem;">Transaction Successful!</div>
                            <div style="color: var(--text-secondary); font-size: 0.9rem;">Your automation task has been registered</div>
                        </div>
                    </div>
                    <div style="font-family: 'JetBrains Mono', monospace; background: rgba(0, 255, 136, 0.1); padding: 1rem; border-radius: var(--radius-sm); word-break: break-all; font-size: 0.85rem;">
                        <strong>Transaction Hash:</strong><br>${txHash}
                    </div>
                    <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                        <button onclick="copyToClipboard('transactionStatus', this)" class="copy-btn">
                            <span class="copy-icon">📋</span> Copy Hash
                        </button>
                        <button onclick="refreshAutomatedTasks()" class="refresh-btn">
                            <span class="btn-icon">🔄</span> Refresh Tasks
                        </button>
                    </div>
                </div>
            `;
            showNotification('Automation transaction successful!', 'success');
        } else {
            throw new Error('Transaction failed');
        }
        
    } catch (error) {
        console.error('Transaction error:', error);
        updateFlowStage(4, 'error', 'Failed');
        
        transactionStatus.style.display = 'block';
        transactionStatus.className = 'transaction-status error';
        transactionStatus.innerHTML = `
            <div style="background: rgba(255, 107, 107, 0.1); padding: 1.5rem; border-radius: var(--radius-lg); border: 1px solid rgba(255, 107, 107, 0.3);">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    <div style="font-size: 2rem;">❌</div>
                    <div>
                        <div style="color: var(--error); font-weight: 700; font-size: 1.1rem;">Transaction Failed</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">Please try again</div>
                    </div>
                </div>
                <div style="background: rgba(255, 107, 107, 0.1); padding: 1rem; border-radius: var(--radius-sm); color: var(--error); font-size: 0.9rem;">
                    ${error.message}
                </div>
            </div>
        `;
        
        showNotification(`Transaction failed: ${error.message}`, 'error');
    } finally {
        signBtn.disabled = false;
        signBtn.innerHTML = '<span class="btn-text">Register from Starkey</span>';
    }
}

function generateCommand() {
    const deployStatus = document.getElementById('deployStatus');
    const generateBtn = document.getElementById('generateCommand');
    
    // Validate parameters
    const paramInputs = document.querySelectorAll('#functionParams .param-input');
    let allValid = true;
    const functionArgs = [];
    
    paramInputs.forEach(input => {
        const value = input.value.trim();
        const type = input.getAttribute('data-param-type');
        input.classList.remove('invalid');
        
        const validation = validateParameter(value, type);
        if (!validation.valid) {
            allValid = false;
            input.classList.add('invalid');
        } else if (value) {
            functionArgs.push(value);
        }
    });
    
    const typeArgInputs = document.querySelectorAll('.type-arg-input');
    const typeArgs = [];
    typeArgInputs.forEach(input => {
        const value = input.value.trim();
        if (!value) {
            allValid = false;
            input.classList.add('invalid');
        } else {
            typeArgs.push(value);
        }
    });
    
    if (!allValid) {
        showNotification('Please fix validation errors', 'error');
        return;
    }
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="loading-spinner"></div><span class="btn-text">Generating...</span>';
    
    const functionId = `${wizardState.walletAddress}::${wizardState.selectedModule}::${wizardState.selectedFunction}`;
    let cliCommand = `supra move automation register --task-max-gas-amount ${document.getElementById('maxGasAmount').value} --task-gas-price-cap ${document.getElementById('gasPriceCap').value} --task-expiry-time-secs ${document.getElementById('expiryTimeAuto').value} --task-automation-fee-cap ${document.getElementById('automationFeeAuto').value} --function-id "${functionId}" `;
    
    if (typeArgs.length > 0) {
        cliCommand += ` --type-args ${typeArgs.join(' ')} `;
    }
    if (functionArgs.length > 0) {
        cliCommand += ` --args ${functionArgs.join(' ')} `;
    }
    cliCommand += ` --rpc-url https://rpc-testnet.supra.com`;
    
    setTimeout(() => {
        deployStatus.style.display = 'block';
        deployStatus.className = 'deploy-status success';
        deployStatus.innerHTML = `
            <div style="background: rgba(53, 63, 74, 0.4); padding: 1rem; border-radius: var(--radius-sm); margin: 1rem 0; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">${cliCommand}</div>
        `;
        
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span class="btn-icon">📋</span><span class="btn-text">Generate CLI Command</span>';
        
        showNotification('CLI command generated!', 'success');
    }, 1500);
}

// ===== TASKS FUNCTIONS =====
async function fetchAutomatedTasks(walletAddress) {
    try {
        document.getElementById('tasksLoading').style.display = 'flex';
        document.getElementById('automatedTasksList').innerHTML = '';
        document.getElementById('noTasksState').style.display = 'none';
        
        const response = await fetch(`https://rpc-testnet.supra.com/rpc/v3/accounts/${walletAddress}/automated_transactions`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        let tasks = [];
        
        if (data && data.data && Array.isArray(data.data)) {
            tasks = data.data;
        } else if (Array.isArray(data)) {
            tasks = data;
        }
        
        document.getElementById('tasksLoading').style.display = 'none';
        
        if (tasks.length > 0) {
            displayAutomatedTasks(tasks);
            showNotification(`Found ${tasks.length} automated tasks!`, 'success');
        } else {
            document.getElementById('noTasksState').style.display = 'block';
        }
    } catch (error) {
        console.error('Error fetching tasks:', error);
        document.getElementById('tasksLoading').style.display = 'none';
        document.getElementById('noTasksState').style.display = 'block';
    }
}

function displayAutomatedTasks(tasks) {
    const tasksList = document.getElementById('automatedTasksList');
    tasksList.innerHTML = '';
    
    tasks.forEach((task, index) => {
        const taskCard = document.createElement('div');
        taskCard.className = 'task-card';
        
        const taskId = task.hash || `task_${index}`;
        const status = task.status || 'Unknown';
        
        let statusColor = 'var(--text-secondary)';
        if (status.toLowerCase().includes('success')) statusColor = 'var(--success)';
        else if (status.toLowerCase().includes('failed')) statusColor = 'var(--error)';
        else if (status.toLowerCase().includes('active')) statusColor = 'var(--info)';
        
        taskCard.innerHTML = `
            <div class="task-header">
                <div class="task-id">${taskId.slice(0, 10)}...${taskId.slice(-10)}</div>
                <div class="task-status" style="color: ${statusColor};">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></span>
                    ${status}
                </div>
            </div>
            <div class="task-details">
                <div class="task-detail">
                    <span class="detail-label">Gas Used:</span>
                    <span class="detail-value">${task.output?.Move?.gas_used || 'N/A'}</span>
                </div>
                <div class="task-detail">
                    <span class="detail-label">Created:</span>
                    <span class="detail-value">${new Date(task.block_header?.timestamp?.utc_date_time || Date.now()).toLocaleDateString()}</span>
                </div>
            </div>
        `;
        
        tasksList.appendChild(taskCard);
    });
}

function refreshAutomatedTasks() {
    if (wizardState.walletAddress) {
        fetchAutomatedTasks(wizardState.walletAddress);
        showNotification('Refreshing tasks...', 'info');
    }
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: ${type === 'success' ? 'rgba(0, 255, 136, 0.1)' : type === 'error' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(139, 92, 246, 0.1)'};
        border: 1px solid ${type === 'success' ? 'rgba(0, 255, 136, 0.3)' : type === 'error' ? 'rgba(255, 107, 107, 0.3)' : 'rgba(139, 92, 246, 0.3)'};
        color: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--purple)'};
        padding: 1rem 1.5rem;
        border-radius: var(--radius-lg);
        backdrop-filter: blur(20px);
        z-index: 1000;
        max-width: 350px;
        animation: slideIn 0.3s ease;
        font-weight: 600;
        box-shadow: var(--shadow-lg);
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.4s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 400);
    }, 4000);
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('connectWallet').addEventListener('click', connectStarkeyWallet);
    document.getElementById('disconnectWallet').addEventListener('click', disconnectWallet);
    document.getElementById('useManualAddress').addEventListener('click', useManualAddress);
    document.getElementById('generateCommand').addEventListener('click', generateCommand);
    document.getElementById('signTransaction').addEventListener('click', signAutomationTransaction);
    document.getElementById('maxGasAmount').addEventListener('change', updateDisplay);
    document.getElementById('refreshTasks').addEventListener('click', refreshAutomatedTasks);
    
    init();
});

window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
    if (countdownInterval) clearInterval(countdownInterval);
});
// ===== DURATION SLIDER & COST ESTIMATION =====
function setupDurationSlider() {
    const slider = document.getElementById('durationSlider');
    const durationValue = document.getElementById('durationValue');
    const estimatedCost = document.getElementById('estimatedCost');
    const estimatedTxs = document.getElementById('estimatedTxs');
    const expiryTimeInput = document.getElementById('expiryTimeAuto');
    
    if (!slider) return;
    
    function updateDurationDisplay() {
        const days = parseInt(slider.value);
        
        // Update duration display
        if (durationValue) {
            durationValue.textContent = `${days} day${days > 1 ? 's' : ''}`;
        }
        
        // Calculate estimates
        const txsPerDay = 288; // 1 tx per 5 minutes = 288 per day
        const costPerTx = 0.5; // Estimated SUPRA per tx
        
        const totalTxs = txsPerDay * days;
        const totalCost = totalTxs * costPerTx;
        
        // Update cost estimates
        if (estimatedCost) {
            estimatedCost.textContent = `${totalCost.toFixed(2)} SUPRA`;
        }
        
        if (estimatedTxs) {
            estimatedTxs.textContent = `~${totalTxs.toLocaleString()} txs`;
        }
        
        // Update expiry time (convert days to seconds)
        if (expiryTimeInput) {
            const now = Math.floor(Date.now() / 1000);
            const expirySeconds = days * 24 * 60 * 60;
            expiryTimeInput.value = now + expirySeconds;
        }
    }
    
    slider.addEventListener('input', updateDurationDisplay);
    updateDurationDisplay(); // Initial update
}

// ===== COLLAPSIBLE SETTINGS =====
function setupAdvancedSettings() {
    const toggle = document.getElementById('settingsToggle');
    const content = document.getElementById('settingsContent');
    
    if (!toggle || !content) return;
    
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        content.classList.toggle('show');
    });
}

// Call these functions on init
document.addEventListener('DOMContentLoaded', () => {
    setupDurationSlider();
    setupAdvancedSettings();
});

// Expose functions for marketplace integration
window.navigateToSection = navigateToSection;
window.enableStep = enableStep;
window.selectFunction = selectFunction;

// Setup collection search with Crystara API
function setupCollectionSearch(input) {
    const wrapper = input.closest('.collection-search-wrapper');
    if (!wrapper) return;
    
    const dropdown = wrapper.querySelector('.collection-dropdown');
    const loading = wrapper.querySelector('.collection-loading');
    
    let searchTimeout;
    let collections = [];
    
    // Load initial collections
    (async () => {
        loading.style.display = 'block';
        if (window.fetchCrystaraCollections) {
            collections = await window.fetchCrystaraCollections();
            renderCollectionDropdown(collections);
        }
        loading.style.display = 'none';
    })();
    
    // Render dropdown
    function renderCollectionDropdown(cols) {
        if (cols.length === 0) {
            dropdown.innerHTML = '<div class="collection-item no-results">No collections found</div>';
        } else {
            dropdown.innerHTML = cols.map(col => `
                <div class="collection-item" data-name="${col.name}" data-creator="${col.creator}">
                    <div class="collection-name">${col.name}</div>
                    <div class="collection-details">
                        <span>Creator: ${col.creator.slice(0, 6)}...${col.creator.slice(-4)}</span>
                    </div>
                </div>
            `).join('');
            
            // Add click handlers
            dropdown.querySelectorAll('.collection-item:not(.no-results)').forEach(item => {
                item.addEventListener('click', () => {
                    const name = item.getAttribute('data-name');
                    input.value = name;
                    input.setAttribute('data-selected-creator', item.getAttribute('data-creator'));
                    dropdown.style.display = 'none';
                });
            });
        }
        dropdown.style.display = 'block';
    }
    
    // Search on input
    input.addEventListener('input', async (e) => {
        clearTimeout(searchTimeout);
        const searchText = e.target.value;
        
        if (searchText.length < 2) {
            renderCollectionDropdown(collections);
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            loading.style.display = 'block';
            dropdown.style.display = 'none';
            
            if (window.fetchCrystaraCollections) {
                const results = await window.fetchCrystaraCollections(searchText);
                renderCollectionDropdown(results);
            }
            
            loading.style.display = 'none';
        }, 300);
    });
    
    // Show dropdown on focus
    input.addEventListener('focus', () => {
        if (dropdown.innerHTML) {
            dropdown.style.display = 'block';
        }
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}