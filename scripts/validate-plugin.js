#!/usr/bin/env node

/**
 * JADE-DEV-ASSIST Plugin Validator
 * 
 * Validates Claude Code plugin structure and configuration.
 * 
 * Usage:
 *   node scripts/validate-plugin.js [plugin-path]
 *   node scripts/validate-plugin.js --schema-only
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_DIRS = [
    '.claude-plugin',
    'commands',
    'skills',
];

const REQUIRED_FILES = [
    '.claude-plugin/plugin.json',
    'README.md',
    'LICENSE',
];

const VALID_HOOK_EVENTS = [
    'SessionStart',
    'SessionEnd',
    'PreToolUse',
    'PostToolUse',
    'UserPromptSubmit',
    'Notification',
];

class PluginValidator {
    constructor(pluginPath) {
        this.pluginPath = path.resolve(pluginPath);
        this.errors = [];
        this.warnings = [];
    }

    validate() {
        console.log(`\n🔍 Validating plugin at: ${this.pluginPath}\n`);

        this.checkDirectoryExists();
        this.checkRequiredFiles();
        this.checkRequiredDirectories();
        this.validateManifest();
        this.validateSkills();
        this.validateCommands();
        this.validateHooks();

        this.printResults();
        return this.errors.length === 0;
    }

    checkDirectoryExists() {
        if (!fs.existsSync(this.pluginPath)) {
            this.errors.push(`Plugin directory does not exist: ${this.pluginPath}`);
        }
    }

    checkRequiredFiles() {
        for (const file of REQUIRED_FILES) {
            const filePath = path.join(this.pluginPath, file);
            if (!fs.existsSync(filePath)) {
                this.errors.push(`Missing required file: ${file}`);
            }
        }
    }

    checkRequiredDirectories() {
        for (const dir of REQUIRED_DIRS) {
            const dirPath = path.join(this.pluginPath, dir);
            if (!fs.existsSync(dirPath)) {
                this.warnings.push(`Missing directory: ${dir}`);
            }
        }
    }

    validateManifest() {
        const manifestPath = path.join(this.pluginPath, '.claude-plugin/plugin.json');
        
        if (!fs.existsSync(manifestPath)) {
            return; // Already reported as missing file
        }

        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

            // Check required fields
            const requiredFields = ['name', 'version', 'description'];
            for (const field of requiredFields) {
                if (!manifest[field]) {
                    this.errors.push(`Manifest missing required field: ${field}`);
                }
            }

            // Validate name format (kebab-case)
            if (manifest.name && !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(manifest.name)) {
                this.warnings.push(`Plugin name should be kebab-case: ${manifest.name}`);
            }

            // Validate version format (semver)
            if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
                this.warnings.push(`Version should follow semver: ${manifest.version}`);
            }

            // Validate commands
            if (manifest.commands) {
                for (const cmd of manifest.commands) {
                    if (!cmd.name || !cmd.path) {
                        this.errors.push(`Command missing name or path: ${JSON.stringify(cmd)}`);
                    }
                    const cmdPath = path.join(this.pluginPath, cmd.path);
                    if (!fs.existsSync(cmdPath)) {
                        this.errors.push(`Command file not found: ${cmd.path}`);
                    }
                }
            }

            // Validate skills
            if (manifest.skills) {
                for (const skill of manifest.skills) {
                    if (!skill.name || !skill.path) {
                        this.errors.push(`Skill missing name or path: ${JSON.stringify(skill)}`);
                    }
                    const skillMdPath = path.join(this.pluginPath, skill.path, 'SKILL.md');
                    if (!fs.existsSync(skillMdPath)) {
                        this.errors.push(`SKILL.md not found: ${skill.path}/SKILL.md`);
                    }
                }
            }

            console.log('✓ Manifest structure valid');

        } catch (err) {
            this.errors.push(`Invalid manifest JSON: ${err.message}`);
        }
    }

    validateSkills() {
        const skillsDir = path.join(this.pluginPath, 'skills');
        
        if (!fs.existsSync(skillsDir)) {
            return;
        }

        const skills = fs.readdirSync(skillsDir).filter(f => 
            fs.statSync(path.join(skillsDir, f)).isDirectory()
        );

        for (const skill of skills) {
            const skillMdPath = path.join(skillsDir, skill, 'SKILL.md');
            
            if (!fs.existsSync(skillMdPath)) {
                this.errors.push(`Skill missing SKILL.md: ${skill}`);
                continue;
            }

            const content = fs.readFileSync(skillMdPath, 'utf8');
            
            // Check for YAML frontmatter
            if (!content.startsWith('---')) {
                this.warnings.push(`Skill ${skill} missing YAML frontmatter`);
            }

            // Check for required frontmatter fields
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (frontmatterMatch) {
                const frontmatter = frontmatterMatch[1];
                if (!frontmatter.includes('name:')) {
                    this.warnings.push(`Skill ${skill} frontmatter missing 'name'`);
                }
                if (!frontmatter.includes('description:')) {
                    this.errors.push(`Skill ${skill} frontmatter missing 'description' (required for skill discovery)`);
                }
            }
        }

        console.log(`✓ Validated ${skills.length} skills`);
    }

    validateCommands() {
        const commandsDir = path.join(this.pluginPath, 'commands');
        
        if (!fs.existsSync(commandsDir)) {
            return;
        }

        const commands = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));

        for (const cmd of commands) {
            const cmdPath = path.join(commandsDir, cmd);
            const content = fs.readFileSync(cmdPath, 'utf8');

            // Check for YAML frontmatter
            if (!content.startsWith('---')) {
                this.warnings.push(`Command ${cmd} missing YAML frontmatter`);
            }
        }

        console.log(`✓ Validated ${commands.length} commands`);
    }

    validateHooks() {
        const hooksPath = path.join(this.pluginPath, 'hooks/hooks.json');
        
        if (!fs.existsSync(hooksPath)) {
            return;
        }

        try {
            const hooks = JSON.parse(fs.readFileSync(hooksPath, 'utf8'));

            if (hooks.hooks) {
                for (const hook of hooks.hooks) {
                    if (!VALID_HOOK_EVENTS.includes(hook.event)) {
                        this.errors.push(`Invalid hook event: ${hook.event}`);
                    }
                }
            }

            console.log('✓ Hooks configuration valid');

        } catch (err) {
            this.errors.push(`Invalid hooks JSON: ${err.message}`);
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(50));
        
        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log('✅ Plugin validation PASSED\n');
            return;
        }

        if (this.errors.length > 0) {
            console.log(`\n❌ ERRORS (${this.errors.length}):`);
            for (const err of this.errors) {
                console.log(`   • ${err}`);
            }
        }

        if (this.warnings.length > 0) {
            console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
            for (const warn of this.warnings) {
                console.log(`   • ${warn}`);
            }
        }

        console.log('\n' + '='.repeat(50));
        
        if (this.errors.length > 0) {
            console.log('❌ Plugin validation FAILED\n');
        } else {
            console.log('✅ Plugin validation PASSED (with warnings)\n');
        }
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--schema-only')) {
        console.log(JSON.stringify({
            type: 'claude-plugin',
            version: '1.0.0',
            requiredDirs: REQUIRED_DIRS,
            requiredFiles: REQUIRED_FILES,
            validHookEvents: VALID_HOOK_EVENTS,
        }, null, 2));
        process.exit(0);
    }

    const pluginPath = args[0] || '.';
    const validator = new PluginValidator(pluginPath);
    const success = validator.validate();
    
    process.exit(success ? 0 : 1);
}

module.exports = { PluginValidator };
