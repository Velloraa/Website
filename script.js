// script.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');

    const entryOverlay = document.getElementById('entryOverlay');
    const appContainer = document.getElementById('appContainer');
    const video = document.getElementById('bgVideo');
    const backgroundMusic = document.getElementById('backgroundMusic');
    const canvas = document.getElementById('audioVisualizerCanvas');
    let canvasCtx;

    // Web Audio API variables
    let audioContext;
    let analyser;
    let sourceNode;
    let dataArray;
    window.isVisualizerLoopRunning = false; // Keep this global if other scripts might interact

    if (!entryOverlay) console.error('Entry overlay #entryOverlay not found!');
    if (!appContainer) console.error('App container #appContainer not found!');
    if (!video) console.error('Video element #bgVideo not found!');
    if (!backgroundMusic) console.error('Audio element #backgroundMusic not found!');
    if (!canvas) {
        console.error('Canvas element #audioVisualizerCanvas not found!');
    } else {
        canvasCtx = canvas.getContext('2d');
    }

    function initAudioVisualizer() {
        if (!backgroundMusic || !canvasCtx) {
            console.error("Cannot init visualizer: Music or Canvas context missing.");
            return;
        }
        if (audioContext && audioContext.state === 'closed') {
            audioContext = null; sourceNode = null;
        }

        if (!audioContext) {
            try {
                console.log('Creating new AudioContext for visualizer...');
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('Visualizer AudioContext created. State:', audioContext.state);

                analyser = audioContext.createAnalyser();
                analyser.smoothingTimeConstant = 0.8;
                console.log('Visualizer AnalyserNode created.');

                if (!sourceNode) { // Ensure sourceNode is created only once
                    sourceNode = audioContext.createMediaElementSource(backgroundMusic);
                    console.log('MediaElementSourceNode for visualizer created from music element.');
                    sourceNode.connect(analyser);
                    analyser.connect(audioContext.destination); // Output audio to speakers
                    console.log('Visualizer audio pipeline connected.');
                }


            } catch (e) {
                console.error("Error during visualizer AudioContext setup:", e);
                return;
            }
        }

        if (audioContext.state === 'suspended') {
            console.log('Visualizer AudioContext suspended. Attempting to resume...');
            audioContext.resume().then(() => {
                console.log('Visualizer AudioContext resumed. State:', audioContext.state);
                if (!window.isVisualizerLoopRunning && !backgroundMusic.paused) {
                    window.isVisualizerLoopRunning = true;
                    resizeCanvas();
                    drawVisualizer();
                }
            }).catch(err => console.error("Error resuming visualizer AudioContext:", err));
        } else if (audioContext.state === 'running' && !window.isVisualizerLoopRunning && !backgroundMusic.paused) {
            console.log('Visualizer AC running, music playing, starting visualizer loop.');
            window.isVisualizerLoopRunning = true;
            resizeCanvas();
            drawVisualizer();
        }

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        console.log('Visualizer Analyser FFT set. Buffer length:', bufferLength);
    }

    function resizeCanvas() {
        if (!canvas || !canvasCtx) return;
        const velloraaTextElement = document.querySelector('.content h1');
        let referenceElement = velloraaTextElement;
        if (!referenceElement || getComputedStyle(referenceElement).display === 'none') {
            referenceElement = canvas.parentElement; // Fallback to parent if text hidden
        }
        
        // Attempt to size canvas relative to the "Velloraa" text or its container
        // This is a simplified approach; you might need more sophisticated logic
        // if the text's size is dynamic or hard to predict before rendering.
        const textRect = referenceElement.getBoundingClientRect();
        
        // Make canvas wide enough for text, with some padding, or a max width
        const desiredWidth = Math.min(window.innerWidth * 0.7, Math.max(300, textRect.width + 40));
        const desiredHeight = Math.max(100, textRect.height * 1.5); // Taller than text

        canvas.width = desiredWidth;
        canvas.height = desiredHeight;
        console.log(`Canvas resized to: ${canvas.width}x${canvas.height} based on reference element`);
    }
    
    // window.addEventListener('resize', resizeCanvas); // Optional: make it responsive

    let frameCount = 0;
    function drawVisualizer() {
        if (!window.isVisualizerLoopRunning || !analyser || !dataArray || !canvasCtx ||
            !audioContext || audioContext.state !== 'running') {
            if (audioContext && audioContext.state !== 'running') {
                window.isVisualizerLoopRunning = false; // Stop if AC is not running
            }
            return;
        }
        requestAnimationFrame(drawVisualizer);

        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const numBars = dataArray.length * 0.8;
        const barSpacing = 2;
        const totalSpacing = (numBars - 1) * barSpacing;
        const barWidth = (canvas.width - totalSpacing) / numBars;
        let x = 0;

        for (let i = 0; i < numBars; i++) {
            const barHeightScale = 0.5;
            const barHeight = (dataArray[i] / 255) * canvas.height * barHeightScale;
            const r = 128 + (dataArray[i] / 2);
            const g = 0;
            const b = 128 + dataArray[i];
            canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + barSpacing;
        }
        // frameCount++; // Not strictly needed unless debugging
    }

    function startApp() {
        console.log('Starting main application...');
        if (appContainer) {
            appContainer.style.display = 'block'; // Or 'flex' if its direct children need flex layout
        }
        
        // Resize canvas now that it's visible
        resizeCanvas(); 

        if (video) {
            video.play().catch(error => console.error('Error playing video:', error));
        }

        if (backgroundMusic) {
            backgroundMusic.volume = 0.3;
            backgroundMusic.loop = true; // Ensure loop is set

            const startMusicAndVisualizer = () => {
                console.log('Music playback successful. Initializing audio visualizer.');
                initAudioVisualizer();
            };

            // User interaction (the click to enter) should allow audio to play.
            const playPromise = backgroundMusic.play();
            if (playPromise !== undefined) {
                playPromise.then(startMusicAndVisualizer)
                .catch(error => {
                    console.warn('Music play prevented even after initial interaction:', error);
                    // You might add a fallback UI element here to manually start music if this fails
                    document.body.addEventListener('click', () => { // One more attempt on another click
                         backgroundMusic.play().then(startMusicAndVisualizer).catch(e => console.error("Still can't play", e));
                    }, { once: true });
                });
            }

            backgroundMusic.onpause = () => {
                console.log('Music paused. Stopping visualizer loop.');
                window.isVisualizerLoopRunning = false;
            };
            backgroundMusic.onplay = () => {
                console.log('Music playing event (visualizer).');
                 // Ensure AudioContext is running and visualizer starts
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume().then(() => {
                        if (!window.isVisualizerLoopRunning) {
                             console.log('AC resumed, restarting visualizer loop.');
                             window.isVisualizerLoopRunning = true;
                             resizeCanvas(); // Ensure canvas is sized
                             drawVisualizer();
                        }
                    });
                } else if (audioContext && audioContext.state === 'running') {
                    if (!window.isVisualizerLoopRunning) {
                        console.log('Music playing, AC running, restarting visualizer loop.');
                        window.isVisualizerLoopRunning = true;
                        resizeCanvas(); // Ensure canvas is sized
                        drawVisualizer();
                    }
                } else if (!audioContext) { // If visualizer wasn't initialized yet
                    console.log('Music playing, initializing visualizer for the first time.');
                    initAudioVisualizer();
                }
            };
        } else {
            console.log('Background music element not found. No music or visualizer will be initialized.');
        }
        console.log('Main application setup complete.');
    }

    if (entryOverlay) {
        entryOverlay.addEventListener('click', function() {
            console.log('"Click 2 Enter" clicked.');
            entryOverlay.style.display = 'none'; // Hide the overlay
            startApp(); // Start the main application
        }, { once: true }); // Ensure this listener runs only once
    } else {
        // Fallback if entryOverlay is not found (e.g., during development/testing)
        console.warn('Entry overlay not found, starting app directly.');
        startApp();
    }
});