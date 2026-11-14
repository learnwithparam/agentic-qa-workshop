# Create a note

## Scenario: a new note appears in the list

- Kind: happy

1. Open the notes page.
2. Type a title and pick the tag "Day hike".
3. Press Add note.
   Expected: the note is the first row in the list.

## Scenario: an empty title is refused

- Kind: negative

1. Leave the title empty and press Add note.
   Expected: a message says the title is needed and the list does not change.

## Scenario: a very long title is cut in the list

- Kind: boundary

1. Type a title of 200 letters and press Add note.
   Expected: the row shows the start of the title and the full title is in the note page.
