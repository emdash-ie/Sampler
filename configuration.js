const CONFIGURABLE = Symbol('Parameters of an object which can be configured using ConfigurableObject.configure()')

let ConfigurableObject = {
    configure: function(configurationParameters) {
        let parameters = this[CONFIGURABLE]
        for (let externalName in parameters) {
            let parameter = parameters[externalName]
            switch (parameter.type) {
                case 'property':
                    this[parameter.propertyName] = configurationParameters[externalName]
                    break
                case 'methodCall':
                    this[parameter.methodName](configurationParameters[externalName])
                    break
                default:
                    break
            }
        }
    },
    setConfigurableParameters(newConfigurableParameters) {
        this[CONFIGURABLE] = newConfigurableParameters
    }
}

let newObject = {
    __proto__: ConfigurableObject,
    increaseShineTo(shineLevel) {
        if (this.shine == undefined || this.shine < shineLevel) {
            this.shine = shineLevel
        } else {
            console.log('Error!')
        }
    }
}

newObject.setConfigurableParameters({
    'volume': {
        'type': 'property',
        'propertyName': 'gain'
    },
    'sparkle': {
        'type': 'methodCall',
        'methodName': 'increaseShineTo'
    }
})

newObject.configure({
    'volume': 12.567,
    'sparkle': 109,
})

console.log(newObject)
