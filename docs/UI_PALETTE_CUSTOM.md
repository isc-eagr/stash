# UI palette and consistency rules

The canonical colors live in [semanticPalette_custom.scss](../ui/v2.5/src/styles/semanticPalette_custom.scss). CSS consumes its variables; TypeScript consumes [semanticColors_custom.ts](../ui/v2.5/src/utils/semanticColors_custom.ts), which references those variables. Change the palette there, update this table, and run the palette regression test. Do not copy semantic hex literals into a screen. Metallic card artwork may retain gradient/shading stops; flat tier legends and shared highlights always use these tokens.

| Meaning                       | Color                | Token          |
| ----------------------------- | -------------------- | -------------- |
| Top                           | Cyan #17a2b8         | top            |
| Bottom                        | Green #28a745        | bottom         |
| Sex activity                  | Orange #d9822b       | sex            |
| Oral activity (Mamando Rifle) | Teal #00b3a4         | oral           |
| Solo activity                 | Purple #a855f7       | solo           |
| Regular event                 | Neutral #8a9ba8      | regular        |
| Really Hot event              | Gold #ffd700         | really-hot     |
| GOAT event                    | Sapphire #5b8def     | goat           |
| Outstanding time              | Gold #ffd700         | outstanding    |
| Standard time                 | Green #28a745        | standard       |
| Unclassified/other time       | Neutral #8a9ba8      | unclassified   |
| Unusable time                 | Red #dc3545          | unusable       |
| Royal Sapphire rating         | Sapphire #5b8def     | royal-sapphire |
| Gold rating                   | Metal gold #d4a93a   | gold           |
| Silver rating                 | Silver #b9c2cc       | silver         |
| Bronze rating                 | Bronze #b07a4f       | bronze         |
| No Tier                       | Dark neutral #464d53 | no-tier        |
| Goal: low                     | Muted red #eca2a8    | goal-red       |
| Goal: partial                 | Orange #edbd87       | goal-orange    |
| Goal: approaching             | Yellow #e6d58c       | goal-yellow    |
| Goal: met                     | Green #91d3b0        | goal-green     |
| Goal: exceeded                | Sapphire #94c3df     | goal-sapphire  |

All tokens have the prefix `--semantic-`, an RGB companion ending in `-rgb` for translucent borders/glows, and a contrasting text token ending in `-ink`.

Event quality is exclusive: GOAT wins over Really Hot, which wins over Regular. Time quality (Outstanding/Standard/Unclassified/Unusable) is a different classification. Metallic rating and task medals are separate scales. Shared hues do not make their data interchangeable.

Use static box-shadow, text-shadow, or drop-shadow for event highlights. Do not add looping shimmer, pulse, or glow animations for quality. Respect reduced-motion preferences for existing interactive effects.

Generic success, warning, danger, and info status colors remain the selected theme's Bootstrap colors. Role badges use dedicated role variants, not success/info aliases. Surface, border, text, accent, and radius tokens use the `--app-` prefix and follow the selected application theme. Pills may remain round; ordinary controls/cards/panels follow the theme radius scale.

Activity time means the union of classified marker ranges; activity categories may overlap and their percentages may total more than 100%. A quality split is a partition. Zero records are not Unknown; unassessed content must not be treated as assessed. Use Vato/Vatos and Movie/Movies in English copy, Mamando Rifle for oral activity, No Tier for rated content below Bronze, and the app locale for dates/numbers/countries.
