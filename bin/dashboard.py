#!/usr/bin/env python3
"""jade-dev-assist task dashboard -- live view of orchestrator task queues.

Usage:
    jade-dashboard    # recommended - uses launcher script
    bin/jade-dashboard
"""

import json
import time
from pathlib import Path

from rich.console import Console
from rich.live import Live
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.columns import Columns
from rich import box

PROJECTS_JSON = Path.home() / ".jade" / "projects.json"
PROJECTS_ROOT = Path.home() / "projects"
REFRESH_INTERVAL = 2.5

STATUS_COLORS = {
    "pending": "yellow",
    "in_progress": "bold cyan",
    "completed": "green",
    "blocked": "dim red",
    "failed": "bold red",
}

PROJECT_STATUS_ICONS = {
    "buildable": "[green]OK[/]",
    "near-buildable": "[yellow]~OK[/]",
    "scaffolding-plus": "[yellow]S+[/]",
    "scaffolding": "[dim]S[/]",
    "blocked": "[red]BLK[/]",
}


def load_registry() -> dict:
    try:
        return json.loads(PROJECTS_JSON.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {"version": 1, "projects_root": str(PROJECTS_ROOT), "projects": []}


def load_tasks(project_path: str) -> dict:
    tasks_file = PROJECTS_ROOT / project_path / ".claude" / "tasks" / "tasks.json"
    try:
        return json.loads(tasks_file.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {"tasks": []}


def make_progress_bar(done: int, total: int, width: int = 20) -> str:
    if total == 0:
        return "[dim]" + "-" * width + "[/]  --"
    pct = done / total
    filled = int(pct * width)
    bar = "[green]" + "█" * filled + "[/][dim]" + "░" * (width - filled) + "[/]"
    return f"{bar} {pct:>4.0%}"


def build_display(registry: dict) -> Table:
    projects = registry.get("projects", [])

    # -- Gather all data --
    all_stats = []
    all_in_progress = []
    all_completed = []
    total_tasks = 0
    total_done = 0

    for proj in projects:
        data = load_tasks(proj["path"])
        tasks = data.get("tasks", [])
        counts = {"pending": 0, "in_progress": 0, "completed": 0, "blocked": 0, "failed": 0}
        for t in tasks:
            s = t.get("status", "pending")
            counts[s] = counts.get(s, 0) + 1
            if s == "in_progress":
                all_in_progress.append((proj["name"], t.get("title", t.get("id", "?"))))
            if s == "completed":
                all_completed.append((proj["name"], t.get("title", t.get("id", "?"))))

        n = len(tasks)
        done = counts["completed"]
        total_tasks += n
        total_done += done
        milestone = data.get("milestone", {}).get("name", "")
        all_stats.append((proj, counts, n, done, milestone))

    # -- Project table --
    tbl = Table(
        title="jade-dev-assist  task dashboard",
        box=box.ROUNDED,
        title_style="bold white",
        border_style="bright_black",
        expand=True,
        padding=(0, 1),
    )
    tbl.add_column("Project", style="bold", min_width=20)
    tbl.add_column("Status", justify="center", min_width=5)
    tbl.add_column("Pend", justify="right", style="yellow")
    tbl.add_column("Run", justify="right", style="cyan")
    tbl.add_column("Done", justify="right", style="green")
    tbl.add_column("Blk", justify="right", style="red")
    tbl.add_column("Fail", justify="right", style="bold red")
    tbl.add_column("Progress", min_width=26)
    tbl.add_column("Milestone", style="dim")

    for proj, counts, n, done, milestone in all_stats:
        icon = PROJECT_STATUS_ICONS.get(proj.get("status", ""), "?")
        bar = make_progress_bar(done, n)
        tbl.add_row(
            proj["name"],
            icon,
            str(counts["pending"] or ""),
            str(counts["in_progress"] or ""),
            str(counts["completed"] or ""),
            str(counts["blocked"] or ""),
            str(counts["failed"] or ""),
            bar,
            milestone,
        )

    # -- Overall progress row --
    tbl.add_section()
    overall_bar = make_progress_bar(total_done, total_tasks, width=20)
    tbl.add_row(
        "[bold]TOTAL[/]",
        "",
        str(sum(c["pending"] for _, c, *_ in all_stats) or ""),
        str(sum(c["in_progress"] for _, c, *_ in all_stats) or ""),
        str(sum(c["completed"] for _, c, *_ in all_stats) or ""),
        str(sum(c["blocked"] for _, c, *_ in all_stats) or ""),
        str(sum(c["failed"] for _, c, *_ in all_stats) or ""),
        overall_bar,
        f"{total_done}/{total_tasks} tasks",
    )

    # -- In-progress panel --
    if all_in_progress:
        ip_lines = "\n".join(
            f"  [cyan]>[/] [bold]{proj}[/]: {title}" for proj, title in all_in_progress
        )
    else:
        ip_lines = "  [dim]No tasks in progress[/]"
    ip_panel = Panel(ip_lines, title="[cyan]In Progress[/]", border_style="cyan", expand=True)

    # -- Recently completed panel --
    recent = all_completed[-8:]  # show last 8
    if recent:
        rc_lines = "\n".join(
            f"  [green]✓[/] [dim]{proj}[/]: {title}" for proj, title in recent
        )
    else:
        rc_lines = "  [dim]No completed tasks yet[/]"
    rc_panel = Panel(rc_lines, title="[green]Recently Completed[/]", border_style="green", expand=True)

    # -- Compose into a master table for layout --
    outer = Table.grid(expand=True)
    outer.add_row(tbl)
    outer.add_row("")
    outer.add_row(Columns([ip_panel, rc_panel], expand=True, equal=True))
    outer.add_row("")
    ts = time.strftime("%H:%M:%S")
    outer.add_row(
        Text(
            f"  Refreshing every {REFRESH_INTERVAL:.0f}s  |  {ts}  |  Ctrl+C to exit",
            style="dim",
        )
    )
    return outer


def main():
    console = Console()
    registry = load_registry()

    if not registry.get("projects"):
        console.print("[red]No projects found in ~/.jade/projects.json[/]")
        return

    console.print("[dim]Starting jade task dashboard... Ctrl+C to exit.[/]\n")

    try:
        with Live(build_display(registry), console=console, refresh_per_second=1, screen=True) as live:
            while True:
                time.sleep(REFRESH_INTERVAL)
                registry = load_registry()  # re-read in case it changes
                live.update(build_display(registry))
    except KeyboardInterrupt:
        console.print("\n[dim]Dashboard stopped.[/]")


if __name__ == "__main__":
    main()
