/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    selectedValue: ComponentFramework.PropertyTypes.Property;
    selectionMode: ComponentFramework.PropertyTypes.EnumProperty<"auto" | "single" | "multiple">;
    placeholder: ComponentFramework.PropertyTypes.StringProperty;
    searchBox: ComponentFramework.PropertyTypes.EnumProperty<"auto" | "always" | "never">;
    colorMode: ComponentFramework.PropertyTypes.EnumProperty<"on" | "off">;
    clearButton: ComponentFramework.PropertyTypes.EnumProperty<"on" | "off">;
}
export interface IOutputs {
    selectedValue?: any;
}
