// script.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');

    // --- Get DOM Elements ---
    const video = document.getElementById('bgVideo');
    const backgroundMusic = document.getElementById('backgroundMusic');
    // const velloraaText = document.querySelector('.content h1'); // Not directly manipulated by this JS

    // For Canvas Visualizer
    const canvas = document.getElementById('audioVisualizerCanvas');
    let canvasCtx;

    // For Custom Cursor & Trail
    const customCursor = document.getElementById('customCursor');

    // --- Error Checking for Elements ---
    if (!video) console.error('Video element #bgVideo not found!');
    if (!backgroundMusic) console.error('Audio element #backgroundMusic not found!');
    if (!canvas) {
        console.error('Canvas element #audioVisualizerCanvas not found!');
    } else {
        canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) console.error('Failed to get 2D context for visualizer canvas!');
    }
    if (!customCursor) console.error('Custom cursor element #customCursor not found!');


    // --- Web Audio API & Visualizer Variables ---
    let audioContext;
    let analyser;
    let sourceNodeVisualizer; // Source node for the visualizer from backgroundMusic
    let visualizerDataArray;
    window.isVisualizerLoopRunning = false;

    // --- Custom Cursor & Trail Variables ---
    const trailDots = [];
    const numTrailDots = 15;
    let mouseX = -100;
    let mouseY = -100;


    // --- Initialize Trail Dots ---
    if (customCursor) { // Only create trail if custom cursor exists
        for (let i = 0; i < numTrailDots; i++) {
            const dot = document.createElement('div');
            dot.classList.add('trail-dot');
            document.body.appendChild(dot);
            trailDots.push({
                element: dot,
                x: -100, // Start off-screen
                y: -100
            });
        }
    }

    // --- Mouse Move Listener for Custom Cursor ---
    if (customCursor) {
        document.addEventListener('mousemove', function(e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
            // Adjust offsets to center the 20x30 cursor. (10 for x, 15 for y for true center)
            // Tweaking this based on perceived center of the cross might be needed.
            customCursor.style.left = (mouseX - 10) + 'px';
            customCursor.style.top = (mouseY - 15) + 'px';
        });
    }

    // --- Animate Trail Function ---
    function animateTrail() {
        if (!customCursor) return; // Don't run if no cursor

        let targetX = mouseX;
        let targetY = mouseY;

        trailDots.forEach((dot, index) => {
            const easeFactor = 0.35;
            dot.x += (targetX - dot.x) * easeFactor;
            dot.y += (targetY - dot.y) * easeFactor;

            // Offset by half dot size (assuming base size 10px, scaled)
            const currentScale = Math.max(0, 1 - (index / numTrailDots) * 0.8);
            const currentDotSize = 10 * currentScale;
            dot.element.style.transform = `translate(${dot.x - (currentDotSize / 2)}px, ${dot.y - (currentDotSize / 2)}px)`;

            const opacity = Math.max(0, 1 - (index / numTrailDots) * 0.9);
            dot.element.style.width = `${currentDotSize}px`;
            dot.element.style.height = `${currentDotSize}px`;
            dot.element.style.opacity = opacity;

            targetX = dot.x;
            targetY = dot.y;
        });
        requestAnimationFrame(animateTrail);
    }

    // --- Function to Initialize Web Audio API for Visualizer ---
    function initAudioVisualizer() {
        if (!backgroundMusic || !canvasCtx) return;
        if (audioContext && audioContext.state === 'closed') {
            audioContext = null; sourceNodeVisualizer = null;
        }

        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.smoothingTimeConstant = 0.8;

                if (!sourceNodeVisualizer) { // Create source only once
                    sourceNodeVisualizer = audioContext.createMediaElementSource(backgroundMusic);
                }
                sourceNodeVisualizer.connect(analyser);
                analyser.connect(audioContext.destination);
                console.log('Visualizer audio pipeline connected.');
            } catch (e) {
                console.error("Error during visualizer AudioContext setup:", e); return;
            }
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('Visualizer AudioContext resumed. State:', audioContext.state);
                if (!window.isVisualizerLoopRunning && !backgroundMusic.paused) {
                    window.isVisualizerLoopRunning = true;
                    resizeCanvas(); drawVisualizer();
                }
            }).catch(err => console.error("Error resuming visualizer AC:", err));
        } else if (audioContext.state === 'running' && !window.isVisualizerLoopRunning && !backgroundMusic.paused) {
            window.isVisualizerLoopRunning = true;
            resizeCanvas(); drawVisualizer();
        }

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        visualizerDataArray = new Uint8Array(bufferLength);
    }

    // --- Canvas Resize Function ---
    function resizeCanvas() {
        if (!canvas || !canvasCtx) return;
        const desiredWidth = Math.min(window.innerWidth * 0.6, 500); // Max 500px or 60%
        const desiredHeight = 180;
        canvas.width = desiredWidth;
        canvas.height = desiredHeight;
        console.log(`Visualizer Canvas resized to: ${canvas.width}x${canvas.height}`);
    }
    // Consider calling resizeCanvas on window.addEventListener('resize', resizeCanvas); for responsiveness

    // --- Draw Visualizer Function ---
    function drawVisualizer() {
        if (!window.isVisualizerLoopRunning || !analyser || !visualizerDataArray || !canvasCtx || !audioContext || audioContext.state !== 'running') {
            if (audioContext && audioContext.state !== 'running') window.isVisualizerLoopRunning = false;
            return;
        }
        requestAnimationFrame(drawVisualizer);
        analyser.getByteFrequencyData(visualizerDataArray);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const numBars = visualizerDataArray.length * 0.7; // Use 70% of bins
        const barSpacing = 1;
        const totalSpacing = (numBars - 1) * barSpacing;
        const barWidth = (canvas.width - totalSpacing) / numBars;
        let x = 0;

        for (let i = 0; i < numBars; i++) {
            const barHeightScale = 1.3;
            const barHeight = (visualizerDataArray[i] / 255) * canvas.height * barHeightScale;
            const r = 100 + (visualizerDataArray[i] / 2.5); // Dynamic purple shade
            const g = 0;
            const b = 120 + (visualizerDataArray[i] / 2);
            canvasCtx.fillStyle = `rgb(${Math.min(255,r)},${g},${Math.min(255,b)})`;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + barSpacing;
        }
    }

    // --- Background Music Playback & Visualizer Initialization ---
    if (backgroundMusic) {
        backgroundMusic.volume = 0.3;
        const startMusicAndEffects = () => {
            console.log('Music playback successful. Initializing audio visualizer.');
            initAudioVisualizer(); // Initialize Web Audio API and visualizer
        };

        const playPromise = backgroundMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(startMusicAndEffects)
            .catch(error => {
                console.warn('Music autoplay prevented:', error);
                const playMusicOnClick = () => {
                    backgroundMusic.play()
                        .then(startMusicAndEffects)
                        .catch(err => console.error('Error playing music after click:', err));
                };
                document.body.addEventListener('click', playMusicOnClick, { once: true });
                console.log('Fallback: Click page to start music and visualizer.');
            });
        }

        backgroundMusic.onpause = () => {
            console.log('Music paused. Stopping visualizer loop.');
            window.isVisualizerLoopRunning = false;
        };
        backgroundMusic.onplay = () => {
            console.log('Music playing event (main).');
            if (audioContext && audioContext.state === 'running') {
                if (!window.isVisualizerLoopRunning) {
                    window.isVisualizerLoopRunning = true;
                    resizeCanvas(); // Ensure canvas is sized
                    drawVisualizer();
                }
            } else if (audioContext && audioContext.state === 'suspended') { // Try to resume if suspended
                audioContext.resume().then(() => {
                    if (!window.isVisualizerLoopRunning) {
                         window.isVisualizerLoopRunning = true;
                         resizeCanvas();
                         drawVisualizer();
                    }
                });
            }
        };
    } else {
        console.log('Background music element not found.');
    }

    // --- Start Cursor Trail Animation ---
    if (customCursor) { // Start trail only if cursor element exists
        animateTrail();
        console.log('Custom cursor trail animation started.');
    }

    console.log('Initial script setup complete.');
});