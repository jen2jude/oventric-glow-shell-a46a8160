# Plan - Fix non-existent column `full_name` in product reviews

The user is reporting an error: `column profiles_1.full_name does not exist`. This typically happens when a PostgREST query (via Supabase) tries to select a column that isn't in the database schema.

In the previous turn, the agent partially fixed this in `src/lib/product-reviews.functions.ts` by changing `full_name` to `display_name` and `username`. However, the error message `profiles_1.full_name` suggests there might be a cached query or another location still trying to access `full_name` via an alias or join.

## Proposed Changes

### Database & Schema
- I will verify the `profiles` table schema via `supabase--read_query` to confirm `full_name` is indeed missing.
- I will check if there are any remaining references to `full_name` in the codebase.

### Server Functions
- Update `src/lib/product-reviews.functions.ts` to ensure the `.select()` call is perfectly aligned with the actual schema columns found in the database.
- Check `src/lib/circles.functions.ts` which also references `full_name` (though from `user_metadata`).

## Verification Plan

### Automated Tests
- Run the `summarize` logic (or the `getProductRating` function) using a script to ensure the Supabase query no longer throws the "column does not exist" error.

### Manual Verification
- Use `preview_ui` (or `code--execute_preview_javascript`) to trigger a product review fetch and confirm it renders without console errors.
