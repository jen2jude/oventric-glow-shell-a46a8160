# Plan - Search System Unification

The user wants to unify the search experience between the "Hub" page (HomeHub) and the "Feed" page, ensuring the search is global and "fetches everything" just like it does in the Hub.

## Context
- **Hub Page (`src/components/oventric/HomeHub.tsx`)**: Uses a header search trigger that opens a `GlobalSearch` overlay (via `Header.tsx`).
- **Feed Page (`src/components/oventric/Feed.tsx`)**: Currently has its own `FeedSearchBar` and `FeedGlobalResults` logic, which was recently updated to include an "Explore" hub with tabs (People, Posts, Products, Topics).
- **Global Search (`src/components/oventric/GlobalSearch.tsx`)**: A component that searches across peers, bounties, and products using `searchGlobal` server function.
- **Feed Search (`src/components/oventric/feed/FeedSearch.tsx`)**: A more specialized search for the feed that also uses `searchGlobal` but renders it within the feed's tabbed "Explore" UI.

## Proposed Changes

### 1. Unify the Search UI in Feed
- The Feed page's "Discover" tab already has a search bar that triggers the "Explore" view.
- The user specifically mentioned the "search system used in the hub page". In the Hub, clicking the search icon opens a high-fidelity overlay.
- We will ensure that the search triggered from the Feed's header (via `FeedAppChrome`) and the search bar within the "Discover" tab both lead to the same high-fidelity global search experience.
- The "Explore" hub (`FeedDiscoverExplore`) already uses `ExploreHeader` and `FeedGlobalResults`. We will verify these results "fetch everything" (Peers, Posts, Products, Bounties, Topics/Circles).

### 2. Update `FeedGlobalResults` to be truly "Global"
- Currently, `FeedGlobalResults` in `FeedSearch.tsx` handles People, Products, and mentions Posts/Topics.
- We will ensure it includes all categories: Peers, Products, Bounties, Circles (Topics), and Posts.
- We will make sure the `searchGlobal` function or the UI handling it pulls in all these data types.

### 3. Sync Header Search in Feed
- In `Feed.tsx`, when `searchOpen` is true, it renders `FeedSearchBar` and `FeedGlobalResults`.
- We will ensure this overlay is consistent with the Hub's global search feel but tailored for the Feed's new "Explore" hub structure if that's what the user prefers (based on their previous request to mirror the "Explore" design).

## Technical Steps
1. **Modify `src/components/oventric/feed/FeedSearch.tsx`**:
    - Update `FeedGlobalResults` to display Bounties and Topics (Circles) consistently with the "Explore" design.
    - Ensure the "Posts" tab actually shows search results (currently it just says "will appear here").
2. **Modify `src/components/oventric/Feed.tsx`**:
    - Ensure the search overlay triggered from the header uses the full global search capabilities.
3. **Verify `src/lib/search.functions.ts`**:
    - Check if `searchGlobal` returns all necessary entities. If not, expand it.

## Verification
- Open the Feed page.
- Click the search icon in the header.
- Type a query.
- Verify that results for People, Posts, Products, and Topics/Bounties appear.
- Repeat the same from the "Discover" tab search bar.
