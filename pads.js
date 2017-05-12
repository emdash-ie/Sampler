(function() {
    document.addEventListener('DOMContentLoaded', init, false);

    function init() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        var filenames = [
            'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/kick_int.wav',
			'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/snare_left.wav',
			'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/hat_close.wav',
			'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/tom2.wav',
			'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/crash_high.wav',
			'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/hat_open.wav',
			'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/tom3.wav',
			'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/tom4.wav',
			'http://lizardpeoplelizardchurch.netsoc.co/Sampler/Samples/hat_foot.wav'
        ];
        Sampler.init(audioContext, filenames, []);
    }

    var SamplePad = {
        setup: function(audioContext, filename) {
            this.context = audioContext;
            this.muteGroup = [];
            this.createSignalPath();
            this.loadSample(filename);
        },
        createSignalPath: function() {
            this.mute = this.context.createGain();
            this.gain = this.context.createGain();
            this.send = this.context.createGain();

            this.mute.connect(this.gain);
            this.gain.connect(this.send);
        },
        loadSample: function(filename) {
            var receiveAudio = function(request) {
                if (request.readyState === 4 && request.status === 200) {
                    const audioData = request.response;
                    var successFunction = function(buffer) {this.buffer = buffer;};
                    var errorFunction = function(e){"Error decoding audio file." + e.err;};

                    request.removeEventListener('readystatechange', receiveAudio, false);
                    this.context.decodeAudioData(audioData, successFunction.bind(this), errorFunction);
                }
            };

            const request = new XMLHttpRequest();
            request.open('GET', filename, true);
            request.responseType = 'arraybuffer';

            // used to be an onload
            request.addEventListener('readystatechange', receiveAudio.bind(this, request), false);
            request.send();
        },
        playSample: function() {
            if (this.buffer) {
                const source = this.context.createBufferSource();
                source.buffer = this.buffer;
                source.connect(this.mute);
                this.unMute();
                this.muteOthers();
                source.start();
            }
        },
        mute: function() {
            this.mute.gain = 0;
        },
        unMute: function() {
            this.mute.gain = 1;
        },
        muteOthers: function() {
            for (let pad of this.muteGroup) {
                pad.mute();
            }
        },
        connect: function(destination) {
            this.gain.connect(destination);
        },
        connectSend: function(destination) {
            this.send.connect(destination);
        },
        addMuteGroup: function(group) {
            for (let pad of group) {
                if (pad !== this) {
                    this.muteGroup.push(pad);
                }
            }
        },
    };

    var Sampler = {
        init: function(context, filenames, muteGroups) {
            this.output = context.createGain();
            this.output.connect(audioContext.destination);
            this.pads = [];
            this.screenPads = document.querySelectorAll('.pad');
            for (let i = 0; i < this.numPads; i++) {
                let pad = Object.create(SamplePad);
                pad.setup(context, filenames[i]);
                pad.connect(this.output);
                this.screenPads[i].addEventListener('click', pad.playSample.bind(pad), false);
                this.pads.push(pad);
            }
        },
        numPads: 9,
    };
}());
