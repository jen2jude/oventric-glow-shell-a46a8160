# Plan: Fix Academy Course Loading Issue

The user reported that clicking on any course in the Academy results in a "something went wrong on our end" error (likely a toast or an error state).

## Diagnosis
Based on the code analysis:
1.  **Component**: `src/components/oventric/Academy.tsx` renders `CourseDetail` when a course is selected.
2.  **Logic**: `CourseDetail` calls `getCourse` (a server function in `src/lib/academy.functions.ts`) inside a `useEffect`.
3.  **Error Handling**: If `getCourse` fails, it catches the error and displays `toast.error(e.message)`. This matches the user's description of an error message.
4.  **Potential Root Causes**:
    *   **Invalid Input**: `getCourse` expects `{ id: string }`.
    *   **Server Logic Errors**:
        *   `signCovers` or `signCourseMedia` might fail if bucket names are wrong or bucket is private (though `supabaseAdmin` is used for covers).
        *   Database query failure (missing table, column, or RLS).
        *   Invalid JSON parsing in `getCourse` for `content_data`.
    *   **RLS/Permissions**: The user might be clicking a course that they don't have access to, or the server function is failing to fetch modules due to RLS.

## Proposed Steps

### 1. Verification & Logging
*   Add detailed logging to `getCourse` in `src/lib/academy.functions.ts` to identify exactly which step is failing (database query, media signing, etc.).
*   Check if `course_modules` or `courses` table has any issues.

### 2. Implementation Fixes
*   **Media Signing**: Ensure `signCovers` and `signCourseMedia` handle empty/null paths gracefully and use the correct clients.
*   **Database Query**: Verify the `COURSE_COLS` and module columns match the schema.
*   **Error Handling**: Improve the error message in the frontend to be more descriptive if possible, or fix the underlying server error.

### 3. Validation
*   Test clicking a course in the preview.
*   Monitor server logs if possible (via `stack_modern--server-function-logs` if available).

## Plan
1.  [X] Inspect `Academy.tsx` and `academy.functions.ts`.
2.  [ ] Add logging to `getCourse` in `src/lib/academy.functions.ts`.
3.  [ ] Identify the failing line/query.
4.  [ ] Fix the bug (likely a missing column, RLS issue, or media signing failure).
5.  [ ] Verify the fix.
