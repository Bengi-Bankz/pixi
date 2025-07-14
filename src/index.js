import {
    Application,
    Assets,
    Sprite,
    Container,
    Graphics,
    Text
} from 'pixi.js';

(async () => {
    const app = new Application();
    await app.init({
        width: window.innerWidth,
        height: window.innerHeight * .98,  // Account for address bar
        backgroundColor: 0x1e3a8a  // Nice blue background
    });

    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.appendChild(app.canvas);

    const ROWS = 5;
    const COLS = 5;
    const SLOT_WIDTH = 120;   // Bigger symbols
    const SLOT_HEIGHT = 120;  // Bigger symbols

    let isSpinning = false;
    let autoSpin = false;
    let autoSpinCount = 0;
    let slots = [];
    let reelContainers = []; // Store reel containers for spinning animation
    let allSymbols = {}; // Store all symbols organized by type
    let backgroundSprite = null; // Store background sprite

    // Game state variables
    let balance = 1000;
    let currentBet = 10;
    let isMenuOpen = false;

    // 🔹 Load background image
    try {
        const backgroundTexture = await Assets.load('/boarddone.png');
        backgroundSprite = new Sprite(backgroundTexture);

        // Scale background to fill the entire screen
        const scaleX = app.screen.width / backgroundTexture.width;
        const scaleY = app.screen.height / backgroundTexture.height;
        const scale = Math.max(scaleX, scaleY); // Use the larger scale to fill screen

        backgroundSprite.scale.set(scale);

        // Center the background
        backgroundSprite.x = (app.screen.width - backgroundTexture.width * scale) / 2;
        backgroundSprite.y = (app.screen.height - backgroundTexture.height * scale) / 2;

        app.stage.addChild(backgroundSprite);
        console.log('Background loaded successfully');
    } catch (error) {
        console.log('Background could not be loaded:', error);
    }

    // 🔹 Load UI atlas with all symbols
    try {
        const uiAtlas = await Assets.load('/ui.png.json');

        // Organize symbols by type
        allSymbols.ones = []; // For 1_ symbols
        allSymbols.twos = []; // For 2_ symbols
        allSymbols.scatters = []; // For scatter symbols
        allSymbols.regular = []; // For regular gameplay (mix of both)

        // Load all 1_ symbols (1_001 to 1_022)
        for (let i = 1; i <= 22; i++) {
            const symbolName = `1_${i.toString().padStart(3, '0')}.png`;
            if (uiAtlas.textures[symbolName]) {
                allSymbols.ones.push(uiAtlas.textures[symbolName]);
            }
        }

        // Load all 2_ symbols (2_001 to 2_024)
        for (let i = 1; i <= 24; i++) {
            const symbolName = `2_${i.toString().padStart(3, '0')}.png`;
            if (uiAtlas.textures[symbolName]) {
                allSymbols.twos.push(uiAtlas.textures[symbolName]);
            }
        }

        // Load scatter symbols with rarity info
        const scatterSymbols = [
            { name: 'cyclonescatter', rarity: 'rare', multiplier: 5 },
            { name: 'hurricanescatter', rarity: 'epic', multiplier: 10 },
            { name: 'stormtracker', rarity: 'legendary', multiplier: 25 }
        ];

        scatterSymbols.forEach(scatter => {
            try {
                const scatterTexture = Assets.get(`/${scatter.name}.png`);
                if (scatterTexture) {
                    allSymbols.scatters.push({
                        texture: scatterTexture,
                        name: scatter.name,
                        rarity: scatter.rarity,
                        multiplier: scatter.multiplier
                    });
                }
            } catch (error) {
                console.log(`Could not load scatter: ${scatter.name}`);
            }
        });

        // For regular gameplay, use first symbol of each type + rare scatters
        if (allSymbols.ones.length > 0) allSymbols.regular.push(allSymbols.ones[0]);
        if (allSymbols.twos.length > 0) allSymbols.regular.push(allSymbols.twos[0]);

        // Add scatter symbols to regular pool with lower probability
        allSymbols.scatters.forEach(scatter => {
            allSymbols.regular.push(scatter.texture);
        });

        console.log(`Loaded ${allSymbols.ones.length} '1' symbols, ${allSymbols.twos.length} '2' symbols, and ${allSymbols.scatters.length} scatter symbols from UI atlas`);
    } catch (error) {
        console.log('UI atlas could not be loaded:', error);
        // Fallback: create colored rectangles
        allSymbols.regular = [];
        for (let i = 1; i <= 2; i++) {
            const graphics = new Graphics();
            graphics.beginFill(i === 1 ? 0xFF6B6B : 0x4ECDC4); // Red for 1s, Teal for 2s
            graphics.drawRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT);
            graphics.endFill();
            allSymbols.regular.push(app.renderer.generateTexture(graphics));
        }
    }

    // 🔹 Load scatter symbols separately
    try {
        const scatterPromises = [
            Assets.load('scatters/cyclonescatter.png'),
            Assets.load('scatters/hurricanescatter.png'),
            Assets.load('scatters/stormtracker.png')
        ];

        const [cycloneTexture, hurricaneTexture, stormTexture] = await Promise.all(scatterPromises);

        // Clear any existing scatter data to avoid duplicates
        allSymbols.scatters = [];

        // Add scatter symbols with rarity data
        if (cycloneTexture) {
            allSymbols.scatters.push({
                texture: cycloneTexture,
                name: 'cyclone',
                rarity: 'rare',
                multiplier: 5
            });
            console.log('✅ Cyclone scatter loaded successfully');
        }

        if (hurricaneTexture) {
            allSymbols.scatters.push({
                texture: hurricaneTexture,
                name: 'hurricane',
                rarity: 'epic',
                multiplier: 10
            });
            console.log('✅ Hurricane scatter loaded successfully');
        }

        if (stormTexture) {
            allSymbols.scatters.push({
                texture: stormTexture,
                name: 'storm',
                rarity: 'legendary',
                multiplier: 25
            });
            console.log('✅ Storm tracker scatter loaded successfully');
        }

        console.log(`📊 Total scatter symbols loaded: ${allSymbols.scatters.length}`);
    } catch (error) {
        console.log('❌ Scatter symbols could not be loaded:', error);
    }

    // 🔹 Create slot container - positioned to center vertically with better spacing
    const slotContainer = new Container();

    // Calculate position with much bigger spacing
    const reelSpacing = 40; // Even more space between reels
    const verticalSpacing = 2; // Tighter spacing between rows
    const totalReelWidth = COLS * SLOT_WIDTH + (COLS - 1) * reelSpacing;
    const totalReelHeight = ROWS * SLOT_HEIGHT + (ROWS - 1) * verticalSpacing;

    const reelAreaX = app.screen.width * 0.44 - totalReelWidth / 2; // Center horizontally
    const reelAreaY = app.screen.height * 0.6 - totalReelHeight / 2; // Center vertically again

    slotContainer.x = reelAreaX;
    slotContainer.y = reelAreaY;
    app.stage.addChild(slotContainer);

    // 🔹 Create professional UI system
    const uiContainer = new Container();
    app.stage.addChild(uiContainer);

    // 🔹 Create top bar with balance and menu
    const topBar = new Container();

    // Top bar background
    const topBarBg = new Graphics();
    topBarBg.beginFill(0x000000, 0.7);
    topBarBg.drawRoundedRect(0, 0, app.screen.width, 80, 0);
    topBarBg.endFill();
    topBar.addChild(topBarBg);

    // Balance display
    const balanceContainer = new Container();
    const balanceBg = new Graphics();
    balanceBg.beginFill(0x2c3e50);
    balanceBg.lineStyle(2, 0xf39c12);
    balanceBg.drawRoundedRect(0, 0, 200, 50, 10);
    balanceBg.endFill();

    const balanceText = new Text(`Balance: $${balance}`, {
        fontFamily: 'Arial',
        fontSize: 18,
        fontWeight: 'bold',
        fill: 0xf39c12,
        align: 'center'
    });
    balanceText.anchor.set(0.5);
    balanceText.x = 100;
    balanceText.y = 25;

    balanceContainer.addChild(balanceBg);
    balanceContainer.addChild(balanceText);
    balanceContainer.x = 20;
    balanceContainer.y = 15;
    topBar.addChild(balanceContainer);

    // Menu button (hamburger style)
    const menuContainer = new Container();
    const menuBg = new Graphics();
    menuBg.beginFill(0x34495e);
    menuBg.lineStyle(2, 0x95a5a6);
    menuBg.drawRoundedRect(0, 0, 60, 50, 10);
    menuBg.endFill();

    // Hamburger lines
    const menuIcon = new Graphics();
    menuIcon.lineStyle(3, 0x95a5a6);
    for (let i = 0; i < 3; i++) {
        menuIcon.moveTo(15, 15 + (i * 8));
        menuIcon.lineTo(45, 15 + (i * 8));
    }

    menuContainer.addChild(menuBg);
    menuContainer.addChild(menuIcon);
    menuContainer.x = app.screen.width - 80;
    menuContainer.y = 15;
    menuContainer.interactive = true;
    menuContainer.buttonMode = true;
    topBar.addChild(menuContainer);

    // Menu dropdown
    const menuDropdown = new Container();
    const menuDropdownBg = new Graphics();
    menuDropdownBg.beginFill(0x2c3e50, 0.95);
    menuDropdownBg.lineStyle(2, 0x95a5a6);
    menuDropdownBg.drawRoundedRect(0, 0, 200, 200, 10);
    menuDropdownBg.endFill();

    const menuItems = ['Settings', 'Paytable', 'Rules', 'Sound: ON'];
    menuItems.forEach((item, index) => {
        const menuItem = new Text(item, {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xecf0f1,
            align: 'left'
        });
        menuItem.x = 15;
        menuItem.y = 15 + (index * 35);
        menuItem.interactive = true;
        menuItem.buttonMode = true;
        menuDropdown.addChild(menuItem);
    });

    menuDropdown.x = app.screen.width - 220;
    menuDropdown.y = 70;
    menuDropdown.visible = false;
    topBar.addChild(menuDropdown);

    uiContainer.addChild(topBar);

    // 🔹 Create bottom control panel
    const controlPanel = new Container();

    // Control panel background
    const controlBg = new Graphics();
    controlBg.beginFill(0x000000, 0.8);
    controlBg.drawRoundedRect(0, 0, app.screen.width, 120, 0);
    controlBg.endFill();
    controlPanel.addChild(controlBg);
    controlPanel.y = app.screen.height - 120;

    // Bet input section
    const betContainer = new Container();

    // Bet label
    const betLabel = new Text('BET', {
        fontFamily: 'Arial',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xbdc3c7,
        align: 'center'
    });
    betLabel.anchor.set(0.5);
    betLabel.x = 100;
    betLabel.y = 20;

    // Bet display/input
    const betInputBg = new Graphics();
    betInputBg.beginFill(0x34495e);
    betInputBg.lineStyle(2, 0xe74c3c);
    betInputBg.drawRoundedRect(0, 0, 200, 40, 8);
    betInputBg.endFill();

    const betText = new Text(`$${currentBet}`, {
        fontFamily: 'Arial',
        fontSize: 20,
        fontWeight: 'bold',
        fill: 0xe74c3c,
        align: 'center'
    });
    betText.anchor.set(0.5);
    betText.x = 100;
    betText.y = 20;

    // Bet adjustment buttons
    const betMinusBtn = createControlButton('-', 0xe74c3c);
    betMinusBtn.x = -40;
    betMinusBtn.y = 35;

    const betPlusBtn = createControlButton('+', 0xe74c3c);
    betPlusBtn.x = 240;
    betPlusBtn.y = 35;

    betContainer.addChild(betLabel);
    betContainer.addChild(betInputBg);
    betContainer.addChild(betText);
    betContainer.addChild(betMinusBtn);
    betContainer.addChild(betPlusBtn);
    betContainer.x = 50;
    betContainer.y = 30;
    controlPanel.addChild(betContainer);

    // Main action buttons
    const buttonSpacing = 80;
    const startX = app.screen.width / 2 - (buttonSpacing * 2);

    // Spin button (main)
    const spinButton = createMainButton('SPIN', 0x27ae60, 100, 60);
    spinButton.x = startX + (buttonSpacing * 2);
    spinButton.y = 30;
    controlPanel.addChild(spinButton);

    // Auto spin button with recycle symbol
    const autoButton = createIconButton('AUTO', '♻', 0x3498db);
    autoButton.x = startX + buttonSpacing;
    autoButton.y = 30;
    controlPanel.addChild(autoButton);

    // Bonus buy button with star
    const bonusButton = createIconButton('BONUS', '★', 0xf39c12);
    bonusButton.x = startX + (buttonSpacing * 3);
    bonusButton.y = 30;
    controlPanel.addChild(bonusButton);

    uiContainer.addChild(controlPanel);

    // 🔹 Helper function to create control buttons
    function createControlButton(text, color) {
        const container = new Container();

        const bg = new Graphics();
        bg.beginFill(color);
        bg.drawRoundedRect(0, 0, 30, 30, 5);
        bg.endFill();

        const buttonText = new Text(text, {
            fontFamily: 'Arial',
            fontSize: 18,
            fontWeight: 'bold',
            fill: 0xffffff,
            align: 'center'
        });
        buttonText.anchor.set(0.5);
        buttonText.x = 15;
        buttonText.y = 15;

        container.addChild(bg);
        container.addChild(buttonText);
        container.interactive = true;
        container.buttonMode = true;

        return container;
    }

    // 🔹 Helper function to create main buttons
    function createMainButton(text, color, width = 80, height = 50) {
        const container = new Container();

        const bg = new Graphics();
        bg.beginFill(color);
        bg.lineStyle(3, color - 0x222222);
        bg.drawRoundedRect(0, 0, width, height, 12);
        bg.endFill();

        const buttonText = new Text(text, {
            fontFamily: 'Arial',
            fontSize: 18,
            fontWeight: 'bold',
            fill: 0xffffff,
            align: 'center'
        });
        buttonText.anchor.set(0.5);
        buttonText.x = width / 2;
        buttonText.y = height / 2;

        container.addChild(bg);
        container.addChild(buttonText);
        container.interactive = true;
        container.buttonMode = true;

        // Store references for later use
        container.bg = bg;
        container.text = buttonText;
        container.originalColor = color;

        return container;
    }

    // 🔹 Helper function to create icon buttons
    function createIconButton(text, icon, color) {
        const container = new Container();

        const bg = new Graphics();
        bg.beginFill(color);
        bg.lineStyle(2, color - 0x111111);
        bg.drawRoundedRect(0, 0, 70, 50, 10);
        bg.endFill();

        const iconText = new Text(icon, {
            fontFamily: 'Arial',
            fontSize: 20,
            fill: 0xffffff,
            align: 'center'
        });
        iconText.anchor.set(0.5);
        iconText.x = 35;
        iconText.y = 18;

        const labelText = new Text(text, {
            fontFamily: 'Arial',
            fontSize: 10,
            fontWeight: 'bold',
            fill: 0xffffff,
            align: 'center'
        });
        labelText.anchor.set(0.5);
        labelText.x = 35;
        labelText.y = 38;

        container.addChild(bg);
        container.addChild(iconText);
        container.addChild(labelText);
        container.interactive = true;
        container.buttonMode = true;

        // Store references
        container.bg = bg;
        container.originalColor = color;

        return container;
    }

    // 🔹 Update balance display function
    function updateBalanceDisplay() {
        balanceText.text = `Balance: $${balance}`;
    }

    // 🔹 Update bet display function
    function updateBetDisplay() {
        betText.text = `$${currentBet}`;
    }

    // 🔹 Add visual guide for reel positioning (remove this in production)
    // const reelGuide = new Graphics();
    // reelGuide.lineStyle(2, 0xFF0000, 0.5); // Red outline for debugging
    // reelGuide.drawRect(0, 0, totalReelWidth, totalReelHeight);
    // slotContainer.addChild(reelGuide);

    // 🔹 Create reel masks for clipping
    const reelMasks = [];
    for (let col = 0; col < COLS; col++) {
        const mask = new Graphics();
        mask.beginFill(0xFFFFFF);
        const reelX = col * (SLOT_WIDTH + reelSpacing);
        mask.drawRect(reelX, 0, SLOT_WIDTH, ROWS * SLOT_HEIGHT + (ROWS - 1) * verticalSpacing);
        mask.endFill();
        slotContainer.addChild(mask);
        reelMasks.push(mask);
    }

    // 🔹 Create individual reel containers
    for (let col = 0; col < COLS; col++) {
        const reelContainer = new Container();
        reelContainer.x = col * (SLOT_WIDTH + reelSpacing);
        reelContainer.y = 0;
        reelContainer.mask = reelMasks[col];
        slotContainer.addChild(reelContainer);
        reelContainers.push(reelContainer);
    }

    // 🔹 Function to create a random symbol with rarity consideration
    function createRandomSymbol() {
        if (allSymbols.regular.length === 0) return null;

        const rand = Math.random();
        let selectedTexture;
        let symbolSource = '';

        // Debug: Check if scatters are available
        const scattersAvailable = allSymbols.scatters.length > 0;
        
        // Rarity-based symbol selection (INCREASED for testing!)
        if (rand < 0.08 && scattersAvailable) {
            // 8% chance for scatter (legendary storm tracker)
            const stormScatter = allSymbols.scatters.find(s => s.name === 'storm');
            selectedTexture = stormScatter ? stormScatter.texture : allSymbols.regular[0];
            symbolSource = stormScatter ? 'storm scatter' : 'fallback';
        } else if (rand < 0.20 && scattersAvailable) {
            // 12% additional chance for epic hurricane (20% total)
            const hurricaneScatter = allSymbols.scatters.find(s => s.name === 'hurricane');
            selectedTexture = hurricaneScatter ? hurricaneScatter.texture : allSymbols.regular[0];
            symbolSource = hurricaneScatter ? 'hurricane scatter' : 'fallback';
        } else if (rand < 0.35 && scattersAvailable) {
            // 15% additional chance for rare cyclone (35% total)
            const cycloneScatter = allSymbols.scatters.find(s => s.name === 'cyclone');
            selectedTexture = cycloneScatter ? cycloneScatter.texture : allSymbols.regular[0];
            symbolSource = cycloneScatter ? 'cyclone scatter' : 'fallback';
        } else {
            // 65% chance for regular symbols (1s and 2s)
            const regularSymbols = [...allSymbols.ones, ...allSymbols.twos];
            if (regularSymbols.length > 0) {
                selectedTexture = regularSymbols[Math.floor(Math.random() * regularSymbols.length)];
                symbolSource = 'regular symbol';
            } else {
                selectedTexture = allSymbols.regular[Math.floor(Math.random() * allSymbols.regular.length)];
                symbolSource = 'fallback regular';
            }
        }

        // Occasionally log what we're creating
        if (Math.random() < 0.1) { // 10% chance to log
            console.log(`Creating symbol: ${symbolSource}, scatters available: ${scattersAvailable}, scatter count: ${allSymbols.scatters.length}`);
        }

        const symbol = new Sprite(selectedTexture);
        return symbol;
    }

    // 🔹 Function to create symbols for a reel (more symbols for spinning effect)
    function createReelSymbols(col, extraSymbols = 10) {
        const symbols = [];
        const totalSymbols = ROWS + extraSymbols;

        for (let i = 0; i < totalSymbols; i++) {
            const symbol = createRandomSymbol();
            if (symbol) {
                symbol.width = SLOT_WIDTH;
                symbol.height = SLOT_HEIGHT;
                symbol.x = 0; // Relative to reel container
                symbol.y = i * (SLOT_HEIGHT + verticalSpacing); // Use the new vertical spacing
                symbols.push(symbol);
                reelContainers[col].addChild(symbol);
            }
        }

        return symbols;
    }

    // 🔹 Function to guarantee at least one scatter per spin
    function guaranteeScatterInSpin() {
        console.log('🔍 Checking for scatters in current spin...');
        
        // After all reels are created, check if there's at least one scatter
        let hasScatter = false;
        let scatterCount = 0;
        
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (slots[row] && slots[row][col]) {
                    const symbolType = getSymbolType(slots[row][col]);
                    if (symbolType && symbolType.startsWith('scatter_')) {
                        hasScatter = true;
                        scatterCount++;
                        console.log(`Found scatter: ${symbolType} at [${row}, ${col}]`);
                    }
                }
            }
        }
        
        console.log(`Total scatters found naturally: ${scatterCount}`);
        
        // ALWAYS force at least 2 scatters for better visibility
        if (scatterCount < 2 && allSymbols.scatters.length > 0) {
            const scattersToAdd = 2 - scatterCount;
            console.log(`🎯 Adding ${scattersToAdd} guaranteed scatters`);
            
            for (let i = 0; i < scattersToAdd; i++) {
                let attempts = 0;
                let placed = false;
                
                while (!placed && attempts < 50) {
                    const randomRow = Math.floor(Math.random() * ROWS);
                    const randomCol = Math.floor(Math.random() * COLS);
                    
                    // Check if this position already has a scatter
                    if (slots[randomRow] && slots[randomRow][randomCol]) {
                        const existingType = getSymbolType(slots[randomRow][randomCol]);
                        if (!existingType || !existingType.startsWith('scatter_')) {
                            // Pick a random scatter type with weighted probability
                            const rand = Math.random();
                            let selectedScatter;
                            
                            if (rand < 0.6) {
                                selectedScatter = allSymbols.scatters.find(s => s.name === 'cyclone');
                            } else if (rand < 0.85) {
                                selectedScatter = allSymbols.scatters.find(s => s.name === 'hurricane');
                            } else {
                                selectedScatter = allSymbols.scatters.find(s => s.name === 'storm');
                            }
                            
                            if (selectedScatter) {
                                slots[randomRow][randomCol].texture = selectedScatter.texture;
                                console.log(`✨ Guaranteed scatter placed: ${selectedScatter.name} at [${randomRow}, ${randomCol}]`);
                                placed = true;
                            }
                        }
                    }
                    attempts++;
                }
                
                if (!placed) {
                    console.log('⚠️ Could not place guaranteed scatter after 50 attempts');
                }
            }
        }
        
        // Final count
        let finalScatterCount = 0;
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                if (slots[row] && slots[row][col]) {
                    const symbolType = getSymbolType(slots[row][col]);
                    if (symbolType && symbolType.startsWith('scatter_')) {
                        finalScatterCount++;
                    }
                }
            }
        }
        console.log(`🎰 Final scatter count: ${finalScatterCount}`);
    }

    // 🔹 Function to spin a single reel
    function spinReel(col, duration, onComplete) {
        const reel = reelContainers[col];
        const symbols = reel.children.slice(); // Copy array

        if (symbols.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        // Calculate spin distance (multiple full cycles + final position)
        const symbolHeight = SLOT_HEIGHT + verticalSpacing; // Use the new vertical spacing
        const cycleDistance = symbols.length * symbolHeight;
        const extraCycles = 3 + Math.random() * 2; // 3-5 extra cycles
        const totalDistance = cycleDistance * extraCycles;

        const startY = reel.y;
        const targetY = startY + totalDistance;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for realistic slot machine feel
            const easeOut = 1 - Math.pow(1 - progress, 3);

            reel.y = startY + (totalDistance * easeOut);

            // Reset symbols that go off screen to the top
            symbols.forEach(symbol => {
                const globalY = reel.y + symbol.y;
                if (globalY > ROWS * symbolHeight) {
                    symbol.y -= symbols.length * symbolHeight;
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Snap to final position
                const finalOffset = reel.y % symbolHeight;
                reel.y -= finalOffset;

                // Update slots array with final visible symbols
                for (let row = 0; row < ROWS; row++) {
                    const symbolIndex = Math.floor(-reel.y / symbolHeight) + row;
                    const wrappedIndex = ((symbolIndex % symbols.length) + symbols.length) % symbols.length;
                    slots[row][col] = symbols[wrappedIndex];
                }

                if (onComplete) onComplete();
            }
        };

        animate();
    }

    // 🔹 Enhanced win detection that returns win amount
    function checkForWins() {
        const winningPositions = [];
        let totalWinAmount = 0;

        // Check for scatter wins first (any 3+ scatters anywhere)
        const scatterPositions = [];
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const symbolType = getSymbolType(slots[row][col]);
                if (symbolType && symbolType.startsWith('scatter_')) {
                    scatterPositions.push({ row, col, type: symbolType });
                }
            }
        }

        // Group scatters by type
        const scatterGroups = {};
        scatterPositions.forEach(pos => {
            if (!scatterGroups[pos.type]) scatterGroups[pos.type] = [];
            scatterGroups[pos.type].push(pos);
        });

        // Check for scatter wins (3+ of same type)
        Object.keys(scatterGroups).forEach(scatterType => {
            const positions = scatterGroups[scatterType];
            if (positions.length >= 3) {
                const scatterName = scatterType.replace('scatter_', '');
                const scatterData = allSymbols.scatters.find(s => s.name === scatterName);
                if (scatterData) {
                    const scatterWin = currentBet * scatterData.multiplier * positions.length;
                    totalWinAmount += scatterWin;
                    winningPositions.push(...positions);
                    console.log(`SCATTER WIN! ${positions.length} ${scatterName} scatters = $${scatterWin}`);
                }
            }
        });

        // Check for horizontal lines of same symbol type
        for (let row = 0; row < ROWS; row++) {
            let consecutiveCount = 1;
            let currentSymbolType = getSymbolType(slots[row][0]);

            for (let col = 1; col < COLS; col++) {
                const symbolType = getSymbolType(slots[row][col]);
                if (symbolType === currentSymbolType && symbolType !== null && !symbolType.startsWith('scatter_')) {
                    consecutiveCount++;
                } else {
                    if (consecutiveCount >= 3 && !currentSymbolType?.startsWith('scatter_')) {
                        // Found a win!
                        const winMultiplier = consecutiveCount === 3 ? 2 : consecutiveCount === 4 ? 5 : 10;
                        const winAmount = currentBet * winMultiplier;
                        totalWinAmount += winAmount;

                        for (let i = col - consecutiveCount; i < col; i++) {
                            winningPositions.push({ row, col: i, type: currentSymbolType });
                        }
                    }
                    consecutiveCount = 1;
                    currentSymbolType = symbolType;
                }
            }

            // Check the last sequence
            if (consecutiveCount >= 3 && !currentSymbolType?.startsWith('scatter_')) {
                const winMultiplier = consecutiveCount === 3 ? 2 : consecutiveCount === 4 ? 5 : 10;
                const winAmount = currentBet * winMultiplier;
                totalWinAmount += winAmount;

                for (let i = COLS - consecutiveCount; i < COLS; i++) {
                    winningPositions.push({ row, col: i, type: currentSymbolType });
                }
            }
        }

        // Animate winning symbols
        if (winningPositions.length > 0) {
            console.log('WIN DETECTED!', winningPositions);
            animateWinningSymbols(winningPositions);
        }

        return totalWinAmount;
    }

    // 🔹 Get symbol type (1, 2, or scatter) from texture
    function getSymbolType(symbolSprite) {
        if (!symbolSprite || !symbolSprite.texture) return null;

        // Check if it's a scatter symbol
        const scatterMatch = allSymbols.scatters.find(s => s.texture === symbolSprite.texture);
        if (scatterMatch) return `scatter_${scatterMatch.name}`;

        // Check if it's a '1' type symbol
        if (allSymbols.ones.includes(symbolSprite.texture)) return '1';
        // Check if it's a '2' type symbol  
        if (allSymbols.twos.includes(symbolSprite.texture)) return '2';

        return null;
    }

    // 🔹 Animate winning symbols
    function animateWinningSymbols(winningPositions) {
        winningPositions.forEach(pos => {
            const symbolSprite = slots[pos.row][pos.col];
            if (!symbolSprite) return;

            let animationFrames = [];

            // Determine animation frames based on symbol type
            if (pos.type === '1') {
                animationFrames = allSymbols.ones;
            } else if (pos.type === '2') {
                animationFrames = allSymbols.twos;
            } else if (pos.type && pos.type.startsWith('scatter_')) {
                // For scatters, create a pulsing effect with scale and glow
                const originalScale = symbolSprite.scale.x;
                let pulseDirection = 1;

                const pulseInterval = setInterval(() => {
                    symbolSprite.scale.x += 0.05 * pulseDirection;
                    symbolSprite.scale.y += 0.05 * pulseDirection;

                    if (symbolSprite.scale.x >= originalScale + 0.3) pulseDirection = -1;
                    if (symbolSprite.scale.x <= originalScale - 0.1) pulseDirection = 1;

                    // Add tint effect for rarity
                    const scatterName = pos.type.replace('scatter_', '');
                    if (scatterName === 'cyclone') symbolSprite.tint = 0xffff00; // Yellow for rare
                    else if (scatterName === 'hurricane') symbolSprite.tint = 0xff00ff; // Purple for epic  
                    else if (scatterName === 'storm') symbolSprite.tint = 0xff6600; // Orange for legendary
                }, 50);

                // Stop animation after 3 seconds
                setTimeout(() => {
                    clearInterval(pulseInterval);
                    symbolSprite.scale.set(originalScale);
                    symbolSprite.tint = 0xffffff; // Reset tint
                }, 3000);

                return; // Skip the regular frame animation
            }

            if (animationFrames.length === 0) return;

            let frameIndex = 0;
            const animationInterval = setInterval(() => {
                symbolSprite.texture = animationFrames[frameIndex];
                frameIndex = (frameIndex + 1) % animationFrames.length;
            }, 100); // Change frame every 100ms

            // Stop animation after 3 seconds
            setTimeout(() => {
                clearInterval(animationInterval);
                // Reset to first frame
                symbolSprite.texture = animationFrames[0];
            }, 3000);
        });
    }

    // 🔹 Enhanced spin function with balance and bet validation
    function spinReels() {
        if (isSpinning || balance < currentBet) {
            if (balance < currentBet) {
                console.log('Insufficient balance!');
                // Could add a visual notification here
            }
            return;
        }

        // Deduct bet from balance
        balance -= currentBet;
        updateBalanceDisplay();

        isSpinning = true;
        spinButton.text.text = 'SPINNING...';
        spinButton.bg.clear();
        spinButton.bg.beginFill(0x888888);
        spinButton.bg.drawRoundedRect(0, 0, 100, 60, 12);
        spinButton.bg.endFill();

        let completedReels = 0;

        // Spin each reel with increasing duration (left to right)
        for (let col = 0; col < COLS; col++) {
            // Clear existing symbols in this reel
            reelContainers[col].removeChildren();

            // Create new symbols for spinning
            createReelSymbols(col);

            // Spin with staggered timing
            const spinDuration = 1000 + (col * 300); // Each reel spins longer

            spinReel(col, spinDuration, () => {
                completedReels++;

                // Check if all reels are done spinning
                if (completedReels >= COLS) {
                    isSpinning = false;
                    spinButton.text.text = 'SPIN';
                    spinButton.bg.clear();
                    spinButton.bg.beginFill(spinButton.originalColor);
                    spinButton.bg.lineStyle(3, spinButton.originalColor - 0x222222);
                    spinButton.bg.drawRoundedRect(0, 0, 100, 60, 12);
                    spinButton.bg.endFill();

                    // Guarantee at least one scatter per spin
                    guaranteeScatterInSpin();

                    // Check for wins after spinning stops
                    const winAmount = checkForWins();
                    if (winAmount > 0) {
                        balance += winAmount;
                        updateBalanceDisplay();
                        console.log(`You won $${winAmount}!`);
                    }

                    // Continue auto spin if active
                    if (autoSpin && autoSpinCount > 0) {
                        autoSpinCount--;
                        setTimeout(() => {
                            if (autoSpin && balance >= currentBet) {
                                spinReels();
                            } else {
                                autoSpin = false;
                                autoButton.bg.clear();
                                autoButton.bg.beginFill(autoButton.originalColor);
                                autoButton.bg.lineStyle(2, autoButton.originalColor - 0x111111);
                                autoButton.bg.drawRoundedRect(0, 0, 70, 50, 10);
                                autoButton.bg.endFill();
                            }
                        }, 1000);
                    }
                }
            });
        }
    }

    // 🔹 Initialize 5x5 slot symbols using reel system
    for (let row = 0; row < ROWS; row++) {
        slots[row] = [];
    }

    // Create initial symbols for each reel
    for (let col = 0; col < COLS; col++) {
        createReelSymbols(col, 0); // No extra symbols for initial setup

        // Update slots array with initial visible symbols
        for (let row = 0; row < ROWS; row++) {
            const symbolIndex = row;
            if (reelContainers[col].children[symbolIndex]) {
                slots[row][col] = reelContainers[col].children[symbolIndex];
            }
        }
    }

    // 🔹 Event handlers for UI elements

    // Menu toggle
    menuContainer.on('pointerdown', () => {
        isMenuOpen = !isMenuOpen;
        menuDropdown.visible = isMenuOpen;
    });

    // Bet adjustment
    betMinusBtn.on('pointerdown', () => {
        if (currentBet > 1 && !isSpinning) {
            currentBet = Math.max(1, currentBet - 1);
            updateBetDisplay();
        }
    });

    betPlusBtn.on('pointerdown', () => {
        if (currentBet < balance && !isSpinning) {
            currentBet = Math.min(balance, currentBet + 1);
            updateBetDisplay();
        }
    });

    // Main spin button
    spinButton.on('pointerdown', () => {
        if (!autoSpin) {
            spinReels();
        }
    });

    // Auto spin button
    autoButton.on('pointerdown', () => {
        if (isSpinning) return;

        autoSpin = !autoSpin;
        if (autoSpin) {
            autoSpinCount = 10; // Auto spin 10 times
            autoButton.bg.clear();
            autoButton.bg.beginFill(0x2c3e50);
            autoButton.bg.lineStyle(2, 0x3498db);
            autoButton.bg.drawRoundedRect(0, 0, 70, 50, 10);
            autoButton.bg.endFill();

            if (balance >= currentBet) {
                spinReels();
            }
        } else {
            autoButton.bg.clear();
            autoButton.bg.beginFill(autoButton.originalColor);
            autoButton.bg.lineStyle(2, autoButton.originalColor - 0x111111);
            autoButton.bg.drawRoundedRect(0, 0, 70, 50, 10);
            autoButton.bg.endFill();
        }
    });

    // Bonus buy button
    bonusButton.on('pointerdown', () => {
        if (isSpinning) return;

        const bonusCost = currentBet * 100; // Bonus costs 100x bet
        if (balance >= bonusCost) {
            balance -= bonusCost;
            updateBalanceDisplay();

            // Trigger bonus round (placeholder - you can implement bonus logic here)
            console.log('Bonus round activated!');

            // For now, give a guaranteed big win
            const bonusWin = bonusCost * 2;
            balance += bonusWin;
            updateBalanceDisplay();
            console.log(`Bonus win: $${bonusWin}!`);
        } else {
            console.log('Insufficient balance for bonus buy!');
        }
    });

    // Add hover effects to all buttons
    [spinButton, autoButton, bonusButton, betMinusBtn, betPlusBtn].forEach(button => {
        button.on('pointerover', () => {
            if (!isSpinning) {
                button.alpha = 0.8;
            }
        });

        button.on('pointerout', () => {
            button.alpha = 1;
        });
    });

    // 🔹 Remove old button code and replace with new spin function
    function spin() {
        if (isSpinning || autoSpin) return;
        console.log('Spin triggered');
        spinReels();
    }
})();
