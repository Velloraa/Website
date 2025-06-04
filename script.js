// script.js

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM fully loaded and parsed');

    const video = document.getElementById('bgVideo');
    const velloraaText = document.querySelector('.content h1');
    let audioContext;
    let analyser;
    let sourceNode; // Renamed from 'source' to avoid confusion with <source> element
    let dataArray;

    window.isGlowLoopRunning = false; // Initialize the flag globally for clarity

    if (!video) {
        console.error('Video element #bgVideo not found!');
        return;
    }
    if (!velloraaText) {
        console.error('Text element .content h1 not found!');
        return;
    }

    // Set initial video volume
    video.volume = 0.5;
    console.log('Video volume set to 0.5');

    function initAudioReactiveGlow() {
        console.log('Attempting to initialize Audio Reactive Glow...');

        if (!audioContext) {
            try {
                console.log('Creating new AudioContext...');
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext created. State:', audioContext.state);

                analyser = audioContext.createAnalyser();
                console.log('AnalyserNode created.');

                // Crucial: MediaElementSourceNode can only be created once per media element
                if (!sourceNode) {
                    sourceNode = audioContext.createMediaElementSource(video);
                    console.log('MediaElementSourceNode created from video.');
                }

                sourceNode.connect(analyser);
                console.log('SourceNode connected to Analyser.');
                analyser.connect(audioContext.destination); // Connect analyser to output to hear sound
                console.log('Analyser connected to audioContext.destination.');

            } catch (e) {
                console.error("Error during AudioContext or Node setup:", e);
                return; // Stop if critical setup fails
            }
        }

        // Attempt to resume context if it's suspended (common before user interaction)
        if (audioContext.state === 'suspended') {
            console.log('AudioContext is suspended. Attempting to resume...');
            audioContext.resume()
                .then(() => {
                    console.log('AudioContext resumed successfully. State:', audioContext.state);
                    // Start the draw loop only after successful resume if it wasn't running
                    if (!window.isGlowLoopRunning && !video.paused) {
                        console.log('AudioContext resumed and video is playing, starting glow loop.');
                        window.isGlowLoopRunning = true;
                        drawGlow();
                    }
                })
                .catch(err => console.error("Error resuming AudioContext:", err));
        } else if (audioContext.state === 'running' && !window.isGlowLoopRunning && !video.paused) {
             console.log('AudioContext is running and video is playing, ensuring glow loop starts.');
             window.isGlowLoopRunning = true;
             drawGlow();
        }


        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        console.log('Analyser FFT size set, dataArray initialized. Buffer length:', bufferLength);
    }

    let frameCount = 0; // For less frequent logging from drawGlow

    function drawGlow() {
        if (!window.isGlowLoopRunning) {
            // console.log('Glow loop is not running, exiting drawGlow.');
            return; // Stop the loop if the flag is false
        }
        if (!analyser || !dataArray) {
            console.warn('Analyser or dataArray not ready in drawGlow. Retrying animation frame.');
            requestAnimationFrame(drawGlow);
            return;
        }

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length || 0;

        const minBlur = 5;
        const maxBlur = 60;
        const sensitivity = 3.5;

        let newBlur = minBlur + (average / 255) * (maxBlur - minBlur) * sensitivity;
        newBlur = Math.min(maxBlur, Math.max(minBlur, newBlur));

        if (velloraaText) {
            velloraaText.style.setProperty('--glow-blur-reactive', newBlur + 'px');
        }

        // Log values periodically to avoid flooding the console
        frameCount++;
        if (frameCount % 100 === 0) { // Log every 100 frames (approx every 1.6 seconds)
            console.log(`drawGlow Loop: Average Audio = ${average.toFixed(2)}, New Blur = ${newBlur.toFixed(2)}px, AC State: ${audioContext ? audioContext.state : 'N/A'}`);
        }

        requestAnimationFrame(drawGlow);
    }

    // --- Event Listeners to Start/Resume Audio Processing ---

    video.onplay = () => {
        console.log('Video "play" event triggered.');
        if (audioContext && audioContext.state === 'running') {
            console.log('Video playing, AudioContext running, ensuring glow loop is active.');
            if (!window.isGlowLoopRunning) {
                 window.isGlowLoopRunning = true;
                 drawGlow(); // Start drawing if it wasn't already
            }
        } else {
            // If context not running or not initialized, initAudioReactiveGlow will handle it
            initAudioReactiveGlow();
        }
    };

    video.onpause = () => {
        console.log('Video "pause" event triggered. Stopping glow loop.');
        window.isGlowLoopRunning = false;
        // Optionally, you could also suspend the audioContext here if desired to save resources,
        // but it will require resume on play again:
        // if (audioContext && audioContext.state === 'running') {
        //     audioContext.suspend().then(() => console.log('AudioContext suspended on video pause.'));
        // }
    };

    // General click listener on the body to try and resume/initialize AudioContext
    // This is a fallback and primary mechanism for browsers requiring explicit user gesture.
    document.body.addEventListener('click', function handleUserInteraction() {
        console.log('Body click detected. Attempting to initialize/resume AudioContext.');
        if (!audioContext || audioContext.state !== 'running') {
            initAudioReactiveGlow();
        } else if (!window.isGlowLoopRunning && !video.paused) {
            // If AC is running but loop isn't and video is playing
            console.log('Body click: AC running, video playing, loop not running. Starting loop.');
            window.isGlowLoopRunning = true;
            drawGlow();
        }
        // Remove this listener after the first successful interaction if you only need it once
        // For robustness, keeping it might allow user to "re-initiate" if something unexpected happened.
        // Or use { once: true } if confident one click is enough:
        // document.body.removeEventListener('click', handleUserInteraction);
    }/*, { once: true } */); // Consider using { once: true } if one click should be enough

    console.log('Event listeners set up.');
});