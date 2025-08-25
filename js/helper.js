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

function init() {
    console.log('🚀 Initializing Supra Automation Assist...');
    console.log('Environment:', {
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        isProduction: window.location.hostname.includes('vercel') || window.location.hostname.includes('.app'),
        timestamp: new Date().toISOString()
    });
    
    initializeSupraSDK();
    createFloatingLetters();
    createParticleSystem();
    updateDisplay();
    updateInterval = setInterval(updateDisplay, 5000);
    countdownInterval = setInterval(updateCountdown, 1000);
    enableStep(1);
}

async function initializeSupraSDK() {
    try {
        // Check for SDK loading error first
        if (window.supraSDKError) {
            throw new Error('SDK failed to load from CDN');
        }
        
        // Wait for SDK to be loaded with timeout
        let attempts = 0;
        console.log('⏳ Waiting for Supra SDK to load...');
        while (!window.SupraClient && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (!window.SupraClient) {
            throw new Error('Supra SDK not available after waiting');
        }
        
        // Initialize Supra SDK client
        supraSdkClient = new window.SupraClient('https://rpc-testnet.supra.com');
        console.log('✅ Supra SDK initialized successfully');
        
        // Test SDK functionality
        const testResponse = await fetch('https://rpc-testnet.supra.com/rpc/v2/accounts/0x1');
        if (!testResponse.ok) {
            throw new Error('RPC endpoint not accessible');
        }
        console.log('✅ RPC endpoint verified');
        
        // Verify BCS and HexString are available
        if (!window.BCS || !window.HexString) {
            throw new Error('BCS or HexString not available');
        }
        console.log('✅ BCS and HexString modules verified');
        
    } catch (error) {
        console.error('❌ Failed to initialize Supra SDK:', error);
        showNotification('SDK initialization failed - transaction signing unavailable', 'error');
        
        // Disable the sign transaction button
        const signBtn = document.getElementById('signTransaction');
        if (signBtn) {
            signBtn.disabled = true;
            signBtn.innerHTML = '<div class="btn-icon">⚠️</div><div class="btn-text">SDK Not Available</div>';
            signBtn.title = 'Supra SDK failed to load - use CLI command instead';
        }
    }
}

function createFloatingLetters() {
    const container = document.querySelector('.floating-letters');
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
            document.getElementById('networkStatus').style.color = '#00ff88';
            return true;
        } else {
            throw new Error('Invalid response format');
        }
    } catch (error) {
        console.error('Error fetching epoch data:', error);
        document.getElementById('networkStatus').textContent = 'Error';
        document.getElementById('networkStatus').style.color = '#ff6b6b';
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
        button.textContent = 'Copied!';
        button.classList.add('success');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('success');
        }, 2000);
    } catch (err) {
        console.error('Failed to copy:', err);
        button.textContent = 'Error';
        setTimeout(() => {
            button.textContent = 'Copy';
        }, 2000);
    }
}

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
        const provider = getStarkeyProvider();
        
        if (!provider) {
            showNotification('Starkey wallet not found. Redirecting to installation...', 'info');
            window.open('https://starkey.app/', '_blank');
            throw new Error('Starkey wallet not found. Please install Starkey extension.');
        } 
        
        showNotification('Connecting to Starkey wallet...', 'info');
        const accounts = await provider.connect();
        
        if (accounts && accounts.length > 0) {
            const address = accounts[0];
            
            // 🔍 ADDED: Verify account exists on network in production
            console.log('🔍 Verifying account exists on network...', address);
            try {
                const accountCheck = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${address}`);
                const accountData = await accountCheck.json();
                console.log('Account verification response:', accountData);
                
                if (!accountData || accountData.error) {
                    throw new Error(`Account ${address} does not exist on Supra testnet. Please ensure your wallet is connected to the correct network.`);
                }
                console.log('✅ Account verified on network');
            } catch (accountError) {
                console.error('❌ Account verification failed:', accountError);
                showNotification(`Account verification failed: ${accountError.message}`, 'error');
                throw accountError;
            }
            
            wizardState.walletConnected = true;
            wizardState.walletAddress = address;
            wizardState.walletProvider = provider;
            document.getElementById('walletAddress').textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
            document.getElementById('walletStatus').style.display = 'block';
            document.getElementById('connectWallet').style.display = 'none';
            document.getElementById('manualAddressGroup').style.display = 'none';
            document.getElementById('autoScanStatus').style.display = 'block';
            document.getElementById('autoScanStatus').innerHTML = '🔍 Scanning for modules at your wallet address...';
            
            setTimeout(() => {
                autoScanWalletModules(address);
            }, 1000);
            
            showNotification('Wallet connected! Scanning for your modules...', 'success');
            
            provider.on('accountChanged', (newAccounts) => {
                if (newAccounts.length > 0) {
                    wizardState.walletAddress = newAccounts[0];
                    document.getElementById('walletAddress').textContent = `${newAccounts[0].slice(0, 6)}...${newAccounts[0].slice(-4)}`;
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
        
        // Demo mode fallback
        setTimeout(() => {
            wizardState.walletConnected = true;
            wizardState.walletAddress = '0x1c5acf62be507c27a7788a661b546224d806246765ff2695efece60194c6df05';
            
            document.getElementById('walletAddress').textContent = '0x1c5a...6df05 (Demo Mode)';
            document.getElementById('walletStatus').style.display = 'block';
            document.getElementById('connectWallet').style.display = 'none';
            document.getElementById('manualAddressGroup').style.display = 'none';
            document.getElementById('autoScanStatus').style.display = 'block';
            document.getElementById('autoScanStatus').innerHTML = '🔍 Demo mode - loading example modules...';
            
            setTimeout(() => {
                autoScanWalletModules(wizardState.walletAddress);
            }, 1000);
            
            showNotification('Demo mode activated - Using example wallet with modules', 'info');
        }, 2000);
        
        return false;
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
    
    wizardState.walletConnected = true;
    wizardState.walletAddress = manualAddress;
    document.getElementById('walletAddress').textContent = `${manualAddress.slice(0, 6)}...${manualAddress.slice(-4)} (Manual)`;
    document.getElementById('walletStatus').style.display = 'block';
    document.getElementById('connectWallet').style.display = 'none';
    document.getElementById('manualAddressGroup').style.display = 'none';
    document.getElementById('autoScanStatus').style.display = 'block';
    document.getElementById('autoScanStatus').innerHTML = '🔍 Scanning for modules at specified address...';
    
    setTimeout(() => {
        autoScanWalletModules(manualAddress);
    }, 1000);
    
    showNotification('Manual address set! Scanning for modules...', 'success');
}

async function autoScanWalletModules(walletAddress) {
    try {
        const moduleCountInput = document.getElementById('moduleCount');
        const moduleCount = moduleCountInput ? parseInt(moduleCountInput.value) || 20 : 20;
        
        document.getElementById('autoScanStatus').innerHTML = `🔍 Fetching ${moduleCount} modules from address...`;
        
        let modules = [];
        let apiUsed = '';
        
        try {
            const responseV3 = await fetch(`https://rpc-testnet.supra.com/rpc/v3/accounts/${walletAddress}/modules?count=${moduleCount}`);
            if (responseV3.ok) {
                const dataV3 = await responseV3.json();
                console.log('v3 API response:', dataV3);
                modules = parseModulesFromResponse(dataV3, 'v3');
                apiUsed = 'v3';
                console.log(`Successfully fetched ${modules.length} modules from v3 API with count=${moduleCount}`);
            } else {
                console.log(`v3 API failed with status: ${responseV3.status}`);
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
                    console.log('v2 API response:', dataV2);
                    modules = parseModulesFromResponse(dataV2, 'v2');
                    apiUsed = 'v2';
                    console.log(`Successfully fetched ${modules.length} modules from v2 API (fallback)`);
                } else {
                    console.log(`v2 API failed with status: ${responseV2.status}`);
                }
            } catch (error) {
                console.log('v2 API error:', error);
                throw new Error('Both v2 and v3 APIs failed');
            }
        }
        
        console.log(`Total modules fetched: ${modules.length}`);
        const validModules = modules.filter(module => {
            const isValid = module.name && 
                           module.name.trim() !== '' &&
                           module.name !== 'Unknown' &&
                           module.name !== 'cursor' &&
                           module.name !== 'modules';
            
            if (!isValid) {
                console.log(`Filtering out invalid module:`, module);
            }
            return isValid;
        });
        
        console.log(`After filtering: ${validModules.length} valid modules`);
        console.log('Valid module names:', validModules.map(m => m.name));
        
        if (validModules.length > 0) {
            document.getElementById('autoScanStatus').innerHTML = `✅ Found ${validModules.length} modules using ${apiUsed} API! (Requested: ${moduleCount})`;
            displayModules(validModules, walletAddress);
            enableStep(2);  
            try {
                await fetchAutomatedTasks(walletAddress);
            } catch (error) {
                console.log('Could not fetch automated tasks:', error);
            }
            showNotification(`Found ${validModules.length} modules at the address! (Requested: ${moduleCount})`, 'success');
        } else {
            throw new Error(`No modules found at address (Requested: ${moduleCount})`);
        }
        
    } catch (error) {
        console.error('Auto-scan error:', error);
        
        const moduleCountInput = document.getElementById('moduleCount');
        const moduleCount = moduleCountInput ? parseInt(moduleCountInput.value) || 20 : 20;
        
        document.getElementById('autoScanStatus').innerHTML = `⚠️ API scan failed (requested ${moduleCount}) - loading demo modules...`;
        
        const demoModules = [
            { name: 'auto_incr', bytecode: 'Available' },
            { name: 'auto_counter', bytecode: 'Available' },
            { name: 'auto_topup', bytecode: 'Available' },
            { name: 'dice_roll', bytecode: 'Available' },
            { name: 'HelloWorld', bytecode: 'Available' },
            { name: 'SupraAI', bytecode: 'Available' },
            { name: 'Counter', bytecode: 'Available' },
            { name: 'auto_faucet', bytecode: 'Available' },
            { name: 'SpinTheWheel', bytecode: 'Available' },
            { name: 'auto_count', bytecode: 'Available' },
            { name: 'TokenMinter', bytecode: 'Available' },
            { name: 'NFTMarketplace', bytecode: 'Available' },
            { name: 'DeFiProtocol', bytecode: 'Available' },
            { name: 'GameLogic', bytecode: 'Available' },
            { name: 'OracleFeeds', bytecode: 'Available' },
            { name: 'AutoStaking', bytecode: 'Available' },
            { name: 'PriceTracker', bytecode: 'Available' },
            { name: 'YieldFarming', bytecode: 'Available' },
            { name: 'LiquidityPool', bytecode: 'Available' },
            { name: 'CrossChain', bytecode: 'Available' },
            { name: 'AutoSwap', bytecode: 'Available' },
            { name: 'LendingPool', bytecode: 'Available' },
            { name: 'VotingDAO', bytecode: 'Available' },
            { name: 'MultiSig', bytecode: 'Available' },
            { name: 'TimeLock', bytecode: 'Available' },
            { name: 'RewardPool', bytecode: 'Available' },
            { name: 'LaunchPad', bytecode: 'Available' },
            { name: 'AirdropManager', bytecode: 'Available' },
            { name: 'VestingContract', bytecode: 'Available' },
            { name: 'BridgeContract', bytecode: 'Available' },
            { name: 'FlashLoan', bytecode: 'Available' },
            { name: 'Insurance', bytecode: 'Available' },
            { name: 'Derivatives', bytecode: 'Available' },
            { name: 'Prediction', bytecode: 'Available' },
            { name: 'Lottery', bytecode: 'Available' },
            { name: 'Escrow', bytecode: 'Available' },
            { name: 'Subscription', bytecode: 'Available' },
            { name: 'Referral', bytecode: 'Available' },
            { name: 'Analytics', bytecode: 'Available' },
            { name: 'Monitoring', bytecode: 'Available' }
        ];

        const limitedDemoModules = demoModules.slice(0, Math.min(moduleCount, demoModules.length));        
        displayModules(limitedDemoModules, walletAddress);
        enableStep(2);   
        try {
            await fetchAutomatedTasks(walletAddress);
        } catch (error) {
            console.log('Could not fetch automated tasks in demo mode:', error);
        }
        showNotification(`Demo modules loaded (showing ${limitedDemoModules.length} of ${demoModules.length} available)`, 'info');
    }
}

