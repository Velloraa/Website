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

            // Create an audio source from the video element
            // This might fail if the video metadata hasn't loaded yet, or if it's cross-origin (not an issue for local files)
            try {
                if (!source) { // Check if source already exists
                    source = audioContext.createMediaElementSource(video);
                }
                source.connect(analyser);
                analyser.connect(audioContext.destination); // So you can still hear the audio
            } catch (e) {
                console.error("Error connecting media element source:", e);
                // Fallback or error message if needed
                // For example, display a message "Could not initialize audio analysis."
                // This might happen if the video is not yet ready or due to browser restrictions.
                return; // Stop if source creation fails
            }
        }

        // --- Resume AudioContext if it's suspended (often needed after user interaction) ---
        // It's good practice to resume it on any user interaction or when play starts.
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        // ------------------------------------------------------------------------------------

        analyser.fftSize = 256; // Smaller FFT size for quicker response, adjust as needed
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        drawGlow();
    }

    function drawGlow() {
        if (!analyser) {
            requestAnimationFrame(drawGlow); // Keep trying if analyser not ready
            return;
        }

        analyser.getByteFrequencyData(dataArray); // Get frequency data

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Normalize the average (0-255) to a more usable range for blur
        // These values (minBlur, maxBlur, sensitivity) need tweaking!
        const minBlur = 8;    // Minimum blur radius for the reactive glow
        const maxBlur = 40;   // Maximum blur radius
        const sensitivity = 1.5; // How much the audio affects the blur (higher means more sensitive)

        // Map the average audio level to the blur radius
        let newBlur = minBlur + (average / 255) * (maxBlur - minBlur) * sensitivity;
        newBlur = Math.min(maxBlur, Math.max(minBlur, newBlur)); // Clamp the value

        if (velloraaText) {
            velloraaText.style.setProperty('--glow-blur-reactive', newBlur + 'px');
        }

        requestAnimationFrame(drawGlow); // Loop the drawing function
    }

    // --- Attempt to initialize audio processing ---
    if (video && velloraaText) {
        // Option 1: Try to start when video can play (might still need interaction for AudioContext)
        video.oncanplay = () => {
            // console.log("Video can play. Attempting to init audio glow.");
            // initAudioReactiveGlow(); // Initial attempt
        };

        video.onplay = () => {
            // console.log("Video is playing. Attempting to init audio glow.");
            if (!audioContext || audioContext.state === 'suspended') {
                initAudioReactiveGlow();
            }
        };

        // Option 2: A more robust way to ensure AudioContext starts is after a user click.
        // You could add a small, unobtrusive "Click to enable audio FX" button, or:
        document.body.addEventListener('click', () => {
            if (!audioContext || audioContext.state === 'suspended') {
                // console.log("Body clicked. Attempting to init audio glow if needed.");
                initAudioReactiveGlow();
            }
        }, { once: true }); // { once: true } ensures this listener runs only once

    } else {
        console.error("Video element or text element not found.");
    }
});