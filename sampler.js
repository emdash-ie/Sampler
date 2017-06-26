(function() {
    document.addEventListener('DOMContentLoaded', init, false);

    /**
    * Initialises the webpage.
    */
    function init() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();

        /**
         * The files to be played by the sample pads.
         * @constant {Object.<string, string>}
         * @default
         */
        const filenames = {
            'kick': 'Samples/kick_int.wav',
			'snare': 'Samples/snare_left.wav',
			'closed-hat': 'Samples/hat_close.wav',
			'high-tom': 'Samples/tom2.wav',
			'crash': 'Samples/crash_high.wav',
			'open-hat': 'Samples/hat_open.wav',
			'mid-tom': 'Samples/tom3.wav',
			'low-tom': 'Samples/tom4.wav',
			'pedal-hat': 'Samples/hat_foot.wav',
        };

        /**
         * Pads that will mute each other when activated, so that only one of each group is ever
         * playing at once.
         * @constant {Object.<string, string[]>}
         * @default
         */
        const muteGroups = {
            'hihat': ['closed-hat', 'open-hat', 'pedal-hat'],
        };

        Sampler.init(audioContext, filenames, muteGroups);
    }

    /**
     * Plays samples when pads are pressed, and has controls to affect the sound.
     */
    var Sampler = {
        /**
         * Initialises the sample-player.
         * @param {Object.<string, string>} filenames The samples to be triggered by the
         *     pads.
         * @param {Object.<string, string[]>} muteGroups The muteGroups to set.
         */
        init: function(context, filenames, muteGroups) {
            this.output = context.createGain();
            this.output.connect(audioContext.destination);
            this.pads = {};
            this.screenPads = document.querySelectorAll('.padGrid-pad');
            let i = 0;
            for (let name in filenames) {
                let pad = Object.create(SamplePad);
                pad.setup(context, name, filenames[name]);
                pad.connect(this.output);
                pad.addTarget(this.screenPads[i]);
                this.screenPads[i].samplerPad = pad;
                this.pads[name] = pad;
                i++;
            }
            this.muteGroups = {};
            for (let groupName in muteGroups) {
                this.createMuteGroup(groupName, muteGroups[groupName]);
            }
            var masterSlider = Object.create(GainSlider);
            masterSlider.connect(document.querySelector('#masterGain'), this.output.gain);
        },
        /**
         * Creates a new mute group – a group of pads of which only one can play at once.
         * @param {string} name The name for the new group.
         * @param {Array<string>} padNames The names of the pads to be included in the
         *     group.
         */
        createMuteGroup: function(name, padNames) {
            let pads = {};
            for (let padName of padNames) {
                pads[padName] = this.pads[padName];
            }
            let muteGroup = Object.create(MuteGroup);
            muteGroup.create(pads, name);
            if (name in this.muteGroups) {
                this.muteGroups[name].destroy();
            }
            this.muteGroups[name] = muteGroup;
        },
        /**
         * Deletes a mute group.
         * @param {string} name The name of the group to delete.
         */
        deleteMuteGroup: function(name) {
            this.muteGroups[name].destroy();
            delete this.muteGroups[name];
        },
        /**
         * Disables a mute group. The group will still exist but won't have any effect.
         * @param {string} name The name of the group to disable.
         */
        disableMuteGroup: function(name) {
            this.muteGroups[name].disable();
        },
        /**
         * Enables a mute group. Groups are enabled by default.
         * @param {string} name The name of the group to enable.
         */
        enableMuteGroup: function(name) {
            this.muteGroups[name].enable();
        },
        /**
         * Plays the pads associated with a target.
         * @callback
         */
        triggerPads: function(clickEvent) {
            for (let pad of Object.values(clickEvent.target.samplerPads)) {
                pad.playSample();
            }
        },
    };

    /**
     * A pad that plays a sample when activated.
     */
    var SamplePad = {
        /**
         * Initialises the pad.
         * @param {AudioContext} audioContext The audio context for the pad to operate in.
         * @param {string} name The name of the pad.
         * @param {string} filename The file the pad should play.
         */
        setup: function(audioContext, name, filename) {
            this.context = audioContext;
            this.name = name;
            this.muteGroups = {};
            this.targets = {};
            this.createSignalPath();
            this.loadSample(filename);
        },
        /**
         * Creates the signal path for the pad.
         * @private
         */
        createSignalPath: function() {
            this.muteGain = this.context.createGain();
            this.gain = this.context.createGain();
            this.send = this.context.createGain();

            this.muteGain.connect(this.gain);
            this.gain.connect(this.send);
        },
        /**
         * Loads a sample for the pad to play.
         * @param {string} filename The file to load.
         */
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
            request.addEventListener('readystatechange', receiveAudio.bind(this, request), false);
            request.send();
        },
        /**
         * Plays the sample associated with this pad.
         */
        playSample: function() {
            if (this.buffer) {
                const source = this.context.createBufferSource();
                source.buffer = this.buffer;
                source.connect(this.muteGain);
                this.unMute();
                this.triggerMuteGroups();
                source.start();
            }
        },
        /**
         * Mutes the pad. Used by mute groups.
         * @private
         */
        mute: function() {
            this.muteGain.gain.value = 0;
        },
        /**
         * Unmutes the pad. Used by mute groups.
         * @private
         */
        unMute: function() {
            this.muteGain.gain.value = 1;
        },
        /**
         * Connects the output of the pad to a destination.
         * @param {AudioGainNode} destination The destination to connect the output to.
         */
        connect: function(destination) {
            this.gain.connect(destination);
        },
        /**
         * Connects the send output of the pad to a destination.
         * @param {AudioGainNode} destination The destination to connect the send output to.
         */
        connectSend: function(destination) {
            this.send.connect(destination);
        },
        /**
         * Adds a mute group.
         * @param {MuteGroup} group The mute group to add.
         */
        addMuteGroup: function(group) {
            this.muteGroups[group.name] = group;
        },
        /**
         * Removes a mute group.
         * @param {MuteGroup} group The mute group to remove.
         */
        removeMuteGroup: function(group) {
            delete this.muteGroups[group.name];
        },
        /**
         * Triggers the mute groups this pad is a member of, muting all other pads in those
         * groups.
         */
        triggerMuteGroups: function() {
            for (let groupName in this.muteGroups) {
                this.muteGroups[groupName].trigger(this);
            }
        },
        /**
         * Adds a target to this pad – when that target is clicked, this pad will be triggered.
         * @param {Element} target The target to add to this pad.
         */
        addTarget: function(target) {
            this.targets[target.name] = target;
            if (!('samplerPads' in target)) {
                target.samplerPads = {};
                target.addEventListener('click', Sampler.triggerPads, false);
            }
            target.samplerPads[this.name] = this;
        },
        /**
         * Removes a target from this pad.
         * @param {Element} target The target to remove from this pad.
         */
        removeTarget: function(target) {
            delete this.targets[target.name];
            delete target.samplerPads[this.name];
            if (Object.keys(target.samplerPads).length === 0) {
                delete target.samplerPads;
                target.removeEventListener('click', Sampler.triggerPads, false);
            }
        },
        /** Removes all targets from this pad. */
        clearTargets: function() {
            for (let target in this.targets) {
                this.removeTarget(target);
            }
        },
        /**
         * Sets a new single target for this pad.
         * @param {Element} target The target to be the only target for this pad.
         */
        setTarget: function(target) {
            this.clearTargets();
            this.addTarget(target);
        },
    };

    /**
     * A group of pads, of which only one can play at once.
     * @typedef {Object} MuteGroup
     * @property {string} name The name of the group.
     * @property {Object} pads The pads in this group.
     * @property {boolean} active Whether this group is currently active.
     */
    var MuteGroup = {
        /**
         * Initialises the group.
         * @param {Object} pads The SamplePads this group should contain.
         * @param {string} name The name for this group.
         */
        create: function(pads, name) {
            this.pads = pads;
            this.name = name;
            for (let padName in pads) {
                pads[padName].addMuteGroup(this);
            }
            this.active = true;
        },
        /**
         * Destroys the group.
         */
        destroy: function() {
            for (let name in this.pads) {
                this.pads[name].removeMuteGroup(this);
            }
            this.active = false;
        },
        /**
        * Disables the group – it will have no effect while disabled.
        */
        disable: function() {
            this.active = false;
        },
        /** Enables the group – the group is enabled by default. */
        enable: function() {
            this.active = true;
        },
        /**
         * Triggers the group, muting all pads except the currently playing one.
         * @param {SamplePad} playing The pad that is currently playing.
         */
        trigger: function(playing) {
            if (this.active) {
                for (let name in this.pads) {
                    if (this.pads[name] !== playing) {
                        this.pads[name].mute();
                    }
                }
            }
        },
    };

    /**
     * A slider to control an AudioGainNode.
     */
    var GainSlider = {
        input: null,
        /**
         * Connects the slider to an input and a target.
         * @param {Object} input A DOM element which will be used to control the slider.
         * @param {AudioGainNode} target The gain the slider should control.
         */
        connect: function(input, target) {
            this.setTarget(target);
            this.setInput(input);
        },
        /**
         * Sets the slider's target – the gain it controls.
         * @param {AudioGainNode} gain The gain the slider should control.
         */
        setTarget: function(gain) {
            this.target = gain;
        },
        /**
         * Sets the slider's input – the element used to control it.
         * @param {Object} input The DOM element that should control the slider.
         */
        setInput: function(input) {
            if (this.input) {
                this.input.removeEventListener('input', this.handleInput.bind(this), false);
            }
            this.input = input;
            this.input.addEventListener('input', this.handleInput.bind(this), false);
        },
        /**
         * Receives input for the slider.
         * @param {event} inputEvent The event providing input.
         */
        handleInput: function(inputEvent) {
            if (inputEvent.target.value > 1) {
                this.target.value = 1;
            } else if (inputEvent.target.value < -1) {
                this.target.value = -1;
            } else {
                this.target.value = inputEvent.target.value;
            }
        },
    };
}());