function parseModulesFromResponse(data, apiVersion) {
    let modules = [];
    
    console.log(`Parsing ${apiVersion} API response. Data type:`, typeof data, 'Length:', Array.isArray(data) ? data.length : 'Not an array');
    console.log('Raw data structure:', data);
    
    if (Array.isArray(data)) {
        console.log(`Direct array found with ${data.length} items`);
        modules = data.map((module, index) => {
            const parsed = parseModuleItem(module, index);
            console.log(`Module ${index + 1}: ${parsed.name}`, parsed);
            return parsed;
        });
    } else if (data && data.data && Array.isArray(data.data)) {
        console.log(`Data.data array found with ${data.data.length} items`);
        modules = data.data.map((module, index) => {
            const parsed = parseModuleItem(module, index);
            console.log(`Module ${index + 1}: ${parsed.name}`, parsed);
            return parsed;
        });
    } else if (data && data.modules && Array.isArray(data.modules)) {
        console.log(`Data.modules array found with ${data.modules.length} items`);
        modules = data.modules.map((module, index) => {
            const parsed = parseModuleItem(module, index);
            console.log(`Module ${index + 1}: ${parsed.name}`, parsed);
            return parsed;
        });
    } else {
        console.log('Unexpected API response format:', data);
    }
    
    console.log(`Total modules parsed: ${modules.length}`);
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
}

