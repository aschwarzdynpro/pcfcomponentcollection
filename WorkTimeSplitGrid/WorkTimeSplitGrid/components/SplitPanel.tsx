import * as React from "react";
import { MODAL_LAYER } from "./layers";
import { EntryRow, Lang, SubtypeRow } from "./types";
import { STRINGS } from "./i18n";
import { FieldConfig, EPSILON } from "./schema";
import {
    parseNumber,
    saveSplit,
    suggestSplit,
    isHolidayForEntry,
    serverErrorMessage,
    SplitInput,
} from "./api";
import { Logger } from "./telemetry";
import { SubtypeRowEditor } from "./SubtypeRowEditor";

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
    /** Single-pane layout → show a "back to list" header (hidden in two-pane). */
    singlePane: boolean;
    /** Offline → read-only: show the entry head + a notice, no editor/save. */
    isOffline: boolean;
    /** Show the AI suggestion (★) pre-fill button (manifest toggle). */
    showSuggest: boolean;
    lang: Lang;
    logger: Logger;
    onBack: () => void;
    onSubtypesChange: (rows: SubtypeRow[]) => void;
    onSaved: () => void;
    onError: (msg: string) => void;
    /** Empty-pane hint override (e.g. "select an entry or a day"). */
    hint?: string;
}

export const SplitPanel: React.FC<SplitPanelProps> = (props) => {
    const t = STRINGS[props.lang];
    const { entry, subtypes, fields } = props;

    const [saving, setSaving] = React.useState(false);
    const [confirming, setConfirming] = React.useState(false);
    const [suggesting, setSuggesting] = React.useState(false);

    // Reset transient panel state when the selected entry changes.
    React.useEffect(() => {
        setSaving(false);
        setConfirming(false);
        setSuggesting(false);
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

    /** Star/AI button: pre-fill the distribution from the entry's date + total
     *  (Sunday → Nacht/Sonntag, holiday → Feiertag, >8h → Normal + Überstunde). */
    const handleSuggest = async () => {
        if (!entry || !subtypes || suggesting) return;
        setSuggesting(true);
        try {
            const holiday = await isHolidayForEntry(
                props.webApi,
                entry.id,
                entry.dateValue ?? "",
            );
            props.onSubtypesChange(
                suggestSplit(entry.dateValue ?? "", entry.total, subtypes, holiday),
            );
        } finally {
            setSuggesting(false);
        }
    };

    const canSuggest =
        props.showSuggest &&
        !!entry &&
        !entry.completed &&
        !props.disabled &&
        !saving &&
        (subtypes?.length ?? 0) > 0;

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
            await saveSplit(
                props.webApi,
                props.utils,
                fields,
                entry.id,
                input,
                props.logger,
            );
            props.onSaved();
        } catch (e) {
            props.onError(`${t.saveFailed}: ${serverErrorMessage(e)}`);
        } finally {
            setSaving(false);
        }
    };

    if (!entry) {
        return (
            <div className="wtsg-panel wtsg-panel-empty">
                <p>{props.hint ?? t.selectHint}</p>
            </div>
        );
    }

    // Detail head title: project number / booking number (type + date are shown
    // in the sub-line below, so the long composed title is redundant here).
    const detailTitle =
        [entry.project, entry.bookingNumber].filter(Boolean).join(" / ") ||
        entry.type ||
        "—";

    // Offline → read-only: the split is a destructive server transaction, so it
    // can't run from the local cache. Show the entry head + a notice instead of
    // the editor/save.
    if (props.isOffline) {
        return (
            <div className="wtsg-panel">
                {props.singlePane && (
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
                    <h3 title={detailTitle}>{detailTitle}</h3>
                    <div className="wtsg-panel-sub">
                        {entry.type || "—"} · {entry.date || "—"}
                    </div>
                </div>
                <div className="wtsg-summary">
                    <div>
                        <span>{t.total}</span>
                        <strong>{entry.totalFormatted || total}</strong>
                    </div>
                </div>
                <div className="wtsg-panel-note" role="status">
                    {t.offlineReadOnly}
                </div>
            </div>
        );
    }

    return (
        <div className="wtsg-panel">
            {props.singlePane && (
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
                <div className="wtsg-panel-head-text">
                    <h3 title={detailTitle}>{detailTitle}</h3>
                    <div className="wtsg-panel-sub">
                        {entry.type || "—"} · {entry.date || "—"}
                    </div>
                </div>
                {canSuggest && (
                    <button
                        type="button"
                        className="wtsg-magic"
                        onClick={handleSuggest}
                        disabled={suggesting}
                        title={t.suggest}
                        aria-label={t.suggest}
                    >
                        {suggesting ? (
                            <span className="wtsg-spinner" aria-hidden="true" />
                        ) : (
                            <svg
                                width="22"
                                height="22"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    d="M9.5 2C9.5 6 6 9.5 2 9.5C6 9.5 9.5 13 9.5 17C9.5 13 13 9.5 17 9.5C13 9.5 9.5 6 9.5 2Z"
                                    fill="#2d8cf0"
                                />
                                <path
                                    d="M18 13.5C18 15.5 15.5 18 13.5 18C15.5 18 18 20.5 18 22.5C18 20.5 20.5 18 22.5 18C20.5 18 18 15.5 18 13.5Z"
                                    fill="#7c4dff"
                                />
                            </svg>
                        )}
                    </button>
                )}
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
                    {subtypes!.map((s) => (
                        <SubtypeRowEditor
                            key={s.id}
                            id={s.id}
                            name={s.name}
                            value={s.value}
                            editable={
                                !entry.completed && !props.disabled && !saving
                            }
                            isMobile={props.isMobile}
                            remaining={remaining}
                            takeRemainingLabel={t.takeRemaining}
                            onChange={handleValueChange}
                        />
                    ))}
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
                <div
                    className="wtsg-modal"
                    style={MODAL_LAYER}
                    role="dialog"
                    aria-modal="true"
                >
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
