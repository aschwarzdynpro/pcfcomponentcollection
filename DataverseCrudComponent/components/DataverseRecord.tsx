import * as React from "react";
import { IRecord } from "./DataverseCrudApp";

export interface DataverseRecordProps {
    record: IRecord;
    columns: ComponentFramework.PropertyHelper.DataSetApi.Column[];
    allowUpdate: boolean;
    allowDelete: boolean;
    onEdit: () => void;
    onDelete: () => void;
}

export const DataverseRecord: React.FC<DataverseRecordProps> = ({
    record,
    columns,
    allowUpdate,
    allowDelete,
    onEdit,
    onDelete
}) => {
    const formatValue = (value: any, column: ComponentFramework.PropertyHelper.DataSetApi.Column): string => {
        if (value === null || value === undefined) {
            return "—";
        }

        // Handle different data types
        switch (column.dataType) {
            case "DateAndTime.DateAndTime":
            case "DateAndTime.DateOnly":
                try {
                    return new Date(value).toLocaleDateString();
                } catch {
                    return value.toString();
                }
            case "Currency":
            case "Decimal":
            case "FP":
                try {
                    return parseFloat(value).toLocaleString();
                } catch {
                    return value.toString();
                }
            case "TwoOptions":
                return value ? "Yes" : "No";
            case "Whole.None":
                return parseInt(value).toLocaleString();
            default:
                return value.toString();
        }
    };

    const getColumnIcon = (column: ComponentFramework.PropertyHelper.DataSetApi.Column): string => {
        switch (column.dataType) {
            case "SingleLine.Text":
            case "Multiple":
                return "📝";
            case "Whole.None":
                return "🔢";
            case "Currency":
                return "💰";
            case "DateAndTime.DateAndTime":
            case "DateAndTime.DateOnly":
                return "📅";
            case "TwoOptions":
                return "☑️";
            case "Decimal":
            case "FP":
                return "📊";
            case "SingleLine.Email":
                return "📧";
            case "SingleLine.Phone":
                return "📞";
            case "SingleLine.URL":
                return "🔗";
            default:
                return "📄";
        }
    };

    // Show only the most important columns in the card view
    const displayColumns = columns.slice(0, 6);

    return (
        <div className="record-card">
            <div className="record-header">
                <div className="record-id">
                    <span className="id-label">ID:</span>
                    <span className="id-value">{record.id.substring(0, 8)}...</span>
                </div>
                
                <div className="record-actions">
                    {allowUpdate && (
                        <button 
                            className="btn btn-sm btn-secondary"
                            onClick={onEdit}
                            title="Edit Record"
                        >
                            ✏️
                        </button>
                    )}
                    {allowDelete && (
                        <button 
                            className="btn btn-sm btn-danger"
                            onClick={onDelete}
                            title="Delete Record"
                        >
                            🗑️
                        </button>
                    )}
                </div>
            </div>

            <div className="record-fields">
                {displayColumns.map((column) => (
                    <div key={column.name} className="field-row">
                        <div className="field-label">
                            <span className="field-icon">{getColumnIcon(column)}</span>
                            <span className="field-name">{column.displayName || column.name}</span>
                        </div>
                        <div className="field-value">
                            {formatValue(record[column.name], column)}
                        </div>
                    </div>
                ))}
                
                {columns.length > 6 && (
                    <div className="field-row more-fields">
                        <div className="field-label">
                            <span className="field-icon">➕</span>
                            <span className="field-name">More fields</span>
                        </div>
                        <div className="field-value">
                            +{columns.length - 6} additional fields
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};