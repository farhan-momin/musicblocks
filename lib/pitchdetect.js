var mic = null;
var waveformData = null;
var audioContext = null;
var sample = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;
var rafID = null;
var tracks = null;
var buflen = 2048;
var buf = new Float32Array(buflen);
var noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function noteFromPitch(frequency) {
    var noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency, note) {
    return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));
}

function autoCorrelate(buf, sampleRate) {
    var SIZE = buf.length;
    var rms = 0;

    for (var i = 0; i < SIZE; i++) {
        var val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    var r1 = 0,
        r2 = SIZE - 1,
        thres = 0.2;
    for (var i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) {
        r1 = i;
        break;
    }
    for (var i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) {
        r2 = SIZE - i;
        break;
    }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    var c = new Array(SIZE).fill(0);
    for (var i = 0; i < SIZE; i++)
        for (var j = 0; j < SIZE - i; j++) c[i] = c[i] + buf[j] * buf[j + i];

    var d = 0;
    while (c[d] > c[d + 1]) d++;
    var maxval = -1,
        maxpos = -1;
    for (var i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    var T0 = maxpos;

    var x1 = c[T0 - 1],
        x2 = c[T0],
        x3 = c[T0 + 1];
    a = (x1 + x3 - 2 * x2) / 2;
    b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
}

function updatePitch(canvasCtx) {
    var cycles = new Array;
    waveformData = analyser.getValue();
    var ac = autoCorrelate(waveformData, sample);

    canvasCtx.clearRect(0, 0, canvasCtx.canvas.width, canvasCtx.canvas.height);

    if (ac == -1) {
        canvasCtx.fillText("-- Hz", canvasCtx.canvas.width / 2 - 30, 50);
        canvasCtx.fillText("--", canvasCtx.canvas.width / 2 - 20, 200);
        canvasCtx.fillText("-- cents", canvasCtx.canvas.width / 2 - 40, 250);
    } else {
		var pitch = ac;
		var note = noteFromPitch(pitch);
		var detune = centsOffFromPitch(pitch, note);
	
		canvasCtx.fillText(Math.round(pitch) + " Hz", canvasCtx.canvas.width / 2 - 40, 50);
		canvasCtx.fillText(noteStrings[note % 12], canvasCtx.canvas.width / 2 - 20, 200);
	
		if (detune === 0) {
			canvasCtx.fillText("-- cents", canvasCtx.canvas.width / 2 - 40, 250);
		} else {
			let detuneCents = Math.abs(detune) + " cents";
			let symbol;
	
			if (detune < 0) {
				symbol = '\u266D'; // Flat symbol
			} else {
				symbol = '\u266F'; // Sharp symbol
			}
	
			// Draw the "cents" text (original size)
			canvasCtx.fillText(detuneCents, canvasCtx.canvas.width / 2 - 60, 250);
	
			// Save the current context state
			canvasCtx.save();
	
			// Set the font size for the symbol
			canvasCtx.font = "24px sans-serif"; // Adjust as needed
			let symbolWidth = canvasCtx.measureText(symbol).width; // Measure the width of the symbol
	
			// Draw the symbol separately
			canvasCtx.fillText(symbol, canvasCtx.canvas.width / 2 - 60 + canvasCtx.measureText(detuneCents).width + 1, 250); // Adjust x-coordinate
	
			// Restore the context to its previous state
			canvasCtx.restore();
		}
	}

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = window.webkitRequestAnimationFrame;
    rafID = window.requestAnimationFrame(function () {
        updatePitch(canvasCtx);
    });
}

async function startPitchDetect(canvasCtx) {
    try{
    audioContext = new Tone.Context();
    await Tone.start();
    mic = new Tone.UserMedia();
    await mic.open();
    analyser = new Tone.Analyser("waveform", 2048);
    sample = audioContext.sampleRate;
    mic.connect(analyser);
    updatePitch(canvasCtx);
    }
    catch (err) {
        console.error(`${err.name}: ${err.message}`);
        alert('Microphone access failed: ' + err.message);
    }

    
}