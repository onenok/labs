'use strict';
document.addEventListener('DOMContentLoaded', () => {
    // === canvas setup ===
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);

    resizeCanvas();
    // === canvas setup end ===

    // === constants ===
    const GRAVITY = 0.5;
    const mapWidth = 2000;
    const mapHeight = 1000; // not used yet
    const playerJumpStrength = 15;
    const playerSpeed = 5;
    const delta = 16; // ms per frame
    // === constants end ===

    // === class construction ===
    // camera object
    class Camera {
        constructor() {
            this.x = 0;
            this.translateX = 0;
        }
        apply(ctx) {
            if (this.x < canvas.width / 2) {
                this.translateX = 0;
                ctx.translate(-this.translateX, 0);
            } else if (this.x > mapWidth - canvas.width / 2) {
                this.translateX = mapWidth - canvas.width;
                ctx.translate(-this.translateX, 0);
            } else {
                this.translateX = this.x - canvas.width
                ctx.translate(-this.translateX, 0);
            }
        }
    }

    // player object
    class Player {
        constructor(x, y, size, { color = 'red', cameraBind = null, collisionEnities = [] } = {}) {
            this.x = x; // 0 is left edge, positive x is right, negative x is left
            this.y = y; // 0 is ground level, positive y is up, negative y is down
            this.vx = 0;
            this.vy = 0;
            this.onGround = false;
            this.size = size;
            this.color = color;
            this.camera = cameraBind;
            this.collisionEnities = collisionEnities;
        }
        bindCamera(camera) {
            this.camera = camera;
        }
        setCollisionEnities(enities) {
            this.collisionEnities = enities;
        }
        checkCollisionEnities() {
            const playerLeft = this.x;
            const playerRight = this.x + this.size;
            const playerTop = this.y;
            const playerBottom = this.y + this.size;
            for (const Enities of this.collisionEnities) {
                const EnitiesLeft = Enities.x; // list of enities x
                const EnitiesRight = Enities.xEnd; // list of enities xEnd
                const EnitiesTop = Enities.y; // list of enities y
                const EnitiesBottom = Enities.yEnd; // list of enities yEnd
                for (let i = 0; i < EnitiesLeft.length; i++) {
                    if (playerLeft < EnitiesRight[i] && playerRight > EnitiesLeft[i] && playerTop < EnitiesBottom[i] && playerBottom > EnitiesTop[i]) {

                    }
                }
            }
            this.onGround = false;
        }
        move() {
            let way = isPressedRight() - isPressedLeft();
            this.vx = way * 5;
        }
        applyV() {
            if (!this.onGround) {
                this.vy -= GRAVITY;
            }
            this.x += this.vx;
            this.y += this.vy;

            // == on ground check ==
            // check if player is below ground level
            if (this.y < 0 + this.size) {
                this.y = 0 + this.size;
                this.vy = 0;
                this.onGround = true;
            } else {
                this.onGround = false;
            }
            // check if player is colliding with enities
            this.checkCollisionEnities();
            // == on ground check end ==

            if (this.camera) {
                this.camera.x = this.x;
                this.camera.apply(ctx);
            }
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, canvas.height - this.y, this.size, this.size);
        }

    }

    class bars {
        x = [];
        xEnd = [];
        y = [];
        yEnd = [];
        constructor(func, startX, startY, gap, width, height, color) {
            this.func = func;
            this.gap = gap;
            this.width = width;
            this.height = height;
            this.color = color;
            this.startX = startX;
            this.startY = startY;
            for (let i = 0; i < mapWidth; i += gap + width) {
                const xValue = i + this.startX;
                this.x.push(xValue);
                this.xEnd.push(xValue + width);
                const yValue = func(i) + startY;
                this.y.push(yValue);
                this.yEnd.push(yValue + height);
            }
        }
        draw() {
            ctx.fillStyle = this.color;
            for (let i = 0; i < this.x.length; i++) {
                const barX = this.x[i];
                const barY = this.y[i];
                ctx.fillRect(barX, canvas.height - barY, this.width, this.height);
            }
        }
    }
    // === class construction end ===

    // === game init ===
    // init
    const camera = new Camera();
    const bar = new bars(x => 100 + 100 * Math.sin((x - 25 * Math.PI) / 50), 400, 100, 50, 200, 20, 'blue');
    const player = new Player(0, 500, 30, { cameraBind: camera, collisionEnities: [bar] });
    // input handling
    const keysPressed = {};
    document.addEventListener('keydown', (event) => {
        keysPressed[event.key] = true;
    });
    document.addEventListener('keyup', (event) => {
        keysPressed[event.key] = false;
    });
    function isPressedLeft() {
        return keysPressed['a'] || keysPressed['ArrowLeft'] ? 1 : 0;
    }
    function isPressedRight() {
        return keysPressed['d'] || keysPressed['ArrowRight'] ? 1 : 0;
    }
    function isPressedJump() {
        return keysPressed['w'] || keysPressed['ArrowUp'] ? 1 : 0;
    }
    function isPressedDown() {
        return keysPressed['s'] || keysPressed['ArrowDown'] ? 1 : 0;
    }
    // === game init end ===

    // === game logic start ===
    // game loop
    function animation() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        player.applyV();
        bar.draw();
        player.draw();
        requestAnimationFrame(animation);
    }
    animation();
    // === game logic end ===
});