async function fetchAutomatedTasks(walletAddress) {
    try {
        document.getElementById('tasksLoading').style.display = 'flex';
        document.getElementById('automatedTasksList').innerHTML = '';
        document.getElementById('noTasksState').style.display = 'none';        
        const response = await fetch(`https://rpc-testnet.supra.com/rpc/v3/accounts/${walletAddress}/automated_transactions`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }   
        const data = await response.json();
        console.log('Automated tasks API response:', data);  
        let tasks = [];
        if (data && data.data && Array.isArray(data.data)) {
            tasks = data.data;
        } else if (data && Array.isArray(data)) {
            tasks = data;
        } else if (data && data.automated_transactions && Array.isArray(data.automated_transactions)) {
            tasks = data.automated_transactions;
        } else if (data && data.transactions && Array.isArray(data.transactions)) {
            tasks = data.transactions;
        }
        document.getElementById('tasksLoading').style.display = 'none';
        if (tasks.length > 0) {
            displayAutomatedTasks(tasks);
            showNotification(`Found ${tasks.length} automated tasks!`, 'success');
        } else {
            document.getElementById('noTasksState').style.display = 'block';
            showNotification('No automated tasks found for this address', 'info');
        }    
    } catch (error) {
        console.error('Error fetching automated tasks:', error);
        document.getElementById('tasksLoading').style.display = 'none';
        document.getElementById('noTasksState').style.display = 'block';
        document.getElementById('noTasksState').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <div class="empty-title">Failed to Load Tasks</div>
                <div class="empty-desc">Could not fetch automated tasks. ${error.message}</div>
            </div>
        `;        
        showNotification('Failed to load automated tasks', 'error');
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
        let functionId = 'Unknown';
        if (task.payload && task.payload.Move && task.payload.Move.function) {
            functionId = task.payload.Move.function;
            const functionParts = functionId.split('::');
            if (functionParts.length >= 3) {
                functionId = functionParts[functionParts.length - 1];
            }
        }
                const gasAmount = (task.header && task.header.max_gas_amount) || 'Unknown';
         const gasUsed = (task.output && task.output.Move && task.output.Move.gas_used) || 'Unknown';
                let createdDisplay = 'Unknown';
        if (task.block_header && task.block_header.timestamp) {
            try {
                let timestamp;
                if (task.block_header.timestamp.utc_date_time) {
                    createdDisplay = new Date(task.block_header.timestamp.utc_date_time).toLocaleString();
                } else if (task.block_header.timestamp.microseconds_since_unix_epoch) {
                    timestamp = parseInt(task.block_header.timestamp.microseconds_since_unix_epoch) / 1000;
                    createdDisplay = new Date(timestamp).toLocaleString();
                }
            } catch (e) {
                createdDisplay = task.block_header.timestamp.utc_date_time || 'Unknown';
            }
        }
        
        let expiryDisplay = 'Unknown';
        if (task.header && task.header.expiration_timestamp) {
            try {
                if (task.header.expiration_timestamp.utc_date_time) {
                    expiryDisplay = new Date(task.header.expiration_timestamp.utc_date_time).toLocaleString();
                } else if (task.header.expiration_timestamp.microseconds_since_unix_epoch) {
                    const timestamp = parseInt(task.header.expiration_timestamp.microseconds_since_unix_epoch) / 1000;
                    expiryDisplay = new Date(timestamp).toLocaleString();
                }
            } catch (e) {
                expiryDisplay = task.header.expiration_timestamp.utc_date_time || 'Unknown';
            }
        }

        let statusColor = '#9EABB5';
        if (status.toLowerCase().includes('active') || status.toLowerCase().includes('running')) {
            statusColor = '#00ff88';
        } else if (status.toLowerCase().includes('completed') || status.toLowerCase().includes('success')) {
            statusColor = '#00ff88';
        } else if (status.toLowerCase().includes('failed') || status.toLowerCase().includes('error')) {
            statusColor = '#ff6b6b';
        } else if (status.toLowerCase().includes('expired')) {
            statusColor = '#ffaa00';
        }
        
        taskCard.innerHTML = `
            <div class="task-header">
                <div class="task-id">Task: ${taskId.slice(0, 8)}...${taskId.slice(-8)}</div>
                <div class="task-status" style="color: ${statusColor};">
                    <span class="status-dot" style="background: ${statusColor};"></span>
                    ${status}
                </div>
            </div>
            <div class="task-details">
                <div class="task-detail">
                    <span class="detail-label">Function:</span>
                    <span class="detail-value" title="${task.payload && task.payload.Move && task.payload.Move.function}">${functionId}</span>
                </div>
                <div class="task-detail">
                    <span class="detail-label">Max Gas:</span>
                    <span class="detail-value">${gasAmount}</span>
                </div>
                <div class="task-detail">
                    <span class="detail-label">Gas Used:</span>
                    <span class="detail-value">${gasUsed}</span>
                </div>
                <div class="task-detail">
                    <span class="detail-label">Created:</span>
                    <span class="detail-value">${createdDisplay}</span>
                </div>
                <div class="task-detail">
                    <span class="detail-label">Expires:</span>
                    <span class="detail-value">${expiryDisplay}</span>
                </div>
            </div>
        `;
        
        tasksList.appendChild(taskCard);
    });
}

async function selectModule(moduleName, baseAddress, event) {
    document.querySelectorAll('.module-card').forEach(card => card.classList.remove('selected'));
    event.currentTarget.classList.add('selected');    
    wizardState.selectedModule = moduleName;
    await fetchAutomatedTasks(baseAddress);
    enableStep(3);    
    document.getElementById('abiLoading').style.display = 'flex';
    try {
        let response;
        let data;        
        try {
            response = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${baseAddress}/modules/${moduleName}`);
            if (response.ok) {
                data = await response.json();
                console.log('Module ABI response:', data);
            }
        } catch (err) {
            console.log('Standard endpoint failed, trying alternative...');
        }        
        if (!data || !response?.ok) {
            console.log('Trying to get module from all modules list...');
            response = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${baseAddress}/modules`);
            if (response.ok) {
                const allModules = await response.json();
                console.log('All modules for finding specific:', allModules);
                
                if (Array.isArray(allModules)) {
                    data = allModules.find(module => {
                        return module.name === moduleName || 
                               (module.abi && module.abi.name === moduleName) ||
                               (typeof module === 'object' && Object.keys(module).includes(moduleName));
                    });
                }
            }
        }

        let moduleABI = null;        
        if (data) {
            if (data.abi) {
                moduleABI = data.abi;
            } else if (data.module && data.module.abi) {
                moduleABI = data.module.abi;
            } else if (data.exposed_functions) {
                moduleABI = data;
            } else if (typeof data === 'object') {
                moduleABI = data;
            }
        }                
        if (moduleABI) {
            wizardState.moduleABI = moduleABI;
            const entryFunctions = extractEntryFunctions(moduleABI);
            if (entryFunctions.length > 0) {
                displayFunctions(entryFunctions);
                showNotification(`Found ${entryFunctions.length} entry functions!`, 'success');
                return;  
            } else {
                console.log('No entry functions found, showing demo functions');
            }
        } else {
            console.log('No ABI found, showing demo functions');
        }
        throw new Error('Could not load real functions from module');
    } catch (error) {
        console.error('ABI fetch error:', error);
        let demoFunctions = [];
        switch(moduleName.toLowerCase()) {
            case 'auto_incr':
            case 'auto_counter':
            case 'counter':
                demoFunctions = [
                    { name: 'auto_increment', params: ['&signer'], is_entry: true, generic_type_params: [] },
                    { name: 'manual_increment', params: ['&signer'], is_entry: true, generic_type_params: [] },
                    { name: 'reset_counter', params: ['&signer'], is_entry: true, generic_type_params: [] }
                ];
                break;
            case 'auto_topup':
                demoFunctions = [
                    { 
                        name: 'auto_topup', 
                        params: ['&signer', 'address', 'u64', 'u64'], 
                        is_entry: true, 
                        generic_type_params: [] 
                    },
                    { 
                        name: 'auto_withdraw', 
                        params: ['&signer', 'address', 'u64', 'u64'], 
                        is_entry: true, 
                        generic_type_params: [] 
                    }
                ];
                break;
            case 'dice_roll':
                demoFunctions = [
                    { 
                        name: 'roll_dice', 
                        params: ['&signer', 'u256'], 
                        is_entry: true, 
                        generic_type_params: [] 
                    }
                ];
                break;
            default:
                demoFunctions = [
                    { name: 'execute', params: ['&signer'], is_entry: true, generic_type_params: [] },
                    { name: 'process', params: ['&signer', 'u64'], is_entry: true, generic_type_params: [] }
                ];
        }
        displayFunctions(demoFunctions);
        showNotification(`Loaded ${demoFunctions.length} demo functions for ${moduleName}`, 'info');
    } finally {
        document.getElementById('abiLoading').style.display = 'none';
    }
}

// Only entry functions based on Nolans feedback
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
            .filter(func => {
                return func.is_entry === true;
            })
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
}

function selectFunction(func, event) {
    document.querySelectorAll('.function-card').forEach(card => card.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    wizardState.selectedFunction = func.name;
    wizardState.functionParams = func.params;
    wizardState.hasGenerics = func.generic_type_params && func.generic_type_params.length > 0;
    
    generateParameterInputs(func.params, func.generic_type_params || []);
    updateAutomationParams();
    enableStep(4);
}

function generateParameterInputs(params, genericParams = []) {
    const container = document.getElementById('functionParams');
    container.innerHTML = '';
    const nonSignerParams = params.filter(param => param !== '&signer');
    nonSignerParams.forEach((paramType, index) => {
        const paramRow = document.createElement('div');
        paramRow.className = 'param-row';      
        const inputType = getInputTypeForMoveType(paramType);
        const placeholder = getPlaceholderForType(paramType);
        const hint = getHintForType(paramType);       
        paramRow.innerHTML = `
            <label>
                Parameter ${index + 1} (${paramType})
                <div class="hint-icon">?
                    <div class="hint-tooltip">${hint}</div>
                </div>
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
    });
    if (genericParams.length > 0) {
        const typeArgsSection = document.createElement('div');
        typeArgsSection.className = 'type-args-section';
        typeArgsSection.innerHTML = `
            <h5>Type Arguments (Generics)
                <div class="hint-icon">?
                    <div class="hint-tooltip">Specify the concrete types for generic parameters (e.g., 0x1::aptos_coin::AptosCoin)</div>
                </div>
            </h5>
        `;  
        genericParams.forEach((_, index) => {
            const typeArgInput = document.createElement('input');
            typeArgInput.type = 'text';
            typeArgInput.className = 'type-arg-input';
            typeArgInput.placeholder = `Type argument ${index + 1} (e.g., 0x1::coin::CoinType)`;
            typeArgInput.dataset.typeArgIndex = index;
            typeArgInput.required = true;
            typeArgsSection.appendChild(typeArgInput);
        });   
        container.appendChild(typeArgsSection);
    }
}

