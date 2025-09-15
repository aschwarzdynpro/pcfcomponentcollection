import * as React from "react";
import { useState } from "react";
import { IRecord } from "./DataverseCrudApp";

export interface EditRecordFormProps {
    record: IRecord;
    columns: ComponentFramework.PropertyHelper.DataSetApi.Column[];
    onSave: (updatedData: Partial<IRecord>) => Promise<void>;
    onCancel: () => void;
}

export const EditRecordForm: React.FC<EditRecordFormProps> = ({
    record,
    columns,
    onSave,
    onCancel
}) => {
    const [formData, setFormData] = useState<Partial<IRecord>>({ ...record });
    const [saving, setSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

    const handleFieldChange = (columnName: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [columnName]: value
        }));
        
        // Clear validation error when user starts typing
        if (validationErrors[columnName]) {
            setValidationErrors(prev => ({
                ...prev,
                [columnName]: ""
            }));
        }
    };

    const validateForm = (): boolean => {
        const errors: {[key: string]: string} = {};
        
        // Check required fields
        columns.forEach(column => {
            if (column.displayName?.includes("*")) {
                const value = formData[column.name];
                if (!value || (typeof value === "string" && value.trim() === "")) {
                    errors[column.name] = `${column.displayName || column.name} is required`;
                }
            }
        });

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        try {
            setSaving(true);
            
            // Only send changed fields
            const changedData: Partial<IRecord> = {};
            Object.keys(formData).forEach(key => {
                if (formData[key] !== record[key]) {
                    changedData[key] = formData[key];
                }
            });
            
            await onSave(changedData);
        } catch (error) {
            console.error("Failed to update record:", error);
        } finally {
            setSaving(false);
        }
    };

    const formatValueForEdit = (value: any, column: ComponentFramework.PropertyHelper.DataSetApi.Column): string => {
        if (value === null || value === undefined) {
            return "";
        }

        switch (column.dataType) {
            case "DateAndTime.DateOnly":
                try {
                    return new Date(value).toISOString().split('T')[0];
                } catch {
                    return "";
                }
            case "DateAndTime.DateAndTime":
                try {
                    return new Date(value).toISOString().slice(0, 16);
                } catch {
                    return "";
                }
            case "TwoOptions":
                return value ? "true" : "false";
            default:
                return value.toString();
        }
    };

    const renderField = (column: ComponentFramework.PropertyHelper.DataSetApi.Column) => {
        // Skip primary key and system fields for editing (typically ID fields or fields that start with underscores)
        if (column.name.toLowerCase().includes("id") || column.name.startsWith("_")) {
            return null;
        }

        const value = formatValueForEdit(formData[column.name], column);
        const hasError = !!validationErrors[column.name];
        const isRequired = column.displayName?.includes("*");
        const hasChanged = formData[column.name] !== record[column.name];

        const fieldProps = {
            id: `edit-field-${column.name}`,
            value: value,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                let newValue: any = e.target.value;
                
                // Convert value based on data type
                if (column.dataType === "TwoOptions") {
                    newValue = e.target.value === "true";
                } else if (column.dataType === "Whole.None") {
                    newValue = parseInt(e.target.value) || 0;
                } else if (column.dataType === "Currency" || column.dataType === "Decimal" || column.dataType === "FP") {
                    newValue = parseFloat(e.target.value) || 0;
                }
                
                handleFieldChange(column.name, newValue);
            },
            className: `form-input ${hasError ? "error" : ""} ${hasChanged ? "changed" : ""}`,
            placeholder: `Enter ${column.displayName || column.name}...`
        };

        let inputElement;

        switch (column.dataType) {
            case "Multiple":
                inputElement = (
                    <textarea
                        {...fieldProps}
                        rows={3}
                        placeholder={`Enter ${column.displayName || column.name}...`}
                    />
                );
                break;
            
            case "Whole.None":
                inputElement = (
                    <input
                        {...fieldProps}
                        type="number"
                        step="1"
                    />
                );
                break;
            
            case "Currency":
            case "Decimal":
            case "FP":
                inputElement = (
                    <input
                        {...fieldProps}
                        type="number"
                        step="0.01"
                    />
                );
                break;
            
            case "DateAndTime.DateOnly":
                inputElement = (
                    <input
                        {...fieldProps}
                        type="date"
                    />
                );
                break;
            
            case "DateAndTime.DateAndTime":
                inputElement = (
                    <input
                        {...fieldProps}
                        type="datetime-local"
                    />
                );
                break;
            
            case "TwoOptions":
                inputElement = (
                    <select
                        {...fieldProps}
                        onChange={(e) => handleFieldChange(column.name, e.target.value === "true")}
                    >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                );
                break;
            
            case "SingleLine.Email":
                inputElement = (
                    <input
                        {...fieldProps}
                        type="email"
                    />
                );
                break;
            
            case "SingleLine.Phone":
                inputElement = (
                    <input
                        {...fieldProps}
                        type="tel"
                    />
                );
                break;
            
            case "SingleLine.URL":
                inputElement = (
                    <input
                        {...fieldProps}
                        type="url"
                    />
                );
                break;
            
            default:
                inputElement = (
                    <input
                        {...fieldProps}
                        type="text"
                    />
                );
                break;
        }

        return (
            <div key={column.name} className="form-field">
                <label htmlFor={`edit-field-${column.name}`} className="form-label">
                    {column.displayName || column.name}
                    {isRequired && <span className="required-asterisk">*</span>}
                    {hasChanged && <span className="changed-indicator">• Modified</span>}
                </label>
                {inputElement}
                {hasError && (
                    <div className="field-error">
                        {validationErrors[column.name]}
                    </div>
                )}
            </div>
        );
    };

    // Check if any fields have been modified
    const hasChanges = Object.keys(formData).some(key => formData[key] !== record[key]);

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3 className="modal-title">
                        <span className="modal-icon">✏️</span>
                        Edit Record
                        <span className="record-id-badge">{record.id.substring(0, 8)}...</span>
                    </h3>
                    <button className="modal-close" onClick={onCancel}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="edit-form">
                    <div className="form-fields">
                        {columns.map(column => renderField(column)).filter(Boolean)}
                    </div>

                    <div className="form-actions">
                        <button 
                            type="button" 
                            className="btn btn-secondary"
                            onClick={onCancel}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={saving || !hasChanges}
                        >
                            {saving ? (
                                <>
                                    <span className="spinner-sm"></span>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <span className="btn-icon">💾</span>
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                    
                    {!hasChanges && (
                        <div className="no-changes-notice">
                            <small>💡 No changes detected. Modify fields above to enable saving.</small>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};