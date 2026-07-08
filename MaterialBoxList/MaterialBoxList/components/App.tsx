import * as React from "react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { BoxRecord, Lang, TakenBehavior } from "./types";
import { getStrings } from "./i18n";
import { BoxList } from "./BoxList";
import { MaterialOverlay } from "./MaterialOverlay";
import { UndoSnackbar } from "./UndoSnackbar";
import { useChildCounts } from "../hooks/useChildCounts";
import { IChildRecordService } from "../services/childRecordService";
import { IUpdateService } from "../services/updateService";

const UNDO_SECONDS = 5;
const UNDO_MS = UNDO_SECONDS * 1000;

export interface AppProps {
    boxes: BoxRecord[];
    hasNextPage: boolean;
    loading: boolean;
    childService: IChildRecordService;
    updateService: IUpdateService;
    takenBehavior: TakenBehavior;
    /** Touch gestures (mobile) vs. fallback buttons (web). */
    gesturesEnabled: boolean;
    lang: Lang;
    onLoadMore: () => void;
}

interface State {
    /** Boxes toggled to "taken" locally (optimistic), pending or committed. */
    takenLocal: string[];
    /** The box in its 5 s undo window, if any. */
    pending: { id: string; secondsLeft: number } | null;
    /** Box shown in the overlay, if any. */
    overlayBoxId: string | null;
    /** Box currently showing a save error, if any. */
    errorId: string | null;
}

type Action =
    | { type: "OPEN"; id: string }
    | { type: "CLOSE" }
    | { type: "START_TAKE"; id: string }
    | { type: "TICK" }
    | { type: "UNDO" }
    | { type: "COMMIT_DONE"; id: string }
    | { type: "COMMIT_FAIL"; id: string };

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case "OPEN":
            return { ...state, overlayBoxId: action.id };
        case "CLOSE":
            return { ...state, overlayBoxId: null };
        case "START_TAKE":
            return {
                ...state,
                takenLocal: state.takenLocal.includes(action.id)
                    ? state.takenLocal
                    : [...state.takenLocal, action.id],
                errorId: state.errorId === action.id ? null : state.errorId,
                pending: { id: action.id, secondsLeft: UNDO_SECONDS },
            };
        case "TICK":
            return state.pending
                ? {
                      ...state,
                      pending: {
                          ...state.pending,
                          secondsLeft: Math.max(0, state.pending.secondsLeft - 1),
                      },
                  }
                : state;
        case "UNDO":
            if (!state.pending) return state;
            return {
                ...state,
                takenLocal: state.takenLocal.filter((x) => x !== state.pending!.id),
                pending: null,
            };
        case "COMMIT_DONE":
            return {
                ...state,
                pending:
                    state.pending?.id === action.id ? null : state.pending,
            };
        case "COMMIT_FAIL":
            return {
                ...state,
                takenLocal: state.takenLocal.filter((x) => x !== action.id),
                errorId: action.id,
                pending:
                    state.pending?.id === action.id ? null : state.pending,
            };
        default:
            return state;
    }
}

export const App: React.FC<AppProps> = ({
    boxes,
    hasNextPage,
    loading,
    childService,
    updateService,
    takenBehavior,
    gesturesEnabled,
    lang,
    onLoadMore,
}) => {
    const strings = getStrings(lang);
    const [state, dispatch] = React.useReducer(reducer, {
        takenLocal: [],
        pending: null,
        overlayBoxId: null,
        errorId: null,
    });

    const isTaken = React.useCallback(
        (box: BoxRecord): boolean =>
            box.taken || state.takenLocal.includes(box.id),
        [state.takenLocal],
    );

    // `hide` drops taken boxes from the list; `gray` / `allow-undo` keep them.
    const visible = React.useMemo(
        () =>
            takenBehavior === "hide"
                ? boxes.filter((b) => !isTaken(b))
                : boxes,
        [boxes, takenBehavior, isTaken],
    );

    const boxIds = React.useMemo(() => visible.map((b) => b.id), [visible]);
    const counts = useChildCounts(childService, boxIds);

    // Commit (server write) for a taken box; id-keyed so a late result never
    // clears the wrong pending row.
    const commitNow = React.useCallback(
        (id: string) => {
            updateService
                .markTaken(id)
                .then(() => dispatch({ type: "COMMIT_DONE", id }))
                .catch(() => dispatch({ type: "COMMIT_FAIL", id }));
        },
        [updateService],
    );

    const pendingRef = React.useRef(state.pending);

    // Drive the undo countdown + the deferred commit for the current pending
    // box. Undo (pending → null) or a replacement take cancels the timer.
    React.useEffect(() => {
        pendingRef.current = state.pending;
        if (!state.pending) return;
        const id = state.pending.id;
        const interval = setInterval(() => dispatch({ type: "TICK" }), 1000);
        const timeout = setTimeout(() => commitNow(id), UNDO_MS);
        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.pending?.id, commitNow]);

    const beginTake = React.useCallback(
        (id: string) => {
            // A new take while another is still in its window: commit the old
            // one immediately so it isn't lost when its timer is cancelled.
            const prev = pendingRef.current;
            if (prev && prev.id !== id) commitNow(prev.id);
            dispatch({ type: "START_TAKE", id });
        },
        [commitNow],
    );

    const onShowMaterials = React.useCallback(
        (id: string) => dispatch({ type: "OPEN", id }),
        [],
    );
    const onCloseOverlay = React.useCallback(() => dispatch({ type: "CLOSE" }), []);
    const onUndo = React.useCallback(() => dispatch({ type: "UNDO" }), []);

    const overlayBox = visible.find((b) => b.id === state.overlayBoxId) ?? null;

    return (
        <FluentProvider theme={webLightTheme} className="mbl-root">
            <BoxList
                boxes={visible}
                countOf={counts.countOf}
                takenOf={(id) => {
                    const box = boxes.find((b) => b.id === id);
                    return box ? isTaken(box) : false;
                }}
                errorId={state.errorId}
                loading={loading}
                hasNextPage={hasNextPage}
                gesturesEnabled={gesturesEnabled}
                strings={strings}
                onShowMaterials={onShowMaterials}
                onTake={beginTake}
                onRetry={beginTake}
                onLoadMore={onLoadMore}
            />

            {overlayBox && (
                <MaterialOverlay
                    open={true}
                    boxName={overlayBox.name}
                    materials={counts.materialsOf(overlayBox.id)}
                    loaded={counts.isLoaded(overlayBox.id)}
                    strings={strings}
                    canTake={!isTaken(overlayBox)}
                    onClose={onCloseOverlay}
                    onMarkTaken={() => {
                        const id = overlayBox.id;
                        dispatch({ type: "CLOSE" });
                        beginTake(id);
                    }}
                />
            )}

            {state.pending && (
                <UndoSnackbar
                    secondsLeft={state.pending.secondsLeft}
                    strings={strings}
                    onUndo={onUndo}
                />
            )}
        </FluentProvider>
    );
};
