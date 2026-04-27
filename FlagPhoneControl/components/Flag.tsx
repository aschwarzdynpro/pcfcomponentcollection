import * as React from "react";
import * as Flags3x2 from "country-flag-icons/react/3x2";
import { flagEmoji } from "./countries";

const FLAG_MAP = Flags3x2 as unknown as Record<
    string,
    React.ComponentType<React.SVGProps<SVGSVGElement>>
>;

export interface FlagProps {
    iso: string;
    className?: string;
    title?: string;
}

export const Flag: React.FC<FlagProps> = ({ iso, className, title }) => {
    const upper = (iso || "").toUpperCase();
    const Svg = FLAG_MAP[upper];
    if (Svg) {
        return (
            <Svg
                className={className}
                role="img"
                aria-hidden="true"
                {...(title ? { title } : {})}
            />
        );
    }
    return (
        <span className={className} aria-hidden="true">
            {flagEmoji(upper)}
        </span>
    );
};
