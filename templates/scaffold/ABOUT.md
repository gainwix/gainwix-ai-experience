# <Project name> — Product Overview

> Scaffolded by `/gx-init`. **Run `/gx-about` to fill this in by interview** (it drafts
> from a repo scan and asks you the rest), or replace every `<placeholder>` by hand —
> either way, delete the guidance notes when done. This file is the **single source of
> truth** for what the product is and why it exists — the dev-workflow commands
> read it for context, and the closing prompt turns it into the seed for your
> backlog. Keep the section structure; fill it in.

## Abstract

<One paragraph: what this product is and the single outcome it delivers, in plain
language. Lead with the user-visible value.>

## Background

**Why this product?** <The problem you're solving and who has it today.>

<What's broken about the status quo / why existing tools don't fit — a few bullets:>

- **<Gap 1>** — <why it matters>
- **<Gap 2>** — <why it matters>

**What gaps does it fill?** <How this product closes those gaps — the 2–3 things it
combines that normally live in separate systems.>

## Business Context

<The domain model and tenancy: the top-level entities, how they relate, and any
status/lifecycle they move through. Replace the examples below.>

- **<Top-level entity, e.g. Organization / Account / Workspace>** — <what it is>
- **<Sub-structure, e.g. teams / units / projects>** — <how it's organized>
- **<Categorization, e.g. tracks / categories / tags>** — <how things are grouped>

### Lifecycle(s)

<Any entity with a defined status lifecycle — show it as a small diagram:>

```
<STATE_A> → <STATE_B> → <STATE_C>
```

### Roles and how they use the product

| Role | Who they are | What they do with the product |
|------|--------------|-------------------------------|
| **<Role 1>** | <who> | <what they do> |
| **<Role 2>** | <who> | <what they do> |
| **<Role 3>** | <who> | <what they do> |

## Components

The product is made of a few cooperating pieces:

1. **<Component 1, e.g. the web app>** — <what it is / who uses it>.
2. **<Component 2, e.g. the backend / system of record>** — <what it does>.
3. **<Component 3, e.g. the client / integration / API surface>** — <what it does>.

## Deployment

- **<Component 1>** — <how it's packaged + where it runs>.
- **<Component 2>** — <how it's packaged + where it runs>.
- **<Data / infra>** — <datastore, hosting, background jobs>.

<Any end-to-end lifecycle the platform enforces, as a diagram:>

```
<CONCEPT> → <DRAFT> → <REVIEW> → <PUBLISHED>
```

## Explanation of Work

<Per role (and per major workflow), describe what each person does and how they do
it with the product — together these form the full end-to-end loop. One short
subsection per role.>

### <Role 1> — <their job in one phrase>

1. <Step they take>
2. <Step they take>

*How:* <which surface / screens they use.>

### <Role 2> — <their job in one phrase>

1. <Step they take>
2. <Step they take>

*How:* <which surface / screens they use.>

---

## Prompt — Generate Features From This Document

> **Instruction (the purpose of this document):** This document explains the
> **why** (Background), the **what** (Components), and the **how** (Business
> Context + Explanation of Work) of the product. Use it as the single source of
> truth to **generate a comprehensive, prioritized set of product features**.
>
> For each role and each workflow described in *Explanation of Work*, derive the
> concrete capabilities the product must provide to make that workflow possible
> end to end. Cover every stage of each lifecycle, every component, and the
> cross-cutting concerns implied above (authentication, roles/permissions,
> the core domain entities and their relationships, notifications, delivery,
> progress/state tracking, analytics, and administration).
>
> For each feature, produce: a short title, the role(s) it serves, the user-facing
> capability as a user story ("As a &lt;role&gt;, I can …, so that …"), acceptance
> criteria, the component(s) it touches, and any dependencies on other features.
> Group features into epics aligned to the components and workflows, and order
> them so foundational capabilities (auth, core entities/roles, the central data
> model) come before the workflows that depend on them. The output should be
> complete enough to seed `.gainwix/<component>/inbox.md` for the GainWix dev workflow.
> (`/gx-about` runs this prompt for you and writes the distilled result into
> the inbox; then `/gx-next` → `/gx-go` plan and ship each item.)
