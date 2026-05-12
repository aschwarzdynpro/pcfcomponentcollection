/*
*This is auto generated from the ControlManifest.Input.xml file
*/

// Define IInputs and IOutputs Type. They should match with ControlManifest.
export interface IInputs {
    phoneNumber: ComponentFramework.PropertyTypes.StringProperty;
    defaultCountry: ComponentFramework.PropertyTypes.StringProperty;
    placeholder: ComponentFramework.PropertyTypes.StringProperty;
    createPhoneCallActivity: ComponentFramework.PropertyTypes.TwoOptionsProperty;
}
export interface IOutputs {
    phoneNumber?: string;
}
