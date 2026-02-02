---
name: jade:review
description: Level up your prompting - challenge Claude, prove it works, request elegance
argument-hint: "[grill | prove | refine | spec]"
allowed-tools: [Read, Write, Bash, Glob, Grep, Git]
---

# Advanced Code Review & Prompting

> "Challenge Claude. Say 'Grill me on these changes and don't make a PR until I pass your test.' Make Claude be your reviewer." — Boris Cherny

## Usage

```bash
/jade:review <command> [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `grill` | Challenge mode - don't PR until you pass Claude's test |
| `prove` | "Prove to me this works" - diff behavior between branches |
| `refine` | "Knowing everything you know now, implement the elegant solution" |
| `spec` | Write detailed specs to reduce ambiguity |

## Examples

### Grill Mode

```bash
/jade:review grill
```

> "Say 'Grill me on these changes and don't make a PR until I pass your test.'"

```
🔥 GRILL MODE ACTIVATED

I'll review these changes as a senior engineer.
You don't get a PR until you pass.

📋 Changes detected:
   src/auth/login.ts (+45, -12)
   src/utils/token.ts (+23, -5)
   tests/auth.test.ts (+67, -0)

🔍 GRILLING...

❌ ISSUE 1: Race condition
   login.ts:34 - concurrent requests could cause token collision
   
   How would you fix this?
   
❌ ISSUE 2: Missing error case
   token.ts:18 - what happens if token is malformed?
   
   What's your solution?
   
❌ ISSUE 3: Test coverage gap
   No test for expired token scenario
   
   Add this test.

📊 Score: 2/5 - Not ready for PR

Fix these issues and run /jade:review grill again.
```

### Prove It Works

```bash
/jade:review prove
```

> "Say 'Prove to me this works' and have Claude diff behavior between main and your feature branch."

```
🔬 PROOF MODE

Comparing behavior: main ↔ feature/auth-refactor

📊 Test Matrix
┌─────────────────┬─────────┬─────────────┐
│ Scenario        │ main    │ feature     │
├─────────────────┼─────────┼─────────────┤
│ Valid login     │ ✅ 200  │ ✅ 200      │
│ Invalid pass    │ ✅ 401  │ ✅ 401      │
│ Expired token   │ ❌ 500  │ ✅ 401      │ ← IMPROVED
│ Missing user    │ ✅ 404  │ ✅ 404      │
│ Rate limited    │ ❌ hang │ ✅ 429      │ ← IMPROVED
└─────────────────┴─────────┴─────────────┘

✅ PROOF: Feature branch improves behavior
   - Fixed expired token handling
   - Added rate limiting
   - No regressions detected
```

### Request Elegance

```bash
/jade:review refine
```

> "After a mediocre fix, say: 'Knowing everything you know now, scrap this and implement the elegant solution.'"

```
✨ ELEGANCE MODE

Current implementation analysis:
   - Works but verbose (120 lines)
   - Multiple nested conditions
   - Repeated error handling

🎯 The elegant solution:

Knowing everything I know now, here's the refined approach:

Before (mediocre):
```typescript
async function authenticate(req, res) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({error: 'No token'});
  }
  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded) {
      return res.status(401).json({error: 'Invalid'});
    }
    // ... 80 more lines
  } catch (e) {
    // ...
  }
}
```

After (elegant):
```typescript
const authenticate = pipe(
  extractToken,
  verifyToken,
  attachUser
);

export const authMiddleware = asyncHandler(authenticate);
```

📉 120 lines → 15 lines
✅ Single responsibility
✅ Composable
✅ Testable
```

### Write Detailed Specs

```bash
/jade:review spec
```

> "Write detailed specs and reduce ambiguity before handing work off. The more specific you are, the better the output."

```
📝 SPEC MODE

Creating detailed specification...

## Feature: User Authentication

### Requirements
1. User can login with email/password
2. JWT token returned on success
3. Token expires after 24 hours
4. Refresh token mechanism required

### Acceptance Criteria
- [ ] POST /auth/login accepts {email, password}
- [ ] Returns {accessToken, refreshToken} on success
- [ ] Returns 401 with {error: string} on failure
- [ ] Access token expires in 15 minutes
- [ ] Refresh token expires in 7 days
- [ ] Rate limit: 5 attempts per minute

### Edge Cases
- Empty email → 400 Bad Request
- Invalid email format → 400 Bad Request
- Wrong password → 401 Unauthorized (generic message)
- Account locked → 423 Locked
- Server error → 500 with error ID

### API Contract
```json
POST /auth/login
Request:
{
  "email": "user@example.com",
  "password": "string"
}

Response 200:
{
  "accessToken": "jwt...",
  "refreshToken": "jwt...",
  "expiresIn": 900
}

Response 401:
{
  "error": "Invalid credentials"
}
```

💡 Ambiguity eliminated. Ready to implement.
```

## Prompting Best Practices

### 1. Challenge Claude

Make it your reviewer:
```
Grill me on these changes and don't make a PR until I pass your test.
```

### 2. Request Proof

Don't trust — verify:
```
Prove to me this works. Show me the behavior diff.
```

### 3. Demand Elegance

After it works, make it beautiful:
```
Knowing everything you know now, scrap this and implement the elegant solution.
```

### 4. Reduce Ambiguity

The more specific, the better:
```
Write a detailed spec for this feature before implementing.
```

## Integration

### With Plan Mode

```bash
/jade:plan start "Feature X"
# ... plan created ...
/jade:review spec   # Make spec more detailed
/jade:review grill  # Review the plan
```

### With PR Workflow

```bash
# After implementing
/jade:review grill

# Fix issues until passing
/jade:review prove

# Make it elegant
/jade:review refine

# Now create PR
git push && gh pr create
```

## Configuration

```json
{
  "review": {
    "grillSeverity": "senior",
    "proofRequired": true,
    "refinementRounds": 2,
    "specTemplate": "detailed"
  }
}
```

## Related Commands

- `/jade:plan review` - Two-Claude plan review
- `/jade:techdebt` - Find code issues
- `/jade:learn` - Capture lessons from reviews
