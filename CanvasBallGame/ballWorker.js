// ballWorker.js
console.log('Ball Worker Loaded');

// canvas 參數
// canvas parameters
let canvasWidth = null;
let canvasHeight = null;

// 配置參數
// Config Parameters
let mouseX = null;
let mouseY = null;
let canPost = false; // 是否可以發送更新
let doWorkerSync = false; // 是否啟用工作者同步

// 性能參數
// performace parameters
let UpdateCount = 0;
let ups = 0;
let lastUpsUpdate = 0;

// 球 參數
// ball parameters
const ballparms = {
    MAX_BALLS: 5000, // 最大球數量 // Maximum number of balls
    numBalls: 250, // 初始球數量 // Initial number of balls
    currentBallCount: 0, // 當前活躍球數量 // Current active ball count
    ballRadius: 5, // 球半徑 // ball Radius
    maxBallRadius: null, // 最大球半徑 // max ball Radius
    maxBaseBallRadius: null  // 最大基礎球半徑 // max base ball Radius
};
// 數據存儲
// Data Storage
const STRIDE = 9; // 步幅 // stride
const buffer = new ArrayBuffer(ballparms.MAX_BALLS * STRIDE * 4); // 創建 緩衝區 // create buffer
// 創建 視圖 // create Views
const x = new Float32Array(buffer, 0, ballparms.MAX_BALLS);
const y = new Float32Array(buffer, ballparms.MAX_BALLS * 4, ballparms.MAX_BALLS);
const vx = new Float32Array(buffer, ballparms.MAX_BALLS * 8, ballparms.MAX_BALLS);
const vy = new Float32Array(buffer, ballparms.MAX_BALLS * 12, ballparms.MAX_BALLS);
const radius = new Float32Array(buffer, ballparms.MAX_BALLS * 16, ballparms.MAX_BALLS);
const h = new Float32Array(buffer, ballparms.MAX_BALLS * 20, ballparms.MAX_BALLS);
const s = new Float32Array(buffer, ballparms.MAX_BALLS * 24, ballparms.MAX_BALLS);
const v = new Float32Array(buffer, ballparms.MAX_BALLS * 28, ballparms.MAX_BALLS);
const radiusAdd = new Float32Array(buffer, ballparms.MAX_BALLS * 32, ballparms.MAX_BALLS);

// 創建球
// Create Balls
function createBalls(i, xx = null, yy = null) {
    const thisBallRadius = Math.floor(Math.random() * (ballparms.maxBaseBallRadius - ballparms.ballRadius)) + ballparms.ballRadius;
    x[i] = xx !== null ? xx : Math.random() * (canvasWidth - 2 * thisBallRadius) + thisBallRadius;
    y[i] = yy !== null ? yy : Math.random() * (canvasHeight - 2 * thisBallRadius) + thisBallRadius;
    vx[i] = (Math.random() - 0.5) * 4;
    vy[i] = (Math.random() - 0.5) * 4;
    radius[i] = thisBallRadius;
    h[i] = Math.floor(Math.random() * 361);
    s[i] = Math.floor(Math.random() * 40) + 60;
    v[i] = Math.floor(Math.random() * 50) + 50;
    radiusAdd[i] = 0;
    ballparms.currentBallCount++;
}

// 初始化
// Initialization
function init() {
    console.log('Worker Init');
    ballparms.currentBallCount = 0;
    for (let i = 0; i < ballparms.numBalls; i++) {
        createBalls(i);
    }
    // 初始完成，進入物理循環
    updateBall();
}

// 更新函數
// update function
function updateBall() {
    // 執行更新
    // run update
    const count = ballparms.currentBallCount;
    const mx = mouseX;
    const my = mouseY;
    const cw = canvasWidth;
    const ch = canvasHeight;

    for (let i = 0; i < count; i++) {
        const r = radius[i] + radiusAdd[i];

        // 更新位置
        x[i] += vx[i];
        y[i] += vy[i];

        // 邊界碰撞
        if (x[i] - r < 0) { x[i] = r; vx[i] *= -1; }
        else if (x[i] + r > cw) { x[i] = cw - r; vx[i] *= -1; }

        if (y[i] - r < 0) { y[i] = r; vy[i] *= -1; }
        else if (y[i] + r > ch) { y[i] = ch - r; vy[i] *= -1; }
        // 滑鼠互動 (半徑)
        let isHovering = false;
        const dx = x[i] - mx;
        const dy = y[i] - my;
        const distSq = dx * dx + dy * dy;

        if (distSq < r * r) {
            isHovering = true;
            if (r < ballparms.maxBallRadius) radiusAdd[i] += 0.5;
        }

        if (!isHovering && r > radius[i]) {
            radiusAdd[i] -= 0.5;
        }
    }

    // 進入等待發送階段
    checkAndPost();
}

function checkAndPost() {
    if (canPost || !doWorkerSync) {
        canPost = false; // 重設開關
        UpdateCount++;
        const currentTime = performance.now();
        if (currentTime - lastUpsUpdate > 500) { // 每 500ms 更新一次文字
            ups = Math.round((UpdateCount * 1000) / (currentTime - lastUpsUpdate));
            lastUpsUpdate = currentTime;
            UpdateCount = 0;
        }
        postMessage({
            type: 'updateComplete',
            buffer: buffer,
            currentBallCount: ballparms.currentBallCount,
            ups: ups
        });
        // 排程下次更新，並釋放執行緒以利通訊處理
        // Schedule next update and yield thread for message handling
        setTimeout(updateBall, 0);
    } else {
        // 延遲 10 毫秒後輪詢發送狀態，維持物理數據同步
        // Poll post status after 10ms to maintain physics data synchronization
        setTimeout(checkAndPost, 0);
    }
}

function updateCanvasSizeAndBallParms(data = {}) {
    if (!data.width || !data.height) return;
    canvasWidth = data.width;
    canvasHeight = data.height;
    ballparms.maxBaseBallRadius = Math.min(canvasWidth, canvasHeight) * 0.1 / 2;
    ballparms.maxBallRadius = Math.min(canvasWidth, canvasHeight) / 2;
}

// 訊息監聽
// Message Listener 
self.onmessage = (e) => {
    const data = e.data;
    switch (data.type) {
        case 'init':
            updateCanvasSizeAndBallParms(data);
            init();
            break;
        case 'canPost':
            // 接收主執行緒準備就緒訊號，更新傳輸狀態位元
            // Update transmission status on main thread ready signal
            canPost = true;
            break;
        case 'resize':
            updateCanvasSizeAndBallParms(data);
            break;
        case 'mouseMove':
            mouseX = data.x;
            mouseY = data.y;
            break;
        case 'mouseLeave':
            mouseX = null;
            mouseY = null;
            break;
        case 'mouseClick':
            const clickX = data.x;
            const clickY = data.y;
            if (ballparms.currentBallCount < ballparms.MAX_BALLS) createBalls(ballparms.currentBallCount, clickX, clickY);
            break;
    }
};

postMessage({ type: 'workerReady', ballparms: ballparms });