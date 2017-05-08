(function() {
    var SamplePad = {
        init: function(audioContext, output, filename) {
            this.output = output;
            this.createSignalPath(audioContext);
            this.loadSample(filename);
        },
        createSignalPath: function() {
            this.gain = audioContext.createGain();
            this.mute = audioContext.createGain();
            this.send = audioContext.createGain();

            this.gain.connect(this.mute);
            this.mute.connect(this.send);
        }
        loadSample: function(filename) {
            let request = new XMLHttpRequest();
            request.open('GET', filename, true);
            request.responseType = 'arraybuffer';

            // used to be an onload
            request.addEventListener('readystatechange', this.receiveAudio.bind(this), false);
            request.send();
        },
        playSample: function() {
            if (this.buffer) {
                let source = audioContext.createBufferSource();
                source.buffer = this.buffer;
                source.connect(this.output);
                this.muteOthers();
                source.start();
            }
        },
        receiveAudio: function() {
            let audioData = request.response;
            let successFunction = function(buffer) {this.buffer = buffer;};
            let errorFunction = function(e){"Error decoding audio file." + e.err;};

            audioContext.decodeAudioData(audioData, successFunction.bind(this), errorFunction);
        },
        muteOthers: function() {
            for (let pad of this.muteGroup) {
                pad.mute();
            }
        },
    };

}());
