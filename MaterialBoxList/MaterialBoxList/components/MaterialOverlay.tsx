import * as React from "react";
import {
    Button,
    Drawer,
    DrawerBody,
    DrawerHeader,
    DrawerHeaderTitle,
    Spinner,
} from "@fluentui/react-components";
import { MaterialRecord } from "./types";
import { Strings } from "./i18n";

export interface MaterialOverlayProps {
    open: boolean;
    boxName: string;
    materials: MaterialRecord[];
    loaded: boolean;
    strings: Strings;
    /** Whether the "mark as taken" action is available for this box. */
    canTake: boolean;
    onClose: () => void;
    onMarkTaken: () => void;
}

/**
 * Bottom-sheet overlay opened by long-press (or the fallback button). Shows the
 * box's materials with the configured columns and a "mark as taken" action so
 * the monteur can inspect and confirm in one flow (§5.6). Reuses the cached
 * rows from the counter fetch — no second round-trip.
 */
export const MaterialOverlay: React.FC<MaterialOverlayProps> = ({
    open,
    boxName,
    materials,
    loaded,
    strings,
    canTake,
    onClose,
    onMarkTaken,
}) => (
    <Drawer
        type="overlay"
        position="bottom"
        open={open}
        onOpenChange={(_, { open: o }) => {
            if (!o) onClose();
        }}
        className="mbl-drawer"
    >
        <DrawerHeader>
            <DrawerHeaderTitle
                action={
                    <Button
                        appearance="subtle"
                        aria-label={strings.close}
                        onClick={onClose}
                    >
                        ✕
                    </Button>
                }
            >
                {boxName || strings.materials}
            </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>
            {!loaded ? (
                <div className="mbl-overlay__loading">
                    <Spinner size="small" label={strings.loading} />
                </div>
            ) : materials.length === 0 ? (
                <div className="mbl-overlay__empty">{strings.emptyBox}</div>
            ) : (
                <ul className="mbl-material-list">
                    {materials.map((m) => (
                        <li key={m.id} className="mbl-material">
                            {m.cells.map((c, i) => (
                                <span
                                    key={c.key}
                                    className={
                                        i === 0
                                            ? "mbl-material__name"
                                            : "mbl-material__cell"
                                    }
                                >
                                    {c.value}
                                </span>
                            ))}
                        </li>
                    ))}
                </ul>
            )}
            {canTake && (
                <div className="mbl-overlay__actions">
                    <Button appearance="primary" onClick={onMarkTaken}>
                        {strings.markTaken}
                    </Button>
                </div>
            )}
        </DrawerBody>
    </Drawer>
);
