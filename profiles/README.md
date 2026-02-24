# Prospect Profiles

Each JSON file in this directory represents a prospect demo setup. Profiles capture everything needed to recreate or hand off a demo to another SE.

## What's in a profile

| Section | Purpose |
|---------|---------|
| `prospect` | Company name, website, industry, market |
| `sales` | MEDDPICC stage, assigned SE, notes |
| `harvest` | Config file path, adapter used, harvest stats |
| `contentful` | Space ID, entries/assets created |
| `branding` | Extracted design tokens (colors, fonts, logo) |
| `pageSections` | Manual notes on page structure for content creation |
| `nextSteps` | What remains to be done for the demo |

## Creating a new profile

1. Copy an existing profile as a template:
   ```bash
   cp profiles/harvey-norman.json profiles/acme-corp.json
   ```

2. Update the prospect info, create a harvest config, and run the pipeline

3. The profile is your "save file" — revisit it to pick up where you left off or share with a teammate

## Sharing with another SE

To hand off a demo:
1. Share the profile JSON + harvest config
2. They clone the repo, copy your `.env.local` (or create their own with the same space)
3. Run `npm run cli -- load` to recreate the content if starting fresh
