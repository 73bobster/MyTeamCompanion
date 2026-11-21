# Live games

How a live score gets from API-Football to the app, and what has to be switched on.

```
API-Football  --(1 call/min)-->  loader on Robert's PC  -->  football-data: ref.live_fixtures, ref.live_events
                                                                      |
                                    Cloudflare Pages Function  /api/live  (read-only role, cached 20s)
                                                                      |
                                       app polls every 30s while a game is on (Home, Results sheet, Tables)
```

## 1. football-data (done)
`ref.live_fixtures` and `ref.live_events` exist, with select granted to `myteamcompanion_ro`.

## 2. Loader on the PC (to do)
Add the step in `importer/live-loader.mjs` to the loader's 60-second cycle (or run that file every minute: `npm i pg`, set
`FOOTBALL_DATABASE_URL` to the loader's own role and `API_FOOTBALL_KEY`). It makes one `fixtures?live=all` call per cycle, plus one
`fixtures?ids=` call when a game has just ended, and upserts the rows. The same live feed can serve the Statto Sweepstake too.
Rules it follows, if you fold it into your own code:
- club ids are `ref.clubs.id`, looked up through `ref.external_ids` (the app also matches by club name, so an unmapped club still works);
- events are replaced for a fixture on every pass; for substitutions `player_name` is the player going off and `assist_name` the player coming on;
- keep a fixture's row after full time (status `FT`/`AET`/`PEN`) so the final score and events stay visible for a few hours.

## 3. Cloudflare Pages (to do)
Project settings > Variables and secrets > add `FOOTBALL_DATABASE_URL` (Production) with the same read-only address already used as the GitHub secret
of that name. Redeploy. `GET /api/live` should then return JSON; until it is set it answers 503 and the app simply shows no live games.

## In the app
- Home: a red card for the followed club's game with minute and score, tap for goals, cards and substitutions; live games in "Next fixtures" show score and minute.
- Tables: the league (and European) table is recalculated with in-play scores and flagged "Live"; it settles when the feed's own table refreshes.
- Polling only runs while the app is open, and only every 30s around a followed-club kick-off or while any game is on; otherwise every 5 minutes.
