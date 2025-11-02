# Modularity Analysis & Improvement Plan

## Current Structure ✅

The project has a **good foundation** with clear separation:

```
src/
├── components/     ✅ 15 components (well organized)
├── hooks/          ✅ 2 custom hooks
├── services/       ✅ 1 API client
├── types/          ⚠️  All types + utilities in one file
└── App.tsx         ✅ Clean entry point
```

## Issues Identified ⚠️

### 1. **Types File is Monolithic**
`types/models.ts` contains:
- All enum definitions
- All interface definitions  
- All utility functions (formatDuration, formatTimeAgo, etc.)
- **175+ lines in one file**

### 2. **Constants Scattered**
- Poll intervals in `useDashboard.ts`
- Magic numbers throughout components
- No centralized constants file

### 3. **Parser Functions Mixed with Client**
- `parsePhase()`, `parseJobState()`, `parseWorkerState()` in `coordinatorClient.ts`
- Should be in separate `utils/parsers.ts`

### 4. **No Utils Module**
- Utility functions mixed with types
- No dedicated utils folder

## Proposed Modular Structure

```
src/
├── components/          ✅ Keep as-is
├── hooks/               ✅ Keep as-is
├── services/
│   └── coordinatorClient.ts  ✅ Keep as-is
├── types/
│   ├── enums.ts        ✨ Extract enums
│   ├── models.ts       ✨ Keep only interfaces
│   └── index.ts         ✨ Re-export barrel
├── utils/               ✨ NEW
│   ├── formatters.ts    ✨ formatDuration, formatTimeAgo
│   ├── parsers.ts       ✨ parsePhase, parseJobState, etc.
│   ├── validators.ts    ✨ Worker health checks
│   └── constants.ts     ✨ Poll intervals, max values
└── App.tsx
```

## Benefits

1. **Better Code Organization** - Single Responsibility Principle
2. **Easier Testing** - Utils can be tested independently
3. **Better Tree-shaking** - Import only what you need
4. **Easier Maintenance** - Find things faster
5. **Type Safety** - Still maintained with TypeScript

## Implementation Plan

1. Extract enums to `types/enums.ts`
2. Extract utilities to `utils/formatters.ts`
3. Extract parsers to `utils/parsers.ts`
4. Extract constants to `utils/constants.ts`
5. Create barrel exports in `types/index.ts` and `utils/index.ts`
6. Update all imports

Would you like me to refactor the codebase to this modular structure?


