# Plan - Fix non-existent column `full_name` in product reviews

The user is reporting the error `column profiles_1.full_name does not exist`. My investigation confirms that the `profiles` table does NOT have a `full_name` column; it uses `display_name` and `username`. 

While `src/lib/product-reviews.functions.ts` was partially updated in the previous turn, the error message `profiles_1.full_name` often occurs when PostgREST (Supabase) generates an internal alias (like `profiles_1`) during a joined query where it still thinks it needs to fetch a column that doesn't exist. This usually happens if the `.select()` string is not perfectly aligned with the actual schema or if there's a cached schema mismatch.

## Proposed Changes

### Server Functions
- I will re-examine `src/lib/product-reviews.functions.ts` and ensure the `.select()` call is absolutely clean. I will also check if any other server functions are joining `profiles` and requesting `full_name`.
- I will check `src/lib/circles.functions.ts` which uses `meta.full_name` from `user_metadata` and ensure it's not accidentally causing a schema error if used in a table join somewhere else.

### Codebase Cleanup
- I will search for any other instances where `profiles` is joined (e.g., `profiles(...)` in a select string) to ensure `full_name` is not being requested.

## Verification Plan

### Automated Verification
- I will run a Playwright script to navigate to a product page and trigger the `getProductRating` server function call. I will monitor the browser console and network responses for the `500` error containing `profiles_1.full_name`.
- I will also attempt to post a review to verify the `rateProduct` function (which calls `summarize`) works end-to-end.

### Manual Verification
- View the screenshots from the Playwright run to ensure the "Customer Reviews" section renders correctly with names and avatars.
