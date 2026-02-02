# Boris Cherny's Claude Code Productivity Tips

> 10 insider tips from @bcherny, Claude Code creator at Anthropic
> Posted: January 31, 2026 | 41K likes, 5K retweets, 84K bookmarks

---

## Tip 1: Do More in Parallel

**The single biggest productivity unlock from the Claude Code team.**

### Strategy
- Spin up 3–5 git worktrees at once, each running its own Claude session in parallel
- Native worktree support is built into Claude Desktop app (@amorriscode built this)

### Implementation Options
1. **Git Worktrees** (team preference)
   ```bash
   git worktree add .claude/worktrees/my-worktree origin/main
   cd .claude/worktrees/my-worktree && claude
   ```

2. **Multiple Git Checkouts** (Boris's personal preference)
   - Clone repo multiple times to different directories
   - Run separate Claude sessions in each

### Pro Tips
- Set up shell aliases (`za`, `zb`, `zc`) to hop between worktrees in one keystroke
- Create a dedicated "analysis" worktree just for reading logs and running BigQuery
- Name worktrees by task (e.g., `feature-auth`, `bugfix-api`, `refactor-db`)

### JADE-DEV-ASSIST Integration
- `/jade:worktree create <name>` - Create new worktree with Claude session
- `/jade:worktree list` - Show all active worktrees
- `/jade:worktree switch <alias>` - Quick switch with shell aliases

---

## Tip 2: Start Every Complex Task in Plan Mode

**Pour your energy into the plan so Claude can 1-shot the implementation.**

### Keyboard Shortcut
- `Shift+Tab` to cycle plan mode on/off

### Team Patterns

1. **Two-Claude Review Pattern**
   - One Claude writes the plan
   - Spin up a second Claude to review it as a staff engineer

2. **Re-Plan on Failure**
   - The moment something goes sideways, switch back to plan mode
   - Don't keep pushing — re-plan
   
3. **Verification in Plan Mode**
   - Explicitly tell Claude to enter plan mode for verification steps
   - Not just for the build phase

### JADE-DEV-ASSIST Integration
- `/jade:plan start` - Enter plan mode
- `/jade:plan review` - Spawn second Claude for staff-level review
- Auto-switch to plan mode when errors detected

---

## Tip 3: Invest in Your CLAUDE.md

**"Every mistake becomes a rule."**

### The Golden Rule
After every correction, end with:
> "Update your CLAUDE.md so you don't make that mistake again."

Claude is eerily good at writing rules for itself.

### Best Practices
- Ruthlessly edit your CLAUDE.md over time
- Keep iterating until Claude's mistake rate measurably drops
- Make it a living document, not a one-time setup

### Advanced Pattern: Notes Directory
One engineer's approach:
1. Maintain a `/notes` directory for every task/project
2. Update notes after every PR
3. Point CLAUDE.md at the notes directory

### Memory File Sizes (from Boris's setup)
```
Memory files · /memory
├─ ~/.claude/CLAUDE.md: 76 tokens
└─ CLAUDE.md: 4k tokens
```

### JADE-DEV-ASSIST Integration
- `/jade:learn <lesson>` - Add mistake to CLAUDE.md automatically
- `/jade:notes sync` - Sync notes directory after PR
- `/jade:claude-md analyze` - Show token usage and suggest optimizations

---

## Tip 4: Create Your Own Skills

**Commit them to git. Reuse across every project.**

### Rule of Thumb
If you do something more than once a day → turn it into a skill or command

### Team Skill Examples

1. **`/techdebt`** - Run at end of every session
   - Finds and kills duplicated code
   - Identifies unused imports/variables
   
2. **Context Sync Command** - Syncs 7 days of:
   - Slack messages
   - Google Drive docs
   - Asana tasks
   - GitHub activity
   - → One unified context dump

3. **Analytics Engineer Agents**
   - Write dbt models
   - Review code
   - Test changes in dev environment

### JADE-DEV-ASSIST Integration
- `/jade:techdebt` - Built-in tech debt scanner
- `/jade:context-sync` - Multi-source context aggregation
- `/jade:skill create <name>` - Scaffold new skill quickly

---

## Tip 5: Claude Fixes Most Bugs By Itself

**Zero context switching required.**

### Patterns

1. **Slack MCP Integration**
   ```
   fix this https://ant.slack.com/archives/...
   ```
   - Enable Slack MCP
   - Paste bug thread URL
   - Just say "fix"

2. **CI Fixes**
   ```
   Go fix the failing CI tests
   ```
   - Don't micromanage how
   - Let Claude figure it out

3. **Docker Log Analysis**
   ```
   Here are the docker logs, troubleshoot the issue
   ```
   - Claude is surprisingly capable at distributed systems debugging

### JADE-DEV-ASSIST Integration
- `/jade:fix ci` - Auto-fix failing CI tests
- `/jade:fix <slack-url>` - Fix from Slack thread
- `/jade:logs analyze` - Analyze docker/service logs

---

## Tip 6: Level Up Your Prompting

### a. Challenge Claude
Make Claude be your reviewer:
```
Grill me on these changes and don't make a PR until I pass your test
```

Verify behavior:
```
Prove to me this works
```
→ Claude will diff behavior between main and your feature branch

### b. Request Elegance
After a mediocre fix:
```
Knowing everything you know now, scrap this and implement the elegant solution
```

### c. Reduce Ambiguity
- Write detailed specs before handing work off
- The more specific you are, the better the output
- Ambiguity = worse results

### JADE-DEV-ASSIST Integration
- `/jade:review grill` - Challenge mode for code review
- `/jade:prove` - Behavior diff between branches
- `/jade:refine` - "Now make it elegant" prompt

---

## Tip 7: Terminal & Environment Setup

### Recommended Terminal: Ghostty
The team loves Ghostty for:
- Synchronized rendering
- 24-bit color
- Proper unicode support

### Status Bar Customization
```
/statusline
```
- Always show context usage
- Always show current git branch

### Tab Management
- Color-code terminal tabs
- Name tabs by task
- Use tmux — one tab per task/worktree

### Voice Dictation
- **macOS**: Press `fn` twice
- You speak 3x faster than you type
- Prompts get way more detailed as a result

### JADE-DEV-ASSIST Integration
- `/jade:terminal setup` - Configure optimal terminal
- `/jade:statusline config` - Custom status bar
- Pre-configured tmux layouts for multi-worktree

---

## Tip 8: Use Subagents

### a. Throw Compute at Problems
Append to any request:
```
use subagents
```
→ Claude throws more compute at the problem

### b. Keep Context Clean
Offload individual tasks to subagents to keep your main agent's context window clean and focused.

### c. Smart Permission Routing
Route permission requests to Opus 4.5 via a hook:
- Let it scan for attacks
- Auto-approve the safe ones
- See: `code.claude.com/docs/en/hooks`

### Example
```
> use 5 subagents to explore the codebase

• I'll launch 5 explore agents in parallel to...
• Running 5 Explore agents... (ctrl+o to expand)
  ├─ Explore entry points and startup · 10
  │  └─ Bash: Find CLI or main entry files
  ├─ Explore React components structure · 14
  │  └─ Bash: ls -la /Users/boris/code/claud...
  └─ Explore tools implementation · 14 tool...
```

### JADE-DEV-ASSIST Integration
- `/jade:subagent explore <topic>` - Launch explore subagents
- `/jade:subagent parallel <n>` - Run n subagents on task
- Permission routing hook with Opus 4.5 scanning

---

## Tip 9: Use Claude for Data & Analytics

### The Pattern
Ask Claude Code to use the `bq` CLI to pull and analyze metrics on the fly.

### Team Setup
- BigQuery skill checked into codebase
- Everyone uses it for analytics queries directly in Claude Code

### Boris's Experience
> "Personally, I haven't written a line of SQL in 6+ months."

### Applies to Any Database
Works for any database that has:
- CLI (psql, mysql, bq, etc.)
- MCP server
- API

### JADE-DEV-ASSIST Integration
- `/jade:query <natural language>` - Natural language to SQL
- BigQuery skill template
- Database connector skills (Postgres, MySQL, etc.)

---

## Tip 10: Learning with Claude

### a. Explanatory Style
Enable "Explanatory" or "Learning" output style in `/config`:
→ Claude explains the *why* behind its changes

### b. Visual Presentations
Have Claude generate visual HTML presentations explaining unfamiliar code.
→ Claude makes surprisingly good slides!

### c. ASCII Diagrams
Ask Claude to draw ASCII diagrams of new protocols and codebases to help you understand them.

### d. Spaced Repetition Learning Skill
Build a skill where:
1. You explain your understanding
2. Claude asks follow-ups to fill gaps
3. Claude stores the result

### JADE-DEV-ASSIST Integration
- `/jade:explain <topic>` - Learning mode explanation
- `/jade:diagram <system>` - Generate ASCII diagram
- `/jade:learn flashcard` - Spaced repetition mode
- "Learning" style preset in styles library

---

## Quick Reference Card

| Tip | Command/Action | Impact |
|-----|----------------|--------|
| Parallel work | 3-5 git worktrees | 3-5x throughput |
| Plan mode | Shift+Tab | 1-shot implementations |
| CLAUDE.md | "Update CLAUDE.md" | Mistake rate drops |
| Custom skills | /techdebt, etc. | Automation |
| Bug fixing | "fix" + Slack URL | Zero context switch |
| Better prompts | "Grill me", "Prove it" | Higher quality |
| Terminal | Ghostty + /statusline | Better visibility |
| Subagents | "use subagents" | More compute |
| Analytics | bq skill | No manual SQL |
| Learning | Explanatory style | Understanding |

---

## Source

Original thread: [@bcherny on X](https://x.com/bcherny)
Posted: January 31, 2026
