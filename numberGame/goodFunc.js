window.goodAlert = function(text) {
    // Create container
    const container = document.createElement('div');
    container.className = 'good-alert-container';
    container.style.position = 'fixed';
    container.style.top = '-100px'; // start off‑screen
    container.style.left = '50%';
    container.style.zIndex = '10000';
    container.style.transform = 'translateX(-50%)';
    container.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    container.style.color = '#232323';
    container.style.padding = '5px';
    container.style.borderRadius = '5px';
    container.style.maxWidth = '500px';
    container.style.minWidth = '200px';
    container.style.width = 'auto';
    container.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    container.style.transition = 'top 0.5s ease, opacity 0.5s ease';
    container.style.opacity = '1';

    // Text element
    const p = document.createElement('p');
    p.style.textAlign = 'center';
    p.style.whiteSpace = 'pre-line';
    p.style.wordBreak = 'break-word';
    p.textContent = text;
    container.appendChild(p);

    // Progress bar
    const progress = document.createElement('span');
    progress.style.display = 'block';
    progress.style.height = '2px';
    progress.style.backgroundColor = '#AAAAAA';
    progress.style.width = '100%';
    progress.style.transition = 'width 10s linear';
    container.appendChild(progress);

    document.body.appendChild(container);

    // Trigger slide‑down animation
    requestAnimationFrame(() => {
        setTimeout(() => {
            container.style.top = '20px';

            // Start progress bar after a tiny delay to allow layout
            setTimeout(() => {
                progress.style.width = '0%';
            }, 50);
            
        } , 100);
    });
    // When progress bar finishes, fade out container
    progress.addEventListener('transitionend', function(e) {
        if (e.propertyName === 'width') {
            container.style.opacity = '0';
        }
    });

    // After fade out, remove container
    container.addEventListener('transitionend', function(e) {
        if (e.propertyName === 'opacity') {
            document.body.removeChild(container);
        }
    });
};

window.loadingAnimation = function(loadingEl) {
    if (!loadingEl) return;
    let dots = 0;
    return setInterval(() => {
        dots = (dots + 1) % 4;
        loadingEl.textContent = 'Loading' + '.'.repeat(dots);
    }, 500);
}