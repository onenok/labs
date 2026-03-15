'use strict';
document.addEventListener('DOMContentLoaded', () => {
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    H_max = canvas.height * 0.9;
}
window.addEventListener('resize', resizeCanvas);


let fixedDt = 0.05; // 每個 tick 0.05 秒 (20TPS)
let accumulator = 0;
let lastTime = performance.now();
const GRAVITY = 750;
const ACCELERATION_TIME = 0.2;
let H_max = canvas.height * 0.9;
const TOLERANCE = 0.2; // Coyote Time 的容許時間 (秒)
let jumpBuffTimer = 0;

let player = {
    size: 20,
    x: 200,
    y: 200,
    speed: 400, // 每秒移動 300 像素
    lastX: 200,
    lastY: 200,
    vx: 0,
    vy: 0,
    jumpForce: 500,
    onGround: false,
    lastGroundY: 0,
    m_CoyoteTime: 0
};

// 鍵盤輸入
const keysState = {};
document.addEventListener('keydown', (event) => {
    if (!keysState[event.key]) {
        keysState[event.key] = { pressed: true, consumed: false };
    } else {
        keysState[event.key].pressed = true;
        keysState[event.key].consumed = false; // 新的一次按下
    }
});

document.addEventListener('keyup', (event) => {
    if (keysState[event.key]) {
        keysState[event.key].pressed = false;
        // 不立刻消失，等邏輯檢查時才會被清掉
    }
});

// 在邏輯更新時檢查
function consumeKey(key) {
    const state = keysState[key];
    if (state && (state.pressed || !state.consumed)) {
        state.consumed = true; // 標記已讀取
        return true;           // 表示這次邏輯更新看到了這個按下
    }
    return false;
}

function isPressedLeft() {
    return consumeKey('a') || consumeKey('ArrowLeft') ? 1 : 0;
}
function isPressedRight() {
    return consumeKey('d') || consumeKey('ArrowRight') ? 1 : 0;
}
function isPressedUpOrJump() {
    return consumeKey('w') || consumeKey('ArrowUp') || consumeKey(' ') ? 1 : 0;
}

function move_toward(from, to, dt) {
    const tau = ACCELERATION_TIME;
    const k = 1 - Math.exp(-dt / tau);
    return from + k * (to - from);
}

// 邏輯更新 (固定時間步)
// 邏輯更新 (固定時間步)
function updateLogic(dt) {
    // --- 0. 輸入處理 ---
    player.lastX = player.x;
    player.lastY = player.y;
    const dirX = (isPressedRight() - isPressedLeft());
    const jumpPressed = isPressedUpOrJump();

    // --- 1. 水平移動 ---
    player.vx = move_toward(player.vx, dirX * player.speed, dt);

    // --- 2. 跳躍緩衝 (Jump Buffer) ---
    if (jumpPressed) {
        jumpBuffTimer = TOLERANCE;
    } else {
        jumpBuffTimer = Math.max(0, jumpBuffTimer - dt);
    }

    // --- 3. 跳躍觸發 (Coyote + Buffer) ---
    if ((jumpPressed || jumpBuffTimer > 0) && player.m_CoyoteTime > 0) {
        player.vy = player.jumpForce;
        player.onGround = false;
        player.releasedJump = false;
        jumpBuffTimer = 0; // 用掉 buffer
    }

    // --- 4. Release Drag (小跳) ---
    if (!jumpPressed && player.vy > 0 && !player.releasedJump) {
        player.vy *= 0.65; // 縮減上升速度
        player.releasedJump = true;
    }

    // --- 5. 重力 ---
    player.vy -= GRAVITY * dt;

    // --- 6. 移動 ---
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // --- 7. 碰撞檢查 ---
    if (player.y < player.size) {
        player.y = player.size;
        player.vy = 0;
        player.onGround = true;
    } else {
        player.onGround = false;
    }

    // --- 8. Coyote Time 更新 ---
    if (player.onGround) {
        player.m_CoyoteTime = TOLERANCE;
    } else {
        player.m_CoyoteTime = Math.max(0, player.m_CoyoteTime - dt);
    }
}

// 渲染 (插值)
function render(alpha) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let drawX = player.lastX + (player.x - player.lastX) * alpha;
    let drawY = player.lastY + (player.y - player.lastY) * alpha;
    ctx.fillStyle = "blue";
    ctx.fillRect(drawX - player.size, canvas.height - (drawY + player.size), player.size * 2, player.size * 2);
}

// 遊戲迴圈
function gameLoop() {
    let now = performance.now();
    let frameTime = (now - lastTime) / 1000; // 轉換成秒
    lastTime = now;

    accumulator += frameTime;

    while (accumulator >= fixedDt) {
        updateLogic(fixedDt);
        accumulator -= fixedDt;
    }

    let alpha = accumulator / fixedDt;
    render(alpha);

    requestAnimationFrame(gameLoop);
}

resizeCanvas();

gameLoop();
});