# AI Design System Guide

**Version:** 1.2  
**Last updated:** 2026-03-09  
**Maintained by:** Design Team Lead

**Purpose:** This document is the single reference for AI agents and developers when implementing or reviewing UI for the TD broker platform. It ties together Figma (UI Kit), design tokens, and project rules.

**Product context:** Professional broker admin platform (web + mobile). Primary users: professional traders and brokers. Key interfaces: order book, charts, watchlists, position management, risk dashboards. Widget system: resizable containers, minimum size 260×260 px. Data density is high; real-time updates are standard.

---

## 1. Figma integration

### Main UI Kit file
- **File key:** `W4bQEnq85XByAAdmt9RkWf`
- **Name:** TD-AT 🌐 UI-Kit
- **URL pattern:** `https://www.figma.com/design/W4bQEnq85XByAAdmt9RkWf/...?node-id=<node-id>`

### Using Figma MCP

**Available methods:**

- **get_metadata(fileKey, nodeId)** — returns structure (IDs, names, types, sizes).
  Use when you need an overview of a page or frame.
- **get_design_context(fileKey, nodeId)** — returns reference code + screenshot.
  Requires the file to be open in Figma desktop and the target node **selected**.

**⚠️ get_design_context warning:**  
If it returns `"You need to select a layer first"` — the node is not selected in Figma desktop.  
Do not retry blindly. Instead:
1. Fall back to `get_metadata` to get structure information
2. Ask the user to open Figma desktop and select the target node
3. Only then retry `get_design_context`

**nodeId format:** from URL `node-id=139230-75336` use `139230:75336` (replace hyphen with colon).

### Example structure (Login & Registration canvas, node `139230:75336`)
- Section: **🔹 Login & Registration** (3380×2858)
  - Feature Header; Titles
  - Flows: Demo account Log in, Confirm Email, Step-1/3 Contact Information, Password Recovery, Email Verification, Backup Code, Active/Terminated Session, Create Practice Login Credentials, Create a new password
  - Components: Link Block (Default/Hovered/Focused/Success), Bottom-buttons, Language Selector, Step-number, Progressbar, Login (Demo/Live), Demo-live (Practice/Live), TD Terms & Conditions (Checked/Unchecked), Tooltip
- Section: **Create Practice Account** (1178×942)

When implementing UI from Figma, always follow this order:
1. **Use existing components first** — check the UI Kit before writing any code
2. **Never recreate components manually** — if a component exists in the UI Kit, use it as-is
3. **Check variants before creating new ones** — the component may already have the state or variant you need

Keep naming consistent with the UI Kit file.

---

## 2. Color tokens (design system)

**Themes:** `dark` (default for trading) and `light`. Always specify theme when suggesting or using tokens.

**Rule:** Use **alias tokens only**, never primitives.

### Naming formula (summary)
`[parent-object]-[object]-[type]-[hierarchy]-[state]-[part]-[part-direction]-[part-gradient]-[part-position]`

- Only letters, numbers, and hyphens. No underscores, no uppercase.
- **Object** is the only required element; all others are optional.

### Quick examples

**✅ Correct:**
```
bottom-bar-sell-button-default-bg
button-buy-hovered-overlay
row-hovered-bg
text-negative
window-bg-grad-top--window-bg-grad-bottom
```

**❌ Incorrect:**
```
bottomBar_sellButton_defaultBg     — underscores not allowed
sell-btn-bg                        — too vague, missing hierarchy and state
BuyButton-Default-BG               — uppercase not allowed
bg-button-default                  — wrong order: object before part
```

**→ For full naming rules, all formula elements, and validation:**  
Use `.cursor/agents/agent-token-naming.md`

### Token usage rule
When suggesting a token — construct the name using the formula, show the result, and ask the user to verify it exists in Figma. Never guess silently.

**References:** Full token library and documentation are in Figma and Confluence (links to be set by the team).

---

## 3. Accessibility and standards

- **Minimum:** WCAG / W3C AA. Every solution must address: color contrast (4.5:1 normal text, 3:1 large text), keyboard navigation, focus management, screen readers, `prefers-reduced-motion`.
- **Heuristics:** Evaluate against Nielsen's 10 heuristics; call out violations and suggest fixes.
- **NN/g:** Use NN/g research as reference; if a pattern contradicts it, flag clearly.
- **Priority:** Usability over aesthetics; think trader first, designer second.

---

## 4. UI text and formatting (agent references)

