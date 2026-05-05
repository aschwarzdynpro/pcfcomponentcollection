/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    totalHours: ComponentFramework.PropertyTypes.NumberProperty;
    hoursPerDay: ComponentFramework.PropertyTypes.WholeNumberProperty;
    storageUnit: ComponentFramework.PropertyTypes.EnumProperty<"auto" | "hours" | "minutes">;
}
export interface IOutputs {
    totalHours?: number;
}