function getInputTypeForMoveType(moveType) {
    if (moveType.includes('u8') || moveType.includes('u16') || 
        moveType.includes('u32') || moveType.includes('u64') || 
        moveType.includes('u128') || moveType.includes('u256')) {
        return 'number';
    }
    if (moveType === 'bool') {
        return 'checkbox';
    }
    return 'text';
}

function getPlaceholderForType(moveType) {
    if (moveType === 'address') {
        return '0x1234...';
    }
    if (moveType.includes('u')) {
        return 'Enter a positive number';
    }
    if (moveType === 'bool') {
        return 'true/false';
    }
    if (moveType.includes('vector')) {
        return 'Enter comma-separated values';
    }
    return `Enter ${moveType} value`;
}

function getHintForType(moveType) {
    const hints = {
        'address': 'A 32-byte address starting with 0x (66 characters total)',
        'u8': 'Unsigned 8-bit integer (0 to 255)',
        'u16': 'Unsigned 16-bit integer (0 to 65,535)',
        'u32': 'Unsigned 32-bit integer (0 to 4,294,967,295)',
        'u64': 'Unsigned 64-bit integer (0 to 18,446,744,073,709,551,615)',
        'u128': 'Unsigned 128-bit integer (very large positive number)',
        'u256': 'Unsigned 256-bit integer (extremely large positive number)',
        'bool': 'Boolean value: true or false',
        'vector<u8>': 'Array of bytes, often used for strings'
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
        if (type === 'u8' && num > 255) {
            return { valid: false, error: 'Value must be between 0 and 255' };
        }
        if (type === 'u16' && num > 65535) {
            return { valid: false, error: 'Value must be between 0 and 65,535' };
        }
        if (type === 'u32' && num > 4294967295) {
            return { valid: false, error: 'Value must be between 0 and 4,294,967,295' };
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
    generateDeploymentSummary();
    enableStep(5); 
}

function generateDeploymentSummary() {
    const summary = document.getElementById('deploymentSummary');
    summary.innerHTML = `
        <div class="summary-item">
            <div class="summary-label">Address</div>
            <div class="summary-value">${wizardState.walletAddress.slice(0, 10)}...${wizardState.walletAddress.slice(-8)}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Module</div>
            <div class="summary-value">${wizardState.selectedModule}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Function</div>
            <div class="summary-value">${wizardState.selectedFunction}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Max Gas</div>
            <div class="summary-value">${document.getElementById('maxGasAmount').value}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Gas Price Cap</div>
            <div class="summary-value">${document.getElementById('gasPriceCap').value}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">Expiry Time</div>
            <div class="summary-value">${document.getElementById('expiryTimeAuto').value}</div>
        </div>
    `;
}

// Convert Move parameter to BCS serialized format
function convertParameterToBCS(value, type) {
    if (!window.BCS) {
        throw new Error('BCS module not loaded');
    }
    
    try {
        if (type === 'address') {
            return new window.HexString(value).toUint8Array();
        } else if (type.includes('u8')) {
            return window.BCS.bcsSerializeUint8(parseInt(value));
        } else if (type.includes('u16')) {
            return window.BCS.bcsSerializeUint16(parseInt(value));
        } else if (type.includes('u32')) {
            return window.BCS.bcsSerializeUint32(parseInt(value));
        } else if (type.includes('u64')) {
            return window.BCS.bcsSerializeUint64(BigInt(value));
        } else if (type.includes('u128')) {
            return window.BCS.bcsSerializeUint128(BigInt(value));
        } else if (type.includes('u256')) {
            return window.BCS.bcsSerializeUint256(BigInt(value));
        } else if (type === 'bool') {
            return window.BCS.bcsSerializeBool(value === 'true');
        } else if (type.includes('vector<u8>')) {
            // Handle string as vector<u8>
            return window.BCS.bcsSerializeStr(value);
        } else {
            // For other types, try to serialize as string
            return window.BCS.bcsSerializeStr(value);
        }
    } catch (error) {
        console.error(`Error converting parameter ${value} of type ${type}:`, error);
        throw error;
    }
}

// Get account sequence number
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
        return BigInt(0); // Fallback to 0
    }
}

