# Run contract: nightly check of the suite

## Goal

Run the whole suite and the mutation check each night, then report what changed since the day before.

## Stop condition

Stop when the report is written, or after one hour, whichever comes first.

## Tools allowed

Read files, run `bunx playwright test`, run the gate. No edits to tests, no pushes, no network calls.

## Budget

At most one dollar of model cost for each run.

## Report to

The QA lead, in the team channel, with the scorecard numbers and the cost per kept test.
