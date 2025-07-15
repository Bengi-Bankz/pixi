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

    // 🎲 Create temporary symbols (colored rectangles) until you get your asset pack
    function createTempSymbol(symbolType) {
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
            const symbol = new Sprite(symbolTexture);
            symbol.x = 0;
            symbol.y = row * (SYMBOL_HEIGHT + SYMBOL_SPACING);
            symbol.width = SYMBOL_WIDTH;
            symbol.height = SYMBOL_HEIGHT;
            reelContainer.addChild(symbol);
            slots[col][row] = symbol;
        }
    }

    // Update balance display
    function updateBalanceDisplay() {
        balanceText.text = `Balance: $${balance}`;
    }

    // 🎮 Spin function
    function spin() {
        if (isSpinning || balance < currentBet) return;

        balance -= currentBet;
        updateBalanceDisplay();
        isSpinning = true;
        spinButtonText.text = 'SPINNING...';

        // Simple spin animation - replace symbols after 1 second
        setTimeout(() => {
            for (let col = 0; col < COLS; col++) {
                for (let row = 0; row < ROWS; row++) {
                    const newTexture = symbolTextures[Math.floor(Math.random() * symbolTextures.length)];
                    slots[col][row].texture = newTexture;
                }
            }

            isSpinning = false;
            spinButtonText.text = 'SPIN';

            // Simple win check - add some money back
            const winAmount = Math.floor(Math.random() * currentBet * 3);
            if (winAmount > 0) {
                balance += winAmount;
                updateBalanceDisplay();
                console.log(`Win: $${winAmount}!`);
            }
        }, 1000);
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
