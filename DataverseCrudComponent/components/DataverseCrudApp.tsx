import * as React from "react";
import { useState, useEffect } from "react";
import { DataverseRecord } from "./DataverseRecord";
import { CreateRecordForm } from "./CreateRecordForm";
import { EditRecordForm } from "./EditRecordForm";

export interface DataverseCrudAppProps {
    context: ComponentFramework.Context<any>;
    dataset: ComponentFramework.PropertyTypes.DataSet;
    allowCreate: boolean;
    allowUpdate: boolean;
    allowDelete: boolean;
    onDataChange: () => void;
}

export interface IRecord {
    id: string;
    [key: string]: any;
}

export const DataverseCrudApp: React.FC<DataverseCrudAppProps> = ({
    context,
    dataset,
    allowCreate,
    allowUpdate,
    allowDelete,
    onDataChange
}) => {
    const [records, setRecords] = useState<IRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingRecord, setEditingRecord] = useState<IRecord | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");

    const recordsPerPage = 10;

    // Load records when component mounts or dataset changes
    useEffect(() => {
        loadRecords();
    }, [dataset]);

    const loadRecords = async () => {
        try {
            setLoading(true);
            setError(null);
            
            if (dataset && dataset.sortedRecordIds && dataset.sortedRecordIds.length > 0) {
                const loadedRecords: IRecord[] = dataset.sortedRecordIds.map(id => {
                    const record = dataset.records[id];
                    const recordData: IRecord = { id };
                    
                    // Get all columns and their values
                    dataset.columns.forEach(column => {
                        if (record.getFormattedValue) {
                            recordData[column.name] = record.getFormattedValue(column.name) || record.getValue(column.name);
                        } else {
                            recordData[column.name] = record.getValue ? record.getValue(column.name) : "";
                        }
                    });
                    
                    return recordData;
                });
                
                setRecords(loadedRecords);
            } else {
                setRecords([]);
            }
        } catch (err) {
            setError(`Failed to load records: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (newRecord: Partial<IRecord>) => {
        try {
            setError(null);
            
            // Use WebAPI to create the record
            if (context.webAPI && dataset.getTargetEntityType) {
                const entityName = dataset.getTargetEntityType();
                const result = await context.webAPI.createRecord(entityName, newRecord);
                
                // Refresh the dataset
                dataset.refresh();
                onDataChange();
                setShowCreateForm(false);
                
                // Show success message
                setError(null);
            } else {
                throw new Error("WebAPI not available or entity type not defined");
            }
        } catch (err) {
            setError(`Failed to create record: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const handleUpdate = async (recordId: string, updatedData: Partial<IRecord>) => {
        try {
            setError(null);
            
            if (context.webAPI && dataset.getTargetEntityType) {
                const entityName = dataset.getTargetEntityType();
                await context.webAPI.updateRecord(entityName, recordId, updatedData);
                
                // Refresh the dataset
                dataset.refresh();
                onDataChange();
                setEditingRecord(null);
            } else {
                throw new Error("WebAPI not available or entity type not defined");
            }
        } catch (err) {
            setError(`Failed to update record: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const handleDelete = async (recordId: string) => {
        if (!confirm("Are you sure you want to delete this record?")) {
            return;
        }
        
        try {
            setError(null);
            
            if (context.webAPI && dataset.getTargetEntityType) {
                const entityName = dataset.getTargetEntityType();
                await context.webAPI.deleteRecord(entityName, recordId);
                
                // Refresh the dataset
                dataset.refresh();
                onDataChange();
            } else {
                throw new Error("WebAPI not available or entity type not defined");
            }
        } catch (err) {
            setError(`Failed to delete record: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    // Filter records based on search term
    const filteredRecords = records.filter(record =>
        Object.values(record).some(value =>
            value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    // Calculate pagination
    const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
    const startIndex = (currentPage - 1) * recordsPerPage;
    const paginatedRecords = filteredRecords.slice(startIndex, startIndex + recordsPerPage);

    // Get column definitions
    const columns = dataset?.columns || [];

    if (loading) {
        return (
            <div className="crud-container">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading records...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="crud-container">
            <div className="crud-header">
                <h2 className="crud-title">
                    <span className="icon">📊</span>
                    Dataverse Records Manager
                </h2>
                <p className="crud-subtitle">Manage your data with full CRUD operations</p>
            </div>

            {error && (
                <div className="error-banner">
                    <span className="error-icon">⚠️</span>
                    <span>{error}</span>
                    <button className="error-dismiss" onClick={() => setError(null)}>×</button>
                </div>
            )}

            <div className="crud-controls">
                <div className="search-container">
                    <input
                        type="text"
                        placeholder="🔍 Search records..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
                
                {allowCreate && (
                    <button 
                        className="btn btn-primary"
                        onClick={() => setShowCreateForm(true)}
                    >
                        <span className="btn-icon">➕</span>
                        Create New Record
                    </button>
                )}
            </div>

            {showCreateForm && (
                <CreateRecordForm
                    columns={columns}
                    onSave={handleCreate}
                    onCancel={() => setShowCreateForm(false)}
                />
            )}

            {editingRecord && (
                <EditRecordForm
                    record={editingRecord}
                    columns={columns}
                    onSave={(updatedData) => handleUpdate(editingRecord.id, updatedData)}
                    onCancel={() => setEditingRecord(null)}
                />
            )}

            <div className="records-container">
                {filteredRecords.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📭</div>
                        <h3>No records found</h3>
                        <p>
                            {searchTerm 
                                ? `No records match "${searchTerm}"`
                                : "No records available"
                            }
                        </p>
                        {allowCreate && !searchTerm && (
                            <button 
                                className="btn btn-primary"
                                onClick={() => setShowCreateForm(true)}
                            >
                                Create Your First Record
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="records-grid">
                            {paginatedRecords.map((record) => (
                                <DataverseRecord
                                    key={record.id}
                                    record={record}
                                    columns={columns}
                                    allowUpdate={allowUpdate}
                                    allowDelete={allowDelete}
                                    onEdit={() => setEditingRecord(record)}
                                    onDelete={() => handleDelete(record.id)}
                                />
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="pagination">
                                <button
                                    className="btn btn-secondary"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                >
                                    ← Previous
                                </button>
                                
                                <span className="pagination-info">
                                    Page {currentPage} of {totalPages} 
                                    ({filteredRecords.length} records)
                                </span>
                                
                                <button
                                    className="btn btn-secondary"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};