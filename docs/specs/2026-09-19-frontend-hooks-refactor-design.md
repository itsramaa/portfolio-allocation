# Frontend Logic Hook Refactor

## Goal

Move frontend state, side effects, API/storage calls, calculations, and domain event handlers into dedicated hooks under `src/hooks`, while keeping JSX structure, element-level presentation, and purely visual event behavior inside components.

## Boundaries

- Hooks own domain state and behavior for authentication, onboarding, settings, dashboard, injection, rebalance, history, and narratives.
- Components consume hook return values and render elements.
- Components may keep element-local presentation state only when it directly controls an element interaction, such as password visibility or dropdown visibility.
- Existing API contracts, UI behavior, encrypted credential flow, and error handling remain unchanged.
- Existing shared calculation utilities remain in `src/lib` and are called by hooks rather than duplicated in components.

## Implementation sequence

1. Extract state and behavior from the smallest domain components first.
2. Extract settings and authentication behavior without exposing secrets to component state after save.
3. Extract portfolio calculation and data loading behavior from dashboard, injection, rebalance, history, and narratives.
4. Keep `App` responsible only for application composition and routing between tabs.
5. Verify after each group with TypeScript build, lint, and Go tests where backend contracts are involved.
