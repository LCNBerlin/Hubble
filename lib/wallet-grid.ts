/**
 * Wallet Financial Control Center layout.
 * Tablet: 12-col grid = Sidebar 2 + Main 7 + Right Panel 3. 32px margin, 24px gutter.
 * Mobile: single column, bottom tabs.
 */

export const WALLET_MARGIN = 32;
export const WALLET_GUTTER = 24;
export const WALLET_COLUMNS = 12;
export const TABLET_BREAKPOINT = 768;

export const SIDEBAR_COLS = 2;
export const MAIN_COLS = 7;
export const RIGHT_PANEL_COLS = 3;

export function useWalletLayout(width: number) {
  const isTablet = width >= TABLET_BREAKPOINT;
  const margin = isTablet ? WALLET_MARGIN : 16;
  const contentWidth = width - margin * 2;
  const colWidth = contentWidth / WALLET_COLUMNS;

  return {
    isTablet,
    width,
    margin,
    gutter: WALLET_GUTTER,
    contentWidth,
    colWidth,
    sidebarFlex: SIDEBAR_COLS,
    mainFlex: MAIN_COLS,
    rightPanelFlex: RIGHT_PANEL_COLS,
    rightPanelWidth: isTablet ? colWidth * RIGHT_PANEL_COLS : 0,
  };
}
