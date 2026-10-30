# Assistant Hub (one helper for all Darren's apps)

## Where we are
- Current step: Brain Dump done → Step 1 (Idea), first draft below, not grilled yet
- Last session: 30 Oct 2026, idea talked through in chat
- Next action: Darren picks: plain doors first or MCP from day one; then grill Step 1

## Principles / constraints
- Cheap: the Claude API is the fallback, not the main path
- Fast: the local part must answer in milliseconds
- Darren's own apps only, one user, no login sharing
- Learns over time: logs → retrain → fewer API calls

## 1. Idea (draft)
- Who: Darren only
- Problem: 4 separate apps, each needs opening and tapping. Darren wants to type (or snap) one thing and have it
  land in the right app.
- Destination: one box. "Just spent 5.10 at Tesco" → WMM spend. Photo of the fridge → Fridge Tracker.
  "Dentist Tuesday 3pm" → Calendar. "Buy bin bags" → To-do.
- Apps linked: Where's My Money (WMM), Fridge Tracker, Calendar, To-do (not built yet, Darren's own)
- Success looks like: most messages are handled locally for free; the API is used rarely and less each month
- Assumptions: each app can take an action from outside (an API / MCP "door"); short messages, not chat
- Missing info: where the hub lives (new app or inside WMM first?); are the apps all on PythonAnywhere?
- In scope: understand → pick app → pull out details → do it → log it → retrain
- Out of scope: a general chatbot; running a big AI locally

## Shape (Darren, 30 Oct): assistant → kitchen → ingredients
- **Assistant** = the front: one box, it understands
- **Kitchen** = the hub behind it: passes jobs to plug-ins, logs, retrains
- **Ingredients** = one plug-in per app (WMM, Fridge, Calendar, To-do). Add, remove or upgrade one without touching
  the rest

## Stages (Darren, 30 Oct): simple first
- **Stage 1:** router weights: which app is this for? (spend / fridge / calendar / to-do)
- **Stage 2:** one small model per app for its details (spend: amount + shop; calendar: day + time; ...)

## 2. Steps (rough, from the brain dump, not grilled yet)
1. **Doors:** each app gets a small "do this" door (API endpoints, later MCP)
2. **Student model:** a tiny local model picks the app from key words + context (trained on example sentences
   Claude writes)
3. **Detail rules:** pull out exact bits (£5.10, Tesco, Tuesday 3pm) with rules
4. **Teacher fallback:** model not sure (low confidence) or a photo → ask the Claude API
5. **Log:** every request: text, the model's guess + confidence, Claude's answer, what was done
6. **Retrain:** now and then, retrain the student on the log so it asks Claude less
7. **Hub screen:** one box (and photo button) that shows what it did + Undo

## 3. Choose & Prove (not started)
Ideas so far (not decisions):
- Student: small text classifier (e.g. scikit-learn), about 1 ms per message, retrain in seconds
- Teacher: Claude Haiku, around £0.001 per message
- Photos: need the API (vision); the tiny model can't read images

## 4. Fine Detail (not started)

## Decisions
| # | Decision | Why | Date |
|---|----------|-----|------|
| 1 | Mix of rules + tiny model + Claude API fallback | free and fast for everyday, smart when unsure | 30 Oct 2026 |
| 2 | Log everything and retrain (teacher → student) | gets cheaper and smarter over time | 30 Oct 2026 |
| 3 | Assistant → kitchen → ingredients (plug-in per app) | add / remove / upgrade apps easily | 30 Oct 2026 |
| 4 | Stage 1 = router only; Stage 2 = per-app detail models | simple first | 30 Oct 2026 |

## Parked (this version, not now)
- MCP doors (start with simple web endpoints; MCP can sit on top later)

## Research
- Can PythonAnywhere free run scikit-learn? (expected yes)
- Haiku vision cost per fridge photo

## Prototypes / tests
- Idea: tiny test on WMM /demo: type "spent 5.10 at tesco" → spend added

## Risks
- Wrong guess does the wrong thing → always show what it did + Undo
- Privacy: messages sent to the API hold spending info → only send when needed

## Later / V2
- Voice input
- Helper asks back ("Which card?")

## PRD

## Tickets

## Build / test progress

## Change log
- 30 Oct 2026: Project file created from the chat brain dump
- 30 Oct 2026: shape (assistant/kitchen/ingredients) + 2 stages agreed
