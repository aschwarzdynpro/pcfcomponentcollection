import * as React from "react";
import { useState } from "react";
import { IRecord } from "./DataverseCrudApp";

export interface CreateRecordFormProps {
    columns: ComponentFramework.PropertyHelper.DataSetApi.Column[];
    onSave: (record: Partial<IRecord>) => Promise<void>;
    onCancel: () => void;
}

export const CreateRecordForm: React.FC<CreateRecordFormProps> = ({
    columns,
    onSave,
    onCancel
}) => {
    const [formData, setFormData] = useState<Partial<IRecord>>({});
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
            await onSave(formData);
        } catch (error) {
            console.error("Failed to save record:", error);
        } finally {
            setSaving(false);
        }
    };

    const renderField = (column: ComponentFramework.PropertyHelper.DataSetApi.Column) => {
        // Skip primary key and system fields (typically ID fields or fields that start with underscores)
        if (column.name.toLowerCase().includes("id") || column.name.startsWith("_")) {
            return null;
        }

        const value = formData[column.name] || "";
        const hasError = !!validationErrors[column.name];
        const isRequired = column.displayName?.includes("*");

        const fieldProps = {
            id: `field-${column.name}`,
            value: value,
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
                handleFieldChange(column.name, e.target.value);
            },
            className: `form-input ${hasError ? "error" : ""}`,
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
                        <option value="">Select...</option>
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
                <label htmlFor={`field-${column.name}`} className="form-label">
                    {column.displayName || column.name}
                    {isRequired && <span className="required-asterisk">*</span>}
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

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3 className="modal-title">
                        <span className="modal-icon">➕</span>
                        Create New Record
                    </h3>
                    <button className="modal-close" onClick={onCancel}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="create-form">
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
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <span className="spinner-sm"></span>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <span className="btn-icon">💾</span>
                                    Create Record
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};