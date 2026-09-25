import type * as React from "react";

/*
 * Stacking order of the control's overlays (z-index). Kept in one place so
 * new overlays slot in predictably:
 *   1  sticky group headers        (css .wtsg-day-head)
 *   3  mobile detail header        (css .wtsg-mobile-head)
 *  20  busy overlay                (css .wtsg-overlay)
 *  30  dropdown menus / popovers   (css .wtsg-dd-menu, InfoPopover)
 *  50  phone bottom sheet          (MobileToolbar)
 *  60  modal dialogs               (MODAL_LAYER)
 *
 * The modal layer is also applied INLINE: after an update the host may still
 * serve the previous stylesheet, and without a z-index the sticky headers were
 * painted above the dialog backdrop.
 */
export const MODAL_LAYER: React.CSSProperties = {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 60,
};
