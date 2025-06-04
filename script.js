// script.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');

    const video = document.getElementById('bgVideo');
    const backgroundMusic = document.getElementById('backgroundMusic');
    const velloraaText = document.querySelector('.content h1'); // We might not need this directly now

    // --- Canvas and Audio Visualizer Setup ---
    const canvas = document.getElementById('audioVisualizerCanvas');
    let canvasCtx; // Will be initialized later

    // Web Audio API variables
    let audioContext;
    let analyser;
    let sourceNode; // Will be created from the backgroundMusic element
    let dataArray; // For frequency data
    window.isVisualizerLoopRunning = false;

    if (!video) console.error('Video element #bgVideo not found!');
    if (!backgroundMusic) console.error('Audio element #backgroundMusic not found!');
    if (!canvas) {
        console.error('Canvas element #audioVisualizerCanvas not found!');
    } else {
        canvasCtx = canvas.getContext('2d');
    }

    // --- Function to initialize Web Audio API for Visualizer ---
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
                analyser.smoothingTimeConstant = 0.8; // Adjust for smoother transitions
                console.log('Visualizer AnalyserNode created.');

                if (!sourceNode) {
                    sourceNode = audioContext.createMediaElementSource(backgroundMusic);
                    console.log('MediaElementSourceNode for visualizer created from music element.');
                }

                sourceNode.connect(analyser);
                analyser.connect(audioContext.destination); // Output audio to speakers
                console.log('Visualizer audio pipeline connected.');

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
                    resizeCanvas(); // Resize canvas before starting loop
                    drawVisualizer();
                }
            }).catch(err => console.error("Error resuming visualizer AudioContext:", err));
        } else if (audioContext.state === 'running' && !window.isVisualizerLoopRunning && !backgroundMusic.paused) {
            console.log('Visualizer AC running, music playing, starting visualizer loop.');
            window.isVisualizerLoopRunning = true;
            resizeCanvas(); // Resize canvas before starting loop
            drawVisualizer();
        }

        analyser.fftSize = 256; // Number of samples for FFT (power of 2, e.g., 256, 512, 1024)
                               // Affects number of bars / data points
        const bufferLength = analyser.frequencyBinCount; // Half of fftSize
        dataArray = new Uint8Array(bufferLength);
        console.log('Visualizer Analyser FFT set. Buffer length:', bufferLength);
    }

    function resizeCanvas() {
        if (!canvas) return;
        // Example: Set canvas size. Adjust these values as needed.
        // Make it somewhat responsive or sized relative to the text.
        // For now, a fixed size.
        const desiredWidth = Math.min(window.innerWidth * 0.7, 600); // Max 600px or 70% of window
        const desiredHeight = 200;

        canvas.width = desiredWidth;
        canvas.height = desiredHeight;
        console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
    }
    // Call resizeCanvas initially and on window resize
    // window.addEventListener('resize', resizeCanvas); // Optional: make it responsive

    let frameCount = 0;

    // --- Function to draw the visualizer on the canvas ---
    function drawVisualizer() {
        if (!window.isVisualizerLoopRunning || !analyser || !dataArray || !canvasCtx ||
            !audioContext || audioContext.state !== 'running') {
            if (audioContext && audioContext.state !== 'running') {
                window.isVisualizerLoopRunning = false;
            }
            return;
        }
        requestAnimationFrame(drawVisualizer); // Loop the drawing

        analyser.getByteFrequencyData(dataArray); // Get frequency data into dataArray

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

        const numBars = dataArray.length * 0.8; // Use about 80% of the available frequency bins
        const barSpacing = 2; // Spacing between bars
        const totalSpacing = (numBars - 1) * barSpacing;
        const barWidth = (canvas.width - totalSpacing) / numBars;
        
        let x = 0;

        for (let i = 0; i < numBars; i++) {
            // Scale bar height: dataArray[i] is 0-255. Make it relative to canvas height.
            // Add a sensitivity factor.
            const barHeightScale = 0.5; // Adjust this to make bars taller/shorter
            const barHeight = (dataArray[i] / 255) * canvas.height * barHeightScale;

            // Color: static purple, or make it dynamic
            const r = 128 + (dataArray[i] / 2); // More purple/blue with intensity: 128-255
            const g = 0;
            const b = 128 + dataArray[i];       // More magenta/purple with intensity: 128-255
            canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
            // Or a fixed purple: canvasCtx.fillStyle = 'rgba(160, 32, 240, 0.8)'; // #A020F0 with opacity

            // Draw bar (from bottom up)
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + barSpacing; // Move to next bar position
        }

        frameCount++;
        if (frameCount % 200 === 0) { // Less frequent logging
             // Optional: log average audio if needed for debugging bar heights
            // let sum = 0; dataArray.forEach(val => sum += val); const avg = sum / dataArray.length;
            // console.log(`Visualizer Loop: Avg Freq Data ~ ${avg.toFixed(2)}, AC State: ${audioContext.state}`);
        }
    }


    // --- Background Music Playback Logic ---
    if (backgroundMusic) {
        backgroundMusic.volume = 0.3;

        const startMusicAndVisualizer = () => {
            console.log('Music playback successful. Initializing audio visualizer.');
            initAudioVisualizer();
        };

        const playPromise = backgroundMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(startMusicAndVisualizer)
            .catch(error => {
                console.warn('Music autoplay prevented:', error);
                const playMusicOnClick = () => {
                    backgroundMusic.play()
                        .then(startMusicAndVisualizer)
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
            console.log('Music playing event (visualizer).');
            if (audioContext && audioContext.state === 'running') {
                if (!window.isVisualizerLoopRunning) {
                    console.log('Music playing, AC running, restarting visualizer loop.');
                    window.isVisualizerLoopRunning = true;
                    resizeCanvas(); // Ensure canvas is sized correctly
                    drawVisualizer();
                }
            } else if (audioContext && audioContext.state === 'suspended') {
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
        console.log('Background music element not found. No music or visualizer will be initialized.');
    }
    console.log('Initial script setup complete.');
});