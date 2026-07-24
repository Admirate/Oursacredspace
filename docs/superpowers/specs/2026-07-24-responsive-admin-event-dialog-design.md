# Responsive Admin Event Dialog Design

## Goal

Make the Add/Edit Event dialog usable at mobile, tablet, laptop, and large desktop viewport sizes. Every field and action must remain reachable without the dialog extending beyond the visible viewport.

## Scope

This change affects only the admin Events dialog in `src/app/oss-ctrl-9x7k2m/events/page.tsx`. It does not change event data, validation, API requests, image-upload behavior, or the shared Dialog component used elsewhere.

## Responsive behavior

### Mobile

- The dialog fills the viewport using dynamic viewport height (`100dvh`).
- It has no outer margin, border radius, or centered-modal transform treatment.
- The title area remains at the top, the form actions remain at the bottom, and only the field area scrolls.
- All paired field groups become a single column so labels, inputs, validation messages, and helper text have sufficient width.
- The layout respects safe-area insets where supported so controls are not obscured by device UI.

### Tablet and desktop

- From the existing `sm` breakpoint upward, the dialog returns to a centered modal.
- The modal keeps the current maximum width and is capped at `90dvh`.
- Paired date/time and pricing/capacity fields use two columns.
- The field area scrolls when content is taller than the available modal space; the title and action buttons remain visible.

## Component structure

The existing Radix dialog and React Hook Form instance remain the single implementation for every viewport.

The dialog uses three vertical regions:

1. A non-scrolling `DialogHeader`.
2. A flexible, scrollable field region inside the form.
3. A non-scrolling action row containing Cancel and Create/Update Event.

The form becomes a constrained flex column so the middle region can use `overflow-y-auto` without making the whole page scroll. Existing form fields move into the scrollable region but retain their names, controls, messages, and event handlers.

## Accessibility and interaction

- The dialog continues to use Radix focus management, Escape-to-close behavior, overlay interaction, and accessible title/description associations.
- The close control, header, and action buttons stay reachable while scrolling long forms.
- Focused inputs must scroll into view naturally, including when the mobile software keyboard reduces available space.
- Existing button labels and loading state remain unchanged.

## Verification

- Run the project type/build validation used by the repository.
- Verify the dialog at representative mobile, tablet, and desktop viewport sizes.
- Confirm that the first and last fields are reachable, paired groups stack only on mobile, and the action buttons remain visible.
- Confirm both Add Event and Edit Event use the same responsive behavior.
- Confirm date popovers, image upload controls, validation messages, Cancel, and Create/Update continue to work.

## Non-goals

- Redesigning the dashboard, event table, or shared dialog system.
- Changing visual branding, copy, field order, validation rules, or event functionality.
- Creating separate mobile and desktop form components.