// Sign and submit automation transaction
async function signAutomationTransaction() {
    const signBtn = document.getElementById('signTransaction');
    const transactionStatus = document.getElementById('transactionStatus');
    
    try {
        signBtn.disabled = true;
        signBtn.innerHTML = '<div class="loading-spinner"></div><div class="btn-text">Creating Transaction...</div>';
        
        // Validate all parameters first
        const paramInputs = document.querySelectorAll('#functionParams .param-input');
        let allValid = true;
        const functionArgs = [];
        const functionTypes = [];
        
        paramInputs.forEach(input => {
            const value = input.value.trim();
            const type = input.getAttribute('data-param-type');
            input.classList.remove('invalid');
            const existingError = input.parentNode.querySelector('.param-error');
            if (existingError) existingError.remove();
            
            const validation = validateParameter(value, type);
            if (!validation.valid) {
                allValid = false;
                input.classList.add('invalid');
                const errorSpan = document.createElement('span');
                errorSpan.className = 'param-error';
                errorSpan.textContent = validation.error;
                input.parentNode.appendChild(errorSpan);
            } else if (value) {
                functionArgs.push(value);
                functionTypes.push(type);
            }
        });
        
        // Validate type arguments
        const typeArgInputs = document.querySelectorAll('.type-arg-input');
        const typeArgs = [];
        typeArgInputs.forEach(input => {
            const value = input.value.trim();
            if (!value) {
                allValid = false;
                input.classList.add('invalid');
            } else {
                typeArgs.push(value);
                input.classList.remove('invalid');
            }
        });
        
        if (!allValid) {
            throw new Error('Please fix validation errors before signing transaction');
        }
        
        // Check if wallet is connected
        if (!wizardState.walletProvider) {
            throw new Error('Wallet not connected. Please connect your StarKey wallet first.');
        }
        
        showNotification('Creating automation transaction...', 'info');
        
        // Get current chain ID
        const chainIdResponse = await wizardState.walletProvider.getChainId();
        if (!chainIdResponse || !chainIdResponse.chainId) {
            throw new Error('Could not get chain ID from wallet');
        }
        
        signBtn.innerHTML = '<div class="loading-spinner"></div><div class="btn-text">Preparing Parameters...</div>';
        
        // Convert function arguments to BCS format
        const bcsArgs = [];
        for (let i = 0; i < functionArgs.length; i++) {
            try {
                const bcsArg = convertParameterToBCS(functionArgs[i], functionTypes[i]);
                bcsArgs.push(bcsArg);
            } catch (error) {
                throw new Error(`Failed to convert parameter ${i + 1}: ${error.message}`);
            }
        }
        
        signBtn.innerHTML = '<div class="loading-spinner"></div><div class="btn-text">Getting Sequence Number...</div>';
        
        // Get account sequence number
        const senderSequenceNumber = await getAccountSequenceNumber(wizardState.walletAddress);
        
        signBtn.innerHTML = '<div class="loading-spinner"></div><div class="btn-text">Creating Raw Transaction...</div>';
        
        // Prepare automation parameters
        const automationMaxGasAmount = BigInt(document.getElementById('maxGasAmount').value);
        const automationGasPriceCap = BigInt(document.getElementById('gasPriceCap').value);
        const automationFeeCap = BigInt(document.getElementById('automationFeeAuto').value.replace(/,/g, ''));
        const automationExpiryTime = BigInt(document.getElementById('expiryTimeAuto').value);
        const automationAuxData = []; // Empty for now as per docs
        
        // Create type arguments array
        const functionTypeArgs = typeArgs.map(typeArg => {
            // Convert string type arguments to TypeTag format
            // This is a simplified conversion - in production you'd want more robust parsing
            return typeArg;
        });
        
        // Create serialized automation transaction
        const serializedTx = supraSdkClient.createSerializedAutomationRegistrationTxPayloadRawTxObject(
            new window.HexString(wizardState.walletAddress),
            senderSequenceNumber,
            wizardState.walletAddress, // Module address (same as sender for user modules)
            wizardState.selectedModule, // Module name
            wizardState.selectedFunction, // Function name
            functionTypeArgs, // Type arguments
            bcsArgs, // Function arguments
            automationMaxGasAmount, // Max gas amount for automated transaction
            automationGasPriceCap, // Gas price cap
            automationFeeCap, // Automation fee cap
            automationExpiryTime, // Expiry timestamp
            automationAuxData // Aux data (reserved for future use)
        );
        
        signBtn.innerHTML = '<div class="loading-spinner"></div><div class="btn-text">Signing Transaction...</div>';
        
        // Convert serialized transaction to hex
        const txHex = Buffer.from(serializedTx).toString('hex');
        
        // Prepare transaction parameters for StarKey wallet
        const txParams = {
            data: txHex,
            from: wizardState.walletAddress,
            chainId: chainIdResponse.chainId,
            options: {
                waitForTransaction: true
            }
        };
        
        showNotification('Please confirm the transaction in your StarKey wallet...', 'info');
        
        // Send transaction through StarKey wallet
        const txHash = await wizardState.walletProvider.sendTransaction(txParams);
        
        signBtn.innerHTML = '<div class="loading-spinner"></div><div class="btn-text">Waiting for Confirmation...</div>';
        
        showNotification('Transaction submitted! Waiting for confirmation...', 'success');
        
        // Wait for transaction result
        const txResult = await wizardState.walletProvider.waitForTransactionWithResult({
            hash: txHash
        });
        
        // Display transaction status
        transactionStatus.style.display = 'block';
        
        if (txResult && txResult.status === 'Success') {
            transactionStatus.className = 'transaction-status success';
            transactionStatus.innerHTML = `
                <div style="background: rgba(0, 255, 136, 0.1); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(0, 255, 136, 0.3);">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                        <div style="font-size: 2rem;">✅</div>
                        <div>
                            <div style="color: #00ff88; font-weight: 700; font-size: 1.1rem;">Automation Transaction Successful!</div>
                            <div style="color: #9EABB5; font-size: 0.9rem;">Your automation task has been registered</div>
                        </div>
                    </div>
                    <div style="font-family: 'JetBrains Mono', monospace; background: rgba(0, 255, 136, 0.1); padding: 1rem; border-radius: 8px; word-break: break-all; font-size: 0.85rem;">
                        <strong>Transaction Hash:</strong><br>${txHash}
                    </div>
                    <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                        <button onclick="copyToClipboard('transactionStatus', this)" style="background: linear-gradient(135deg, #00ff88, #00cc6a); border: none; color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600;">Copy Hash</button>
                        <button onclick="refreshAutomatedTasks()" style="background: linear-gradient(135deg, #DD1438, #c41030); border: none; color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600;">Refresh Tasks</button>
                    </div>
                </div>
            `;
            showNotification('Automation transaction successful! 🎉', 'success');
        } else {
            throw new Error(`Transaction failed: ${txResult?.vmStatus || 'Unknown error'}`);
        }
        
    } catch (error) {
        console.error('Transaction signing error:', error);
        
        transactionStatus.style.display = 'block';
        transactionStatus.className = 'transaction-status error';
        transactionStatus.innerHTML = `
            <div style="background: rgba(255, 107, 107, 0.1); padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(255, 107, 107, 0.3);">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    <div style="font-size: 2rem;">❌</div>
                    <div>
                        <div style="color: #ff6b6b; font-weight: 700; font-size: 1.1rem;">Transaction Failed</div>
                        <div style="color: #9EABB5; font-size: 0.9rem;">Please try again or check the parameters</div>
                    </div>
                </div>
                <div style="background: rgba(255, 107, 107, 0.1); padding: 1rem; border-radius: 8px; color: #ff6b6b; font-size: 0.9rem;">
                    ${error.message}
                </div>
            </div>
        `;
        
        showNotification(`Transaction failed: ${error.message}`, 'error');
    } finally {
        signBtn.disabled = false;
        signBtn.innerHTML = '<div class="btn-icon">✍️</div><div class="btn-text">Sign & Submit Transaction</div>';
    }
}

