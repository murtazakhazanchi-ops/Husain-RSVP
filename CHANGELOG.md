# Production Release Changelog

## Personalized Invitation Management

Modified files:

- `AppsScript-Code.gs`
  - Added a non-destructive `Invitations` sheet with token, allocation, response, status, and timestamp fields.
  - Added public token lookup for a single invitation without exposing dashboard credentials or the full invitation list.
  - Added admin create/update invitation operations using the existing dashboard authentication key.
  - Added server-side personalized RSVP validation so adult and child attendance cannot exceed the stored allocation.
  - Added invitation response syncing so revisiting a personal RSVP updates the existing RSVP record instead of double-counting.
  - Added invitation-specific overview statistics while preserving existing RSVP response calculations.

- `script.js`
  - Added `?invite=<TOKEN>` personalized mode for the existing RSVP artwork form.
  - Prefills guest name, mobile number, adults, children, existing attendance, and child ages when a token is verified.
  - Restricts adult and child dropdown options to the invitation allocation only in personalized mode.
  - Keeps invalid personal links disabled with a host-contact message instead of falling back to unrestricted RSVP entry.

- `dashboard.html`
  - Added Add Invitation controls inside the existing Guests area.
  - Added an invitation status filter and invitation list container.
  - Added the invitation create/edit dialog.

- `dashboard.css`
  - Added responsive styles for invitation cards, invitation dialog totals, and the expanded overview metric grid.
  - Preserved the existing dashboard visual language, touch targets, and horizontal overflow containment.

- `dashboard.js`
  - Added dashboard invitation creation, editing, status filtering, link copying, and WhatsApp sharing.
  - Added personalized invitation URL generation from the saved Public RSVP Webpage URL.
  - Added invitation allocation statistics to Overview without mixing invited headcount into attendee totals.

## Captain Husain RSVP Final Release

Modified files:

- `index.html`
  - Replaced the HTML-generated Captain's Notice with the official `location card.png` artwork section.
  - Added absolute-positioned overlay fields for venue name, date, time, address, and navigational coordinates.
  - Added one transparent clickable layer over the printed Get Directions button.

- `style.css`
  - Refined Captain's Notice overlay alignment for venue name, date, address, coordinates, and Get Directions hit area.
  - Improved address wrapping, date hierarchy, mobile sizing, section spacing, and reduced-motion behavior.
  - Removed styling for the previous HTML-generated venue card.
  - Added proportional `1147 / 1372` artwork layout for `location card.png`.
  - Added responsive percentage-based text and button overlay positioning.
  - Preserved fade-in animation, safe-area support, touch behavior, and horizontal overflow containment.

- `script.js`
  - Added one-time Captain's Notice visible state for the entrance animation.
  - Improved venue date rendering with separate visual hierarchy for weekday and date.
  - Disabled the Google Maps overlay link safely when no Maps URL is configured.
  - Lazy-loads `location card.png` only after the venue is announced.
  - Supports `publishVenue` while retaining `venueAnnounced` compatibility.
  - Renders venue name, date, time, address, and compact two-line DMS coordinates on top of the official artwork.
  - Opens the saved Google Maps URL from the transparent printed-button hit layer and disables it when no URL exists.
  - Updates the confirmation message to the final production copy.

- `location card.png`
  - Added as the official Captain's Notice artwork template used by the public RSVP page.

- `dashboard.html`
  - Shortens the Attendance chart title to "Accepted vs Declined" for final overview balance.
  - Adds chart summary hooks for the Attendance and Guest Mix doughnut cards.
  - Renamed ambiguous dashboard statistics and filters to distinguish attendee totals from RSVP response counts.
  - Updates the Attendance chart title wording for clear RSVP status comparison.
  - Removes input placeholders.
  - Renames guest export print action to Print.
  - Simplifies Venue tab fields to Publish Venue, Venue Name, Address, Google Maps URL, Latitude, Longitude, Arrival Notes, and Public RSVP Webpage URL.
  - Adds Live Preview coordinate output.
  - Renames reset and close controls for the final SVG-icon-only interface.

- `dashboard.css`
  - Refines final overview rhythm with smaller matched doughnuts, larger summary text, and consistent statistic card typography.
  - Polishes doughnut chart center typography, title wrapping, card balance, and summary spacing.
  - Improves dashboard touch target sizing, close button SVG styling, preview text wrapping, and mobile containment.
  - Adds supporting styles for explicit guest metadata and venue coordinate preview.

- `dashboard.js`
  - Increases doughnut legend separation and preserves chart values while refining summary separators.
  - Simplifies Attendance chart legend labels to Accepted and Declined while preserving existing calculations.
  - Aligns Attendance and Guest Mix center text hierarchy and adds dynamic summary lines.
  - Renamed summary cards to Total Attending, Accepted RSVPs, Declined RSVPs, and RSVP Responses.
  - Updated Attendance chart legend labels to Accepted and Declined.
  - Replaced percentage-based Attendance chart center text with the accepted RSVP count.
  - Updated event status values to show Published/Pending venue state, "Sent X of Y" venue messages, and explicit RSVP terminology.
  - Updated recent RSVP and guest status badges to use Accepted RSVP / Declined RSVP language.
  - Saves and previews `publishVenue`, latitude, longitude, and Public RSVP URL.
  - Generates QR codes from the Public RSVP URL automatically.
  - Validates missing Public RSVP URL and required publish-ready venue details.
  - Renames guest WhatsApp action to Venue Message.
  - Updates message counters to Pending, Sent, and Total.
  - Uses saved maps URL or coordinates in venue messages.

- `AppsScript-Code.gs`
  - Adds backend config support for `publishVenue`, `latitude`, `longitude`, and `publicRsvpUrl`.
  - Preserves backwards compatibility with `venueAnnounced`.
  - Adds coordinate validation before storing Apps Script config.

- `CHANGELOG.md`
  - Added this production release changelog.
