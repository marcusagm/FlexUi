# 🧩 Contributing to FlexUI

Thank you for your interest in contributing to **FlexUI**!  
This document outlines the **contribution guidelines**, **coding standards**, and **best practices** that ensure the project remains clean, consistent, and maintainable.

---

## 🧭 Table of Contents

- [🧩 Contributing to FlexUI](#-contributing-to-flexui)
    - [🧭 Table of Contents](#-table-of-contents)
    - [🚀 Project Overview](#-project-overview)
    - [🧰 Getting Started](#-getting-started)
    - [🧾 Code Standards](#-code-standards)
        - [Naming Conventions](#naming-conventions)
        - [Formatting Rules](#formatting-rules)
        - [Coding Principles](#coding-principles)
        - [Code Complexity](#code-complexity)
    - [⚙️ Best Practices](#️-best-practices)
        - [✅ Do](#-do)
        - [❌ Don’t](#-dont)
    - [🌱 Commit \& Branch Naming](#-commit--branch-naming)
        - [Branches](#branches)
        - [Commits](#commits)
    - [🔍 Pull Request Guidelines](#-pull-request-guidelines)
    - [🧪 Testing](#-testing)
    - [👀 Code Review Process](#-code-review-process)
    - [💬 Communication](#-communication)
    - [🤝 Final Notes](#-final-notes)

---

## 🚀 Project Overview

O **FlexUI** é um sistema de interface de usuário (UI) modular e reconfigurável, projetado para a construção de layouts dinâmicos baseados em painéis (widgets) e colunas, em uma arquitetura semelhante a dashboards ou IDEs (Integrated Development Environments). O projeto se concentra em fornecer uma experiência de usuário fluida para composição de layout, incluindo funcionalidades avançadas como Drag-and-Drop (D&D) para reorganização precisa, redimensionamento horizontal de colunas e vertical de painéis, e persistência do estado da área de trabalho (Workspace)

---

## 🧰 Getting Started

1. **Clone the repository**

    ```bash
    git clone https://github.com/marcusagm/FlexUI.git
    cd FlexUI
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Run ESLint and format your code**

    ```bash
    npx eslint .
    npx prettier --write .
    ```

4. **Run the development server**
    ```bash
    npm start
    ```

---

## 🧾 Code Standards

### Naming Conventions

- **Never abbreviate variable names.**  
  Each variable name must describe **exactly** its responsibility.

    ```js
    // ✅ Correct
    const circuitComponentList = [];

    // ❌ Avoid
    const compList = [];
    ```

- Use **camelCase** for variables and functions, **PascalCase** for classes, and **UPPER_CASE** for constants.

### Formatting Rules

These are enforced automatically via ESLint and Prettier:

| Rule                       | Description                           |
| -------------------------- | ------------------------------------- |
| **4 spaces**               | Indentation (no tabs)                 |
| **Single quotes `'`**      | For strings                           |
| **Semicolons**             | Required at the end of each statement |
| **Trailing commas**        | Not allowed                           |
| **Newline at EOF**         | Always required                       |
| **No trailing spaces**     | On any line                           |
| **One space after commas** | Consistent spacing                    |

> **Tip:** Run `npx eslint --fix` to automatically correct minor formatting issues.

---

### Coding Principles

- **Single Responsibility Principle (SRP):**  
  Each function or class must have **only one clear purpose**.

- **Readability over cleverness:**  
  Favor code that is **easy to understand** over complex or compact solutions.

- **Avoid side effects:**  
  Functions should not unexpectedly modify global variables or unrelated states.

- **Avoid deeply nested conditionals:**  
  Refactor complex logic into smaller, testable functions.

- **Always return explicitly:**  
  Every function should clearly define what it returns.

---

### Code Complexity

| Metric              | Limit | Enforcement              |
| ------------------- | ----- | ------------------------ |
| Function complexity | 10    | ESLint `complexity` rule |
| Max lines per file  | 300   | ESLint `max-lines` rule  |

If you exceed these limits, consider **splitting** logic into smaller functions or modules.

---

## ⚙️ Best Practices

### ✅ Do

- Use **`const`** and **`let`**, never `var`.
- Use **strict equality (`===`)** instead of `==`.
- Use **ES Modules** (`import` / `export`) consistently.
- Handle all DOM changes **via APIs**, never with `document.write()`.
- Prefer **pure functions** and **immutable data structures**.
- Write **clear, concise comments** explaining _why_ — not _what_.
- Keep files focused on a single concern (e.g., a specific simulation behavior).

### ❌ Don’t

- Leave unused variables or imports.
- Commit commented-out code blocks.
- Use `console.log()` for debugging — use `console.warn` or `console.error` if necessary.
- Push code containing `TODO` or `FIXME` notes without resolving them.
- Introduce “magic numbers” — define them as named constants.

---

## 🌱 Commit & Branch Naming

Follow a **consistent naming convention** for clarity:

### Branches

```
feature/add-transistor-component
fix/rendering-glitch-canvas
refactor/component-system
docs/update-readme
```

### Commits

```
feat: implement voltage source simulation
fix: correct resistor label positioning
refactor: split CanvasController into smaller modules
docs: update contributing guidelines
```

> Use [Conventional Commits](https://www.conventionalcommits.org/) whenever possible.

---

## 🔍 Pull Request Guidelines

Before opening a PR:

1. Ensure **ESLint passes** with no errors:
    ```bash
    npx eslint .
    ```
2. Ensure **Prettier formatting** is applied:
    ```bash
    npx prettier --check .
    ```
3. Verify **no console logs or TODO comments** remain.
4. Include a **clear and concise description** of your change.
5. If adding a new feature:
    - Include minimal usage documentation.
    - Add examples or screenshots if visual.

---

## 🧪 Testing

- All core logic should include **unit tests** (if applicable).
- Avoid coupling test logic to UI or rendering functions.
- Place tests under `/tests` or next to their module with the `.test.js` suffix.
- Run tests before committing:
    ```bash
    npm test
    ```

---

## 👀 Code Review Process

Every pull request goes through at least one review for:

- Code readability
- Consistency with style guidelines
- Functionality and correctness
- Documentation quality

Reviews should remain **constructive, respectful, and educational**.

---

## 💬 Communication

If you have questions or ideas:

- Open a **GitHub Issue** for bugs or suggestions.
- Use **Discussions** for brainstorming or feature requests.
- For urgent collaboration, tag maintainers in your pull request.

---

## 🤝 Final Notes

Contributing to **FlexUI** means upholding the principles of:

- **Clarity**
- **Consistency**
- **Educational value**
- **Engineering precision**

Each contribution, big or small, helps make the simulator more intuitive, realistic, and useful for everyone learning electronics.

> Thank you for helping make FlexUI a tool that empowers the next generation of makers and engineers!

---

🧡 _Marcus Maia_  
Creator & Maintainer — [FlexUI](https://github.com/marcusagm/FlexUI)
