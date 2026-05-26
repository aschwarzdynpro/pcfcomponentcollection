/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    selectedItem: ComponentFramework.PropertyTypes.LookupProperty;
    column1: ComponentFramework.PropertyTypes.StringProperty;
    column2: ComponentFramework.PropertyTypes.StringProperty;
    column3: ComponentFramework.PropertyTypes.StringProperty;
    column4: ComponentFramework.PropertyTypes.StringProperty;
    pageSize: ComponentFramework.PropertyTypes.WholeNumberProperty;
    placeholder: ComponentFramework.PropertyTypes.StringProperty;
    additionalFilter: ComponentFramework.PropertyTypes.StringProperty;
    enableQuickCreate: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    enableFavorites: ComponentFramework.PropertyTypes.TwoOptionsProperty;
    enableRecentlyUsed: ComponentFramework.PropertyTypes.TwoOptionsProperty;
}
export interface IOutputs {
    selectedItem?: ComponentFramework.LookupValue[];
}
