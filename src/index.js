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
    const SYMBOL_WIDTH = 130;
    const SYMBOL_HEIGHT = 118;
    const SYMBOL_SPACING = 1;

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

    function resizeCanvas() {
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

    // Walking wild state
    const WALKING_WILD_INDEX = 13;
    let walkingWilds = [];
    let animatingWild = false;
    let cat5WildTexture = null;
    let currentWildSprite = null; // Hold the wild sprite to move it

    // Background
    let backgroundSprite = null;
    try {
        const backgroundTexture = await Assets.load('/board_frame_001.png');
        backgroundSprite = new Sprite(backgroundTexture);
        backgroundSprite.width = SCREEN_WIDTH;
        backgroundSprite.height = SCREEN_HEIGHT;
        backgroundSprite.x = 0;
        backgroundSprite.y = 0;
        app.stage.addChild(backgroundSprite);
        console.log('✅ Hurricane Chase background loaded successfully!');
    } catch (error) {
        console.log('❌ Background could not be loaded:', error);
        const fallbackBg = new Graphics();
        fallbackBg.fill(0x1a1a2e);
        fallbackBg.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        fallbackBg.fill();
        app.stage.addChild(fallbackBg);
    }

    // Slot container
    const slotContainer = new Container();
    const gridStartX = (SCREEN_WIDTH - GRID_WIDTH) / 2 + 15;
    const gridStartY = (SCREEN_HEIGHT - GRID_HEIGHT) / 2 + 75;
    slotContainer.x = gridStartX;
    slotContainer.y = gridStartY;

    // Mask
    const slotMask = new Graphics();
    slotMask.fill(0xff0000);
    slotMask.rect(0, 10, GRID_WIDTH, GRID_HEIGHT - 10);
    slotMask.fill();
    slotMask.x = gridStartX;
    slotMask.y = gridStartY;
    slotContainer.mask = slotMask;
    app.stage.addChild(slotMask);
    app.stage.addChild(slotContainer);

    // UI
    const uiContainer = new Container();
    app.stage.addChild(uiContainer);

    // Balance display
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

    // Bet display
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

    // Spin button
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

    // Asset loading
    let scatterSpriteSheet = null;
    let symbolSpriteSheet = null;
    let houseScatterFrames = [];
    let hurricaneScatterFrames = [];

    try {
        scatterSpriteSheet = await Assets.load('/scatter-sprite-animation-seq/scatter.png.json');
        for (let i = 1; i <= 6; i++) {
            const frameName = `housescatter_0${i}.png`;
            if (scatterSpriteSheet.textures[frameName]) {
                houseScatterFrames.push(scatterSpriteSheet.textures[frameName]);
            }
        }
        for (let i = 1; i <= 6; i++) {
            const frameName = `hurricanescatter_0${i}.png`;
            if (scatterSpriteSheet.textures[frameName]) {
                hurricaneScatterFrames.push(scatterSpriteSheet.textures[frameName]);
            }
        }
        console.log('✅ Scatter sprite sheet loaded successfully!');
        console.log(`✅ House scatter frames: ${houseScatterFrames.length}`);
        console.log(`✅ Hurricane scatter frames: ${hurricaneScatterFrames.length}`);
    } catch (error) {
        console.log('❌ Could not load scatter sprite sheet:', error);
    }

    try {
        symbolSpriteSheet = await Assets.load('/symbol-sprites/symbols.png.json');
        console.log('✅ Symbol sprite sheet loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load symbol sprite sheet:', error);
    }

    // Load CAT5 wild sprite
    try {
        const catWildSheet = await Assets.load('/cat1-5.png.json');
        cat5WildTexture = catWildSheet.textures["5sprite-removebg-preview.png"];
        console.log('✅ Cat5 Wild loaded!');
    } catch (error) {
        console.log('❌ Could not load Cat5 Wild:', error);
    }

    function createTempSymbol(symbolType) {
        if (houseScatterFrames.length > 0 && symbolType === 0) {
            const animatedSprite = new Container();
            const sprite = new Sprite(houseScatterFrames[0]);
            sprite.width = SYMBOL_WIDTH;
            sprite.height = SYMBOL_HEIGHT;
            animatedSprite.addChild(sprite);
            animatedSprite.isScatter = true;
            animatedSprite.frames = houseScatterFrames;
            animatedSprite.currentFrame = 0;
            animatedSprite.sprite = sprite;
            return animatedSprite;
        }
        if (hurricaneScatterFrames.length > 0 && symbolType === 1) {
            const animatedSprite = new Container();
            const sprite = new Sprite(hurricaneScatterFrames[0]);
            sprite.width = SYMBOL_WIDTH;
            sprite.height = SYMBOL_HEIGHT;
            animatedSprite.addChild(sprite);
            animatedSprite.isScatter = true;
            animatedSprite.frames = hurricaneScatterFrames;
            animatedSprite.currentFrame = 0;
            animatedSprite.sprite = sprite;
            return animatedSprite;
        }
        if (symbolType === WALKING_WILD_INDEX && cat5WildTexture) {
            return cat5WildTexture;
        }
        if (symbolSpriteSheet) {
            const symbolNames = [
                null,
                null,
                'storm1.png',
                'radio_frame_001.png',
                'water_frame_001.png',
                'windsock_frame_001.png',
                'evacsign_frame_001.png',
                'flashlight_frame_001.png',
                'ace_frame.png',
                'king_frame.png',
                'queen_frame.png',
                'jack_frame.png',
                '10_frame.png'
            ];
            if (symbolType >= 2 && symbolType < symbolNames.length && symbolNames[symbolType]) {
                const symbolTexture = symbolSpriteSheet.textures[symbolNames[symbolType]];
                if (symbolTexture) {
                    return symbolTexture;
                }
            }
        }
        const colors = [
            0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57,
            0xff9ff3, 0x54a0ff, 0x5f27cd, 0x00d2d3, 0xff9f43,
            0xe74c3c, 0x2ecc71, 0x3498db
        ];
        const symbolContainer = new Container();
        const graphics = new Graphics();
        graphics.fill(colors[symbolType % colors.length]);
        graphics.setStrokeStyle({ color: 0xffffff, width: 1, alpha: 0.3 });
        graphics.roundRect(0, 0, SYMBOL_WIDTH, SYMBOL_HEIGHT, 4);
        graphics.fill();
        graphics.stroke();
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
        symbolContainer.addChild(graphics);
        symbolContainer.addChild(symbolText);
        return app.renderer.generateTexture(symbolContainer);
    }

    // Symbol textures: includes Cat5 wild at index 13
    const symbolTextures = [];
    for (let i = 0; i <= WALKING_WILD_INDEX; i++) {
        symbolTextures.push(createTempSymbol(i));
    }

    function startScatterAnimation(symbol) {
        if (!symbol.isScatter || !symbol.frames || symbol.frames.length === 0) return;
        let frameIndex = 0;
        let loopCount = 0;
        const maxLoops = 2;
        const animationInterval = setInterval(() => {
            symbol.sprite.texture = symbol.frames[frameIndex];
            frameIndex++;
            if (frameIndex >= symbol.frames.length) {
                frameIndex = 0;
                loopCount++;
                if (loopCount >= maxLoops) {
                    clearInterval(animationInterval);
                    console.log('🎬 Scatter animation completed!');
                }
            }
        }, 150);
    }

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
            if (symbolTexture && symbolTexture.isScatter) {
                symbol = symbolTexture;
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

    // ------- WALKING WILD ANIMATION SYSTEM -------

    // Animate all symbols in the column dropping out, then do first wild drop
    function startWalkingWildDrop(col) {
        if (animatingWild) return;
        animatingWild = true;

        let completed = 0;
        for (let row = 0; row < ROWS; row++) {
            const symbol = slots[col][row];

            // Compute global position before moving to stage
            const globalX = slotContainer.x + reelContainers[col].x + symbol.x;
            const startY = slotContainer.y + reelContainers[col].y + symbol.y;
            symbol.x = globalX;
            symbol.y = startY;
            app.stage.addChild(symbol);

            const targetY = SCREEN_HEIGHT + SYMBOL_HEIGHT;
            let t = 0;
            const duration = 50;

            app.ticker.add(function dropTicker() {
                t++;
                symbol.y = startY + ((targetY - startY) * t / duration);
                if (t >= duration) {
                    app.ticker.remove(dropTicker);
                    app.stage.removeChild(symbol);
                    completed++;
                    if (completed === ROWS) {
                        blankReel(col);
                        setTimeout(() => dropExpandWild(col), 350);
                    }
                }
            });
        }
    }

    // Blank the reel with a blue panel
    function blankReel(col) {
        for (let row = 0; row < ROWS; row++) {
            reelContainers[col].removeChild(slots[col][row]);
            slots[col][row] = null;
        }
        const bluePanel = new Graphics();
        bluePanel.beginFill(0x3399ff, 0.92);
        bluePanel.drawRoundedRect(0, 0, SYMBOL_WIDTH, GRID_HEIGHT, 18);
        bluePanel.endFill();
        bluePanel.name = 'wild-panel-bg';
        reelContainers[col].addChild(bluePanel);
    }

    // Drop one Cat5 wild, centered in the blue panel
    function dropExpandWild(col) {
        reelContainers[col].removeChildren();

        // Blue panel background fills the entire column
        const bluePanel = new Graphics();
        bluePanel.beginFill(0x3399ff, 0.92);
        bluePanel.drawRoundedRect(0, 0, SYMBOL_WIDTH, GRID_HEIGHT, 18);
        bluePanel.endFill();
        bluePanel.name = 'wild-panel-bg';
        reelContainers[col].addChild(bluePanel);

        // Only one Cat5 wild, centered vertically in the panel
        const wild = new Sprite(cat5WildTexture);
        wild.width = SYMBOL_WIDTH;
        wild.height = SYMBOL_HEIGHT;
        wild.x = 0;
        wild.y = (GRID_HEIGHT - SYMBOL_HEIGHT) / 2;
        currentWildSprite = wild;

        // Start above panel for drop animation
        const startY = -SYMBOL_HEIGHT;
        const targetY = wild.y;
        wild.y = startY;
        reelContainers[col].addChild(wild);

        let t = 0;
        const duration = 32;
        app.ticker.add(function wildDropTicker() {
            t++;
            wild.y = startY + ((targetY - startY) * t / duration);
            if (t >= duration) {
                wild.y = targetY;
                app.ticker.remove(wildDropTicker);
                // For logic: all slots in this column point to this wild
                for (let row = 0; row < ROWS; row++) {
                    slots[col][row] = wild;
                }
                animatingWild = false;
            }
        });
    }

    // Slide the wild and blue panel left one column, no trapdoor!
    function slideWildToNextCol() {
        if (walkingWilds.length === 0) return;
        const prevCol = walkingWilds[0].col;
        if (prevCol === 0) {
            // Remove wild state if at leftmost
            walkingWilds = [];
            return;
        }

        const nextCol = prevCol - 1;
        const prevContainer = reelContainers[prevCol];
        const nextContainer = reelContainers[nextCol];

        // Find the blue panel and wild in prevCol
        const bluePanel = prevContainer.getChildByName('wild-panel-bg');
        const wild = currentWildSprite;

        if (!bluePanel || !wild) {
            animatingWild = false;
            return;
        }

        // Remove from prevCol
        prevContainer.removeChild(bluePanel);
        prevContainer.removeChild(wild);

        // Set initial positions (fixed at start)
        bluePanel.x = 0; bluePanel.y = 0;
        wild.x = 0; wild.y = (GRID_HEIGHT - SYMBOL_HEIGHT) / 2;

        // Add to nextCol, but start at prevCol's X for animation
        nextContainer.addChild(bluePanel);
        nextContainer.addChild(wild);

        // Animate X from prevCol to nextCol in slotContainer space
        const startX = reelContainers[prevCol].x;
        const endX = reelContainers[nextCol].x;
        let t = 0;
        const duration = 24;
        animatingWild = true;

        // We'll animate by moving the wild/panel in nextCol from startX to endX, then snap to x=0
        bluePanel.x = startX - endX;
        wild.x = startX - endX;

        app.ticker.add(function slideTicker() {
            t++;
            const interp = (startX - endX) * (1 - t / duration);
            bluePanel.x = interp;
            wild.x = interp;
            if (t >= duration) {
                bluePanel.x = 0;
                wild.x = 0;
                app.ticker.remove(slideTicker);
                // Set slots in new col to wild, clear old
                for (let row = 0; row < ROWS; row++) {
                    slots[nextCol][row] = wild;
                    slots[prevCol][row] = null;
                }
                walkingWilds[0].col = nextCol;
                animatingWild = false;
            }
        });
    }

    function updateBalanceDisplay() {
        balanceText.text = `Balance: $${balance}`;
    }

    // Spin function with walking wild
    function spin() {
        if (isSpinning || balance < currentBet || animatingWild) return;

        // If wild is on the board, slide it left instead of trapdoor
        if (walkingWilds.length > 0) {
            slideWildToNextCol();
            const checkWildAnim = setInterval(() => {
                if (!animatingWild) {
                    clearInterval(checkWildAnim);
                    beginSpin();
                }
            }, 30);
        } else {
            beginSpin();
        }
    }

    function beginSpin() {
        balance -= currentBet;
        updateBalanceDisplay();
        isSpinning = true;
        spinButtonText.text = 'SPINNING...';

        const spinDurations = [2000, 2500, 3000, 3500, 4000];
        const reelAnimations = [];

        for (let col = 0; col < COLS; col++) {
            let spinCount = 0;
            const maxSpins = 20 + (col * 5);

            const willWildSlideHere = walkingWilds.length > 0 && walkingWilds[0].col - 1 === col;
            const isWildCol = walkingWilds.length > 0 && walkingWilds[0].col === col;

            const reelSpin = setInterval(() => {
                // Don't randomize the destination or current wild column
                if (isWildCol || willWildSlideHere) {
                    spinCount++;
                    if (spinCount >= maxSpins) {
                        clearInterval(reelSpin);
                        reelAnimations[col] = true;
                        if (reelAnimations.filter(stopped => stopped).length === COLS) {
                            isSpinning = false;
                            spinButtonText.text = 'SPIN';
                            const winAmount = Math.floor(Math.random() * currentBet * 3);
                            if (winAmount > 0) {
                                balance += winAmount;
                                updateBalanceDisplay();
                                console.log(`🎉 Win: $${winAmount}!`);
                            }
                            // Only spawn a wild if there isn't one
                            if (!animatingWild && walkingWilds.length === 0 && Math.random() < 0.6 && cat5WildTexture) {
                                const spawnCol = COLS - 1;
                                walkingWilds = [{ col: spawnCol, stepsRemaining: spawnCol }];
                                startWalkingWildDrop(spawnCol);
                            }
                        }
                    }
                    return;
                }

                for (let row = 0; row < ROWS; row++) {
                    reelContainers[col].removeChild(slots[col][row]);
                    const randomSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                    const randomTexture = symbolTextures[randomSymbolIndex];
                    let newSymbol;
                    if (randomTexture && randomTexture.isScatter) {
                        newSymbol = createTempSymbol(randomSymbolIndex);
                    } else {
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

                if (spinCount >= maxSpins) {
                    clearInterval(reelSpin);

                    for (let row = 0; row < ROWS; row++) {
                        reelContainers[col].removeChild(slots[col][row]);
                        const finalSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                        const finalTexture = symbolTextures[finalSymbolIndex];
                        let finalSymbol;
                        if (finalTexture && finalTexture.isScatter) {
                            finalSymbol = createTempSymbol(finalSymbolIndex);
                            setTimeout(() => {
                                startScatterAnimation(finalSymbol);
                            }, 500);
                        } else {
                            finalSymbol = new Sprite(finalTexture);
                            finalSymbol.width = SYMBOL_WIDTH;
                            finalSymbol.height = SYMBOL_HEIGHT;
                        }
                        finalSymbol.x = 0;
                        finalSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                        reelContainers[col].addChild(finalSymbol);
                        slots[col][row] = finalSymbol;
                    }

                    console.log(`🎰 Reel ${col + 1} stopped!`);

                    reelAnimations[col] = true;
                    if (reelAnimations.filter(stopped => stopped).length === COLS) {
                        isSpinning = false;
                        spinButtonText.text = 'SPIN';

                        const winAmount = Math.floor(Math.random() * currentBet * 3);
                        if (winAmount > 0) {
                            balance += winAmount;
                            updateBalanceDisplay();
                            console.log(`🎉 Win: $${winAmount}!`);
                        }

                        // For demo: randomly spawn walking wild in rightmost reel if none exists
                        if (!animatingWild && walkingWilds.length === 0 && Math.random() < 0.6 && cat5WildTexture) {
                            const spawnCol = COLS - 1;
                            walkingWilds = [{ col: spawnCol, stepsRemaining: spawnCol }];
                            startWalkingWildDrop(spawnCol);
                        }
                    }
                }
            }, 100 - (col * 10));
            reelAnimations[col] = false;
        }
    }

    spinButton.on('pointerdown', spin);
    spinButton.on('pointerover', () => {
        spinButton.alpha = 0.8;
    });
    spinButton.on('pointerout', () => {
        spinButton.alpha = 1.0;
    });
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