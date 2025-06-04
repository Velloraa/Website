// script.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');

    const video = document.getElementById('bgVideo'); // For the background video (plays muted)
    const velloraaText = document.querySelector('.content h1'); // Text element for the glow
    const backgroundMusic = document.getElementById('backgroundMusic'); // For the MP3 music

    // Web Audio API variables
    let audioContext;
    let analyser;
    let sourceNode; // Will be created from the backgroundMusic element
    let dataArray;
    window.isGlowLoopRunning = false; // Flag to control the animation loop

    if (!video) console.error('Video element #bgVideo not found!');
    if (!velloraaText) console.error('Text element .content h1 not found!');
    if (!backgroundMusic) console.error('Audio element #backgroundMusic not found!');

    // --- Function to initialize Web Audio API for reactive glow ---
    function initAudioReactiveGlow() {
        if (!backgroundMusic || velloraaText === null) {
            console.error("Cannot init glow: Music or Text element missing.");
            return;
        }
        // Ensure AudioContext is not already created and running in a bad state
        if (audioContext && audioContext.state === 'closed') {
            audioContext = null; 
            sourceNode = null; 
        }

        if (!audioContext) { // Initialize only once, or if closed
            try {
                console.log('Creating new AudioContext for music analysis...');
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext created. Initial State:', audioContext.state);

                analyser = audioContext.createAnalyser();
                console.log('AnalyserNode created.');

                if (!sourceNode) { // Create source node from the <audio> element only once
                    sourceNode = audioContext.createMediaElementSource(backgroundMusic);
                    console.log('MediaElementSourceNode created from backgroundMusic element.');
                }

                sourceNode.connect(analyser);
                console.log('Music sourceNode connected to Analyser.');
                // Connect analyser to output ONLY IF you want the music through AudioContext pipeline
                // If the <audio> tag plays directly, this isn't strictly needed for analysis ONLY
                // But it's good practice if you were to add more AudioNodes later.
                // For simple analysis from an already playing <audio> tag, sourceNode -> analyser is enough.
                // However, to ensure it works reliably and to enable future effects, connect to destination.
                analyser.connect(audioContext.destination);
                console.log('Analyser connected to audioContext.destination.');

            } catch (e) {
                console.error("Error during AudioContext or Node setup for music:", e);
                return; 
            }
        }

        // Attempt to resume context if it's suspended
        if (audioContext.state === 'suspended') {
            console.log('Music AudioContext is suspended. Attempting to resume...');
            audioContext.resume()
                .then(() => {
                    console.log('Music AudioContext resumed. State:', audioContext.state);
                    if (!window.isGlowLoopRunning && !backgroundMusic.paused) {
                        console.log('Music AC resumed, music playing, starting glow loop.');
                        window.isGlowLoopRunning = true;
                        drawGlow();
                    }
                })
                .catch(err => console.error("Error resuming music AudioContext:", err));
        } else if (audioContext.state === 'running' && !window.isGlowLoopRunning && !backgroundMusic.paused) {
            console.log('Music AC running, music playing, ensuring glow loop starts.');
            window.isGlowLoopRunning = true;
            drawGlow();
        }

        analyser.fftSize = 256; // Adjust for sensitivity and performance
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        console.log('Music Analyser FFT size set, dataArray initialized.');
    }

    let frameCount = 0; // For periodic logging

    // --- Function to draw the glow based on audio ---
    function drawGlow() {
        if (!window.isGlowLoopRunning) return;
        if (!analyser || !dataArray || !audioContext || audioContext.state !== 'running') {
            if (audioContext && audioContext.state !== 'running') {
                window.isGlowLoopRunning = false; 
                return;
            }
            requestAnimationFrame(drawGlow);
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length || 0;

        // --- Adjust these for desired "brightness" (blur radius) effect ---
        const minBlur = 8;    // Minimum blur when quiet
        const maxBlur = 150;   // Maximum blur when loud (making it appear "brighter"/larger)
        const sensitivity = 5.0; // How much audio affects blur (higher = more sensitive)

        let newBlur = minBlur + (average / 255) * (maxBlur - minBlur) * sensitivity;
        newBlur = Math.min(maxBlur, Math.max(minBlur, newBlur)); // Clamp value

        if (velloraaText) {
            velloraaText.style.setProperty('--glow-blur-reactive', newBlur + 'px');
        }

        frameCount++;
        if (frameCount % 100 === 0) {
            console.log(`Music Glow: Avg Audio = ${average.toFixed(2)}, Blur = ${newBlur.toFixed(2)}px, AC State: ${audioContext.state}`);
        }
        requestAnimationFrame(drawGlow);
    }

    // --- Background Music Playback Logic ---
    if (backgroundMusic) {
        backgroundMusic.volume = 0.3; // Set desired music volume

        const startMusicAndGlow = () => {
            // This function is called once music successfully starts
            console.log('Music playback successful. Initializing reactive glow.');
            initAudioReactiveGlow(); // Initialize Web Audio API and glow effect
        };

        const playPromise = backgroundMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(startMusicAndGlow) // If autoplay works, init glow
            .catch(error => {
                console.warn('Music autoplay prevented:', error);
                console.log('Setting up click listener to start music and glow.');
                // Fallback: play music and init glow on the first user click
                const playMusicOnClick = () => {
                    backgroundMusic.play()
                        .then(startMusicAndGlow) // If click-triggered play works, init glow
                        .catch(err => console.error('Error playing music after click:', err));
                };
                document.body.addEventListener('click', playMusicOnClick, { once: true });
            });
        }

        backgroundMusic.onpause = () => {
            console.log('Music paused. Stopping glow loop.');
            window.isGlowLoopRunning = false;
        };
        backgroundMusic.onplay = () => { // When music resumes (e.g. after pause, or if it starts delayed)
            console.log('Music playing event.');
            // Ensure glow restarts if context is ready and music is actually playing
            if (audioContext && audioContext.state === 'running') {
                if (!window.isGlowLoopRunning) {
                    console.log('Music playing, AC running, restarting glow loop.');
                    window.isGlowLoopRunning = true;
                    drawGlow();
                }
            } else if (audioContext && audioContext.state === 'suspended') {
                // If context is suspended, try to resume it (e.g. if user re-enables tab)
                audioContext.resume().then(() => {
                    if (!window.isGlowLoopRunning) {
                         window.isGlowLoopRunning = true;
                         drawGlow();
                    }
                });
            }
            // If audioContext isn't even set up yet but music starts,
            // the initial playPromise handler or click handler should have called initAudioReactiveGlow.
        };

    } else { // No backgroundMusic element found
        console.log('Background music element not found. No music or reactive glow will be initialized.');
    }

    console.log('Initial script setup complete.');
});