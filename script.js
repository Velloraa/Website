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
    window.isVisualizerLoopRunning = false;

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

                if (!sourceNode) {
                    sourceNode = audioContext.createMediaElementSource(backgroundMusic);
                    console.log('MediaElementSourceNode for visualizer created from music element.');
                    sourceNode.connect(analyser);
                    analyser.connect(audioContext.destination);
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
        const cayseyTextElement = document.querySelector('.content h1');
        let referenceElement = cayseyTextElement;
        if (!referenceElement || getComputedStyle(referenceElement).display === 'none') {
            referenceElement = canvas.parentElement; 
        }
        
        const textRect = referenceElement.getBoundingClientRect();
        
        const desiredWidth = Math.min(window.innerWidth * 1, Math.max(400, textRect.width + 80));
        const desiredHeight = Math.max(100, textRect.height * 1.5); 

        canvas.width = desiredWidth;
        canvas.height = desiredHeight;
        console.log(`Canvas resized to: ${canvas.width}x${canvas.height} based on reference element`);
    }
    
    // window.addEventListener('resize', resizeCanvas); // Optional

    function drawVisualizer() {
        if (!window.isVisualizerLoopRunning || !analyser || !dataArray || !canvasCtx ||
            !audioContext || audioContext.state !== 'running') {
            if (audioContext && audioContext.state !== 'running') {
                window.isVisualizerLoopRunning = false;
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
    }

    function startApp() {
        console.log('Starting main application...');
        if (appContainer) {
            appContainer.style.display = 'block';
        }
        
        resizeCanvas(); 

        if (video) {
            video.loop = true; 
            video.muted = true; 

            const attemptPlayVideo = () => {
                video.play()
                    .then(() => {
                        console.log("Video playback started successfully.");
                    })
                    .catch(error => {
                        console.error('Error playing video:', error);
                    });
            };

            if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
                console.log('Video metadata already loaded, attempting to play.');
                attemptPlayVideo();
            } else {
                console.log('Video metadata not yet loaded, adding event listener for loadedmetadata.');
                video.addEventListener('loadedmetadata', () => {
                    console.log('Video metadata loaded via event, now attempting to play.');
                    attemptPlayVideo();
                }, { once: true });
                
                video.addEventListener('error', (e) => {
                    console.error('Error occurred with the video element itself (e.g., bad source, network issue):', e);
                });
            }

        } else {
            console.error('Video element #bgVideo not found when trying to start app!');
        }

        if (backgroundMusic) {
            backgroundMusic.volume = 0.3;
            backgroundMusic.loop = true; 

            const startMusicAndVisualizer = () => {
                console.log('Music playback successful. Initializing audio visualizer.');
                initAudioVisualizer();
            };

            const playPromise = backgroundMusic.play();
            if (playPromise !== undefined) {
                playPromise.then(startMusicAndVisualizer)
                .catch(error => {
                    console.warn('Music play prevented even after initial interaction:', error);
                    // Fallback attempt
                    document.body.addEventListener('click', () => { 
                        backgroundMusic.play().then(startMusicAndVisualizer).catch(e => console.error("Still can't play music after second attempt", e));
                    }, { once: true });
                });
            }

            backgroundMusic.onpause = () => {
                console.log('Music paused. Stopping visualizer loop.');
                window.isVisualizerLoopRunning = false;
            };
            backgroundMusic.onplay = () => {
                console.log('Music playing event (visualizer).');
                if (audioContext && audioContext.state === 'suspended') {
                    audioContext.resume().then(() => {
                        if (!window.isVisualizerLoopRunning) {
                            console.log('AC resumed, restarting visualizer loop.');
                            window.isVisualizerLoopRunning = true;
                            resizeCanvas();
                            drawVisualizer();
                        }
                    });
                } else if (audioContext && audio_context.state === 'running') {
                    if (!window.isVisualizerLoopRunning) {
                        console.log('Music playing, AC running, restarting visualizer loop.');
                        window.isVisualizerLoopRunning = true;
                        resizeCanvas();
                        drawVisualizer();
                    }
                } else if (!audioContext) { 
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
            entryOverlay.style.display = 'none'; 
            startApp(); 
        }, { once: true }); 
    } else {
        console.warn('Entry overlay not found, attempting to start app directly (may not be intended).');
        startApp();
    }
});