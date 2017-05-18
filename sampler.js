(function(){
    document.addEventListener('DOMContentLoaded', init, false);
    var filenames = ['Samples/kick_int.wav',
    				'Samples/snare_left.wav',
    				'Samples/hat_close.wav',
    				'Samples/tom2.wav',
    				'Samples/crash_high.wav',
    				'Samples/hat_open.wav',
    				'Samples/tom3.wav',
    				'Samples/tom4.wav',
    				'Samples/hat_foot.wav'];
    window.buffers = [];
    window.active_pad = 0;
    var pads = [];
    var gainNodes = [];
    var muteGains = [];
    var delaySends = [];
    window.muteGroups = [[2, 5, 8]];

    function init(){
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();

        // Table sizing:
        resizeTable();
        window.addEventListener('resize', resizeTable, false);

        // Selecting controls, enabling nav links
        controls = document.querySelectorAll('nav a');
        for (var i = 0; i < controls.length; i++) {
        	controls[i].addEventListener('click', viewControls, false);
        }

        // Master gain:
        masterGain = audioContext.createGain();
		masterGain.connect(audioContext.destination);

		masterGain.gain.value = 1;

		// Output Meter:
		outputMeter = audioContext.createAnalyser();
		masterGain.connect(outputMeter);
		// Distortion:
		bussDistortion = audioContext.createWaveShaper();
		bussDistortion.curve = makeDistortionCurve(0);
		distortionGain = audioContext.createGain();
		distortionGain.gain.value = 1;
		bussDistortion.connect(distortionGain);
		distortionGain.connect(masterGain);

		// Compressor:
		bussComp = audioContext.createDynamicsCompressor();
		compGain = audioContext.createGain();
		bussComp.connect(compGain);
		compGain.connect(bussDistortion);

		bussComp.threshold.value = 0;
		compGain.gain.value = 1;

		// Delay:
		bussDelay = audioContext.createDelay();
		delayLevel = audioContext.createGain();
		delayFeedback = audioContext.createGain();
		delayFilter = audioContext.createBiquadFilter();
		bussDelay.connect(delayLevel);
		bussDelay.connect(delayFeedback);
		delayFeedback.connect(delayFilter);
		delayFilter.connect(bussDelay);
		delayLevel.connect(masterGain);

		delayFilter.frequency.value = 5000;
		delayFilter.gain.value = -2;
		bussDelay.delayTime.value = 0.25;
		delayFeedback.gain.value = 0;
		delayLevel.gain.value = 0;

		/* Controls: */
		masterSlider = document.querySelector('#master');
		compThresholdSlider = document.querySelector('#comp_thresh');
		compGainSlider = document.querySelector('#comp_gain');
		compRatioSlider = document.querySelector('#comp_ratio');
		delayLevelSlider = document.querySelector('#delay_level');
		delayFeedbackSlider = document.querySelector('#delay_feedback');
		distortionAmountSlider = document.querySelector('#distortion_amount');
		padGainSlider = document.querySelector('#pad_gain');
		pad_selector = document.querySelector('#pad_controls select');
		delaySendSlider = document.querySelector('#pad_delay');
		saveButton = document.querySelector('#settings_name + button');
		loadButton = document.querySelector('#save_load select + button');

		// Set sliders to defaults
		masterSlider.value = masterGain.gain.value * 100;
		compThresholdSlider.value = bussComp.threshold.value;
		compGainSlider.value = compGain.gain.value*2;
		compRatioSlider.value = bussComp.ratio.value * 5;
		delayLevelSlider.value = delayLevel.gain.value * 100;
		delayFeedbackSlider.value = delayFeedback.gain.value * 100;
		distortionAmountSlider.value = 0;

		pad_fieldset = document.querySelector('#pad_controls');
		form = document.querySelector('form');
		window.editButton = document.querySelector('#editbutton');
		muteGroupDelete = document.querySelector('#delete_mute_group');
		muteGroupCreate = document.querySelector('#create_mute_group');
		muteGroupLister = document.querySelector('#mute_group select');
		listedMuteGroups = document.querySelectorAll('#mute_group option');
		updateMuteGroupLister();

        for (var i = 0; i < 9; i++) {
        	pads.push(document.querySelector('#p' + String(i + 1)));
			loadSample(i);
			var gainNode = audioContext.createGain();
			var send = audioContext.createGain();
			var muteGain = audioContext.createGain();
			send.gain.value = 0;

			gainNode.connect(muteGain);
			muteGain.connect(send);
			muteGain.connect(bussComp);
			send.connect(bussDelay);

			gainNodes.push(gainNode);
			muteGains.push(muteGain);
			delaySends.push(send);
		}


		setDefaultGains();

        enablePads();

        masterSlider.addEventListener('input', changeMaster, false);
        compThresholdSlider.addEventListener('input', changeCompThresh, false);
        compGainSlider.addEventListener('input', changeCompGain, false);
        compRatioSlider.addEventListener('input', changeCompRatio, false);
        delayLevelSlider.addEventListener('input', changeDelayLevel, false);
        delayFeedbackSlider.addEventListener('input', changeDelayFeedback, false);
        distortionAmountSlider.addEventListener('input', changeDistortionAmount, false);
        padGainSlider.addEventListener('input', changePadGain, false);
        delaySendSlider.addEventListener('input', changeDelaySend, false);
        pad_selector.addEventListener('change', changeActivePad, false);
        muteGroupDelete.addEventListener('click', deleteMuteGroup, false);
        muteGroupCreate.addEventListener('click', createMuteGroup, false);

        window.setInterval(100, updateCompGRMeter);

    }

    function loadSample(padnumber){
        var request = new XMLHttpRequest();

        request.open('GET', filenames[padnumber], true);
        request.responseType = 'arraybuffer';

        request.onload = function() {
            var audioData = request.response;

            audioContext.decodeAudioData(audioData, function(buffer) {
                window.buffers[padnumber] = buffer;
            },

            function(e){"Error decoding audio file." + e.err});
        }

        request.send();
    }

    function playSample(event) {
    	// Get the number of the pad that was clicked:
    	for (var padnumber = -1; event.target.id != 'p' + String(padnumber + 1); padnumber++) {}

    	// Prepare sample for playback
    	source = audioContext.createBufferSource();
    	source.buffer = buffers[padnumber];
    	source.connect(gainNodes[padnumber]);

    	// Mute and unmute pads according to mute groups
    	for (var i = 0; i < window.muteGroups.length; i++) {
    		if (isInArray(padnumber, window.muteGroups[i])) {
    			thisgroup = window.muteGroups[i];
    			for (var j = 0; j < thisgroup.length; j++) {
    				currentpad = thisgroup[j];
    				if (currentpad != padnumber) {
    					muteGains[currentpad].gain.value = 0;
    				}
    				else {
    					muteGains[currentpad].gain.value = 1;
    				}
    			}
    		}
    	}

        source.start();

        // Prevent touchscreen browsers from generating a click event as well as a touch event
        event.preventDefault();
    }

    function changeMaster() {
    	masterGain.gain.value = masterSlider.value/100;
    	}

    function changeCompThresh() {
    	bussComp.threshold.value = compThresholdSlider.value;
    }

    function changeCompGain() {
    	compGain.gain.value = compGainSlider.value/2;
    }

    function changeCompRatio() {
    	bussComp.ratio.value = compRatioSlider.value/5;
    }

    function changeDelayLevel() {
    	delayLevel.gain.value = delayLevelSlider.value/100;
    }

    function changeDelayFeedback() {
    	delayFeedback.gain.value = delayFeedbackSlider.value/100;
    }

    function changeDistortionAmount() {
    	bussDistortion.curve = makeDistortionCurve(distortionAmountSlider.value);
    	distortionGain.gain.value = 1/(Math.sqrt(distortionAmountSlider.value) + 1)
    }

    function disablePads() {
    	for (var i = 0; i < 9; i++) {
    		pads[i].removeEventListener('click', playSample, false);
    		pads[i].removeEventListener('touchstart', playSample, false);
    	}
    }

    function enablePads() {
    	for (var i = 0; i < 9; i++) {
    		pads[i].addEventListener('click', playSample, false);
    		pads[i].addEventListener('touchstart', playSample, false);
    	}
    }

    function addEditListeners() {
    	for (var i = 0; i < 9; i++) {
    		pads[i].addEventListener('click', changeActivePad, false);
    	}
    	pad_gain.addEventListener('input', changePadGain, false);
    	delaySendSlider.addEventListener('input', changeDelaySend, false);
    }

    function removeEditListeners() {
    	for (var i = 0; i < 9; i++) {
    		pads[i].removeEventListener('click', changeActivePad, false);
    	}
    	pad_gain.removeEventListener('input', changePadGain, false);
    	delaySendSlider.removeEventListener('input', changeDelaySend, false);
    }

    function changeActivePad(event) {
    	options = document.querySelectorAll('#pad_controls select option');
    	for (var i = 0; i < options.length; i++) {
    		if (options[i].selected == true) {
    			active_pad = options[i].value;
    			break;
    		}
    	}

    	padGainSlider.value = 100 * gainNodes[active_pad].gain.value;
    	delaySendSlider.value = 100 * delaySends[active_pad].gain.value;
    }

    function changePadGain(event) {
    	gainNodes[active_pad].gain.value = padGainSlider.value/100;
    }

    function setDefaultGains() {
    	for (var i = 0; i < 9; i++) {
    		if (i == 3 || i == 6 || i == 7) {
    			gainNodes[i].gain.value = 0.4;
    		}
    		else if (i == 5) {
    			gainNodes[i].gain.value = 0.7;
    		}
    		else if (i == 8) {
    			gainNodes[i].gain.value = 0.8;
    		}
    		else {
    			gainNodes[i].gain.value = 1;
    		}
    	}
    }

    function makeDistortionCurve( amount ) {
    	// Curve equation found on Stack Overflow and modified a little
  		var k = amount,
    		n_samples = 44100,
    		curve = new Float32Array(n_samples),
    		i = 0,
    		x;
  		for ( ; i < n_samples; ++i ) {
    		x = i * 2 / n_samples - 1;
    		curve[i] = (( 3 + k ) * x) / ( Math.PI + k * Math.abs(x) );
  		}
  		return curve;
  	}

  	function isInArray(value, array) {
  		return array.indexOf(value) > -1;
	}

	function changeDelaySend() {
		delaySends[active_pad].gain.value = delaySendSlider.value/100;
	}

	function resizeTable() {
		cells = document.querySelectorAll('.pads td');
        table = document.querySelector('table.pads');
        aside = document.querySelector('aside');
        nav = document.querySelector('nav');
        body = document.querySelector('body');
        aside.style.display = 'none';
        nav.style.display = 'none';
        aside.style.top = String((body.scrollHeight - body.offsetHeight)/2) + 'px';
        aside.style.left = String((body.scrollWidth - body.offsetWidth)/2) + 'px';
        if (window.innerWidth > window.innerHeight) {
        	for (var i = 0; i < cells.length; i++) {
        		cells[i].style.height = String((body.offsetHeight)/3) + 'px';
        	}
        	table.style.width = String(body.offsetHeight) + 'px';
        	aside.style.left = String((body.offsetWidth - table.offsetWidth) / 2) + 'px';
        	aside.style.width = String(table.offsetWidth) + 'px';
        	aside.style.height = String(body.offsetHeight) + 'px';
        	nav.style.position = 'relative';
        	nav.style.top = '-' + String(table.offsetHeight) + 'px';
        	nav.style.left = String(((body.offsetWidth + table.offsetWidth) / 2)) + 'px';
        	nav.style.width = String((body.offsetWidth - table.offsetWidth) / 2) + 'px';
        	nav.style.height = String(body.offsetHeight) + 'px';
        	aside.style.display = 'block';
        	nav.style.display = 'block';
        }
        else {
        	for (var i = 0; i < cells.length; i++) {
        		cells[i].style.height = String((body.offsetWidth)/3) + 'px';
        	}
        	table.style.width = String(body.offsetWidth) + 'px';
        	aside.style.width = String(body.scrollWidth) + 'px';
        	aside.style.height = String(body.scrollWidth) + 'px';
        	nav.style.position = 'absolute';
        	nav.style.top = String(table.offsetHeight +
        	((body.scrollHeight - body.offsetHeight) / 2)) + 'px';
        	nav.style.left = String((body.scrollWidth - body.offsetWidth) / 2) + 'px';
        	nav.style.height = String(body.offsetHeight - table.offsetHeight) + 'px';
        	nav.style.width = String(body.offsetWidth) + 'px';
        	aside.style.display = 'block';
        	nav.style.display = 'block';
        }
	}

	function viewControls(event) {
		var which_control = event.target.className;
		var aside = document.querySelector('aside');
		var control = document.querySelector('#' + String(which_control));
		var controls = document.querySelectorAll('.controlset');

		if (control.style.display === 'none' || control.style.display === '') {
			control.style.display = 'block';
			control.style.opacity = '1';
			aside.style.zIndex = 2;
			for (var i = 0; i < controls.length; i++) {
				if (controls[i] != control) {
					controls[i].style.display = 'none';
					controls[i].style.opacity = 0;
				}
			}
		}
		else {
			control.style.display = 'none';
			control.style.display = '0';
			aside.style.zIndex = -1;
		}
	}

	function closeControls() {
		var body = document.querySelector('body');
		console.log('close');
		var controls = document.querySelectorAll('.controlset');
		for (var i = 0; i < controls.length; i++) {
			if (controls[i].style.display === 'block') {
				//aside.removeEventListener('click', closeControls, false);
				controls[i].style.display = 'none';
			}
		}
	}

	function updateMuteGroupLister() {
		// Select the lister and the lister groups
		listedMuteGroups = document.querySelectorAll('#mute_group option');
		muteGroupLister = document.querySelector('#mute_group select');

		// Delete all listed groups
		for (var i = 0; i < listedMuteGroups.length; i++) {
			listedMuteGroups[i].parentNode.removeChild(listedMuteGroups[i]);
		}

		// For each mute group:
		for (var i = 0; i < window.muteGroups.length; i++) {
			// Create an option, set its value, prepare a label for it
			node = document.createElement('option');
			node.value = i;
			group_label = '';

			// Set the label to show which pads are in the group
			// (Correct for 0-based counting)
			for (var j = 0; j < window.muteGroups[i].length; j++) {
				group_label += String(window.muteGroups[i][j] + 1);
				if (j != window.muteGroups[i].length - 1) {
					group_label += ', ';
				}
			}

			// Connect things up
			text = document.createTextNode(group_label);
			node.appendChild(text);
			muteGroupLister.appendChild(node);
		}
	}

	function deleteMuteGroup() {
		// Find the lister and the listed groups
		muteGroupLister = document.querySelector('#mute_group select');
		listedMuteGroups = document.querySelectorAll('#mute_group option');

		// Work out which mute group is selected
		for (var i = 0; i < listedMuteGroups.length; i++) {
			if (listedMuteGroups[i].selected === true) {
				break;
			}
		}
		// Reset the mute gains in that group
		thisgroup = muteGroups[Number(listedMuteGroups[i].value)];
		for (var j = 0; j < thisgroup.length; j++) {
			muteGains[thisgroup[j]].gain.value = 1;
		}
		// Delete the mute group
		window.muteGroups.splice(Number(listedMuteGroups[i].value), 1);
		// Update the mute group lister
		updateMuteGroupLister();
	}

	function createMuteGroup() {
		// Find the checkboxes and the mute group lister
		listedMuteGroups = document.querySelectorAll('#mute_group option');
		muteGroupCheckboxes = document.querySelectorAll('#mute_group input');
		// Initialise new group
		var newgroup = [];
		// Create new group from checkboxes
		for (var i = 0; i < muteGroupCheckboxes.length; i++) {
			if (muteGroupCheckboxes[i].checked === true) {
				newgroup.push(Number(muteGroupCheckboxes[i].value));
				muteGroupCheckboxes[i].checked = false;
			}
		}
		// Add the group to the mute group array
		window.muteGroups.push(newgroup);
		// Update the group lister
		updateMuteGroupLister();
	}

	function updateOutputMeter () {
		canvas = document.querySelector('#output_meter');


	}

	function updateCompGRMeter () {
		canvas = document.querySelector('#gain_reduction');
		context = canvas.getContext('2d');
		context.fillStyle = 'red';

		var x = canvas.width;
		var y = canvas.height;
		var scale = [-20, -18, -15, -10, -8, -5, -3, -2, -1, -0.5]
		var blockWidth = canvas.width / scale.length;
		var reduction = bussComp.reduction.value;

		for (var i = 0; i < scale.length; i++) {
			if (reduction < scale[i]) {
				context.fillRect(x - blockWidth, y, x, y);
				x -= blockWidth;
			} else {
				break;
			}
		}
	}

})();
