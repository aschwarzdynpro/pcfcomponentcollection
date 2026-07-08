import * as React from "react";
import { Badge, Spinner } from "@fluentui/react-components";
import { CountState } from "./types";
import { Strings } from "./i18n";

export interface CounterChipProps {
    state: CountState;
    strings: Strings;
}

/**
 * Per-box material counter (concept §2 / §5.3). Shows the count as a badge, a
 * tiny spinner while the batch fetch is in flight, and a dimmed "–" on error so
 * the row never blocks on the counter.
 */
export const CounterChip: React.FC<CounterChipProps> = ({ state, strings }) => {
    if (state.status === "loading") {
        return (
            <span className="mbl-chip mbl-chip--loading" aria-hidden="true">
                <Spinner size="tiny" />
            </span>
        );
    }
    if (state.status === "error") {
        return (
            <span className="mbl-chip mbl-chip--error" title="—" aria-hidden="true">
                –
            </span>
        );
    }
    const empty = state.count === 0;
    return (
        <Badge
            appearance="filled"
            color={empty ? "informative" : "brand"}
            shape="rounded"
            aria-label={strings.countAria(state.count)}
        >
            {state.count}
        </Badge>
    );
};
