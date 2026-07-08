/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    childEntityName: ComponentFramework.PropertyTypes.StringProperty;
    childLookupField: ComponentFramework.PropertyTypes.StringProperty;
    childDisplayColumns: ComponentFramework.PropertyTypes.StringProperty;
    childFilter: ComponentFramework.PropertyTypes.StringProperty;
    swipeFieldName: ComponentFramework.PropertyTypes.StringProperty;
    swipeFieldValue: ComponentFramework.PropertyTypes.StringProperty;
    takenBehavior: ComponentFramework.PropertyTypes.EnumProperty<"hide" | "gray" | "allow-undo">;
    boxDataset: ComponentFramework.PropertyTypes.DataSet;
}
export interface IOutputs {
}
