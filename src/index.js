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

    // Cat label textures
    let catLabels = []; // Array of 5 textures (Cat 1–5)

    // Animated backgrounds: auto-detect all bg/*.png.json atlases
    let bgSpriteSheets = [];
    let bgFrameArrays = [];
    let bgFrameIndices = [];
    let animatedBgSprites = [];
    let overlayBgSprite = null;
    try {
        // Dynamically find all bg/*.png.json files
        const bgAtlasFiles = [];
        const bgDir = 'bg';
        // List of all possible backgrounds (manually listed for now, can be automated with a build step)
        bgAtlasFiles.push('bg/bg-0.png.json');
        bgAtlasFiles.push('bg/bg-1.png.json');
        bgAtlasFiles.push('bg/bg-0@0.5x.png.json');
        bgAtlasFiles.push('bg/bg-1@0.5x.png.json');
        // If you add more, just add to this array or automate with a build script

        for (let i = 0; i < bgAtlasFiles.length; i++) {
            try {
                const sheet = await Assets.load(bgAtlasFiles[i]);
                const frameNames = Object.keys(sheet.textures)
                    .filter(name => name.startsWith('frame_'))
                    .sort((a, b) => {
                        const na = parseInt(a.match(/(\d+)/)[0], 10);
                        const nb = parseInt(b.match(/(\d+)/)[0], 10);
                        return na - nb;
                    });
                const frames = frameNames.map(name => sheet.textures[name]);
                if (frames.length === 0) continue;
                const sprite = new Sprite(frames[0]);
                sprite.width = SCREEN_WIDTH;
                sprite.height = SCREEN_HEIGHT;
                sprite.x = 0;
                sprite.y = 0;
                // Insert each background in order (0 = bottom, 1 = above, etc)
                app.stage.addChildAt(sprite, i);
                bgSpriteSheets.push(sheet);
                bgFrameArrays.push(frames);
                bgFrameIndices.push(0);
                animatedBgSprites.push(sprite);
                console.log(`✅ Animated background loaded: ${bgAtlasFiles[i]}`);
            } catch (bgErr) {
                console.log(`❌ Could not load background atlas: ${bgAtlasFiles[i]}`, bgErr);
            }
        }

        // Overlay background (board_frame_001.png) above all animated backgrounds
        const overlayTexture = await Assets.load('board_frame_001.png');
        overlayBgSprite = new Sprite(overlayTexture);
        overlayBgSprite.width = SCREEN_WIDTH;
        overlayBgSprite.height = SCREEN_HEIGHT;
        overlayBgSprite.x = 0;
        overlayBgSprite.y = 0;
        // Insert at index = number of animated backgrounds
        app.stage.addChildAt(overlayBgSprite, animatedBgSprites.length);

        // Animate all backgrounds in a loop
        app.ticker.add(() => {
            for (let i = 0; i < animatedBgSprites.length; i++) {
                if (!bgFrameArrays[i] || !bgFrameArrays[i].length) continue;
                bgFrameIndices[i] = (bgFrameIndices[i] + 0.1) % bgFrameArrays[i].length;
                animatedBgSprites[i].texture = bgFrameArrays[i][Math.floor(bgFrameIndices[i])];
            }
        });
        console.log('✅ All animated backgrounds loaded and running!');
        console.log('✅ Overlay background loaded and layered above animated backgrounds!');
    } catch (error) {
        console.log('❌ Animated backgrounds could not be loaded:', error);
        // Fallback: solid color
        const fallbackBg = new Graphics();
        fallbackBg.fill(0x1a1a2e);
        fallbackBg.rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        fallbackBg.fill();
        app.stage.addChildAt(fallbackBg, 0);
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

    // Load Cat1-5 label textures
    for (let i = 1; i <= 5; i++) {
        try {
            const labelTexture = await Assets.load(`labels/${i}label.png`);
            catLabels.push(labelTexture);
        } catch (error) {
            console.error(`❌ Could not load label: labels/${i}label.png`, error);
        }
    }

    try {
        scatterSpriteSheet = await Assets.load('scatter-sprite-animation-seq/scatter.png.json');
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
        symbolSpriteSheet = await Assets.load('symbol-sprites/symbols.png.json');
        console.log('✅ Symbol sprite sheet loaded successfully!');
    } catch (error) {
        console.log('❌ Could not load symbol sprite sheet:', error);
    }

    // Load CAT5 wild sprite
    try {
        const catWildSheet = await Assets.load('cat1-5.png.json');
        cat5WildTexture = catWildSheet.textures["5sprite-removebg-preview.png"];
        console.log('✅ Cat5 Wild loaded!');
    } catch (error) {
        console.log('❌ Could not load Cat5 Wild:', error);
    }

    // Load Storm Chase Cat (storm tracker symbol)
    let stormChaseCatTexture = null;
    try {
        stormChaseCatTexture = await Assets.load('stormchasescat.png');
        console.log('✅ Storm Chase Cat loaded!');
    } catch (error) {
        console.log('❌ Could not load Storm Chase Cat:', error);
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
        // Storm Chase Cat (Storm Tracker) - Index 2
        if (symbolType === 2 && stormChaseCatTexture) {
            const stormContainer = new Container();
            const sprite = new Sprite(stormChaseCatTexture);
            sprite.width = SYMBOL_WIDTH;
            sprite.height = SYMBOL_HEIGHT;
            stormContainer.addChild(sprite);
            stormContainer.isStormTracker = true;
            stormContainer.sprite = sprite;
            return stormContainer;
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
            if (symbolType >= 3 && symbolType < symbolNames.length && symbolNames[symbolType]) {
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

    // Symbol textures: exclude Cat5 wild from regular symbols
    const symbolTextures = [];
    for (let i = 0; i < WALKING_WILD_INDEX; i++) { // Stop before walking wild index
        symbolTextures.push(createTempSymbol(i));
    }
    // Note: WALKING_WILD_INDEX (13) is excluded from regular symbol pool

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

    // Storm tracker pulse animation
    function startStormTrackerPulse(symbol, col, row) {
        if (!symbol.isStormTracker) return;

        console.log(`🌩️ Storm tracker detected at column ${col + 1}, row ${row + 1}!`);

        let pulseCount = 0;
        const maxPulses = 2; // Reduced from 3 to 2
        let growing = true;
        const originalScale = 1.0;
        const maxScale = 1.05; // Reduced from 1.3 to 1.1 (more subtle)
        let currentScale = originalScale;

        const pulseInterval = setInterval(() => {
            if (growing) {
                currentScale += 0.04; // Reduced from 0.05 to 0.02 (slower growth)
                if (currentScale >= maxScale) {
                    growing = false;
                }
            } else {
                currentScale -= 0.02; // Reduced from 0.05 to 0.02 (slower shrink)
                if (currentScale <= originalScale) {
                    growing = true;
                    pulseCount++;
                }
            }

            // Scale the entire container, not just the sprite
            symbol.scale.set(currentScale);

            if (pulseCount >= maxPulses) {
                clearInterval(pulseInterval);
                symbol.scale.set(originalScale);
                console.log('⚡ Storm tracker pulse completed! Triggering storm...');

                // Trigger storm spawn after pulse
                setTimeout(() => {
                    if (!animatingWild && walkingWilds.length === 0) {
                        triggerStormFromTracker();
                    }
                }, 500);
            }
        }, 120); // Increased from 100ms to 120ms (slower overall animation)
    }

    // Trigger storm spawn from storm tracker
    function triggerStormFromTracker() {
        if (!cat5WildTexture || catLabels.length !== 5) {
            console.log('❌ Storm assets not loaded!');
            return;
        }

        const spawnCol = COLS - 1;
        const catCategory = Math.ceil(Math.random() * 5);
        walkingWilds = [{ col: spawnCol, stepsRemaining: spawnCol, cat: catCategory }];
        console.log(`🌪️ Storm tracker triggered Cat ${catCategory} hurricane in column ${spawnCol + 1}!`);
        startWalkingWildDrop(spawnCol);
    }

    // Validate and fix empty slots
    function validateAndFixSlots() {
        let emptyCount = 0;
        for (let col = 0; col < COLS; col++) {
            for (let row = 0; row < ROWS; row++) {
                if (!slots[col][row] || !slots[col][row].parent) {
                    emptyCount++;
                    console.warn(`🔧 Fixing empty slot at column ${col + 1}, row ${row + 1}`);

                    // Create a replacement symbol using only valid symbols (not walking wild)
                    const randomSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                    let replacementSymbol = createTempSymbol(randomSymbolIndex);

                    // If createTempSymbol returned a texture instead of a sprite/container, wrap it
                    if (replacementSymbol && replacementSymbol.baseTexture && !replacementSymbol.addChild) {
                        const spriteWrapper = new Sprite(replacementSymbol);
                        spriteWrapper.width = SYMBOL_WIDTH;
                        spriteWrapper.height = SYMBOL_HEIGHT;
                        replacementSymbol = spriteWrapper;
                    }

                    replacementSymbol.x = 0;
                    replacementSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                    reelContainers[col].addChild(replacementSymbol);
                    slots[col][row] = replacementSymbol;
                }
            }
        }
        if (emptyCount > 0) {
            console.log(`🔧 Fixed ${emptyCount} empty slots`);
        }
        return emptyCount;
    }

    for (let col = 0; col < COLS; col++) {
        const reelContainer = new Container();
        reelContainer.x = col * (SYMBOL_WIDTH + SYMBOL_SPACING);
        reelContainer.y = 0;
        slotContainer.addChild(reelContainer);
        reelContainers.push(reelContainer);

        slots[col] = [];
        for (let row = 0; row < ROWS; row++) {
            // Use only regular symbols (not walking wild)
            const randomSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
            let symbol = createTempSymbol(randomSymbolIndex);

            // If createTempSymbol returned a texture instead of a sprite/container, wrap it
            if (symbol && symbol.baseTexture && !symbol.addChild) {
                const spriteWrapper = new Sprite(symbol);
                spriteWrapper.width = SYMBOL_WIDTH;
                spriteWrapper.height = SYMBOL_HEIGHT;
                symbol = spriteWrapper;
            }

            // Ensure we have a valid symbol
            if (!symbol) {
                console.warn(`⚠️ Failed to create initial symbol for index ${randomSymbolIndex}, using fallback`);
                symbol = createTempSymbol(8); // Use ACE as fallback
                if (symbol && symbol.baseTexture && !symbol.addChild) {
                    const spriteWrapper = new Sprite(symbol);
                    spriteWrapper.width = SYMBOL_WIDTH;
                    spriteWrapper.height = SYMBOL_HEIGHT;
                    symbol = spriteWrapper;
                }
            }

            symbol.x = 0;
            symbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
            reelContainer.addChild(symbol);
            slots[col][row] = symbol;
        }
    }

    // Validate initial grid
    console.log('🔍 Validating initial grid...');
    validateAndFixSlots();

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

    // Drop one CatX wild, centered in the blue panel, with category label
    function dropExpandWild(col) {
        reelContainers[col].removeChildren();

        // Blue panel background fills the entire column
        const bluePanel = new Graphics();
        bluePanel.beginFill(0x3399ff, 0.92);
        bluePanel.drawRoundedRect(0, 0, SYMBOL_WIDTH, GRID_HEIGHT, 18);
        bluePanel.endFill();
        bluePanel.name = 'wild-panel-bg';
        reelContainers[col].addChild(bluePanel);

        // Add the category label sprite at the top of the reel
        const catCategory = walkingWilds[0].cat; // 1-5
        console.log(`🏷️ Adding Cat ${catCategory} label to walking wild in column ${col + 1}`);
        console.log(`🏷️ catLabels.length = ${catLabels.length}, catCategory = ${catCategory}`);
        console.log(`🏷️ Available cat labels:`, catLabels);

        if (catLabels.length >= catCategory && catLabels[catCategory - 1]) {
            console.log(`🏷️ Using texture:`, catLabels[catCategory - 1]);
            const labelSprite = new Sprite(catLabels[catCategory - 1]);
            labelSprite.width = SYMBOL_WIDTH - 4; // Slightly smaller than column for padding
            labelSprite.height = 35; // Slightly shorter for better fit
            labelSprite.x = 2; // Small padding from left edge
            labelSprite.y = -35; // Position above the blue panel but within mask bounds
            labelSprite.name = "cat-label";
            reelContainers[col].addChild(labelSprite);
            console.log(`✅ Cat ${catCategory} label added successfully! Sprite:`, labelSprite);
            console.log(`✅ Label position: x=${labelSprite.x}, y=${labelSprite.y}, width=${labelSprite.width}, height=${labelSprite.height}`);
        } else {
            console.log(`❌ Cat label ${catCategory} not available (only ${catLabels.length} labels loaded)`);
            console.log(`❌ Texture at index ${catCategory - 1}:`, catLabels[catCategory - 1]);
        }

        // Only one CatX wild, centered vertically in the panel
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

    // Start spinning animation for destination column while wild slides
    function startDestinationColumnSpin(col) {
        console.log(`🎰 Starting destination column spin for column ${col + 1}`);

        let spinCount = 0;
        const maxSpins = 8; // Shorter spin since wild is coming

        const columnSpin = setInterval(() => {
            // Only spin if column doesn't have wild elements
            let hasWildElements = false;
            for (let row = 0; row < ROWS; row++) {
                if (slots[col][row] === currentWildSprite) {
                    hasWildElements = true;
                    break;
                }
            }

            if (hasWildElements) {
                clearInterval(columnSpin);
                return;
            }

            // Remove existing symbols and add random spinning ones
            for (let row = 0; row < ROWS; row++) {
                if (slots[col][row] && slots[col][row] !== currentWildSprite) {
                    reelContainers[col].removeChild(slots[col][row]);
                }

                const randomSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                let newSymbol = createTempSymbol(randomSymbolIndex);

                // If createTempSymbol returned a texture instead of a sprite/container, wrap it
                if (newSymbol && newSymbol.baseTexture && !newSymbol.addChild) {
                    const spriteWrapper = new Sprite(newSymbol);
                    spriteWrapper.width = SYMBOL_WIDTH;
                    spriteWrapper.height = SYMBOL_HEIGHT;
                    newSymbol = spriteWrapper;
                }

                newSymbol.x = 0;
                newSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                reelContainers[col].addChild(newSymbol);
                slots[col][row] = newSymbol;
            }

            spinCount++;
            if (spinCount >= maxSpins) {
                clearInterval(columnSpin);
                console.log(`✅ Destination column ${col + 1} spin completed`);
            }
        }, 120); // Slightly slower than regular reels for visual effect
    }

    // Start spinning the column that the wild just stepped off from
    function startColumnSpinAfterWildLeaves(col) {
        console.log(`🌪️ Starting spin for column ${col + 1} after wild stepped off`);

        let spinCount = 0;
        const maxSpins = 12; // Medium spin duration

        const columnSpin = setInterval(() => {
            // Remove existing symbols and add random spinning ones
            for (let row = 0; row < ROWS; row++) {
                // Clear the slot first
                if (slots[col][row]) {
                    // Don't remove if it's somehow still the wild (safety check)
                    if (slots[col][row] !== currentWildSprite) {
                        slots[col][row] = null;
                    }
                }

                const randomSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                let newSymbol = createTempSymbol(randomSymbolIndex);

                // If createTempSymbol returned a texture instead of a sprite/container, wrap it
                if (newSymbol && newSymbol.baseTexture && !newSymbol.addChild) {
                    const spriteWrapper = new Sprite(newSymbol);
                    spriteWrapper.width = SYMBOL_WIDTH;
                    spriteWrapper.height = SYMBOL_HEIGHT;
                    newSymbol = spriteWrapper;
                }

                newSymbol.x = 0;
                newSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                reelContainers[col].addChild(newSymbol);
                slots[col][row] = newSymbol;
            }

            spinCount++;
            if (spinCount >= maxSpins) {
                clearInterval(columnSpin);

                // Final symbols with possible special symbols
                reelContainers[col].removeChildren();
                for (let row = 0; row < ROWS; row++) {
                    const finalSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                    let finalSymbol = createTempSymbol(finalSymbolIndex);

                    // If createTempSymbol returned a texture instead of a sprite/container, wrap it
                    if (finalSymbol && finalSymbol.baseTexture && !finalSymbol.addChild) {
                        const spriteWrapper = new Sprite(finalSymbol);
                        spriteWrapper.width = SYMBOL_WIDTH;
                        spriteWrapper.height = SYMBOL_HEIGHT;
                        finalSymbol = spriteWrapper;
                    }

                    // Check if it's a scatter symbol and start animation
                    if (finalSymbol.isScatter) {
                        setTimeout(() => {
                            startScatterAnimation(finalSymbol);
                        }, 500);
                    }

                    // Check if it's a storm tracker and start pulse
                    if (finalSymbol.isStormTracker) {
                        setTimeout(() => {
                            startStormTrackerPulse(finalSymbol, col, row);
                        }, 600);
                    }

                    finalSymbol.x = 0;
                    finalSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                    reelContainers[col].addChild(finalSymbol);
                    slots[col][row] = finalSymbol;
                }

                console.log(`✅ Column ${col + 1} finished spinning after wild left`);
            }
        }, 100); // Same speed as regular reels
    }

    // Slide the wild, panel, and label left one column, no trapdoor!
    function slideWildToNextCol() {
        if (walkingWilds.length === 0) return;
        const prevCol = walkingWilds[0].col;

        // If wild is already at column 0, mark it for landfall after this spin
        if (prevCol === 0) {
            // Stay on column 0 for one more spin, then remove
            if (walkingWilds[0].landfallNext) {
                // Remove wild state after staying for one spin
                const container = reelContainers[prevCol];
                container.removeChildren();
                for (let row = 0; row < ROWS; row++) {
                    slots[prevCol][row] = null;
                }
                console.log(`🌪️ Cat ${walkingWilds[0].cat} hurricane made landfall!`);
                walkingWilds = [];
                currentWildSprite = null;
                // Immediately fill with static symbols (no respawn spin)
                setTimeout(() => {
                    for (let row = 0; row < ROWS; row++) {
                        const finalSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                        let finalSymbol = createTempSymbol(finalSymbolIndex);
                        if (finalSymbol && finalSymbol.baseTexture && !finalSymbol.addChild) {
                            const spriteWrapper = new Sprite(finalSymbol);
                            spriteWrapper.width = SYMBOL_WIDTH;
                            spriteWrapper.height = SYMBOL_HEIGHT;
                            finalSymbol = spriteWrapper;
                        }
                        finalSymbol.x = 0;
                        finalSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                        reelContainers[prevCol].addChild(finalSymbol);
                        slots[prevCol][row] = finalSymbol;
                    }
                    console.log(`✅ Column ${prevCol + 1} refilled after wild left (no respin)`);
                }, 400);
                return;
            } else {
                // Mark for landfall next time but stay for this spin
                walkingWilds[0].landfallNext = true;
                return;
            }
        }

        const nextCol = prevCol - 1;
        const prevContainer = reelContainers[prevCol];
        const nextContainer = reelContainers[nextCol];

        // Only create trapdoor effect if destination column has regular symbols (not wild)
        // Check if any slot in the destination column contains the current wild sprite
        let hasWildInDestination = false;
        for (let row = 0; row < ROWS; row++) {
            if (slots[nextCol][row] === currentWildSprite) {
                hasWildInDestination = true;
                break;
            }
        }

        if (!hasWildInDestination) {
            createTrapdoorEffect(nextCol);
        }

        // Start spinning the destination column while wild slides
        startDestinationColumnSpin(nextCol);

        // Find the blue panel, wild, and label in prevCol
        const bluePanel = prevContainer.getChildByName('wild-panel-bg');
        const labelSprite = prevContainer.getChildByName('cat-label');
        const wild = currentWildSprite;

        if (!bluePanel || !wild || !labelSprite) {
            animatingWild = false;
            return;
        }

        // Wait a moment for trapdoor effect if it was triggered
        const slideDelay = hasWildInDestination ? 0 : 300;

        setTimeout(() => {
            // Remove from prevCol
            prevContainer.removeChild(bluePanel);
            prevContainer.removeChild(wild);
            prevContainer.removeChild(labelSprite);

            // Set initial positions (fixed at start)
            bluePanel.x = 0; bluePanel.y = 0;
            wild.x = 0; wild.y = (GRID_HEIGHT - SYMBOL_HEIGHT) / 2;
            labelSprite.x = 2; labelSprite.y = -35; // Match the positioning from dropExpandWild

            // Add to nextCol, but start at prevCol's X for animation
            nextContainer.addChild(bluePanel);
            nextContainer.addChild(labelSprite);
            nextContainer.addChild(wild);

            // Animate X from prevCol to nextCol in slotContainer space
            const startX = reelContainers[prevCol].x;
            const endX = reelContainers[nextCol].x;
            let t = 0;
            const duration = 24;
            animatingWild = true;

            // We'll animate by moving the wild/panel/label in nextCol from startX to endX, then snap to x=0
            bluePanel.x = startX - endX;
            wild.x = startX - endX;
            labelSprite.x = startX - endX + 2; // Keep label padding

            app.ticker.add(function slideTicker() {
                t++;
                const interp = (startX - endX) * (1 - t / duration);
                bluePanel.x = interp;
                wild.x = interp;
                labelSprite.x = interp + 2; // Keep label padding
                if (t >= duration) {
                    bluePanel.x = 0;
                    wild.x = 0;
                    labelSprite.x = 2;
                    app.ticker.remove(slideTicker);
                    // Set slots in new col to wild, clear old
                    for (let row = 0; row < ROWS; row++) {
                        slots[nextCol][row] = wild;
                        slots[prevCol][row] = null;
                    }
                    walkingWilds[0].col = nextCol;
                    animatingWild = false;

                    // Start spinning the column the wild just left
                    startColumnSpinAfterWildLeaves(prevCol);
                }
            });
        }, slideDelay);
    }

    // Create trapdoor effect for destination column
    function createTrapdoorEffect(col) {
        console.log(`🕳️ Creating trapdoor effect for column ${col + 1}`);

        let completed = 0;
        let totalSymbols = 0;

        for (let row = 0; row < ROWS; row++) {
            const symbol = slots[col][row];
            if (!symbol || symbol === currentWildSprite) {
                // Skip null symbols and the current wild sprite
                continue;
            }

            totalSymbols++;

            // Compute global position before moving to stage
            const globalX = slotContainer.x + reelContainers[col].x + symbol.x;
            const startY = slotContainer.y + reelContainers[col].y + symbol.y;
            symbol.x = globalX;
            symbol.y = startY;
            app.stage.addChild(symbol);

            const targetY = SCREEN_HEIGHT + SYMBOL_HEIGHT;
            let t = 0;
            const duration = 40;

            app.ticker.add(function trapdoorTicker() {
                t++;
                symbol.y = startY + ((targetY - startY) * t / duration);
                if (t >= duration) {
                    app.ticker.remove(trapdoorTicker);
                    app.stage.removeChild(symbol);
                    completed++;
                    if (completed === totalSymbols) {
                        // Clear only the non-wild symbols from the column
                        for (let row = 0; row < ROWS; row++) {
                            if (slots[col][row] && slots[col][row] !== currentWildSprite) {
                                slots[col][row] = null;
                            }
                        }
                        // Remove children except wild elements
                        const childrenToRemove = [];
                        for (let i = 0; i < reelContainers[col].children.length; i++) {
                            const child = reelContainers[col].children[i];
                            if (child !== currentWildSprite &&
                                child.name !== 'wild-panel-bg' &&
                                child.name !== 'cat-label') {
                                childrenToRemove.push(child);
                            }
                        }
                        childrenToRemove.forEach(child => reelContainers[col].removeChild(child));
                        console.log(`✅ Trapdoor effect completed for column ${col + 1}`);
                    }
                }
            });
        }

        // If no symbols to drop, consider it completed immediately
        if (totalSymbols === 0) {
            console.log(`✅ Trapdoor effect completed immediately for column ${col + 1} (no symbols to drop)`);
        }
    }

    // Respawn symbols after landfall with spinning animation
    function respawnSymbolsAfterLandfall(col) {
        console.log(`🎰 Respawning symbols in column ${col + 1} after landfall...`);

        let spinCount = 0;
        const maxSpins = 15; // Quick respawn spin

        const respawnSpin = setInterval(() => {
            // Remove existing symbols (should be empty but just in case)
            reelContainers[col].removeChildren();

            // Add random symbols during spin
            for (let row = 0; row < ROWS; row++) {
                const randomSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                let newSymbol = createTempSymbol(randomSymbolIndex);

                // If createTempSymbol returned a texture instead of a sprite/container, wrap it
                if (newSymbol && newSymbol.baseTexture && !newSymbol.addChild) {
                    const spriteWrapper = new Sprite(newSymbol);
                    spriteWrapper.width = SYMBOL_WIDTH;
                    spriteWrapper.height = SYMBOL_HEIGHT;
                    newSymbol = spriteWrapper;
                }

                newSymbol.x = 0;
                newSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                reelContainers[col].addChild(newSymbol);
                slots[col][row] = newSymbol;
            }

            spinCount++;

            if (spinCount >= maxSpins) {
                clearInterval(respawnSpin);

                // Final symbols
                reelContainers[col].removeChildren();
                for (let row = 0; row < ROWS; row++) {
                    const finalSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                    let finalSymbol = createTempSymbol(finalSymbolIndex);

                    // If createTempSymbol returned a texture instead of a sprite/container, wrap it
                    if (finalSymbol && finalSymbol.baseTexture && !finalSymbol.addChild) {
                        const spriteWrapper = new Sprite(finalSymbol);
                        spriteWrapper.width = SYMBOL_WIDTH;
                        spriteWrapper.height = SYMBOL_HEIGHT;
                        finalSymbol = spriteWrapper;
                    }

                    // Check if it's a scatter symbol and start animation
                    if (finalSymbol.isScatter) {
                        setTimeout(() => {
                            startScatterAnimation(finalSymbol);
                        }, 500);
                    }

                    finalSymbol.x = 0;
                    finalSymbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
                    reelContainers[col].addChild(finalSymbol);
                    slots[col][row] = finalSymbol;
                }

                console.log(`✅ Column ${col + 1} respawned with new symbols!`);
            }
        }, 80); // Faster spin for respawn
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

            const isWildCol = walkingWilds.length > 0 && walkingWilds[0].col === col;
            const willWildSlideHere = walkingWilds.length > 0 && walkingWilds[0].col - 1 === col;

            const reelSpin = setInterval(() => {
                // Skip spinning for current wild column and destination column (they're handled separately)
                if (isWildCol || willWildSlideHere) {
                    spinCount++;
                    if (spinCount >= maxSpins) {
                        clearInterval(reelSpin);
                        reelAnimations[col] = true;
                        if (reelAnimations.filter(stopped => stopped).length === COLS) {
                            isSpinning = false;
                            spinButtonText.text = 'SPIN';

                            // Validate slots after spinning
                            validateAndFixSlots();

                            const winAmount = Math.floor(Math.random() * currentBet * 3);
                            if (winAmount > 0) {
                                balance += winAmount;
                                updateBalanceDisplay();
                                console.log(`🎉 Win: $${winAmount}!`);
                            }
                            // Only spawn a wild if there isn't one (1 in 3 chance)
                            if (!animatingWild && walkingWilds.length === 0 && Math.random() < 0.33 && cat5WildTexture && catLabels.length === 5) {
                                const spawnCol = COLS - 1;
                                // Random category each time (1–5)
                                const catCategory = Math.ceil(Math.random() * 5);
                                walkingWilds = [{ col: spawnCol, stepsRemaining: spawnCol, cat: catCategory }];
                                startWalkingWildDrop(spawnCol);
                            }
                        }
                    }
                    return;
                }

                for (let row = 0; row < ROWS; row++) {
                    if (slots[col][row]) {
                        reelContainers[col].removeChild(slots[col][row]);
                    }
                    const randomSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                    let newSymbol = createTempSymbol(randomSymbolIndex);

                    // If createTempSymbol returned a texture instead of a sprite/container, wrap it
                    if (newSymbol && newSymbol.baseTexture && !newSymbol.addChild) {
                        const spriteWrapper = new Sprite(newSymbol);
                        spriteWrapper.width = SYMBOL_WIDTH;
                        spriteWrapper.height = SYMBOL_HEIGHT;
                        newSymbol = spriteWrapper;
                    }

                    // Ensure we have a valid symbol
                    if (!newSymbol) {
                        console.warn(`⚠️ Failed to create symbol for index ${randomSymbolIndex}, using fallback`);
                        newSymbol = createTempSymbol(8); // Use ACE as fallback
                        if (newSymbol && newSymbol.baseTexture && !newSymbol.addChild) {
                            const spriteWrapper = new Sprite(newSymbol);
                            spriteWrapper.width = SYMBOL_WIDTH;
                            spriteWrapper.height = SYMBOL_HEIGHT;
                            newSymbol = spriteWrapper;
                        }
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
                        if (slots[col][row]) {
                            reelContainers[col].removeChild(slots[col][row]);
                        }
                        const finalSymbolIndex = Math.floor(Math.random() * symbolTextures.length);
                        let finalSymbol = createTempSymbol(finalSymbolIndex);

                        // If createTempSymbol returned a texture instead of a sprite/container, wrap it
                        if (finalSymbol && finalSymbol.baseTexture && !finalSymbol.addChild) {
                            const spriteWrapper = new Sprite(finalSymbol);
                            spriteWrapper.width = SYMBOL_WIDTH;
                            spriteWrapper.height = SYMBOL_HEIGHT;
                            finalSymbol = spriteWrapper;
                        }

                        // Ensure we have a valid symbol
                        if (!finalSymbol) {
                            console.warn(`⚠️ Failed to create final symbol for index ${finalSymbolIndex}, using fallback`);
                            finalSymbol = createTempSymbol(8); // Use ACE as fallback
                            if (finalSymbol && finalSymbol.baseTexture && !finalSymbol.addChild) {
                                const spriteWrapper = new Sprite(finalSymbol);
                                spriteWrapper.width = SYMBOL_WIDTH;
                                spriteWrapper.height = SYMBOL_HEIGHT;
                                finalSymbol = spriteWrapper;
                            }
                        }

                        // Check if it's a scatter symbol and start animation
                        if (finalSymbol.isScatter) {
                            setTimeout(() => {
                                startScatterAnimation(finalSymbol);
                            }, 500);
                        }

                        // Check if it's a storm tracker and start pulse
                        if (finalSymbol.isStormTracker) {
                            setTimeout(() => {
                                startStormTrackerPulse(finalSymbol, col, row);
                            }, 600);
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

                        // Validate slots after spinning
                        validateAndFixSlots();

                        const winAmount = Math.floor(Math.random() * currentBet * 3);
                        if (winAmount > 0) {
                            balance += winAmount;
                            updateBalanceDisplay();
                            console.log(`🎉 Win: $${winAmount}!`);
                        }

                        // Check for storm tracker symbols and trigger pulse animation
                        setTimeout(() => {
                            checkForStormTrackers();
                        }, 1000);

                        // For demo: randomly spawn walking wild in rightmost reel if none exists (reduced chance since we have storm tracker)
                        if (!animatingWild && walkingWilds.length === 0 && Math.random() < 0.2 && cat5WildTexture && catLabels.length === 5) {
                            const spawnCol = COLS - 1;
                            // Random category each time (1–5)
                            const catCategory = Math.ceil(Math.random() * 5);
                            walkingWilds = [{ col: spawnCol, stepsRemaining: spawnCol, cat: catCategory }];
                            startWalkingWildDrop(spawnCol);
                        }
                    }
                }
            }, 100 - (col * 10));
            reelAnimations[col] = false;
        }
    }

    // Spawn Storm button for testing
    const spawnStormButton = new Graphics();
    spawnStormButton.fill(0xff6b35);
    spawnStormButton.setStrokeStyle({ color: 0xff8c42, width: 3 });
    spawnStormButton.roundRect(0, 0, 140, 50, 10);
    spawnStormButton.fill();
    spawnStormButton.stroke();
    spawnStormButton.x = SCREEN_WIDTH - 170;
    spawnStormButton.y = SCREEN_HEIGHT - 150;
    spawnStormButton.interactive = true;
    spawnStormButton.buttonMode = true;
    uiContainer.addChild(spawnStormButton);

    const spawnStormText = new Text({
        text: 'SPAWN STORM',
        style: {
            fontFamily: 'Arial',
            fontSize: 16,
            fontWeight: 'bold',
            fill: 0xffffff
        }
    });
    spawnStormText.anchor.set(0.5);
    spawnStormText.x = spawnStormButton.x + 70;
    spawnStormText.y = spawnStormButton.y + 25;
    uiContainer.addChild(spawnStormText);

    // Check for storm tracker symbols after spin
    function checkForStormTrackers() {
        const stormTrackers = [];

        // Scan all positions for storm tracker symbols
        for (let col = 0; col < COLS; col++) {
            for (let row = 0; row < ROWS; row++) {
                const symbol = slots[col][row];
                if (symbol && symbol.isStormTracker) {
                    stormTrackers.push({ symbol, col, row });
                }
            }
        }

        if (stormTrackers.length > 0) {
            console.log(`🌩️ Found ${stormTrackers.length} storm tracker(s)!`);

            // Start pulse animation for all storm trackers (with slight delays)
            stormTrackers.forEach((tracker, index) => {
                setTimeout(() => {
                    startStormTrackerPulse(tracker.symbol, tracker.col, tracker.row);
                }, index * 200); // Stagger the pulses
            });
        }
    }

    // Spawn storm function for testing (updated to show storm tracker first)
    function spawnStorm() {
        if (animatingWild || walkingWilds.length > 0) {
            console.log('🌪️ Storm already active!');
            return;
        }

        if (!cat5WildTexture || catLabels.length !== 5) {
            console.log('❌ Storm assets not loaded!');
            return;
        }

        // For testing: place a storm tracker first, then trigger it
        if (stormChaseCatTexture) {
            console.log('🌩️ Placing storm tracker for demonstration...');

            // Find a random empty spot or replace a symbol
            const testCol = Math.floor(Math.random() * COLS);
            const testRow = Math.floor(Math.random() * ROWS);

            // Remove existing symbol
            if (slots[testCol][testRow]) {
                reelContainers[testCol].removeChild(slots[testCol][testRow]);
            }

            // Add storm tracker
            const stormTracker = createTempSymbol(2); // Index 2 is storm tracker
            stormTracker.x = 0;
            stormTracker.y = testRow * (SYMBOL_HEIGHT + SYMBOL_SPACING);
            reelContainers[testCol].addChild(stormTracker);
            slots[testCol][testRow] = stormTracker;

            // Start the pulse sequence
            setTimeout(() => {
                startStormTrackerPulse(stormTracker, testCol, testRow);
            }, 500);
        } else {
            // Fallback: direct spawn
            const spawnCol = COLS - 1;
            const catCategory = Math.ceil(Math.random() * 5);
            walkingWilds = [{ col: spawnCol, stepsRemaining: spawnCol, cat: catCategory }];
            console.log(`🌩️ Spawning Cat ${catCategory} hurricane in column ${spawnCol + 1}!`);
            startWalkingWildDrop(spawnCol);
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

    spawnStormButton.on('pointerdown', spawnStorm);
    spawnStormButton.on('pointerover', () => {
        spawnStormButton.alpha = 0.8;
    });
    spawnStormButton.on('pointerout', () => {
        spawnStormButton.alpha = 1.0;
    });

    console.log(`
🌪️ HURRICANE CHASE SLOT MACHINE READY!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

� FIXES APPLIED:
   • Cat 5 Wild (index 13) excluded from regular symbol pool ✅
   • Blank square validation and auto-repair system ✅
   • Asset loading paths fixed (no leading slashes) ✅
   • Improved symbol creation with fallback handling ✅

�📐 HURRICANE CHASE SPECIFICATIONS:
   • Background: Hurricane Chase frame loaded ✅
   • Symbol Size: ${SYMBOL_WIDTH}x${SYMBOL_HEIGHT}px (wider rectangles)
   • Grid Size: ${GRID_WIDTH}x${GRID_HEIGHT}px
   • Symbol Pool: ${symbolTextures.length} regular symbols (excludes walking wild)
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

    // Assume bgFrames is your array of textures for the background animation
    // and bgSprite is the PIXI.Sprite displaying the background

    let bgCurrentFrame = 6; // Frame 7 (zero-based)
    let bgAnimating = false;
    const bgFrameDuration = 100; // ms per frame during animation
    const bgHoldDuration = 120000; // 2 minutes

    function showBgFrame7() {
        bgSprite.texture = bgFrames[bgCurrentFrame];
    }

    function playBgAnimationOnce() {
        bgAnimating = true;
        let frame = 0;
        const anim = setInterval(() => {
            bgSprite.texture = bgFrames[frame];
            frame++;
            if (frame >= bgFrames.length) {
                clearInterval(anim);
                bgAnimating = false;
                showBgFrame7();
                scheduleBgAnimation();
            }
        }, bgFrameDuration);
    }

    function scheduleBgAnimation() {
        setTimeout(() => {
            if (!bgAnimating) playBgAnimationOnce();
        }, bgHoldDuration);
    }

    // Initial setup
    showBgFrame7();
    scheduleBgAnimation();

    // Show frame 7 for all animated backgrounds
    function showAllBgFrame7() {
        for (let i = 0; i < animatedBgSprites.length; i++) {
            if (bgFrameArrays[i] && bgFrameArrays[i][HOLD_FRAME_INDEX]) {
                animatedBgSprites[i].texture = bgFrameArrays[i][HOLD_FRAME_INDEX];
            }
        }
    }

    // Play full animation for all backgrounds once, then return to frame 7
    function playAllBgAnimationsOnce() {
        bgAnimating = true;
        let frame = 0;
        const maxFrames = Math.max(...bgFrameArrays.map(arr => arr.length));
        const anim = setInterval(() => {
            for (let i = 0; i < animatedBgSprites.length; i++) {
                if (bgFrameArrays[i] && bgFrameArrays[i][frame]) {
                    animatedBgSprites[i].texture = bgFrameArrays[i][frame];
                }
            }
            frame++;
            if (frame >= maxFrames) {
                clearInterval(anim);
                bgAnimating = false;
                showAllBgFrame7();
                scheduleAllBgAnimation();
            }
        }, FRAME_DURATION);
    }

    // Schedule the animation to play every X seconds
    function scheduleAllBgAnimation() {
        setTimeout(() => {
            if (!bgAnimating) playAllBgAnimationsOnce();
        }, ANIMATION_INTERVAL);
    }

    // Initial setup
    showAllBgFrame7();
    scheduleAllBgAnimation();
})();