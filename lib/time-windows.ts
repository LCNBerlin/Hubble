export function createTimeWindows() {
  const now = new Date();
  return {
    now,
    startOfToday: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(),
    startOfMonth: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    twentyFourHoursAgo: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    sevenDaysAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    thirtyDaysAgo: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
