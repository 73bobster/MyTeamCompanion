# Live games

```
API-Football --(1 live=all call/min)--> tools/poller.mjs on Robert's PC (Statto Sweepstake repo) --> Statto DB: public.live_board
                                                                                                          |
                                                    Cloudflare Pages Function /api/live (read-only role, cached 20s)
                                                                                                          |
                                                    app polls every 30s while a game is on (Home, match sheet, Tables)
```

The live feed is owned by the Statto Sweepstake poller (`tools/poller.mjs`, `public.live_board`, migration `008_live_board.sql`).
It already ran every minute for sweepstake matches; it now also keeps every UK and European game in play on the board. The football-data
database holds reference data only (live data is not stored there).

## To switch on
1. On the PC: `git pull` in the Statto Sweepstake folder and restart `tools/run-poller.bat`.
2. Cloudflare Pages (MyTeamCompanion project) > Settings > Variables and secrets > add `LIVE_DATABASE_URL` (Production): the connection string of the
   read-only role `myteamcompanion_live_ro` on Neon project `stattosweepstake` (it can only read `live_board`). Redeploy.
3. `GET /api/live` should return JSON. Until the variable is set it answers 503 and the app just shows no live games.

## In the app
- Home: a red card for the followed club's game with minute and score, tap for goals, cards and substitutions; live games in "Next fixtures" show score and minute.
- Tables: the league (and European) table is recalculated with in-play scores and flagged "Live"; it settles when the feed's own table refreshes.
- Polling runs only while the app is open: every 30s around a followed-club kick-off or while any game is on, otherwise every 5 minutes.
- Clubs are matched by name (API-Football's spelling mapped through the same alias list the reference-data sync uses).
