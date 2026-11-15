// Clubs that are always imported, so that a team added in the app has its fixtures, results, line-ups and squad stats ready straight away.
// BBC Sport team slugs (same as the app's club slugs). 2026/27 season: update after promotion and relegation.
export const PREMIER_LEAGUE = [
  'arsenal', 'aston-villa', 'bournemouth', 'brentford', 'brighton-and-hove-albion', 'chelsea', 'coventry-city', 'crystal-palace',
  'everton', 'fulham', 'hull-city', 'ipswich-town', 'leeds-united', 'liverpool', 'manchester-city', 'manchester-united',
  'newcastle-united', 'nottingham-forest', 'sunderland', 'tottenham-hotspur',
];
export const SCOTTISH_PREMIERSHIP = [
  'aberdeen', 'celtic', 'dundee', 'dundee-united', 'falkirk', 'heart-of-midlothian', 'hibernian', 'kilmarnock',
  'motherwell', 'rangers', 'st-johnstone', 'st-mirren',
];
export const TOP_FLIGHT = [...PREMIER_LEAGUE, ...SCOTTISH_PREMIERSHIP];
