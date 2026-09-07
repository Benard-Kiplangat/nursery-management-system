# Application Design Principles Roadmap

This document captures the design improvements recommended for the nursery management application.

## 1. Establish a consistent design system

Centralize the application's:

- Colors
- Spacing scale
- Border radii
- Shadows
- Typography
- Button and input variants

Build on the shared utilities in `src/index.css` with reusable patterns such as:

- `page-header`
- `section-card`
- `form-label`
- `btn-icon`
- `empty-state`
- `loading-state`
- `data-table`

Avoid mixing inconsistent custom styles across pages.

## 2. Improve visual hierarchy

Every page should clearly communicate:

1. Where the user is
2. What they can do
3. What requires attention
4. What the primary action is

The POS page should have a clear title, short subtitle, prominent search field, product results, distinct cart summary, and one obvious checkout action.

## 3. Redesign navigation

The navigation should include:

- Active route styling
- Grouped sections for Sales, Inventory, Customers, and Administration
- Consistent icons paired with labels
- Tooltips for icon-only actions
- A mobile drawer or bottom navigation
- User profile and logout controls together

Do not rely on color alone to indicate the active page.

## 4. Fix mobile constraints

Avoid fixed minimum widths that cause horizontal scrolling on small devices. Ensure:

- Buttons can wrap or stack
- Inputs remain usable
- Tables scroll horizontally when necessary
- Cart actions stay reachable
- Fixed mobile controls do not cover content

## 5. Improve POS efficiency

For the POS workflow:

- Keep product cards compact and scannable
- Make product name and price visually dominant
- Place secondary fields in expandable sections
- Keep quantity and discount controls together
- Make the cart sticky on desktop
- Show subtotal, discount total, and final total
- Use a clear primary action such as `Complete Sale`
- Confirm destructive actions such as clearing the cart

Use progressive disclosure so product cards do not feel like large forms.

## 6. Make feedback and states explicit

Every data-driven component should support:

- Loading state
- Empty state
- Error state
- Success confirmation
- Disabled state
- Offline or synchronization state

Prefer consistent inline messages, dialogs, or toasts over browser `alert()` calls for routine validation.

## 7. Improve accessibility

Ensure:

- Every input has a visible label
- Buttons have descriptive text or an `aria-label`
- Focus states are visible
- Keyboard navigation follows a logical order
- Color contrast meets WCAG AA
- Checkbox labels have a generous click target
- Errors are associated with their inputs
- Modals trap focus and close with Escape
- Icons are not the only way to understand an action

Use a consistent icon system instead of relying on emoji as primary controls.

## 8. Improve forms and validation

For quantity, discount, payment, and customer fields:

- Show valid ranges
- Prevent discounts greater than the subtotal
- Format currency consistently
- Use `inputMode="numeric"` on mobile
- Preserve input while showing validation errors
- Explain why an action is disabled
- Validate before submission

Prefer explicit messages such as:

> Discount cannot exceed Ksh 2,500.

over silently clamping invalid values.

## 9. Improve data presentation

For sales, batches, crops, customers, and purchases:

- Use consistent table headers
- Add sorting and filtering
- Add pagination for large lists
- Use status badges consistently
- Show summary metrics above tables
- Make row actions predictable
- Format dates and currency consistently
- Add empty states with a clear next action

## 10. Use consistent terminology

Choose one term and use it throughout the application:

- `Customer` rather than mixing customer and client
- `Discount` rather than inconsistent discount labels
- `Complete Sale` rather than mixing Quick Sell, Make Sale, and Checkout
- `Available stock` with a clear explanation of readiness and availability

## 11. Improve responsive layout

Recommended POS behavior:

- Desktop: products and sticky cart side-by-side
- Tablet: products first and cart below
- Mobile: product list with a fixed cart summary bar
- Large screens: use more available width instead of overly narrow content columns

## 12. Add visual polish carefully

Useful refinements include:

- Subtle hover and focus transitions
- Consistent card padding
- Stronger section headers
- Aligned currency values
- Product or category color accents
- Clear distinction between editable and read-only values
- Helpful empty-state illustrations
- Consistent iconography

Avoid excessive gradients, shadows, animation, or rounded containers. The interface should feel calm and predictable.

## Recommended implementation order

1. Fix mobile overflow and layout constraints.
2. Standardize navigation and page headers.
3. Create shared form, button, card, and status components.
4. Improve POS hierarchy and sticky cart behavior.
5. Add loading, empty, error, and validation states.
6. Audit accessibility, keyboard navigation, and contrast.
7. Standardize tables, terminology, currency, and dates.
8. Add visual polish after usability issues are resolved.
