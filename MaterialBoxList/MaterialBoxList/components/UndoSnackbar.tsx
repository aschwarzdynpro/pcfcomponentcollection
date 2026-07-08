import * as React from "react";
import { Button } from "@fluentui/react-components";
import { Strings } from "./i18n";

export interface UndoSnackbarProps {
    secondsLeft: number;
    strings: Strings;
    onUndo: () => void;
}

/**
 * Bottom snackbar shown for the 5 s undo window after a take-out (§5.5). Undo
 * within the window prevents the server write entirely; otherwise the write
 * commits when the countdown ends.
 */
export const UndoSnackbar: React.FC<UndoSnackbarProps> = ({
    secondsLeft,
    strings,
    onUndo,
}) => (
    <div className="mbl-snackbar" role="status" aria-live="polite">
        <span className="mbl-snackbar__text">
            {strings.undoCountdown(secondsLeft)}
        </span>
        <Button appearance="transparent" size="small" onClick={onUndo}>
            {strings.undo}
        </Button>
    </div>
);
