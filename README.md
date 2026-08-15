# Oventric Core UI

Build the foundational UI/UX shell for a premium, multi-vendor tech platform named "Oventric". The application must be fully responsive (Desktop and Mobile-first) and strictly adhere to a high-fidelity dark mode aesthetic. Use React, Tailwind CSS, and Lucide React icons.



### 1. Color Palette & Global CSS Requirements

*   **Main Canvas Background:** Deep charcoal (`bg-[#121214]`).

*   **Surface/Panel Containers:** Sleek dark gray (`bg-[#1E1E24]`).

*   **Text Colors:** Clean slate for body, stark white for headings.

*   **Primary Action Accent:** Vivid neon emerald green (`#10B981`).

*   **Custom Animation Requirement:** Add a custom CSS keyframe animation called `rgb-neon-chase` that cycles through a vibrant spectrum of colors (red, orange, yellow, green, blue, purple) and applies it as a glowing box-shadow or border-color. Add a secondary animation called `rgb-pulse` for a breathing glow effect.



### 2. Layout Architecture

*   **Desktop View:** Create a layout with a fixed, collapsible left sidebar and a top universal header. The main content area should take up the remaining space. Ensure a continuous, 1px animated `rgb-neon-chase` border runs along the absolute outer edge of the main viewport frame.

*   **Mobile View:** Hide the left sidebar. Instead, implement a sticky bottom navigation bar permanently pinned to the bottom. Use a strict, zero-bounce viewport container (`h-screen overflow-hidden`). Ensure the `rgb-neon-chase` border animates across the very top and bottom edges of the screen.



### 3. Top Universal Header (Omniscient Control)

*   **Components:** A text logo "OVENTRIC" (font-bold, emerald accent), a global search input bar with smooth focus states, a Notification Bell icon, a Chat/DM icon, and a User Profile Avatar.

*   **Living Matrix Animations:** Apply the `rgb-pulse` animation to the Notification Bell and User Profile Avatar so they subtly breathe with a neon glow every few seconds, indicating active states.



### 4. Navigation (Sidebar on PC / Bottom Bar on Mobile)

*   **Icons (Lucide):** Feed (Home), Marketplace (ShoppingBag), Academy (GraduationCap), Bounties (Target), and Wallet (Wallet).

*   **The Universal "+" Button:** Place this in the center of the Mobile bottom bar and prominently in the Desktop sidebar. It must be an oversized, circular button containing a "+" icon, backed by a persistent, glowing `rgb-neon-chase` background. 

*   **Action:** Clicking the "+" button should trigger a smooth, animated slide-up panel containing 4 choice cards: "Drop a Post", "Post a Bounty ($)", "Sell an Asset", and "Add Blog Article".



### 5. Main Workspace Canvas (Feed Route Placeholder)

*   Render a scrolling feed column in the center.

*   **Input Container:** A panel at the top reading: "What are you creating today? Seeking Technical Help?" with an "Attach" icon and a "Post" button.

*   **Dummy Social Post:** A standard user post card with avatar, name, time, text content, and Like/Comment/Share buttons.

*   **Injected Ad Placeholder (Tier 2):** A distinct panel representing a sponsored Native Ad. Include a brand header, a dummy image banner (use a generic placeholder block), body text, and an emerald CTA button reading "Learn More".

*   **Injected Bounty Card:** A glowing panel featuring an emerald badge "[ACTIVE BOUNTY: $450 USD]", a title "Need a clean custom user-roles matrix built for a Supabase backend", applicant stats, and an emerald "Solve & Earn" button.



Ensure all card components have sharp, structural corners with a subtle border (`border-white/10`) and sit cleanly on the `#121214` background. Do not use any external image dependencies; build purely with Tailwind, CSS 

animations, and Lucide icons.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://oventric-glow-shell.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/edfe3718-716a-4c70-9e5e-216fbc715fe1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
