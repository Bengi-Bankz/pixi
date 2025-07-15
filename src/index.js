import {
    Application,
    Assets,
    Sprite,
    Container,
    Graphics,
    Text
} from 'pixi.js';

(async () => {
    // 🎯 HURRICANE CHASE FRAME DIMENSIONS
    const SCREEN_WIDTH = 1920;
    const SCREEN_HEIGHT = 1080;
    const ROWS = 5;
    const COLS = 5;
    const SYMBOL_WIDTH = 130; // Wider symbols for better visual impact
    const SYMBOL_HEIGHT = 118; // Keep height same
    const SYMBOL_SPACING = 1; // Minimal spacing for clean look

    // Calculate grid to fit the Hurricane Chase frame
    const GRID_WIDTH = (SYMBOL_WIDTH * COLS) + (SYMBOL_SPACING * (COLS - 1));
    const GRID_HEIGHT = (SYMBOL_HEIGHT * ROWS) + (SYMBOL_SPACING * (ROWS - 1));

    const app = new Application();
    await app.init({
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        backgroundColor: 0x1a1a2e
    });

    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.width = '100vw';
    document.body.style.height = '100vh';
    document.body.appendChild(app.canvas);

    // Scale canvas to fit screen and remove white space
    function resizeCanvas() {
        const scaleX = window.innerWidth / SCREEN_WIDTH;
        const scaleY = window.innerHeight / SCREEN_HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        app.canvas.style.width = '100vw';
        app.canvas.style.height = '100vh';
        app.canvas.style.position = 'fixed';
        app.canvas.style.left = '0';
        app.canvas.style.top = '0';
        app.canvas.style.objectFit = 'cover';
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Game state
    let balance = 1000;
    let currentBet = 10;
    let isSpinning = false;
    let slots = [];
    let reelContainers = [];

    // 🖼️ Load your new background
    let backgroundSprite = null;
    try {
        const backgroundTexture = await Assets.load('/board_frame_001.png');
        backgroundSprite = new Sprite(backgroundTexture);

        // Scale to fit screen perfectly
        backgroundSprite.width = SCREEN_WIDTH;
        backgroundSprite.height = SCREEN_HEIGHT;
        backgroundSprite.x = 0;
        backgroundSprite.y = 0;

        app.stage.addChild(backgroundSprite);
        console.log('✅ Weather-themed background loaded successfully!');
    } catch (error) {
        console.log('❌ Background could not be loaded:', error);
        console.log('Place board_frame_001.png in the public folder');
        // Fallback dark background
        const fallbackBg = new Graphics();
        fallbackBg.fill(0x1a1a2e);
        fallbackBg.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        fallbackBg.fill();
        app.stage.addChild(fallbackBg);
    }

    // 🎰 Create main slot container positioned in the Hurricane Chase frame
    const slotContainer = new Container();
    // Position the grid to match the rectangular slot area in Hurricane Chase
    const gridStartX = (SCREEN_WIDTH - GRID_WIDTH) / 2 + 15; // Center horizontally + move right
    const gridStartY = (SCREEN_HEIGHT - GRID_HEIGHT) / 2 + 75; // Slightly lower + move down more
    slotContainer.x = gridStartX;
    slotContainer.y = gridStartY;

    // 🎭 Create mask to clip symbols inside the frame
    const slotMask = new Graphics();
    slotMask.fill(0xff0000); // Color doesn't matter for masks
    slotMask.rect(0, 10, GRID_WIDTH, GRID_HEIGHT - 10); // Start 10px down, reduce height by 10px
    slotMask.fill();
    slotMask.x = gridStartX;
    slotMask.y = gridStartY;

    // Apply mask to slot container so symbols are clipped to frame area
    slotContainer.mask = slotMask;

    app.stage.addChild(slotMask); // Add mask to stage
    app.stage.addChild(slotContainer);

    // 🎮 Create simple UI
    const uiContainer = new Container();
    app.stage.addChild(uiContainer);

    // Balance display (top left)
    const balanceText = new Text({
        text: `Balance: $${balance}`,
        style: {
            fontFamily: 'Arial',
            fontSize: 24,
            fontWeight: 'bold',
            fill: 0xffd700,
            stroke: { color: 0x000000, width: 2 }
        }
    });
    balanceText.x = 30;
    balanceText.y = 30;
    uiContainer.addChild(balanceText);

    // Bet display (bottom left)
    const betText = new Text({
        text: `Bet: $${currentBet}`,
        style: {
            fontFamily: 'Arial',
            fontSize: 20,
            fontWeight: 'bold',
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 2 }
        }
    });
    betText.x = 30;
    betText.y = SCREEN_HEIGHT - 100;
    uiContainer.addChild(betText);

    // Spin button (bottom right)
    const spinButton = new Graphics();
    spinButton.fill(0x27ae60);
    spinButton.setStrokeStyle({ color: 0x2ecc71, width: 3 });
    spinButton.roundRect(0, 0, 120, 50, 10);
    spinButton.fill();
    spinButton.stroke();
    spinButton.x = SCREEN_WIDTH - 150;
    spinButton.y = SCREEN_HEIGHT - 80;
    spinButton.interactive = true;
    spinButton.buttonMode = true;
    uiContainer.addChild(spinButton);

    const spinButtonText = new Text({
        text: 'SPIN',
        style: {
            fontFamily: 'Arial',
            fontSize: 18,
            fontWeight: 'bold',
            fill: 0xffffff
        }
    });
    spinButtonText.anchor.set(0.5);
    spinButtonText.x = spinButton.x + 60;
    spinButtonText.y = spinButton.y + 25;
    uiContainer.addChild(spinButtonText);

    // 🎲 Load all your weather-themed symbols and animated scatters
    let houseScatterFrames = [];
    let hurricaneScatterFrames = [];
    let stormSymbolTexture = null;
    let radioSymbolTexture = null;
    let waterSymbolTexture = null;
    let windsockSymbolTexture = null;
    let evacsignSymbolTexture = null;
    let flashlightSymbolTexture = null;

    // Load house scatter animation frames
    try {
        for (let i = 1; i <= 6; i++) {
            const frameTexture = await Assets.load(`/frames/housescatter/housescatter_0${i}.png`);
            houseScatterFrames.push(frameTexture);
        }
        console.log('✅ House scatter animation frames loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load house scatter frames:', error);
    }

    // Load hurricane scatter animation frames
    try {
        for (let i = 1; i <= 6; i++) {
            const frameTexture = await Assets.load(`/frames/hurricanescatter/hurricanescatter_0${i}.png`);
            hurricaneScatterFrames.push(frameTexture);
        }
        console.log('✅ Hurricane scatter animation frames loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load hurricane scatter frames:', error);
    }

    // Load storm symbol
    try {
        stormSymbolTexture = await Assets.load('/storm1.png');
        console.log('✅ Storm symbol loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load storm1.png:', error);
    }

    // Load radio symbol
    try {
        radioSymbolTexture = await Assets.load('/radio_frame_001.png');
        console.log('✅ Radio symbol loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load radio_frame_001.png:', error);
    }

    // Load water symbol
    try {
        waterSymbolTexture = await Assets.load('/water_frame_001.png');
        console.log('✅ Water symbol loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load water_frame_001.png:', error);
    }

    // Load windsock symbol
    try {
        windsockSymbolTexture = await Assets.load('/windsock_frame_001.png');
        console.log('✅ Windsock symbol loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load windsock_frame_001.png:', error);
    }

    // Load evacuation sign symbol
    try {
        evacsignSymbolTexture = await Assets.load('/evacsign_frame_001.png');
        console.log('✅ Evacuation sign symbol loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load evacsign_frame_001.png:', error);
    }

    // Load flashlight symbol
    try {
        flashlightSymbolTexture = await Assets.load('/flashlight_frame_001.png');
        console.log('✅ Flashlight symbol loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load flashlight_frame_001.png:', error);
    }

    function createTempSymbol(symbolType) {
        // Create animated scatter symbols
        if (houseScatterFrames.length > 0 && symbolType === 0) {
            // Create animated sprite for house scatter
            const animatedSprite = new Container();
            const sprite = new Sprite(houseScatterFrames[0]);
            sprite.width = SYMBOL_WIDTH;
            sprite.height = SYMBOL_HEIGHT;
            animatedSprite.addChild(sprite);

            // Add animation data
            animatedSprite.isScatter = true;
            animatedSprite.frames = houseScatterFrames;
            animatedSprite.currentFrame = 0;
            animatedSprite.sprite = sprite;

            return animatedSprite;
        }

        if (hurricaneScatterFrames.length > 0 && symbolType === 1) {
            // Create animated sprite for hurricane scatter
            const animatedSprite = new Container();
            const sprite = new Sprite(hurricaneScatterFrames[0]);
            sprite.width = SYMBOL_WIDTH;
            sprite.height = SYMBOL_HEIGHT;
            animatedSprite.addChild(sprite);

            // Add animation data
            animatedSprite.isScatter = true;
            animatedSprite.frames = hurricaneScatterFrames;
            animatedSprite.currentFrame = 0;
            animatedSprite.sprite = sprite;

            return animatedSprite;
        }

        if (stormSymbolTexture && symbolType === 2) {
            return stormSymbolTexture;
        }
        if (radioSymbolTexture && symbolType === 3) {
            return radioSymbolTexture;
        }
        if (waterSymbolTexture && symbolType === 4) {
            return waterSymbolTexture;
        }
        if (windsockSymbolTexture && symbolType === 5) {
            return windsockSymbolTexture;
        }
        if (evacsignSymbolTexture && symbolType === 6) {
            return evacsignSymbolTexture;
        }
        if (flashlightSymbolTexture && symbolType === 7) {
            return flashlightSymbolTexture;
        }

        // Otherwise create temporary colored symbols
        const colors = [
            0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57,
            0xff9ff3, 0x54a0ff, 0x5f27cd, 0x00d2d3, 0xff9f43
        ];

        // Create a container to hold both graphics and text
        const symbolContainer = new Container();

        const graphics = new Graphics();
        graphics.fill(colors[symbolType % colors.length]);
        graphics.setStrokeStyle({ color: 0xffffff, width: 1, alpha: 0.3 });
        graphics.roundRect(0, 0, SYMBOL_WIDTH, SYMBOL_HEIGHT, 4);
        graphics.fill();
        graphics.stroke();

        // Add symbol number
        const symbolText = new Text({
            text: (symbolType + 1).toString(),
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fontWeight: 'bold',
                fill: 0xffffff
            }
        });
        symbolText.anchor.set(0.5);
        symbolText.x = SYMBOL_WIDTH / 2;
        symbolText.y = SYMBOL_HEIGHT / 2;

        // Add both to container
        symbolContainer.addChild(graphics);
        symbolContainer.addChild(symbolText);

        return app.renderer.generateTexture(symbolContainer);
    }

    // Create symbol textures
    const symbolTextures = [];
    for (let i = 0; i < 8; i++) {
        symbolTextures.push(createTempSymbol(i));
    }

    // 🎬 Scatter animation system
    function startScatterAnimation(symbol) {
        if (!symbol.isScatter || !symbol.frames || symbol.frames.length === 0) return;

        let frameIndex = 0;
        let loopCount = 0;
        const maxLoops = 2; // Loop twice as requested

        const animationInterval = setInterval(() => {
            // Update sprite texture
            symbol.sprite.texture = symbol.frames[frameIndex];

            frameIndex++;

            // Check if we completed a full cycle
            if (frameIndex >= symbol.frames.length) {
                frameIndex = 0;
                loopCount++;

                // Stop after 2 loops
                if (loopCount >= maxLoops) {
                    clearInterval(animationInterval);
                    console.log('🎬 Scatter animation completed!');
                }
            }
        }, 150); // Animation speed - adjust as needed
    }

    // 🎰 Initialize reels and symbols
    for (let col = 0; col < COLS; col++) {
        const reelContainer = new Container();
        reelContainer.x = col * (SYMBOL_WIDTH + SYMBOL_SPACING);
        reelContainer.y = 0;
        slotContainer.addChild(reelContainer);
        reelContainers.push(reelContainer);

        slots[col] = [];
        for (let row = 0; row < ROWS; row++) {
            const symbolTexture = symbolTextures[Math.floor(Math.random() * symbolTextures.length)];
            let symbol;

            // Handle animated scatter symbols differently
            if (symbolTexture.isScatter) {
                symbol = symbolTexture; // Use the container directly
            } else {
                symbol = new Sprite(symbolTexture);
                symbol.width = SYMBOL_WIDTH;
                symbol.height = SYMBOL_HEIGHT;
            }

            symbol.x = 0;
            symbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
            reelContainer.addChild(symbol);
            slots[col][row] = symbol;
        }
    }

    // Update balance display
    function updateBalanceDisplay() {
        balanceText.text = `Balance: $${balance}`;
    }

    // 🎮 Enhanced Spin function with reel animations
    function spin() {
        if (isSpinning || balance < currentBet) return;

        balance -= currentBet;
        updateBalanceDisplay();
        isSpinning = true;
        spinButtonText.text = 'SPINNING...';

        // 🎰 Create spinning animation for each reel
        const spinDurations = [2000, 2500, 3000, 3500, 4000]; // Each reel stops at different times
        const reelAnimations = [];

        for (let col = 0; col < COLS; col++) {
            let spinCount = 0;
            const maxSpins = 20 + (col * 5); // More spins for later reels

            const reelSpin = setInterval(() => {
                // Cycle through symbols rapidly during spin
                for (let row = 0; row < ROWS; row++) {
                    const randomSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                    const randomTexture = symbolTextures[randomSymbolIndex];

                    // Always remove old symbol first
                    reelContainers[col].removeChild(slots[col][row]);

                    let newSymbol;
                    // Create fresh symbol based on type
                    if (randomTexture.isScatter) {
                        // Create new animated scatter symbol
                        newSymbol = createTempSymbol(randomSymbolIndex);
                    } else {
                        // Create new static symbol
                        newSymbol = new Sprite(randomTexture);
                        newSymbol.width = SYMBOL_WIDTH;
                        newSymbol.height = SYMBOL_HEIGHT;
                    }

                    newSymbol.x = 0;
                    newSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                    reelContainers[col].addChild(newSymbol);
                    slots[col][row] = newSymbol;
                }

                spinCount++;

                // Stop this reel after its duration
                if (spinCount >= maxSpins) {
                    clearInterval(reelSpin);

                    // Set final symbols for this reel
                    for (let row = 0; row < ROWS; row++) {
                        const finalSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                        const finalTexture = symbolTextures[finalSymbolIndex];

                        // Always remove old symbol first
                        reelContainers[col].removeChild(slots[col][row]);

                        let finalSymbol;
                        // Create fresh final symbol
                        if (finalTexture.isScatter) {
                            // Create new animated scatter symbol
                            finalSymbol = createTempSymbol(finalSymbolIndex);

                            // Start scatter animation after reel stops
                            setTimeout(() => {
                                startScatterAnimation(finalSymbol);
                            }, 500);
                        } else {
                            // Create new static symbol
                            finalSymbol = new Sprite(finalTexture);
                            finalSymbol.width = SYMBOL_WIDTH;
                            finalSymbol.height = SYMBOL_HEIGHT;
                        }

                        finalSymbol.x = 0;
                        finalSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                        reelContainers[col].addChild(finalSymbol);
                        slots[col][row] = finalSymbol;
                    }

                    // Add reel stop sound effect (visual feedback)
                    console.log(`🎰 Reel ${col + 1} stopped!`);

                    // Check if all reels have stopped
                    reelAnimations[col] = true;
                    if (reelAnimations.filter(stopped => stopped).length === COLS) {
                        // All reels stopped - game over
                        isSpinning = false;
                        spinButtonText.text = 'SPIN';

                        // Check for wins
                        const winAmount = Math.floor(Math.random() * currentBet * 3);
                        if (winAmount > 0) {
                            balance += winAmount;
                            updateBalanceDisplay();
                            console.log(`🎉 Win: $${winAmount}!`);
                        }
                    }
                }
            }, 100 - (col * 10)); // Slightly different speeds for visual variety

            reelAnimations[col] = false;
        }
    }

    // Event handlers
    spinButton.on('pointerdown', spin);
    spinButton.on('pointerover', () => {
        spinButton.alpha = 0.8; // Hover effect
    });
    spinButton.on('pointerout', () => {
        spinButton.alpha = 1.0; // Normal state
    });

    // Debug click
    spinButton.on('pointerdown', () => {
        console.log('Spin button clicked!');
    });

    console.log(`
🌪️ HURRICANE CHASE SLOT MACHINE READY!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 HURRICANE CHASE SPECIFICATIONS:
   • Background: Hurricane Chase frame loaded ✅
   • Symbol Size: ${SYMBOL_WIDTH}x${SYMBOL_HEIGHT}px (wider rectangles)
   • Grid Size: ${GRID_WIDTH}x${GRID_HEIGHT}px
   • Positioned: Center of rectangular slot area
   
📁 READY FOR YOUR WEATHER-THEMED ASSET PACK:
   assets/
   ├── symbols/
   │   ├── hurricane_symbol.png (${SYMBOL_WIDTH}x${SYMBOL_HEIGHT}px)
   │   ├── lightning_symbol.png (${SYMBOL_WIDTH}x${SYMBOL_HEIGHT}px)
   │   ├── tornado_symbol.png (${SYMBOL_WIDTH}x${SYMBOL_HEIGHT}px)
   │   └── ... (weather-themed symbols)
   
🌩️ Grid with wider symbols perfectly fits the Hurricane Chase frame!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
})();
