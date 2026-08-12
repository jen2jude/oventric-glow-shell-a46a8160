# Plan: Redesign Course Publish Wizard

Redesign `CoursePublishWizard.tsx` to align with the Oventric premium app-like aesthetic, standardizing on the crimson theme and refined dark-mode UI.

## User Review Required

> [!IMPORTANT]
> The emerald/green theme will be replaced with Oventric Crimson (#E5484D) for all progress indicators, buttons, and active states.

## Proposed Changes

### UI & Aesthetics
- Update background colors to Oventric deep black (`#0A0A0B`) and dark grey (`#141416`).
- Swap all emerald-500/400 accents with crimson (`#E5484D`).
- Standardize all `rounded` utilities to `rounded-[10px]` or `rounded-2xl` for the modal container.
- Refine the step indicator to be more minimal and modern.

### Form Layout
- **Header**: Center the title and optimize for mobile "app-shell" views.
- **Basics Step**: Clean up the cover upload area with a more premium glassmorphic preview.
- **Curriculum**: Improve the lesson/section drag-and-drop handles and item spacing.
- **Settings**: Modernize toggle switches and price input fields.

### Mobile Optimization
- Ensure sticky footers use the ecosystem's glass effect.
- Maintain large touch targets (min 44px) for all interactive elements.

## Technical Details
- Modify `src/components/oventric/CoursePublishWizard.tsx`.
- Replace `bg-emerald-500`, `text-emerald-500`, etc., with `bg-[#E5484D]` and `text-[#E5484D]`.
- Update the modal structure to use the standard `modal-light` (or equivalent dark-standard) styles from the marketplace components.
- Verify `isAppShell` logic remains intact for mobile native-like feel.
