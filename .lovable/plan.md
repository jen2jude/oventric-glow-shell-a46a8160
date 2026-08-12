# Redesign Bounties & Escrow Page

Redesign the Bounties & Escrow page, editor, and details to align with the Oventric premium deep black (#0A0A0B) and crimson (#E5484D) theme, consistent with the Academy and Marketplace redesigns.

## Proposed Changes

### UI & UX Standardizations
- Update all accent colors from emerald to crimson (#E5484D).
- Standardize all backgrounds to deep black (#0A0A0B) or elevated dark (#0F0F10 / #141416).
- Apply rounded-[10px] to buttons, inputs, and cards where missing.
- Refine typography to use heavy weights for headings and clean tracking for labels.

### Bounties Main Board (src/components/oventric/Bounties.tsx)
- Swap emerald-500 for #E5484D in hero badges, buttons, and filters.
- Update the Total Locked metric card to use a crimson border/text theme.
- Theme the skeleton loaders and empty state illustrations.

### Bounty Editor (src/components/oventric/BountyEditorModal.tsx)
- Redesign the Publish Bounty flow to match the CoursePublishWizard style.
- Use glassmorphism for image upload areas.
- Update the publishedSplash (BountyPublishedSplash) to use crimson/purple gradients instead of blue/emerald.

### Bounty Details & Proposals (src/components/oventric/BountyDetail.tsx)
- Standardize the Apply section with crimson accents.
- Update status pills (Accepted, Pending, Rejected) to use the Oventric color palette.
- Refine the chat/contract workspace with sleek dark theme inputs and message bubbles.

## Technical Details
- Change Tailwind classes from bg-emerald-500 to bg-[#E5484D].
- Ensure ShieldAlert, Target, and Wallet icons use crimson highlights.
- Update BountyPublishedSplash radial gradients to #E5484D based tones.
