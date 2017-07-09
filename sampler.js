(function() {
    document.addEventListener('DOMContentLoaded', init, false);

    /**
    * Initialises the webpage.
    */
    function init() {
        test();
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
            masterSlider.connect(document.querySelector('#master'), this.output.gain);
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

    var SerialSignalPath = {
        nodes: {
            length: 0,
            addNode: function(name, node) {
                this[name] = node;
                this.length += 1;
            },
        },
        firstNode: undefined,
        lastNode: undefined,
        inputs: [],
        outputs: [],
        rewireInputs: function (newNode) {
            for (let input of this.inputs) {
                input.disconnect(this.firstNode);
                input.connect(newNode);
            }
        },
        rewireOutputs: function(newNode) {
            for (let output of this.outputs) {
                this.lastNode.disconnect(output);
                this.newNode.connect(output);
            }
        },
        addFirstNode: function(node, name) {
            if (this.firstNode) {
                this.disconnectInputs();
                node.connect(this.firstNode);
            } else {
                this.lastNode = node;
            }
            this.nodes.addNode(node, name);
            this.firstNode = node;
            this.connectInputs();
        },
        addLastNode: function(node, name) {
            if (this.lastNode) {
                this.disconnectOutputs();
                this.lastNode.connect(node);
            } else {
                this.firstNode = node;
            }
            this.nodes.addNode(node, name);
            this.lastNode = node;
            this.connectOutputs();
        },
        connectInput: function(input) {
            if (this.firstNode) {
                input.connect(this.firstNode);
            }
            this.inputs.push(input);
        },
        connectOutput: function(output) {
            if (this.lastNode) {
                this.lastNode.connect(output);
            }
            this.outputs.push(output);
        },
    };

    /* Datastructures */

    function test() {
        linkedDictionary = Object.create(LinkedDictionary)
        linkedDictionary.init()
        linkedDictionary.addFirst('input', 42)
        linkedDictionary.addLast('output', 20)
        linkedDictionary.addAfter('input', 'compressor', 10)
        linkedDictionary.addBefore('compressor', 'delay', 5)

        console.log(linkedDictionary.linkedList.toString())
        console.log(linkedDictionary.size())
        console.log(linkedDictionary.get('delay'))

        linkedDictionary.remove('compressor')

        console.log(linkedDictionary.linkedList.toString())
        console.log(linkedDictionary)

        for (let value of linkedDictionary) {
            console.log(value)
        }

        for (let key of linkedDictionary.keys()) {
            console.log(`${key}: ${linkedDictionary.get(key)}`)
        }
    }

    let LinkedDictionary = {
        [Symbol.iterator]: function* () {
            for (let node of this.linkedList) {
                yield node.getValue()
            }
        },
        keys: function* () {
            for (let node of this.linkedList) {
                yield node.getName()
            }
        },
        init: function() {
            this.linkedList = Object.create(LinkedList)
            this.linkedList.init(NamedListNode)
            this.nodes = {}
        },
        get: function(key) {
            return this.nodes[key].getValue()
        },
        put: function(key, value) {
            if (key in this.nodes) {
                this.nodes[key].setValue(value)
            }
        },
        add: function(key, value, addFunction, extraKey) {
            let thisNode
            if (extraKey == undefined) {
                thisNode = addFunction.call(this.linkedList, value)
            } else {
                let extraNode = this.nodes[extraKey]
                thisNode = addFunction.call(this.linkedList, extraNode, value)
            }
            this.nodes[key] = thisNode
            thisNode.setName(key)
        },
        addAfter: function(beforeKey, key, value) {
            this.add(key, value, this.linkedList.addAfter, beforeKey)
        },
        addBefore: function(afterKey, key, value) {
            this.add(key, value, this.linkedList.addBefore, afterKey)
        },
        addFirst: function(key, value) {
            this.add(key, value, this.linkedList.addFirst)
        },
        addLast: function(key, value) {
            this.add(key, value, this.linkedList.addLast)
        },
        remove: function(key) {
            this.linkedList.removeNode(this.nodes[key])
            delete this.nodes[key]
        },
        size: function() {
            return this.linkedList.size
        },
        isEmpty: function() {
            return this.linkedList.isEmpty()
        }
    }

    let LinkedList = {
        init: function(NodeObject) {
            this.node = NodeObject
            this.head = Object.create(this.node)
            this.tail = Object.create(this.node)
            this.head.setNext(this.tail)
            this.tail.setPrev(this.head)
            this.size = 0
            this[Symbol.iterator] = function*() {
                if (!this.isEmpty()) {
                    let node = this.head.getNext()
                    while (node.getNext()) {
                        yield node
                        node = node.getNext()
                    }
                }
            }
        },
        /**
         * Adds a new value after the given node.
         * @return The node containing the new value.
         */
        addAfter: function(before, value) {
            let after = before.getNext()
            let node = Object.create(this.node)
            node.setValue(value)
            node.setPrev(before)
            node.setNext(after)
            after.setPrev(node)
            before.setNext(node)
            this.size++
            return node
        },
        /**
         * Adds a new value before the given node.
         * @return The node containing the new value.
         */
        addBefore: function(after, value) {
            return this.addAfter(after.getPrev(), value)
        },
        /**
         * Adds a new value to the start of the list.
         * @return The node containing the new value.
         */
        addFirst: function(value) {
            return this.addAfter(this.head, value)
        },
        /**
         * Adds a new value to the end of the list.
         * @return The node containing the new value.
         */
        addLast: function(value) {
            return this.addBefore(this.tail, value)
        },
        removeNode: function(node) {
            node.getNext().setPrev(node.getPrev())
            node.getPrev().setNext(node.getNext())
            this.size--
        },
        isEmpty: function() {
            return this.size === 0
        },
        toString: function() {
            let output = []
            for (let node of this) {
                output.push(node.getValue())
            }
            return '[' + output.join(', ') + ']'
        }
    }

    /**
     * A node in a linked list.
     * @property {function} getNext Returns the node after this one in the list.
     * @property {function} getPrev Returns the node before this one in the list.
     */
    let ListNode = {
        getValue: function() {
            return this.value
        },
        setValue: function(value) {
            this.value = value
        },
        getNext: function() {
            return this.nextNode
        },
        setNext: function(node) {
            this.nextNode = node
        },
        getPrev: function() {
            return this.prevNode
        },
        setPrev: function(node) {
            this.prevNode = node
        },
        clear: function() {
            delete this.value
            delete this.nextNode
            delete this.prevNode
        }
    }

    let NamedListNode = Object.create(ListNode)

    NamedListNode.getName = function() {
        return this.name
    }

    NamedListNode.setName = function(name) {
        this.name = name
    }
}());
