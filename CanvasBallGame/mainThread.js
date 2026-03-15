document.addEventListener('DOMContentLoaded', () => {
    const ballWorker = new Worker('ballWorker.js');
    const canvas = document.getElementById('board');
    const ctx = canvas.getContext('2d');

    const views = {};
    let currentBallCount = 0;
    let MAX_BALLS = null;

    let frameCount = 0;
    let fps = 0;
    let lastFpsUpdate = 0;
    let ups = 0;

    let mouseX = null;
    let mouseY = null;
    function init() {
        console.log('Main Thread Init');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        requestAnimationFrame(render);
        ballWorker.postMessage({ type: 'init', width: canvas.width, height: canvas.height });
    }

    // 渲染函數
    // Render function
    function render(currentTime) {
        // ===計算 FPS===
        // ===Calculate FPS===
        frameCount++;
        // currentTime 是由 requestAnimationFrame 自動傳入的毫秒數
        // currentTime is the milliseconds passed in automatically by requestAnimationFrame
        if (currentTime - lastFpsUpdate > 500) { // 每 500ms 更新一次文字
            fps = Math.round((frameCount * 1000) / (currentTime - lastFpsUpdate));
            lastFpsUpdate = currentTime;
            frameCount = 0;
        }

        // ===清除畫布===
        // ===Clear Canvas===
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ===繪製球===
        // ===Draw Balls===
        for (let i = 0; i < currentBallCount; i++) {
            ctx.fillStyle = `hsl(${views.h[i]}, ${views.s[i]}%, ${views.l[i]}%)`;
            ctx.beginPath();
            ctx.arc(views.x[i], views.y[i], views.radius[i] + views.radiusAdd[i], 0, Math.PI * 2);
            ctx.fill();
        }

        // ===繪製 FPS 文字===
        // ===Draw FPS text===
        // 設定字型與樣式
        // Set font and style
        ctx.font = '16px monospace';
        let text = `FPS: ${fps}`;
        let textMetrics = ctx.measureText(text); // 測量文字寬度 // Measure text width

        // 繪製背景矩形
        // Draw background rectangle
        const padding = 6;
        let rectWidth = textMetrics.width + (padding * 2);
        const rectHeight = 24; // 根據字型大小調整 // Adjust according to font size
        let rectX = 10;
        let rectY = 10;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // 半透明黑色背景 // Semi-transparent black background
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

        // 繪製文字
        // Draw text
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'top'; // 確保文字從頂部對齊以符合背景矩形 // Ensure text aligns from the top to match background rectangle
        ctx.fillText(text, rectX + padding, rectY + padding / 2);

        // ===繪製 UPS 文字===
        // ===Draw UPS text===
        // 設定字型與樣式
        // Set font and style
        text = `UPS: ${ups}`;
        textMetrics = ctx.measureText(text); // 測量文字寬度 // Measure text width

        // 繪製背景矩形
        // Draw background rectangle
        rectX = 12 + rectWidth;
        rectWidth = textMetrics.width + (padding * 2);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // 半透明黑色背景 // Semi-transparent black background
        ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

        // 繪製文字
        // Draw text
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'top'; // 確保文字從頂部對齊以符合背景矩形 // Ensure text aligns from the top to match background rectangle
        ctx.fillText(text, rectX + padding, rectY + padding / 2);


        // 通知 Worker 準備下一幀
        // Notify Worker to prepare for the next frame
        ballWorker.postMessage({ type: 'canPost' });

        // 傳入 currentTime 繼續循環
        // Pass in currentTime to continue the loop
        requestAnimationFrame(render);
    }

    ballWorker.onmessage = (e) => {
        const data = e.data;
        switch (data.type) {
            case 'updateComplete':
                const buffer = data.buffer;
                currentBallCount = data.currentBallCount;
                views.x = new Float32Array(buffer, 0, MAX_BALLS);
                views.y = new Float32Array(buffer, MAX_BALLS * 4, MAX_BALLS);
                views.radius = new Float32Array(buffer, MAX_BALLS * 16, MAX_BALLS);
                views.h = new Float32Array(buffer, MAX_BALLS * 20, MAX_BALLS);
                views.s = new Float32Array(buffer, MAX_BALLS * 24, MAX_BALLS);
                views.l = new Float32Array(buffer, MAX_BALLS * 28, MAX_BALLS);
                views.radiusAdd = new Float32Array(buffer, MAX_BALLS * 32, MAX_BALLS);
                ups = data.ups;
                break;
            case 'workerReady':
                MAX_BALLS = data.ballparms.MAX_BALLS;
                break;
        }
    }
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        ballWorker.postMessage({ type: 'resize', width: canvas.width, height: canvas.height });
    });
    canvas.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        ballWorker.postMessage({ type: 'mouseMove', x: mouseX, y: mouseY });
    });
    canvas.addEventListener('mouseleave', () => {
        mouseX = -999;
        mouseY = -999;
        ballWorker.postMessage({ type: 'mouseLeave' });
    });
    canvas.addEventListener('click', (e) => {
        ballWorker.postMessage({ type: 'mouseClick', x: e.clientX, y: e.clientY });
    });
    init();

});