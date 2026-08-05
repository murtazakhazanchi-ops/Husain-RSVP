# Production Release Changelog

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
  - Renamed ambiguous dashboard statistics and filters to distinguish attendee totals from RSVP response counts.
  - Updated the Attendance chart title to "Accepted vs Declined RSVPs".
  - Removes input placeholders.
  - Renames guest export print action to Print.
  - Simplifies Venue tab fields to Publish Venue, Venue Name, Address, Google Maps URL, Latitude, Longitude, Arrival Notes, and Public RSVP Webpage URL.
  - Adds Live Preview coordinate output.
  - Renames reset and close controls for the final SVG-icon-only interface.

- `dashboard.css`
  - Improves dashboard touch target sizing, close button SVG styling, preview text wrapping, and mobile containment.
  - Adds supporting styles for explicit guest metadata and venue coordinate preview.

- `dashboard.js`
  - Renamed summary cards to Total Attending, Accepted RSVPs, Declined RSVPs, and RSVP Responses.
  - Updated Attendance chart legend labels to Accepted RSVPs and Declined RSVPs.
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
