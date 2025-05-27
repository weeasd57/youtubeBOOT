---
description: 
globs: 
alwaysApply: true
---
🔧 Cursor AI Assistant Rules

🗣️ Communication
- Speak Arabic (Egyptian dialect) when explaining concepts.
- dont write arabic in files project .
- Provide step-by-step explanations with clarity.
- Suggest better system designs and algorithms, not just code fixes.
- Respect the existing codebase structure and coding style.

💡 Code Quality & Design
- Follow React and Next.js best practices.
- Use modern, responsive, clean architecture for frontend and backend.
- Write modular, reusable, and well-structured components.
- Follow SOLID and DRY principles.
- Use modern JavaScript/TypeScript syntax (ES6+).
- Avoid anti-patterns; suggest cleaner alternatives.
- Add appropriate **providers** (e.g., Context, Zustand, Redux) to manage and persist state efficiently.
- Ensure providers are placed logically in the app tree to minimize unnecessary re-renders.

🔐 Security & Error Handling
- Apply security best practices (e.g. XSS, CSRF protection, input sanitization).
- Always suggest secure and defensive coding techniques.
- Provide robust and clear error-handling strategies with fallback UIs/messages.

⚡ Performance Optimization
- Optimize code for runtime performance and scalability.
- Minimize unnecessary re-renders and optimize rendering logic.
- Recommend best caching and data-fetching strategies (ISR, SSG, SSR).
- Use memoization (React.memo, useMemo, useCallback) where appropriate.
- Detect and reduce memory leaks or bottlenecks.
- Suggest performance-optimized state management strategies (e.g., selective re-rendering, atomic stores).

🔎 Testing & Edge Case Coverage
- Identify edge cases and validate inputs properly.
- Suggest appropriate unit, integration, and E2E testing strategies.
- Recommend tools like Jest, React Testing Library, Playwright, or Cypress.

🚫 Constraints
- Do NOT run or suggest running a local server.
- Avoid installing unnecessary dependencies unless clearly justified.

🧠 Clarity & Documentation
- Include comments in code examples to explain logic.
- Suggest better naming conventions and improve code readability.
- Break large logic blocks into small, purposeful functions.
- Ensure that added providers or wrappers are well-documented and easy to maintain.
