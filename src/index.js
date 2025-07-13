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
    let slots = [];
    let reelContainers = []; // Store reel containers for spinning animation
    let allSymbols = {}; // Store all symbols organized by type
    let backgroundSprite = null; // Store background sprite

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
        
        // For regular gameplay, use first symbol of each type
        if (allSymbols.ones.length > 0) allSymbols.regular.push(allSymbols.ones[0]);
        if (allSymbols.twos.length > 0) allSymbols.regular.push(allSymbols.twos[0]);
        
        console.log(`Loaded ${allSymbols.ones.length} '1' symbols and ${allSymbols.twos.length} '2' symbols from UI atlas`);
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

    // 🔹 Function to create a random symbol
    function createRandomSymbol() {
        if (allSymbols.regular.length === 0) return null;
        
        const randomTexture = allSymbols.regular[Math.floor(Math.random() * allSymbols.regular.length)];
        const symbol = new Sprite(randomTexture);
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

    // 🔹 Win detection and animation system
    function checkForWins() {
        const winningPositions = [];
        
        // Check for horizontal lines of same symbol type
        for (let row = 0; row < ROWS; row++) {
            let consecutiveCount = 1;
            let currentSymbolType = getSymbolType(slots[row][0]);
            
            for (let col = 1; col < COLS; col++) {
                const symbolType = getSymbolType(slots[row][col]);
                if (symbolType === currentSymbolType && symbolType !== null) {
                    consecutiveCount++;
                } else {
                    if (consecutiveCount >= 3) {
                        // Found a win!
                        for (let i = col - consecutiveCount; i < col; i++) {
                            winningPositions.push({ row, col: i, type: currentSymbolType });
                        }
                    }
                    consecutiveCount = 1;
                    currentSymbolType = symbolType;
                }
            }
            
            // Check the last sequence
            if (consecutiveCount >= 3) {
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
    }
    
    // 🔹 Get symbol type (1 or 2) from texture
    function getSymbolType(symbolSprite) {
        if (!symbolSprite || !symbolSprite.texture) return null;
        
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
            
            const animationFrames = pos.type === '1' ? allSymbols.ones : allSymbols.twos;
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

    // 🔹 Spin function
    function spinReels() {
        if (isSpinning) return;

        isSpinning = true;
        buttonText.text = 'SPINNING...';
        buttonBg.clear();
        buttonBg.beginFill(0x888888);
        buttonBg.drawRoundedRect(0, 0, 150, 60, 15);
        buttonBg.endFill();

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
                    buttonText.text = 'SPIN';
                    buttonBg.clear();
                    buttonBg.beginFill(0x4CAF50);
                    buttonBg.drawRoundedRect(0, 0, 150, 60, 15);
                    buttonBg.endFill();
                    buttonBg.lineStyle(3, 0x2E7D32);
                    buttonBg.drawRoundedRect(0, 0, 150, 60, 15);
                    
                    // Check for wins after spinning stops
                    checkForWins();
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

    // 🔹 Create spin button
    const buttonContainer = new Container();

    // Button background
    const buttonBg = new Graphics();
    buttonBg.beginFill(0x4CAF50);
    buttonBg.drawRoundedRect(0, 0, 150, 60, 15);
    buttonBg.endFill();

    // Button border
    buttonBg.lineStyle(3, 0x2E7D32);
    buttonBg.drawRoundedRect(0, 0, 150, 60, 15);

    // Button text
    const buttonText = new Text('SPIN', {
        fontFamily: 'Arial',
        fontSize: 24,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
        align: 'center'
    });
    buttonText.anchor.set(0.5);
    buttonText.x = 75;
    buttonText.y = 30;

    buttonContainer.addChild(buttonBg);
    buttonContainer.addChild(buttonText);

    // Position button on the right side, vertically centered with screen
    buttonContainer.x = app.screen.width - 200; // 200px from right edge
    buttonContainer.y = app.screen.height * 0.5 - 30; // Vertically centered with screen

    // Make button interactive
    buttonContainer.interactive = true;
    buttonContainer.buttonMode = true;

    // Button hover effects
    buttonContainer.on('pointerover', () => {
        if (!isSpinning) {
            buttonBg.clear();
            buttonBg.beginFill(0x66BB6A);
            buttonBg.drawRoundedRect(0, 0, 150, 60, 15);
            buttonBg.endFill();
            buttonBg.lineStyle(3, 0x2E7D32);
            buttonBg.drawRoundedRect(0, 0, 150, 60, 15);
        }
    });

    buttonContainer.on('pointerout', () => {
        if (!isSpinning) {
            buttonBg.clear();
            buttonBg.beginFill(0x4CAF50);
            buttonBg.drawRoundedRect(0, 0, 150, 60, 15);
            buttonBg.endFill();
            buttonBg.lineStyle(3, 0x2E7D32);
            buttonBg.drawRoundedRect(0, 0, 150, 60, 15);
        }
    });

    // Spin function
    function spin() {
        if (isSpinning) return;

        console.log('Spin triggered');
        spinReels();
    }

    // Add click event to button
    buttonContainer.on('pointerdown', spin);

    app.stage.addChild(buttonContainer);
})();
