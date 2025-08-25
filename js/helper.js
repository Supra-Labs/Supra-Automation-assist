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
    console.log('Initializing Supra Automation Assist...');
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
        if (window.supraSDKError) {
            throw new Error('SDK failed to load from CDN');
        }
        
        let attempts = 0;
        while (!window.SupraClient && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        if (!window.SupraClient) {
            throw new Error('Supra SDK not available after waiting');
        }
        
        supraSdkClient = new window.SupraClient('https://rpc-testnet.supra.com');
        console.log('Supra SDK initialized successfully');
        
        const testResponse = await fetch('https://rpc-testnet.supra.com/rpc/v2/accounts/1');
        if (!testResponse.ok) {
            throw new Error('RPC endpoint not accessible');
        }
        
    } catch (error) {
        console.error('Failed to initialize Supra SDK:', error);
        showNotification('SDK initialization failed - transaction signing unavailable', 'error');
        
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
                modules = parseModulesFromResponse(dataV3, 'v3');
                apiUsed = 'v3';
            }
        } catch (error) {
            console.log('v3 API error:', error);
        }
        
        if (modules.length === 0) {
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
            document.getElementById('autoScanStatus').innerHTML = `✅ Found ${validModules.length} modules using ${apiUsed} API!`;
            displayModules(validModules, walletAddress);
            enableStep(2);  
            try {
                await fetchAutomatedTasks(walletAddress);
            } catch (error) {
                console.log('Could not fetch automated tasks:', error);
            }
            showNotification(`Found ${validModules.length} modules!`, 'success');
        } else {
            throw new Error(`No modules found at address`);
        }
        
    } catch (error) {
        console.error('Auto-scan error:', error);
        
        document.getElementById('autoScanStatus').innerHTML = `⚠️ API scan failed - loading demo modules...`;
        
        const demoModules = [
            { name: 'auto_incr', bytecode: 'Available' },
            { name: 'auto_counter', bytecode: 'Available' },
            { name: 'auto_topup', bytecode: 'Available' },
            { name: 'dice_roll', bytecode: 'Available' },
            { name: 'HelloWorld', bytecode: 'Available' },
            { name: 'Counter', bytecode: 'Available' }
        ];

        displayModules(demoModules, walletAddress);
        enableStep(2);   
        try {
            await fetchAutomatedTasks(walletAddress);
        } catch (error) {
            console.log('Could not fetch automated tasks in demo mode:', error);
        }
        showNotification(`Demo modules loaded`, 'info');
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
        
        let tasks = [];
        if (data && data.data && Array.isArray(data.data)) {
            tasks = data.data;
        } else if (data && Array.isArray(data)) {
            tasks = data;
        }
        
        document.getElementById('tasksLoading').style.display = 'none';
        if (tasks.length > 0) {
            displayAutomatedTasks(tasks);
        } else {
            document.getElementById('noTasksState').style.display = 'block';
        }    
    } catch (error) {
        console.error('Error fetching automated tasks:', error);
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
        let functionId = 'Unknown';
        if (task.payload && task.payload.Move && task.payload.Move.function) {
            functionId = task.payload.Move.function;
            const functionParts = functionId.split('::');
            if (functionParts.length >= 3) {
                functionId = functionParts[functionParts.length - 1];
            }
        }
        
        let statusColor = '#9EABB5';
        if (status.toLowerCase().includes('success')) {
            statusColor = '#00ff88';
        } else if (status.toLowerCase().includes('failed')) {
            statusColor = '#ff6b6b';
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
                    <span class="detail-value">${functionId}</span>
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
    
    try {
        let demoFunctions = [];
        switch(moduleName.toLowerCase()) {
            case 'auto_incr':
            case 'auto_counter':
            case 'counter':
                demoFunctions = [
                    { name: 'auto_increment', params: ['&signer'], is_entry: true, generic_type_params: [] },
                    { name: 'manual_increment', params: ['&signer'], is_entry: true, generic_type_params: [] }
                ];
                break;
            case 'auto_topup':
                demoFunctions = [
                    { name: 'auto_topup', params: ['&signer', 'address', 'u64', 'u64'], is_entry: true, generic_type_params: [] }
                ];
                break;
            case 'dice_roll':
                demoFunctions = [
                    { name: 'roll_dice', params: ['&signer', 'u256'], is_entry: true, generic_type_params: [] }
                ];
                break;
            default:
                demoFunctions = [
                    { name: 'execute', params: ['&signer'], is_entry: true, generic_type_params: [] }
                ];
        }
        displayFunctions(demoFunctions);
        showNotification(`Loaded ${demoFunctions.length} functions for ${moduleName}`, 'info');
    } catch (error) {
        console.error('Function loading error:', error);
    }
}

function displayFunctions(functions) {
    const functionsList = document.getElementById('functionsList');
    functionsList.innerHTML = '';
    functions.forEach(func => {
        const functionCard = document.createElement('div');
        functionCard.className = 'function-card';
        const nonSignerParams = func.params.filter(param => param !== '&signer');
        
        functionCard.innerHTML = `
            <div class="function-name">${func.name}</div>
            <div class="function-desc">${nonSignerParams.length} parameters</div>
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
    return `Enter ${moveType} value`;
}

function getHintForType(moveType) {
    const hints = {
        'address': 'A 32-byte address starting with 0x (66 characters total)',
        'u8': 'Unsigned 8-bit integer (0 to 255)',
        'u64': 'Unsigned 64-bit integer',
        'u256': 'Unsigned 256-bit integer',
        'bool': 'Boolean value: true or false'
    };
    return hints[moveType] || `Value of type ${moveType}`;
}

function validateParameter(value, type) {
    if (!value && type !== 'bool') return { valid: false, error: 'Required field' };
    if (type === 'address') {
        if (!value.startsWith('0x') || value.length !== 66) {
            return { valid: false, error: 'Invalid address format' };
        }
    }
    if (type.includes('u')) {
        const num = parseInt(value);
        if (isNaN(num) || num < 0) {
            return { valid: false, error: 'Must be positive number' };
        }
    }
    return { valid: true };
}

function updateAutomationParams() {
    const currentTime = Math.floor(Date.now() / 1000);
    const maxExpiryTime = currentTime + maxTaskDuration;
    const calculatedExpiryTime = calculateExpiryTime();
    document.getElementById('expiryTimeAuto').value = expiryTime;
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
    `;
}

function convertParameterToBCS(value, type) {
    if (!window.BCS) {
        throw new Error('BCS module not loaded');
    }
    
    try {
        if (type === 'address') {
            return new window.HexString(value).toUint8Array();
        } else if (type.includes('u8')) {
            return window.BCS.bcsSerializeUint8(parseInt(value));
        } else if (type.includes('u64')) {
            return window.BCS.bcsSerializeUint64(BigInt(value));
        } else if (type.includes('u256')) {
            return window.BCS.bcsSerializeUint256(BigInt(value));
        } else if (type === 'bool') {
            return window.BCS.bcsSerializeBool(value === 'true');
        } else {
            return window.BCS.bcsSerializeStr(value);
        }
    } catch (error) {
        throw error;
    }
}

async function getAccountSequenceNumber(address) {
    try {
        const response = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${address}`);
        const data = await response.json();
        if (data && data.sequence_number !== undefined) {
            return BigInt(data.sequence_number);
        }
        return BigInt(0);
    } catch (error) {
        console.error('Error fetching sequence number:', error);
        return BigInt(0);
    }
}

async function signAutomationTransaction() {
    const signBtn = document.getElementById('signTransaction');
    const transactionStatus = document.getElementById('transactionStatus');
    
    try {
        if (!supraSdkClient || !window.BCS || !window.HexString) {
            throw new Error('Supra SDK not loaded. Please refresh page.');
        }
        
        signBtn.disabled = true;
        signBtn.innerHTML = '<div class="loading-spinner"></div><div class="btn-text">Creating...</div>';
        
        const paramInputs = document.querySelectorAll('#functionParams .param-input');
        let allValid = true;
        const functionArgs = [];
        const functionTypes = [];
        
        paramInputs.forEach(input => {
            const value = input.value.trim();
            const type = input.getAttribute('data-param-type');
            const validation = validateParameter(value, type);
            if (!validation.valid) {
                allValid = false;
            } else if (value) {
                functionArgs.push(value);
                functionTypes.push(type);
            }
        });
        
        if (!allValid) {
            throw new Error('Fix validation errors first');
        }
        
        if (!wizardState.walletProvider) {
            throw new Error('Wallet not connected');
        }
        
        const chainIdResponse = await wizardState.walletProvider.getChainId();
        if (!chainIdResponse) {
            throw new Error('Could not get chain ID');
        }
        
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
        
        const serializedTx = supraSdkClient.createSerializedAutomationRegistrationTxPayloadRawTxObject(
            new window.HexString(wizardState.walletAddress),
            senderSequenceNumber,
            wizardState.walletAddress,
            wizardState.selectedModule,
            wizardState.selectedFunction,
            [],
            bcsArgs,
            automationMaxGasAmount,
            automationGasPriceCap,
            automationFeeCap,
            automationExpiryTime,
            []
        );
        
        const txHex = window.Buffer.from(serializedTx).toString('hex');
        
        const txParams = {
            data: txHex,
            from: wizardState.walletAddress,
            chainId: chainIdResponse.chainId,
            options: { waitForTransaction: true }
        };
        
        showNotification('Confirm in wallet...', 'info');
        
        const txHash = await wizardState.walletProvider.sendTransaction(txParams);
        
        const txResult = await wizardState.walletProvider.waitForTransactionWithResult({ hash: txHash });
        
        transactionStatus.style.display = 'block';
        
        if (txResult && txResult.status === 'Success') {
            transactionStatus.className = 'transaction-status success';
            transactionStatus.innerHTML = `
                <div style="background: rgba(0, 255, 136, 0.1); padding: 1.5rem; border-radius: 12px;">
                    <div style="color: #00ff88; font-weight: 700; margin-bottom: 1rem;">✅ Transaction Successful!</div>
                    <div style="font-family: monospace; background: rgba(0, 255, 136, 0.1); padding: 1rem; border-radius: 8px; word-break: break-all; font-size: 0.85rem;">
                        ${txHash}
                    </div>
                    <button onclick="refreshAutomatedTasks()" style="background: #DD1438; border: none; color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-top: 1rem;">Refresh Tasks</button>
                </div>
            `;
            showNotification('Success!', 'success');
        } else {
            throw new Error(`Transaction failed: ${txResult?.vmStatus || 'Unknown'}`);
        }
        
    } catch (error) {
        transactionStatus.style.display = 'block';
        transactionStatus.className = 'transaction-status error';
        transactionStatus.innerHTML = `
            <div style="background: rgba(255, 107, 107, 0.1); padding: 1.5rem; border-radius: 12px;">
                <div style="color: #ff6b6b; font-weight: 700; margin-bottom: 1rem;">❌ Transaction Failed</div>
                <div style="color: #ff6b6b; font-size: 0.9rem;">${error.message}</div>
                <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(221, 20, 56, 0.1); border-radius: 6px; font-size: 0.8rem;">
                    💡 Try the CLI command instead
                </div>
            </div>
        `;
        showNotification(`Failed: ${error.message}`, 'error');
    } finally {
        signBtn.disabled = false;
        signBtn.innerHTML = '<div class="btn-icon">✍️</div><div class="btn-text">Sign & Submit Transaction</div>';
    }
}

function refreshAutomatedTasks() {
    if (wizardState.walletAddress) {
        fetchAutomatedTasks(wizardState.walletAddress);
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
        const validation = validateParameter(value, type);
        if (!validation.valid) {
            allValid = false;
        } else if (value) {
            functionArgs.push(value);
        }
    });
    
    if (!allValid) {
        showNotification('Fix validation errors first', 'error');
        return;
    }
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<div class="loading-spinner"></div><div class="btn-text">Generating...</div>';
    
    const functionId = `${wizardState.walletAddress}::${wizardState.selectedModule}::${wizardState.selectedFunction}`;
    
    let cliCommand = `supra move automation register --task-max-gas-amount ${document.getElementById('maxGasAmount').value} --task-gas-price-cap ${document.getElementById('gasPriceCap').value} --task-expiry-time-secs ${document.getElementById('expiryTimeAuto').value} --task-automation-fee-cap ${document.getElementById('automationFeeAuto').value} --function-id "${functionId}"`;
    
    if (functionArgs.length > 0) {
        cliCommand += ` --args ${functionArgs.join(' ')}`;
    }
    cliCommand += ` --rpc-url https://rpc-testnet.supra.com`;
    
    setTimeout(() => {
        deployStatus.style.display = 'block';
        deployStatus.className = 'deploy-status success';
        deployStatus.innerHTML = `
            <div style="background: rgba(53, 63, 74, 0.4); padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap;">${cliCommand}</div>
            <button onclick="copyToClipboard('deployStatus', this)" style="background: #DD1438; border: none; color: white; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-top: 1rem;">COPY</button>
        `;      
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<div class="btn-icon">📋</div><div class="btn-text">Generate CLI Command</div>';    
        showNotification('CLI command generated!', 'success');
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
    document.getElementById('maxGasAmount').addEventListener('change', updateDisplay);
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