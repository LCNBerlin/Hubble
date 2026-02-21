/**
 * TV (Broadcast / Stations / Cinema) layout grid.
 * iPad: 12-column grid, 32px margins, 24px gutter.
 * Mobile: stacked, full width with horizontal padding.
 */

export const GRID_MARGIN = 32;
export const GRID_GUTTER = 24;
export const CARD_RHYTHM = 24;
export const GRID_COLUMNS = 12;

export const BROADCAST_CARD_WIDTH = 300;
export const BROADCAST_CARD_HEIGHT = 190; // 16:10

export const UPCOMING_CARD_ASPECT = 2 / 3; // poster-ish
export const STATION_CARD_SIZE = 260; // square
export const CINEMA_POSTER_WIDTH = 220;
export const CINEMA_POSTER_HEIGHT = 330; // 2:3

export const TABLET_BREAKPOINT = 768;

export function useTvLayout(width: number) {
  const isTablet = width >= TABLET_BREAKPOINT;
  const contentWidth = Math.min(width - GRID_MARGIN * 2, 1200);
  const paddingHorizontal = isTablet ? GRID_MARGIN : 16;

  return {
    isTablet,
    contentWidth,
    paddingHorizontal,
    gutter: GRID_GUTTER,
    cardRhythm: CARD_RHYTHM,
    columns: isTablet ? GRID_COLUMNS : 1,
    // Broadcast
    broadcastCardsPerRow: isTablet ? 4 : 1,
    broadcastCardWidth: isTablet ? BROADCAST_CARD_WIDTH : width * 0.85,
    broadcastCardHeight: isTablet ? BROADCAST_CARD_HEIGHT : Math.round((width * 0.85) / (16 / 10)),
    // Upcoming: 3 cols iPad, 1 col mobile
    upcomingColumns: isTablet ? 3 : 1,
    // Stations
    stationCardSize: isTablet ? STATION_CARD_SIZE : 160,
    featuredStationsColumns: isTablet ? 4 : 2,
    // Cinema
    posterWidth: isTablet ? CINEMA_POSTER_WIDTH : 160,
    posterHeight: isTablet ? CINEMA_POSTER_HEIGHT : 240,
    originalsPerRow: isTablet ? 5 : 1,
    shortFilmsColumns: isTablet ? 3 : 2,
    genreColumns: isTablet ? 4 : 1,
  };
}
