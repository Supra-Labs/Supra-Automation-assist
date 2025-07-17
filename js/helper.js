let updateInterval;
let countdownInterval;
let epochData = {};
let nextEpochTime = null;
let maxTaskDuration = 7 * 24 * 60 * 60; // 7 days in seconds - fallback as suggested by Nolan
let wizardState = {
    walletConnected: false,
    walletAddress: '',
    selectedModule: '',
    selectedFunction: '',
    moduleABI: null,
    functionParams: [],
    hasGenerics: false,
    typeArgs: []
};

function init() {
    console.log('Initializing Supra Automation Assist...');
    createFloatingLetters();
    createParticleSystem();
    updateDisplay();
    updateInterval = setInterval(updateDisplay, 5000);
    countdownInterval = setInterval(updateCountdown, 1000);
    enableStep(1);
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
            epochData.epochInterval = 7200; // 7200 seconds = 2 hours
            epochData.buffer = 300; // 5 minutes buffer
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
        // still need to make sure we kep fallback value
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
        document.getElementById('autoScanStatus').innerHTML = '🔍 Fetching modules from address...';
        
        const response = await fetch(`https://rpc-testnet.supra.com/rpc/v2/accounts/${walletAddress}/modules`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Auto-scan API response:', data);
        
        let modules = [];
        
        if (data && data.modules && Array.isArray(data.modules)) {
            modules = data.modules.map((module, index) => {
                let moduleName = `Module_${index + 1}`;
                
                if (typeof module === 'string') {
                    moduleName = module;
                } else if (module && typeof module === 'object') {
                    moduleName = module.name || 
                                module.module_name || 
                                module.module || 
                                module.address?.split('::').pop() ||
                                (module.abi && module.abi.name) ||
                                `Module_${index + 1}`;
                }
                
                return {
                    name: moduleName,
                    bytecode: 'Available',
                    abi: module.abi || module,
                    raw: module
                };
            });
        } else if (Array.isArray(data)) {
            modules = data.map((module, index) => ({
                name: module.name || module.module_name || `Module_${index + 1}`,
                bytecode: 'Available',
                abi: module.abi || module,
                raw: module
            }));
        }
        
        const validModules = modules.filter(module => 
            module.name !== 'Unknown' && 
            module.name !== 'modules' && 
            module.name !== 'cursor' &&
            module.name.length > 1
        );
        
        if (validModules.length > 0) {
            document.getElementById('autoScanStatus').innerHTML = `✅ Found ${validModules.length} modules!`;
            displayModules(validModules, walletAddress);
            enableStep(2);  
            showNotification(`Found ${validModules.length} modules at the address!`, 'success');
        } else {
            throw new Error('No modules found at address');
        }
        
    } catch (error) {
        console.error('Auto-scan error:', error);
        
        document.getElementById('autoScanStatus').innerHTML = '⚠️ API scan failed - loading demo modules...';
        
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
            { name: 'auto_count', bytecode: 'Available' }
        ];
        
        displayModules(demoModules, walletAddress);
        enableStep(2);
        showNotification('Demo modules loaded from example wallet', 'info');
    }
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

async function selectModule(moduleName, baseAddress, event) {
    document.querySelectorAll('.module-card').forEach(card => card.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    wizardState.selectedModule = moduleName;
    
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
                enableStep(3);
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
        }
        displayFunctions(demoFunctions);
        enableStep(3);
        showNotification(`Loaded ${demoFunctions.length} demo functions for ${moduleName}`, 'info');
    } finally {
        document.getElementById('abiLoading').style.display = 'none';
    }
}

// Only entry functionsbased on Nolans feedbac
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
    document.getElementById('maxGasAmount').addEventListener('change', function() {
        updateDisplay();
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