| Topic | Agent file | Use when | Do not use when |
|-------|------------|----------|-----------------|
| **Token naming** | `agent-token-naming.md` | Constructing, validating, or explaining any color token name. | Choosing which data to display or how to format it. |
| **Capitalization** | `agent-capitalization.md` | Generating or reviewing any UI text: labels, headers, menus, messages. Default: Sentence case; Title Case only where specified. | Writing code identifiers, file names, or non-UI copy. |
| **Flexible layout** | `agent-flexible-layout.md` | Questions about widgets, workspaces, layouts, save/load, resize, detach, maximize, 260×260 min size. | Visual design decisions inside a widget (colors, typography, component choice). |
| **Data visualization** | `agent-data-visualization.md` | Formatting numbers, currencies, dates, percentages, tables, locale (EN/FR), signs, trailing zeros. | Deciding which data to show — only how to format it. |
| **Rounding** | `agent-rounding-rules.md` | Determining rounding method and precision before applying UI formatting. Always use before data visualization agent when raw values are involved. | Formatting already-rounded values — use data visualization agent for that. |
| **Analysis** | `agent-analyst.md` | Clarifying user needs, goals, and constraints before a solution is designed. Stress-testing problem statements. | Generating design solutions — analyst asks questions, does not design. |
| **Senior designer** | `agent-senior-designer.md` | Generating design options, checking heuristics, accessibility, token naming. Always provides 2–3 options with reasoning. | Formatting data, defining rounding, or writing UI copy — use dedicated agents for those. |

### How to activate an agent in Cursor

In Cursor Chat, type:
```
Use instructions from .cursor/agents/agent-name.md
```

For example:
```
Use instructions from .cursor/agents/agent-senior-designer.md

Here is my task: [describe your task]
```

You can combine agents in one session:
```
Use instructions from .cursor/agents/agent-analyst.md and
.cursor/agents/agent-senior-designer.md
```

---

## 5. How to use this guide (for AI)

1. **Implementing from Figma:** Use `fileKey` and `nodeId` above; call `get_metadata` for structure. If the user has the node selected in Figma desktop, `get_design_context` can be used for code and screenshot. If it fails, see warning in section 1. Map Figma component names to the same names in code where possible.
2. **Suggesting or using colors:** Build token names using `agent-token-naming.md`; specify theme (dark/light). If a token is uncertain, show the constructed name and ask the user to verify in Figma.
3. **UI copy:** Apply capitalization rules from the dedicated agent; do not guess Title vs Sentence case.
4. **Numbers, dates, currency:** Apply rounding agent first, then data visualization agent, with the given locale.
5. **Layout and widgets:** Apply flexible layout rules (min size, workspace, layout, detach, etc.).
6. **Design review:** Check accessibility (AA), heuristics, and token usage; prefer options with reasoning (see senior designer agent).

### When uncertain about design decisions

Always follow this order before proposing a solution:

1. **Analyze user goals** — what is the user trying to accomplish and in what context?
2. **Check UX principles** — does the solution satisfy Nielsen's heuristics and NN/g guidelines?
3. **Verify design tokens** — does the solution use existing tokens and components from the UI Kit?
4. **Propose 2–3 solutions with reasoning** — never give one answer; always explain trade-offs

Never guess silently. If any of the above steps cannot be completed — say so and ask for clarification.

---

## 6. Code implementation rules

These rules apply whenever generating or reviewing React components and UI code.

- **Use design tokens only** — never hardcode colors, spacing, or typography values
- **Never hardcode colors** — every color value must reference a token from the design system
- **Prefer component reuse** — always check if a component exists before creating a new one
- **Follow component naming from Figma** — map Figma component names directly to code names

### Component naming convention

Figma uses slash notation; code uses PascalCase without slashes:

| Figma | Code |
|-------|------|
| `Button / Primary` | `ButtonPrimary` |
| `Button / Ghost` | `ButtonGhost` |
| `Row / Hovered` | `RowHovered` |
| `Table / Header` | `TableHeader` |
| `Status Badge / Warning` | `StatusBadgeWarning` |

**Rule:** If a component exists in the UI Kit — use it. If a variant exists — use it.
Never recreate what already exists in the design system.

---

## 7. Project structure (design-related)

```
.cursor/
  agents/
    agent-senior-designer.md
    agent-analyst.md
    agent-token-naming.md
    agent-capitalization.md
    agent-data-visualization.md
    agent-rounding-rules.md
    agent-flexible-layout.md
  mcp.json          # Figma MCP config (FIGMA_API_KEY required)
  README.md         # MCP setup instructions
AI-DESIGN-SYSTEM-GUIDE.md   # This file
```

When the codebase grows (e.g. tokens in code, component library, Storybook), extend this guide with paths to token definitions, component locations, and build/styling approach so that Figma MCP and design system stay in sync.
