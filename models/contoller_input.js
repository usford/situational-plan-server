class ControllerInput {
    constructor(id, item, ioName, code1, code2, code3, legend, description, time, value) {
        this.id = id;
        this.item = item;
        this.ioName = ioName;
        this.code1 = code1;
        this.code2 = code2;
        this.code3 = code3;
        this.legend = legend;
        this.description = description;
        this.time = time;
        this.value = value;
    }

    static copyFrom(controllerInput) {
        return new ControllerInput(controllerInput.id,
            controllerInput.item,
            controllerInput.ioName,
            controllerInput.code1,
            controllerInput.code2,
            controllerInput.code3,
            controllerInput.legend,
            controllerInput.description,
            controllerInput.time,
            controllerInput.value,
        );
    }

    isEqual(controllerInput) {
        return controllerInput.id == this.id
            && controllerInput.item == this.item
            && controllerInput.ioName == this.ioName
            && controllerInput.code1 == this.code1
            && controllerInput.code2 == this.code2
            && controllerInput.code3 == this.code3
            && controllerInput.legend == this.legend
            && controllerInput.description == this.description
            && (controllerInput.time ? controllerInput.time.getTime() : null)  == (this.time ? this.time.getTime() : null)
            && controllerInput.value == this.value;

    }
}

export default ControllerInput;