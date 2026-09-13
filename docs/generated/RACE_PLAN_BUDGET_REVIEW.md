# Race Plan budget diagnostic

Reference: 30-second fight, 100 AD / 100 AP / 1000 HP. These are estimates, not measured item equivalence. Unknown effects are flagged, never silently certified. Exact magnitudes in spec §12–15 do not consistently satisfy §19; no automatic rescaling is applied. Incremental bands: plan .25–.35, evolution .30–.40, finishing .60–.90. Support targeting, mana cadence, retargeting, conditional uptime and combined nodes need simulation.

| Node | Kind | Estimated IE | Unpriced effects | Review |
|---|---|---:|---:|---|
| RP_HIGH_PACE_PRESSURE | PLAN | 0.149 | 0 | band  |
| RP_HIGH_PACE_GATE | PLAN | 0.111 | 1 | band  |
| RP_HIGH_PACE_BREAK | PLAN | 0.145 | 0 | band  |
| RP_LEAD_CONTROL | PLAN | 0.471 | 0 | band  |
| RP_LEAD_RAIL | PLAN | 0.137 | 0 | band  |
| RP_LEAD_TEMPO | PLAN | 0.653 | 0 | band  |
| RP_MIDDLE_BALANCE | PLAN | 0.493 | 0 | band  |
| RP_MIDDLE_CYCLE | PLAN | 0.139 | 0 | band  |
| RP_MIDDLE_POSITION | PLAN | 0.565 | 0 | band  |
| RP_SLOW_STORE | PLAN | 0.125 | 0 | band late AS >50% |
| RP_SLOW_PATIENCE | PLAN | 0.305 | 0 |  |
| RP_SLOW_STAMINA | PLAN | 0.895 | 0 | band  |
| RP_PASS_OUTSIDE | PLAN | 0.267 | 0 |  |
| RP_PASS_GAP | PLAN | 0.136 | 0 | band  |
| RP_PASS_CHAIN | PLAN | 0.029 | 1 | band  |
| RP_LAST3F_ACCEL | PLAN | 0.32 | 0 |  |
| RP_LAST3F_KICK | PLAN | 0.319 | 0 |  |
| RP_LAST3F_FINISH | PLAN | 0.267 | 0 |  |
| RP_GUTS_LOW_HP | PLAN | 0.183 | 0 | band  |
| RP_GUTS_DUEL | PLAN | 0.089 | 0 | band  |
| RP_GUTS_COMEBACK | PLAN | 0.103 | 0 | band  |
| RP_TRACK_TURF | PLAN | 0.044 | 0 | band  |
| RP_TRACK_DIRT | PLAN | 0.089 | 0 | band  |
| RP_TRACK_GOING | PLAN | 0.598 | 0 | band  |
| RP_PACE_READ_FIELD | PLAN | 0.53 | 0 | band  |
| RP_PACE_READ_LAP | PLAN | 0.471 | 0 | band  |
| RP_PACE_READ_BREATH | PLAN | 0.513 | 0 | band  |
| RP_PACE_READ_SHADOW | PLAN | 0.642 | 0 | band  |
| RP_GAMBLE_ALL_IN | PLAN | 0.333 | 0 |  |
| RP_GAMBLE_SPEND_LEGS | PLAN | 0.287 | 0 |  |
| RP_GAMBLE_LATE_BREAK | PLAN | 0.25 | 0 |  |
| RP_GAMBLE_BLINKERS | PLAN | 0.353 | 0 | band  |
| RP_HIGH_PACE_RUNAWAY | PLAN | 0.398 | 1 | band  |
| RP_LEAD_SLIPSTREAM | PLAN | 0.692 | 0 | band  |
| RP_MIDDLE_RHYTHM | PLAN | 0.112 | 0 | band  |
| RP_SLOW_SAVE_LEGS | PLAN | 0.443 | 0 | band  |
| RP_PASS_RAIL_GAP | PLAN | 0.34 | 0 | late AS >50% |
| RP_LAST3F_SECOND_KICK | PLAN | 0.1 | 0 | band  |
| RP_GUTS_LAST_GASP | PLAN | 1.146 | 0 | band  |
| RP_TRACK_WEATHER | PLAN | 1.765 | 0 | band  |
| EV_EARLY_OVERPACE | EVOLUTION | 0.093 | 0 | band  |
| EV_EARLY_CLEAN_START | EVOLUTION | 0.053 | 0 | band  |
| EV_EARLY_FRONT_LOCK | EVOLUTION | 0.089 | 0 | band  |
| EV_MID_EFFICIENT | EVOLUTION | 0.083 | 0 | band  |
| EV_MID_SECOND_WIND | EVOLUTION | 0.215 | 0 | band  |
| EV_MID_FORMATION | EVOLUTION | 0.5 | 0 | band  |
| EV_LATE_SAVE_LEGS | EVOLUTION | 0.16 | 0 | band late AS >50% |
| EV_LATE_LONG_SPURT | EVOLUTION | 0.24 | 0 | band late AS >50% |
| EV_LATE_ONE_KICK | EVOLUTION | 0.4 | 0 |  |
| EV_PASS_WEAK | EVOLUTION | 0.8 | 0 | band  |
| EV_PASS_BACKLINE | EVOLUTION | 0.08 | 0 | band  |
| EV_PASS_ARMOR | EVOLUTION | 0.182 | 0 | band  |
| EV_GUTS_SHIELD | EVOLUTION | 0.022 | 0 | band  |
| EV_GUTS_HEAL | EVOLUTION | 0.024 | 0 | band  |
| EV_GUTS_LAST | EVOLUTION | 1.258 | 0 | band  |
| EV_CAST_RHYTHM | EVOLUTION | 0.1 | 0 | band  |
| EV_CAST_FINISH | EVOLUTION | 0.2 | 0 | band  |
| EV_ATTACK_RHYTHM | EVOLUTION | 0.056 | 0 | band  |
| EV_ATTACK_PRESSURE | EVOLUTION | 0.121 | 0 | band  |
| EV_TEAM_PACE | EVOLUTION | 0.036 | 0 | band  |
| EV_STAMINA_BANK | EVOLUTION | 0.32 | 0 |  |
| EV_STAMINA_CONVERT | EVOLUTION | 1.26 | 0 | band  |
| EV_TRACK_ADAPT | EVOLUTION | 0.252 | 0 | band  |
| EV_COURSE_SENSE | EVOLUTION | 0.15 | 0 | band  |
| EV_ENCORE_CORNER | EVOLUTION | 0.533 | 0 | band  |
| EV_SPEND_GUTS | EVOLUTION | 0.087 | 0 | band  |
| EV_FIELD_READ | EVOLUTION | 0.196 | 0 | band  |
| EV_DEEP_BREATH | EVOLUTION | 0.055 | 0 | band  |
| EV_WIND_SHADOW | EVOLUTION | 0.458 | 0 | band  |
| EV_RAIL_RIDE | EVOLUTION | 0.417 | 0 | band  |
| EV_TARGET_SWITCH | EVOLUTION | 0.053 | 0 | band  |
| EV_SPENT_LEGS | EVOLUTION | 0.672 | 0 | band  |
| EV_PACE_UP | EVOLUTION | 0.37 | 0 |  |
| EV_TEAM_SLIPSTREAM | EVOLUTION | 1.133 | 0 | band  |
| EV_LONE_RUN | EVOLUTION | 0.867 | 1 | band  |
| EV_MUDDER | EVOLUTION | 1.555 | 0 | band  |
| EV_LATE_SURGE | EVOLUTION | 0.059 | 0 | band late AS >50% |
| EV_HARD_MOUTH | EVOLUTION | 0.061 | 0 | band  |
| EV_PHOTO_FINISH | EVOLUTION | 0.05 | 0 | band  |
| EV_ROUGH_RIDE | EVOLUTION | 1.12 | 0 | band  |
| FM_BREAKAWAY | FINISHING | 0.676 | 0 |  |
| FM_GATE_BURST | FINISHING | 0.6 | 1 |  |
| FM_FRONT_COMMAND | FINISHING | 0.056 | 0 | band  |
| FM_STAYER | FINISHING | 1 | 0 | band  |
| FM_HEART | FINISHING | 0.11 | 0 | band  |
| FM_PHOTO_FINISH | FINISHING | 1.222 | 0 | band  |
| FM_HEAVY_GOING | FINISHING | 1.382 | 0 | band  |
| FM_TURN_OF_FOOT | FINISHING | 0.233 | 0 | band  |
| FM_LONG_SPURT | FINISHING | 0.57 | 0 | band late AS >50% |
| FM_LAST_3F | FINISHING | 0.327 | 0 | band late AS >50% |
| FM_FINAL_KICK | FINISHING | 0.467 | 0 | band  |
| FM_SAVE_LEGS | FINISHING | 0.3 | 0 | band  |
| FM_SECOND_WIND | FINISHING | 0.252 | 0 | band  |
| FM_PACE_MAKER | FINISHING | 0 | 1 | band  |
| FM_RHYTHM_CAST | FINISHING | 0.553 | 0 | band  |
| FM_EVEN_PACE | FINISHING | 1.003 | 0 | band  |
| FM_TURF_STRIDE | FINISHING | 0.067 | 0 | band  |
| FM_DIRT_GRIND | FINISHING | 0.822 | 0 |  |
| FM_CHASER | FINISHING | 0.696 | 1 |  |
| FM_ONE_TARGET | FINISHING | 0.133 | 0 | band  |
| FM_COURSE_SPECIALIST | FINISHING | 0.622 | 0 |  |
| FM_RACE_READ | FINISHING | 0 | 0 | band  |
| FM_OUTSIDE_PASS | FINISHING | 0.16 | 0 | band  |
| FM_GAP_SHOT | FINISHING | 0.303 | 0 | band  |
| FM_LEFT_HAND | FINISHING | 0.053 | 0 | band  |
| FM_PHOTO_EDGE | FINISHING | 0.533 | 0 | band  |
| FM_ENCORE_STRAIGHT | FINISHING | 0.656 | 0 |  |
| FM_ENCORE_DOUBLE | FINISHING | 0.633 | 0 |  |
| FM_ENCORE_KILL | FINISHING | 0.65 | 0 |  |
| FM_CONVERT_GUTS | FINISHING | 0.083 | 0 | band  |
| FM_CONVERT_SPELL | FINISHING | 0.115 | 0 | band  |
| FM_CONVERT_BODY | FINISHING | 0.35 | 0 | band  |
| FM_FRONT_WIRE | FINISHING | 0.498 | 1 | band  |
| FM_SUSTAIN_STAYER | FINISHING | 1.438 | 0 | band  |
| FM_BURST_PHOTO | FINISHING | 0.16 | 0 | band  |
| FM_SPELL_CADENCE | FINISHING | 0.583 | 0 | band  |
| FM_TEMPO_SWITCH | FINISHING | 0.12 | 0 | band  |
| FM_AMPLIFY_PROGRESS | FINISHING | 0.639 | 0 |  |
| FM_PASS_THREAD | FINISHING | 0.241 | 0 | band  |
| FM_SUPPORT_PACEMAKER | FINISHING | 0.433 | 0 | band  |
| FM_CRIT_CLOSER | FINISHING | 2.25 | 0 | band  |
| FM_SIG_KITASAN_BLACK | FINISHING | 0.273 | 0 | band  |
| FM_SIG_SYMBOLI_RUDOLF | FINISHING | 0.983 | 0 | band  |
| FM_SIG_SPECIAL_WEEK | FINISHING | 0.348 | 0 | band  |
| FM_SIG_DAIWA_SCARLET | FINISHING | 0.607 | 0 |  |
| FM_SIG_TAIKI_SHUTTLE | FINISHING | 0.1 | 1 | band  |
| FM_SIG_MIHONO_BOURBON | FINISHING | 1.235 | 0 | band  |
| FM_SIG_OGURI_CAP | FINISHING | 0.373 | 0 | band  |
| FM_SIG_ORFEVRE | FINISHING | 0.112 | 0 | band late AS >50% |
| FM_SIG_SMART_FALCON | FINISHING | 1.211 | 0 | band  |
| FM_SIG_MARUZENSKY | FINISHING | 0.233 | 0 | band  |
| FM_SIG_GOLD_SHIP | FINISHING | 0.3 | 0 | band  |
| FM_SIG_GRASS_WONDER | FINISHING | 0.107 | 0 | band  |
| FM_SIG_SUPER_CREEK | FINISHING | 0.645 | 0 |  |
| FM_SIG_COPANO_RICKEY | FINISHING | 0.682 | 1 |  |
| FM_SIG_HOKKO_TARUMAE | FINISHING | 0.933 | 0 | band  |
| FM_SIG_SILENCE_SUZUKA | FINISHING | 0.338 | 0 | band  |