// Refresh automated tasks after successful transaction
function refreshAutomatedTasks() {
    if (wizardState.walletAddress) {
        fetchAutomatedTasks(wizardState.walletAddress);
        showNotification('Refreshing automated tasks...', 'info');
    }
}

function generateCommand() {
    const deployStatus = document.getElementById('deployStatus');
    const generateBtn = document.getElementById('generateCommand');
    const paramInputs = document.querySelectorAll('#functionParams .param-input');
    let allValid = true;
    const functionArgs = [];
    paramInputs.forEach(input => {
        const value = input.value.trim();
        const type = input.getAttribute('data-param-type');
        input.classList.remove('invalid');
        const existingError = input.parentNode.querySelector('.param-error');
        if (existingError) existingError.remove();
        const validation = validateParameter(value, type);
        if (!validation.valid) {
            allValid = false;
            input.classList.add('invalid');
            const errorSpan = document.createElement('span');
            errorSpan.className = 'param-error';
            errorSpan.textContent = validation.error;
            input.parentNode.appendChild(errorSpan);
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
            input.classList.remove('invalid');
        }
    });    
    if (!allValid) {
        showNotification('Please fix validation errors before generating CLI command', 'error');
        return;
    }
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="loading-spinner"></div><div class="btn-text">Generating...</div>';
    
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
            <div style="background: rgba(53, 63, 74, 0.4); padding: 1rem; border-radius: 8px; margin: 1rem 0; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">${cliCommand}</div>
            <button onclick="copyToClipboard('deployStatus', this)" style="background: linear-gradient(135deg, #DD1438, #c41030); border: none; color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600;">COPY</button>
        `;      
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<div class="btn-icon">📋</div><div class="btn-text">Generate CLI Command</div>';    
        showNotification('CLI command generated successfully!', 'success');
    }, 1500);
}

function enableStep(stepNumber) {
    const step = document.getElementById(`step-${stepNumber}`);
    if (step) {
        step.classList.remove('disabled');
        step.classList.add('active');
        for (let i = 1; i < stepNumber; i++) {
            const prevStep = document.getElementById(`step-${i}`);
            if (prevStep) {
                prevStep.classList.remove('active');
            }
        }
    }
}

function showNotification(message, type = 'info') {
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
    }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('connectWallet').addEventListener('click', connectStarkeyWallet);
    document.getElementById('useManualAddress').addEventListener('click', useManualAddress);
    document.getElementById('generateCommand').addEventListener('click', generateCommand);
    document.getElementById('signTransaction').addEventListener('click', signAutomationTransaction);
    document.getElementById('maxGasAmount').addEventListener('change', function() {
        updateDisplay();
    });
    document.getElementById('refreshTasks').addEventListener('click', function() {
        if (wizardState.walletAddress) {
            fetchAutomatedTasks(wizardState.walletAddress);
        }
    });    
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.target.id === 'expiryTimeValue' || mutation.target.id === 'feeCapValue') {
                if (wizardState.selectedFunction) {
                    updateAutomationParams();
                }
            }
        });
    });
    observer.observe(document.getElementById('expiryTimeValue'), { childList: true, characterData: true, subtree: true });
    observer.observe(document.getElementById('feeCapValue'), { childList: true, characterData: true, subtree: true });
    init();
});

window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
    if (countdownInterval) clearInterval(countdownInterval);
});