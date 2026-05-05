/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    statusColumn: ComponentFramework.PropertyTypes.StringProperty;
    titleColumn: ComponentFramework.PropertyTypes.StringProperty;
    subtitleColumn: ComponentFramework.PropertyTypes.StringProperty;
    descriptionColumn: ComponentFramework.PropertyTypes.StringProperty;
    allowDragDrop: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    allowCreate: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    cards: ComponentFramework.PropertyTypes.DataSet;
}
export interface IOutputs {
}
