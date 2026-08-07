# Plan - Fix Academy Enrollment and Progress Loading

The user is reporting that clicking "Resume Learning" or enrolled courses results in a "This page didn't load, something went wrong on our end" error. Previous attempts to harden `getCourse` were made, but the issue persists.

## Investigation Findings

1.  **Client-Side `CourseDetail` Error Handling**: In `Academy.tsx`, the `CourseDetail` component handles the initial load of course and enrollment data. The error toast ("Unable to load course details. Please try again.") is triggered if `fetchCourse` or `fetchEnroll` fails.
2.  **Server-Side `getMyEnrollment`**: This function in `academy.functions.ts` uses `context.userId` and `context.supabase`. If the middleware `requireSupabaseAuth` fails (e.g., token expired or missing in request), it throws a 401. However, the client-side `useEffect` in `CourseDetail` has a `catch` block that might be catching this or a subsequent error.
3.  **Potential "Hydration" or "Auth" Races**: The `userId` is set via `supabase.auth.getUser()` in an effect in `Academy`. `CourseDetail` is rendered when `view === 'course' && selectedId`. If `userId` is not yet available when `CourseDetail` mounts, `fetchEnroll` is skipped initially, but then `userId` changes and triggers the effect again.
4.  **Schema Mismatches**: Although `getCourse` was updated to `select("*")`, `getMyEnrollment` still selects specific columns: `select("id, course_id, created_at, completed_at")`. If `course_enrollments` or `course_progress` has had schema changes, this could fail.
5.  **Data Consistency**: The error message "something went wrong on our end" usually comes from the TanStack `ErrorBoundary` or a caught promise rejection that isn't handled gracefully.

## Proposed Changes

### 1. Hardening `getMyEnrollment` and `listMyEnrollments`
- Update `getMyEnrollment` to `select("*")` to avoid column name issues.
- Wrap the database calls in `getMyEnrollment` and `listMyEnrollments` with more robust error handling and logging.

### 2. Improving `CourseDetail` Resilience
- Ensure `CourseDetail` doesn't crash if `enrollment` fetching fails silently or returns an unexpected error.
- Add more granular logging in the client to identify exactly which server function call is failing.

### 3. Verification
- Use Playwright to simulate an authenticated session and navigate to the Academy page to check if the error occurs.

## Task List

- [ ] Update `src/lib/academy.functions.ts` to use `select("*")` in enrollment functions and add better logging.
- [ ] Update `src/components/oventric/Academy.tsx` to handle enrollment fetching errors more gracefully without breaking the UI.
- [ ] Run a Playwright test to verify the fix.
