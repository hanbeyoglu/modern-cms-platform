/**
 * "Visible to visitors now" window for content with publishStartAt / publishEndAt.
 * Mirrors PUBLISH_WINDOW_FILTER in the public content service.
 */
export function publishWindow(now: Date) {
  return [
    { OR: [{ publishStartAt: null }, { publishStartAt: { lte: now } }] },
    { OR: [{ publishEndAt: null }, { publishEndAt: { gte: now } }] },
  ];
}
