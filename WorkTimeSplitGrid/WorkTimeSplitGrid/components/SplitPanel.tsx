import * as React from "react";
import { EntryRow, Lang, SubtypeRow } from "./types";
import { STRINGS } from "./i18n";
import { FieldConfig, EPSILON } from "./schema";
import { parseNumber, formatNumber, saveSplit, SplitInput } from "./api";

export interface SplitPanelProps {
    entry: EntryRow | null;
    subtypes: SubtypeRow[] | null;
    loading: boolean;
    error: string | null;
    fields: FieldConfig;
    webApi: ComponentFramework.WebApi;
    utils: ComponentFramework.Utility;
    disabled: boolean;
    isMobile: boolean;
    lang: Lang;
    onBack: () => void;
    onSubtypesChange: (rows: SubtypeRow[]) => void;
    onSaved: () => void;
    onError: (msg: string) => void;
}

export const SplitPanel: React.FC<SplitPanelProps> = (props) => {
    const t = STRINGS[props.lang];
    const { entry, subtypes, fields } = props;

    const [saving, setSaving] = React.useState(false);
    const [confirming, setConfirming] = React.useState(false);

    // Reset transient panel state when the selected entry changes.
    React.useEffect(() => {
        setSaving(false);
        setConfirming(false);
    }, [entry?.id]);

    const parsed = React.useMemo(
        () => (subtypes ?? []).map((s) => parseNumber(s.value)),
        [subtypes],
    );
    const hasInvalid = parsed.some((n) => Number.isNaN(n));
    const distributed = parsed.reduce((a, n) => a + (Number.isNaN(n) ? 0 : n), 0);
    const total = entry?.total ?? 0;
    const remaining = total - distributed;
    const activeCount = parsed.filter((n) => !Number.isNaN(n) && n > 0).length;

    const sumMatches = Math.abs(remaining) < EPSILON && distributed > 0;
    const canSave =
        !!entry &&
        !entry.completed &&
        !props.disabled &&
        !saving &&
        !hasInvalid &&
        (subtypes?.length ?? 0) > 0 &&
        sumMatches;

    const handleValueChange = (id: string, value: string) => {
        if (!subtypes) return;
        props.onSubtypesChange(
            subtypes.map((s) => (s.id === id ? { ...s, value } : s)),
        );
    };

    const doSave = async () => {
        if (!entry || !subtypes) return;
        setConfirming(false);
        setSaving(true);
        const input: SplitInput[] = subtypes.map((s) => ({
            id: s.id,
            name: s.name,
            value: parseNumber(s.value),
            paytype: s.paytype ?? null,
        }));
        try {
            await saveSplit(props.webApi, props.utils, fields, entry.id, input);
            props.onSaved();
        } catch (e) {
            const msg =
                (e as { message?: string })?.message ??
                String(e ?? "unknown error");
            props.onError(`${t.saveFailed}: ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    if (!entry) {
        return (
            <div className="wtsg-panel wtsg-panel-empty">
                <p>{t.selectHint}</p>
            </div>
        );
    }

    return (
        <div className="wtsg-panel">
            {props.isMobile && (
                <div className="wtsg-mobile-head">
                    <button
                        type="button"
                        className="wtsg-back"
                        onClick={props.onBack}
                        aria-label={t.back}
                    >
                        <span aria-hidden="true">‹</span> {t.back}
                    </button>
                </div>
            )}
            <div className="wtsg-panel-head">
                <h3 title={entry.name}>{entry.name}</h3>
                <div className="wtsg-panel-sub">
                    {entry.type || "—"} · {entry.date || "—"}
                </div>
            </div>

            {props.loading ? (
                <div className="wtsg-panel-loading">
                    <span className="wtsg-spinner" aria-hidden="true" />
                    {t.loadingSubtypes}
                </div>
            ) : props.error ? (
                <div className="wtsg-panel-error">{props.error}</div>
            ) : (subtypes?.length ?? 0) === 0 ? (
                <div className="wtsg-panel-error">{t.noSubtypes}</div>
            ) : (
                <div className="wtsg-rows">
                    {subtypes!.map((s) => {
                        const invalid = Number.isNaN(parseNumber(s.value));
                        const editable =
                            !entry.completed && !props.disabled && !saving;
                        // Offer "use remaining" on every row while time is left.
                        const showFill = editable && remaining > EPSILON;
                        return (
                            <label key={s.id} className="wtsg-rowitem">
                                <span className="wtsg-rowname">{s.name}</span>
                                <span className="wtsg-rowfill">
                                    {showFill && (
                                        <button
                                            type="button"
                                            className="wtsg-fillbtn"
                                            title={`${t.takeRemaining} (${round(remaining)})`}
                                            aria-label={`${t.takeRemaining} (${round(remaining)})`}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                const cur = parseNumber(s.value);
                                                const base = Number.isNaN(cur)
                                                    ? 0
                                                    : cur;
                                                handleValueChange(
                                                    s.id,
                                                    formatNumber(base + remaining),
                                                );
                                            }}
                                        >
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 16 16"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    d="M2.5 8h8M7.5 4.5 11 8l-3.5 3.5M13 3.5v9"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.6"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        </button>
                                    )}
                                </span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className={`wtsg-rowinput ${invalid ? "invalid" : ""}`}
                                    value={s.value}
                                    placeholder="0"
                                    disabled={entry.completed || props.disabled || saving}
                                    onChange={(e) =>
                                        handleValueChange(s.id, e.target.value)
                                    }
                                />
                            </label>
                        );
                    })}
                </div>
            )}

            {!props.loading &&
                !props.error &&
                (subtypes?.length ?? 0) > 0 && (
                    <>
                        <div className="wtsg-summary">
                            <div>
                                <span>{t.total}</span>
                                <strong>{entry.totalFormatted || total}</strong>
                            </div>
                            <div>
                                <span>{t.distributed}</span>
                                <strong>{round(distributed)}</strong>
                            </div>
                            <div
                                className={
                                    Math.abs(remaining) < EPSILON ? "ok" : "warn"
                                }
                            >
                                <span>{t.remaining}</span>
                                <strong>{round(remaining)}</strong>
                            </div>
                        </div>

                        <div className="wtsg-actions">
                            <button
                                type="button"
                                className="wtsg-save"
                                disabled={!canSave}
                                title={!sumMatches ? t.saveDisabledSum : t.save}
                                onClick={() => setConfirming(true)}
                            >
                                {saving ? t.saving : t.save}
                            </button>
                        </div>
                    </>
                )}

            {confirming && (
                <div className="wtsg-modal" role="dialog" aria-modal="true">
                    <div className="wtsg-modal-card">
                        <h4>{t.confirmTitle}</h4>
                        <p>{t.confirmBody(entry.name, activeCount)}</p>
                        <div className="wtsg-modal-actions">
                            <button
                                type="button"
                                className="wtsg-btn-secondary"
                                onClick={() => setConfirming(false)}
                            >
                                {t.confirmCancel}
                            </button>
                            <button
                                type="button"
                                className="wtsg-btn-primary"
                                onClick={doSave}
                            >
                                {t.confirmOk}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function round(n: number): number {
    return Math.round(n * 1000) / 1000;
}
