---
name: jade:explain
description: Learning with Claude - explanatory style, visual presentations, ASCII diagrams, spaced repetition
argument-hint: '<topic> [--slides | --diagram | --quiz]'
allowed-tools: [Read, Write, Bash, Glob, Grep]
---

# Learning with Claude

> "Enable the 'Explanatory' or 'Learning' output style in /config to have Claude explain the _why_ behind its changes." — Boris Cherny

## Usage

```bash
/jade:explain <topic> [options]
```

## Options

| Flag        | Description                        |
| ----------- | ---------------------------------- |
| `--slides`  | Generate visual HTML presentation  |
| `--diagram` | Draw ASCII diagram                 |
| `--quiz`    | Spaced repetition quiz mode        |
| `--deep`    | Extended explanation with examples |

## Examples

### Explain Code

```bash
/jade:explain "how does the auth middleware work"
```

````
📚 Learning Mode

## What is Auth Middleware?

**Simple**: Code that checks if a request is allowed before processing it.

**Analogy**: Like a bouncer at a club:
- Checks your ID (token)
- Valid ID? You're in (next handler)
- No ID? Go away (401 error)

## How It Works

1. Request arrives
2. Extract token from header
3. Verify token signature
4. Attach user to request
5. Continue to handler

## The Code

```typescript
// src/middleware/auth.ts
export const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const user = jwt.verify(token, SECRET);
  req.user = user;
  next();
};
````

## Why This Pattern?

- ✅ Separates auth from business logic
- ✅ Reusable across routes
- ✅ Fails fast on bad requests

## Common Mistakes

❌ Checking auth in every route
❌ Forgetting to call next()
❌ Exposing sensitive error details

````

### Generate Visual Presentation

```bash
/jade:explain "OAuth2 flow" --slides
````

> "Have Claude generate a visual HTML presentation explaining unfamiliar code. It makes surprisingly good slides!"

Creates `oauth2-slides.html`:

```html
<!-- Interactive HTML slides with:
     - Clear diagrams
     - Step-by-step animations
     - Code examples
     - Speaker notes -->
```

### Draw ASCII Diagrams

```bash
/jade:explain "request lifecycle" --diagram
```

> "Ask Claude to draw ASCII diagrams of new protocols and codebases to help you understand them."

```
HTTP Request Lifecycle:

┌─────────┐    ┌──────────────┐    ┌────────────┐
│ Browser │───▶│ Express App  │───▶│ Controller │
└─────────┘    └──────────────┘    └────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐ ┌──────────┐ ┌─────────┐
   │ Logger  │ │   Auth   │ │  CORS   │
   └─────────┘ └──────────┘ └─────────┘

Middleware Chain:
  Request → Logger → CORS → Auth → Route → Response
```

### Spaced Repetition Quiz

```bash
/jade:explain "authentication" --quiz
```

> "Build a spaced-repetition learning skill: you explain your understanding, Claude asks follow-ups to fill gaps, stores the result."

```
🎯 Quiz Mode: Authentication

Let me check your understanding.

Q1: Explain JWT tokens in your own words.
    [Your answer here]

Analyzing your response...

✅ Correct: Tokens contain claims
✅ Correct: Tokens are signed
⚠️ Gap: You didn't mention expiration
⚠️ Gap: What about refresh tokens?

Follow-up Questions:
1. Why do tokens expire?
2. How do refresh tokens improve security?

[Continue quiz...]
```

## Style Configuration

Enable learning style:

```bash
/jade:styles --apply learning
```

Or in config:

```json
{
  "styles": {
    "default": "learning"
  }
}
```

## Learning Style Features

### Always Explains Why

Not just what to do, but why:

```
// We use bcrypt (not SHA-256) because:
// 1. Built-in salting prevents rainbow tables
// 2. Configurable work factor slows brute force
// 3. Industry standard for passwords
```

### Uses Analogies

```
Middleware is like an assembly line:
- Each station (middleware) does one job
- Parts (request) move through in order
- Quality check (validation) can reject early
```

### Shows Trade-offs

```
Session vs JWT:

Session:
  ✅ Easy revocation
  ❌ Server storage required

JWT:
  ✅ Stateless
  ❌ Can't revoke until expiry
```

### Builds Incrementally

```
Let's build auth step by step:

Step 1: Basic password check
Step 2: Add password hashing
Step 3: Add JWT generation
Step 4: Add refresh tokens
Step 5: Add rate limiting
```

## Use Cases

### 1. New Codebase Onboarding

```bash
/jade:explain "how does this codebase work" --diagram
```

### 2. Understanding Complex Systems

```bash
/jade:explain "kubernetes networking" --slides
```

### 3. Code Review Learning

```bash
/jade:explain "why was this PR approach chosen"
```

### 4. Interview Prep

```bash
/jade:explain "system design concepts" --quiz
```

## Tips for Better Learning

### 1. Ask Why

Instead of "How do I do X?", ask "Why would I choose X over Y?"

### 2. Request Diagrams

Visual explanations stick better.

### 3. Quiz Yourself

Use `--quiz` to identify knowledge gaps.

### 4. Explain Back

Tell Claude your understanding; it'll correct misconceptions.

## Configuration

```json
{
  "explain": {
    "defaultStyle": "learning",
    "includeAnalogies": true,
    "showTradeoffs": true,
    "quizStorage": ".claude/quiz-history.json",
    "slidesTheme": "dark"
  }
}
```

## Related Commands

- `/jade:styles --apply learning` - Enable learning style
- `/jade:config` - Configure explanation preferences
- `/jade:learn` - Store lessons in CLAUDE.md
