# Explore Hub Revamp Plan

Revamp the Oventric Feed search results and discover view to mirror the high-fidelity "Explore" mobile UI design. This includes a dedicated "Explore" header with tabbed navigation (People, Posts, Products, Topics) and a premium list view for people results.

## Proposed Changes

### 1. New Components
- **`src/components/oventric/feed/ExploreHeader.tsx`**: A new sticky header for the Explore/Search view with a crimson underlined tab system (People, Posts, Products, Topics).
- **`src/components/oventric/feed/PeopleExploreList.tsx`**: A dedicated component to render the high-fidelity list of people, matching the reference image's layout (circular avatar, name, @username, description, and crimson 'Follow' button).

### 2. UI Refinements in Feed Search
- **`src/components/oventric/feed/FeedSearch.tsx`**:
    - Update `FeedSearchBar` to allow hiding the default tab rail when the new `ExploreHeader` is active.
    - Refactor `FeedGlobalResults` to use the new `PeopleExploreList` for people search results.
    - Apply the dark premium theme (#0A0A0B) to match the reference image.

### 3. Feed Integration
- **`src/components/oventric/Feed.tsx`**:
    - Update the search view logic to incorporate the `ExploreHeader`.
    - Ensure a smooth transition between the "Discover" exploration view and the active search "Explore" view.

## Visual Blueprint (from user image)
- **Header**: Large "Explore" title with crimson-accented tabs.
- **Background**: Pure dark/black theme (#0A0A0B).
- **People List**: 
    - Avatar with subtle ring/border.
    - Professional/creator description below name.
    - High-contrast crimson "Follow" button.
    - Clean hairlines between list items.

## Success Criteria
- The Explore view exactly matches the design, arrangement, and colors of the provided reference image.
- Search results for "People" use the new high-fidelity card layout.
- Navigation between Explore tabs is seamless and follows the existing app-like feel.
