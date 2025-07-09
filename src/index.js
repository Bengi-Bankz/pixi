import { Application, Graphics } from 'pixi.js';

const app = new Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0a0a0a,
});

await app.init(); // 👈 must be awaited before accessing canvas

document.body.appendChild(app.canvas);

// Draw red box
const box = new Graphics();
box.beginFill(0xff0000);
box.drawRect(100, 100, 200, 200);
box.endFill();
app.stage.addChild(box);
