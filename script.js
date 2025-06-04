// script.js

document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('bgVideo');
    const velloraaText = document.querySelector('.content h1');
    let audioContext;
    let analyser;
    let source;
    let dataArray;

    // Set initial video volume (as requested previously)
    if (video) {
        video.volume = 0.5;
    }

    function initAudioReactiveGlow() {
        if (!audioContext) { // Initialize only once
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();

            try {
                if (!source) {
                    source = audioContext.createMediaElementSource(video);
                }
                source.connect(analyser);
                analyser.connect(audioContext.destination);
            } catch (e) {
                console.error("Error connecting media element source:", e);
                return; 
            }
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(err => console.error("Error resuming AudioContext:", err));
        }

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        // Start the drawing loop if it's not already started
        // (or ensure it continues if it was paused)
        // We call it once here, and it will loop itself with requestAnimationFrame
        if (!window.isGlowLoopRunning) { // Use a global flag or similar check
             window.isGlowLoopRunning = true;
             drawGlow();
        }
    }

    function drawGlow() {
        if (!analyser || !window.isGlowLoopRunning) { // Check flag to stop loop if needed
            window.isGlowLoopRunning = false; // Ensure flag is reset if loop stops
            return;
        }

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length || 0; // Ensure average is not NaN

        // --- ADJUST THESE VALUES FOR SENSITIVITY ---
        const minBlur = 5;    // Minimum blur radius
        const maxBlur = 60;   // Maximum blur radius
        const sensitivity = 3.5; // Increased sensitivity

        let newBlur = minBlur + (average / 255) * (maxBlur - minBlur) * sensitivity;
        newBlur = Math.min(maxBlur, Math.max(minBlur, newBlur)); // Clamp the value

        if (velloraaText) {
            velloraaText.style.setProperty('--glow-blur-reactive', newBlur + 'px');
        }

        requestAnimationFrame(drawGlow); // Loop the drawing function
    }
    window.isGlowLoopRunning = false; // Initialize the flag


    if (video && velloraaText) {
        video.onplay = () => {
            // console.log("Video is playing. Attempting to init audio glow.");
            if (!audioContext || audioContext.state === 'suspended') {
                initAudioReactiveGlow();
            } else if (audioContext.state === 'running' && !window.isGlowLoopRunning) {
                // If context is running but loop was stopped for some reason, restart it
                window.isGlowLoopRunning = true;
                drawGlow();
            }
        };
        
        video.onpause = () => {
            // console.log("Video paused. Stopping glow loop.");
            // Optionally stop the glow loop when video is paused to save resources
             window.isGlowLoopRunning = false;
        };

        // Attempt to initialize and resume AudioContext on user interaction
        document.body.addEventListener('click', () => {
            if (!audioContext || audioContext.state === 'suspended') {
                // console.log("Body clicked. Attempting to init audio glow if needed.");
                initAudioReactiveGlow();
            } else if (audioContext.state === 'running' && !window.isGlowLoopRunning && !video.paused) {
                // If context is running, video is playing, but loop stopped, restart.
                window.isGlowLoopRunning = true;
                drawGlow();
            }
        }, { once: false }); // Changed once to false to allow re-init if context gets messed up
                            // Though ideally, it sets up once and just resumes.
                            // For robustness on user clicking again if something went wrong.

    } else {
        console.error("Video element or text element not found.");
    }
});