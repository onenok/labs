'use strict';
document.addEventListener('DOMContentLoaded', () => {
    // === canvas setup ===
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let resizing = true;
    let resizeTimer = null;

    function resizeCanvas() {
        clearTimeout(resizeTimer);
        resizing = true;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (camera?.totalTranslateX || null) camera.totalTranslateX = 0;
        resizeTimer = setTimeout(resizing = false, 100)
    }

    // === constants ===
    const mapWidth = 50000;
    const GRAVITY = 750;
    const ACCELERATION_TIME = 0.2;
    const CoyoteTOLERANCE = 0.1; // Coyote Time
    const jumpBufferTOLERANCE = 0.1; // Jump Buffer Time
    let fixedDt = 1 / 60; //
    let accumulator = 0;
    let lastTime = performance.now();
    let jumpBufferTimer = 0;
    // === constants end ===

    // === input system ===
    const keysState = {};
    window.addEventListener('keydown', e => {
        if (!keysState[e.key]) keysState[e.key] = { pressed: true, consumed: false };
        else { keysState[e.key].pressed = true; keysState[e.key].consumed = false; }
    });
    window.addEventListener('keyup', e => {
        if (keysState[e.key]) keysState[e.key].pressed = false;
    });
    // 頁面失去焦點時強制清空（重要！）
    window.addEventListener('blur', () => {
        for (let key in keysState) {
            keysState[key].pressed = false;
        }
    });
    function consumeKey(key) {
        const state = keysState[key];
        if (state && (state.pressed || !state.consumed)) {
            state.consumed = true;
            return true;
        }
        return false;
    }
    function isPressedLeft() { return consumeKey('a') || consumeKey('ArrowLeft') ? 1 : 0; }
    function isPressedRight() { return consumeKey('d') || consumeKey('ArrowRight') ? 1 : 0; }
    function isPressedUpOrJump() { return consumeKey('w') || consumeKey('ArrowUp') || consumeKey(' ') ? 1 : 0; }
    // === input system end ===

    // === helper function ===
    Number.prototype.fmt = function (decimals = 2) {
        return this.toFixed(decimals);
    };
    function move_toward(from, to, dt) {
        const tau = ACCELERATION_TIME;
        const k = 1 - Math.exp(-dt / tau);
        return from + k * (to - from);
    }
    function createSafePlatformFunc(
        {
            baseYValues = [150, 200],
            maxAmpValue = 120,
            amp1Value = [0.7, 40],
            amp2Value = [50, 20],
            freq1Value = [50, 40],
            freq2Value = [1.8, 1.2],
            heightLimitValue = 680,
            heightLimitBuffer = 20
        }
    ) {
        // 原有參數
        const baseY = baseYValues[0] + Math.random() * (baseYValues[1] - baseYValues[0]);
        const maxAmp = maxAmpValue;
        const amp1 = Math.random() * maxAmp * amp1Value[0] + amp1Value[1];
        const amp2 = Math.random() * amp2Value[0] + amp2Value[1];
        const freq1 = Math.random() * freq1Value[0] + freq1Value[1];
        const freq2 = freq1 * (Math.random() * freq2Value[0] + freq2Value[1]);
        const phase1 = -Math.PI / 2;
        const phase2 = Math.PI;

        const theoreticalMax = baseY + 2 * (amp1 + amp2);
        const heightLimit = heightLimitValue;
        const scale = theoreticalMax > heightLimit ? (heightLimit - heightLimitBuffer) / theoreticalMax : 1;
        const func = (x) => {
            const f = ((amp1 * scale) - ((baseY * (1 - scale)) / 4)) * (Math.sin(x / freq1 + phase1) + 1) + baseY / 2;
            const g = ((amp2 * scale) - ((baseY * (1 - scale)) / 4)) * (Math.cos(x / freq2 + phase2) + 1) + baseY / 2;
            const y = f + g;
            return y;
        };

        // 回傳結果
        return {
            func: func,
            params: {
                funcStr: `
                const f = ((${amp1} * ${scale}) - ((${baseY} * (1 - ${scale})) / 4)) * (Math.sin(x / ${freq1} + ${phase1}) + 1) + ${baseY} / 2;
                const g = ((${amp2} * ${scale}) - ((${baseY} * (1 - ${scale})) / 4)) * (Math.cos(x / ${freq2} + ${phase2}) + 1) + ${baseY} / 2;
                const y = f + g;
                `,
                desmos_ed_func: `
                f = ((${amp1} * ${scale}) - ((${baseY} * (1 - ${scale})) / 4)) * (sin(x / ${freq1} + ${phase1}) + 1) + ${baseY} / 2
                g = ((${amp2} * ${scale}) - ((${baseY} * (1 - ${scale})) / 4)) * (cos(x / ${freq2} + ${phase2}) + 1) + ${baseY} / 2
                y = f + g
                `,
                baseY,
                amp1,
                amp2,
                freq1,
                freq2,
                phase1: phase1.toFixed(4),
                phase2: phase2.toFixed(4),
                theoreticalMax: theoreticalMax.toFixed(2),
                heightLimit,
                heightLimitBuffer,
                scale: scale.toFixed(4),
            },

        };
    }
    function drawDashedRect(ctx, x, y, width, height, dashArray = [6, 6], lineWidth = 2, color = '#000') {
        ctx.save();                // 保存狀態，避免影響其他繪圖

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;

        // 設定虛線樣式：[實線長度, 空白長度]
        // [6,6] = 6像素實線 + 6像素空白，重複
        ctx.setLineDash(dashArray);

        ctx.strokeRect(x, y, width, height);

        ctx.setLineDash([]);       // 恢復成實線（重要！）
        ctx.restore();             // 恢復狀態
    }

    // === helper function end ===

    // === class construction ===
    class Camera {
        constructor() {
            this.x = 0;
            this.translateX = 0;
            this.totalTranslateX = 0;
        }
        apply(ctx, player) {
            if (this.x > canvas.width / 2 && this.x < mapWidth - canvas.width / 2) {
                this.translateX = this.x - (canvas.width / 2) - this.totalTranslateX;
                ctx.translate(-this.translateX, 0);
                this.totalTranslateX += this.translateX;
            }
            ctx.fillStyle = "black";
            ctx.fillText(`Player velocity: vx:${player.vx.fmt(2)}, vy:${player.vy.fmt(2)}`, this.totalTranslateX + 10, 0 + 10);
            ctx.fillText(`Player alpha position: x:${player.x.fmt(2)}, y:${player.y.fmt(2)}`, this.totalTranslateX + 10, 0 + 10 + 10);
            ctx.textAlign = 'center';
            let lastFontStyle = ctx.font;
            let lastTextBaseline = ctx.textBaseline;
            ctx.font = 'bold 50px Arial';
            ctx.textBaseline = 'top';
            ctx.fillText(player.score, this.totalTranslateX + canvas.width / 2, 0 + 10);
            ctx.font = lastFontStyle;
            ctx.textBaseline = lastTextBaseline;
            ctx.textAlign = 'left';
        }
    }

    class Player {
        constructor(x, y, size, { color = 'red', cameraBind = null, collisionEnities = [], scoreedEntities = [] } = {}) {
            this.x = x; this.y = y; // bottom y = 0 // pointer at bottom left corner
            this.drawX = x; this.drawY = y; // alpha position
            this.vx = 0; this.vy = 0; // vy > 0 means moving up
            this.size = size; this.color = color;
            this.onGround = false;
            this.standedOnEntity = false;
            this.isStandOn = false;
            this.releasedJump = false;
            this.coyoteTime = 0;
            this.camera = cameraBind;
            this.collisionEnities = collisionEnities;
            this.lastX = x; this.lastY = y;
            this.jumpForce = 500;
            this.speed = 400;
            this.score = 0;
            this.scoreedEntities = scoreedEntities
        }

        update(dt) {
            this.lastX = this.x;
            this.lastY = this.y;

            // 水平移動
            const dirX = isPressedRight() - isPressedLeft();
            this.vx = move_toward(this.vx, dirX * this.speed, dt);

            // Jump Buffer
            if (isPressedUpOrJump()) jumpBufferTimer = jumpBufferTOLERANCE;
            else jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);

            // 跳躍觸發
            if ((isPressedUpOrJump() || jumpBufferTimer > 0) && this.coyoteTime > 0) {
                this.vy = this.jumpForce;
                this.isStandOn = false;
                this.releasedJump = false;
                jumpBufferTimer = 0;
            }

            // Release Drag
            if (!isPressedUpOrJump() && this.vy > 0 && !this.releasedJump) {
                this.vy *= 0.65;
                this.releasedJump = true;
            }

            // 重力
            this.vy -= GRAVITY * dt;

            // 移動
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.checkCanvasBound();
            if (this.checkOnGround()) {
                if (!this.onGround) {
                    this.onGround = true;
                    this.collisionEnities.forEach(entity => {
                        entity.removeFlyPast();
                    });
                }
            }
            else {
                this.onGround = false;
            }
            this.standedOnEntity = this.checkCollisionEnities(dt);
            // 碰撞檢查
            if (this.onGround || this.standedOnEntity) {
                this.isStandOn = true;
            } else {
                this.isStandOn = false;
            }

            // Coyote Time 更新
            if (this.isStandOn) this.coyoteTime = CoyoteTOLERANCE;
            else this.coyoteTime = Math.max(0, this.coyoteTime - dt);
        }
        checkCanvasBound() {
            if (this.x < 0) {
                this.x = 0;
                this.vx = 0;
            }
            else if (this.x + this.size > mapWidth) {
                this.x = mapWidth - this.size;
                this.vx = 0;
            }
        }
        checkOnGround() {
            if (this.y < 0) {
                this.y = 0
                this.vy = 0;
                return true;
            }
            return false;
        }

        checkCollisionEnities(dt) {
            const playerLeft = this.x;
            const playerBottom = this.y;
            const playerRight = this.x + this.size;
            const playerTop = this.y + this.size;

            const lastPlayerLeft = this.lastX;
            const lastPlayerBottom = this.lastY;
            const lastPlayerRight = this.lastX + this.size;
            const lastPlayerTop = this.lastY + this.size;

            for (const entity of this.collisionEnities) {
                for (let i = 0; i < entity.x.length; i++) {
                    const eLeft = entity.x[i];
                    const eRight = entity.xEnd[i];
                    const eBottom = entity.y[i];
                    const eTop = entity.yEnd[i];

                    if (playerRight > eLeft && playerLeft < eRight && playerTop > eBottom) {
                        // 檢查是否在實體正上方
                        if (!entity.playerFlyPast[i] && playerBottom > eTop) {
                            entity.setFlyPast(i);
                        }
                        // 檢查是否有任何重疊（AABB 基本檢測）
                        if (playerBottom < eTop) {

                            // 1. 站在平台上（落地檢測，優先處理）
                            if (this.vy <= 0 &&
                                playerBottom < eTop &&
                                playerTop > eTop &&
                                (eTop - playerBottom <= this.size / 4 || lastPlayerBottom >= eTop)
                            ) {  // 上一幀還在上面或剛好在邊界
                                this.y = eTop;
                                this.vy = 0;
                                entity.setStanded(i);
                                return true;  // 落地成功，直接返回
                            }

                            // 其他碰撞（側面或頭頂）
                            else {
                                // ────────────── 計算進入方向 ──────────────
                                let horizontalDir = 0;  // 1: 從左撞右邊界, -1: 從右撞左邊界
                                let verticalDir = 0;  // 1: 從下頂到底面

                                // 水平方向進入判斷
                                if (playerRight > eLeft && lastPlayerRight <= eLeft) {
                                    horizontalDir = 1;   // 從左進入
                                }
                                else if (playerLeft < eRight && lastPlayerLeft >= eRight) {
                                    horizontalDir = -1;  // 從右進入
                                }

                                // 垂直方向進入判斷（頂到底面）
                                if (playerTop > eBottom && lastPlayerTop <= eBottom) {
                                    verticalDir = 1;     // 從下頂到底面
                                }

                                // ────────────── 如果同時有側面 + 頂面進入，計算誰先撞 ──────────────
                                if (horizontalDir !== 0 && verticalDir !== 0) {
                                    let t_horizontal = Infinity;
                                    let t_vertical = Infinity;

                                    // 計算水平碰撞時間比例
                                    if (horizontalDir === 1 && this.vx > 0) {
                                        const distance = eLeft - lastPlayerRight;
                                        if (distance > 0) {
                                            t_horizontal = distance / (this.vx * dt);
                                        }
                                    }
                                    else if (horizontalDir === -1 && this.vx < 0) {
                                        const distance = lastPlayerLeft - eRight;
                                        if (distance > 0) {
                                            t_horizontal = distance / (Math.abs(this.vx) * dt);
                                        }
                                    }

                                    // 計算垂直碰撞時間比例
                                    if (verticalDir === 1 && this.vy > 0) {
                                        const distance = eBottom - lastPlayerTop;
                                        if (distance > 0) {
                                            t_vertical = distance / (this.vy * dt);
                                        }
                                    }

                                    // 比較誰先發生（允許一點浮點誤差）
                                    const sideFirst = t_horizontal < t_vertical && t_horizontal >= 0 && t_horizontal <= 1.05;
                                    const topFirst = t_vertical < t_horizontal && t_vertical >= 0 && t_vertical <= 1.05;

                                    if (sideFirst) {
                                        // 側面先撞 → 水平碰撞
                                        if (horizontalDir === 1) {
                                            this.x = eLeft - this.size;
                                        } else {
                                            this.x = eRight;
                                        }
                                        this.vx = 0;
                                        return false;
                                    }
                                    else if (topFirst) {
                                        // 頂面先撞 → 頭部碰撞
                                        this.y = eBottom - this.size;
                                        this.vy = 0;
                                        return false;
                                    }
                                    else {
                                        // fallback：t 值無效或相近 → 用速度比例決定
                                        if (Math.abs(this.vx) > Math.abs(this.vy)) {
                                            // 水平速度較大 → 當水平處理
                                            if (horizontalDir === 1) this.x = eLeft - this.size;
                                            else if (horizontalDir === -1) this.x = eRight;
                                            this.vx = 0;
                                        } else {
                                            // 垂直速度較大或相等 → 當頭部碰撞
                                            this.y = eBottom - this.size;
                                            this.vy = 0;
                                        }
                                        return false;
                                    }
                                }

                                // ────────────── 只單一方向碰撞 ──────────────
                                else if (horizontalDir !== 0) {
                                    // 只側面碰撞
                                    if (horizontalDir === 1) this.x = eLeft - this.size;
                                    else if (horizontalDir === -1) this.x = eRight;
                                    this.vx = 0;
                                    return false;
                                }
                                else if (verticalDir === 1 && this.vy > 0) {
                                    // 只頂面碰撞
                                    this.y = eBottom - this.size;
                                    this.vy = 0;
                                    return false;
                                }
                            }
                        }
                    }
                }
            }
            return false;
        }

        draw(ctx, alpha) {
            this.drawX = this.lastX + (this.x - this.lastX) * alpha;
            this.drawY = this.lastY + (this.y - this.lastY) * alpha;
            this.score = this.scoreedEntities.reduce((acc, entity) => acc + entity.getScore(), 0);
            // Camera
            if (this.camera) {
                this.camera.x = this.drawX;
                this.camera.apply(ctx, this);
            }
            ctx.fillStyle = this.color;
            ctx.fillRect(this.drawX, canvas.height - this.drawY, this.size, -this.size);
            drawDashedRect(ctx, this.lastX, canvas.height - this.lastY, this.size, -this.size, [8, 4], 3, 'green');
            drawDashedRect(ctx, this.x, canvas.height - this.y, this.size, -this.size, [8, 4], 3, 'blue');
        }
    }

    class bars {
        x = []; xEnd = []; y = []; yEnd = []; // left, right, bottom, top
        constructor(
            func,
            startX, startY,
            gap,
            width, height,
            color, standedColor = 'green', flyPastColor = 'orange'
        ) {
            this.standedNum = 0;
            this.func = func;
            this.gap = gap;
            this.width = width;
            this.height = height;
            this.color = color;
            this.standedColor = standedColor;
            this.flyPastColor = flyPastColor;
            this.startX = startX;
            this.startY = startY;
            this.playerStandedOn = [];
            this.playerFlyPast = [];
            for (let i = 0; i < mapWidth; i += gap + width) {
                const xValue = i + this.startX;
                this.x.push(xValue);
                this.xEnd.push(xValue + width);
                const yValue = this.func.func(i) + startY;
                this.y.push(yValue - height);
                this.yEnd.push(yValue);
                this.playerStandedOn.push(false);
                this.playerFlyPast.push(false);
            }
        }
        getScore() {
            return this.standedNum;
        }
        removeFlyPast() {
            for (let i = 0; i < this.playerFlyPast.length; i++) {
                this.playerFlyPast[i] = false;
            }
        }
        setFlyPast(n) {
            if (this.playerFlyPast[n]) { return; }
            this.playerFlyPast[n] = true;
        }
        setStanded(n) {
            if (this.playerStandedOn[n]) { return; }
            this.standedNum++;
            this.playerStandedOn[n] = true;
            for (let j = n - 1; j > 0; j--) {
                if (!this.playerStandedOn[j] && this.playerFlyPast[j]) {
                    this.standedNum++;
                    this.playerStandedOn[j] = true;
                } else {
                    break;
                }
            }
        }
        draw() {
            for (let i = 0; i < this.x.length; i++) {
                ctx.fillStyle = (
                    this.playerStandedOn[i] ?
                        (
                            this.standedColor
                        ) : (
                            this.playerFlyPast[i] ?
                                this.flyPastColor : this.color
                        )
                );
                ctx.fillRect(this.x[i], canvas.height - this.y[i], this.width, -this.height);
                ctx.fillStyle = 'black';
                ctx.fillText(`${this.x[i]}, ${this.yEnd[i]}`, this.x[i], canvas.height - this.y[i] - this.height);
            }
        }
    }
    // === class construction end ===

    // === game init ===
    const result = createSafePlatformFunc({ heightLimitValue: 680, heightLimitBuffer: 30 + 20 });
    const camera = new Camera();
    const bar = new bars(result, 400, 0, 100, 200, 20, 'blue');
    const player = new Player(0, 500, 30, { color: 'red', cameraBind: camera, collisionEnities: [bar], scoreedEntities: [bar] });
    // === game init end ===

    // === game loop ===
    function gameLoop() {
        if (resizing) { requestAnimationFrame(gameLoop); }
        let now = performance.now();
        let frameTime = (now - lastTime) / 1000;
        lastTime = now;
        accumulator += frameTime;

        while (accumulator >= fixedDt) {
            player.update(fixedDt);
            accumulator -= fixedDt;
        }

        let alpha = accumulator / fixedDt;
        ctx.clearRect(1, 1, mapWidth - 1, canvas.height - 1);
        let lastCtxStrokeStyle = ctx.strokeStyle;
        ctx.strokeStyle = 'lightblue';
        ctx.strokeRect(0, 0, mapWidth, canvas.height);
        ctx.strokeStyle = lastCtxStrokeStyle;
        player.draw(ctx, alpha);
        bar.draw();

        requestAnimationFrame(gameLoop);
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    gameLoop();
});
