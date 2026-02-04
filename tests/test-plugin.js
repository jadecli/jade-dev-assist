#!/usr/bin/env node

/**
 * JADE-DEV-ASSIST Plugin Tests
 *
 * Basic test suite for plugin validation.
 */

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Directory structure tests
console.log('\n📁 Directory Structure Tests\n');

test('Plugin root exists', () => {
  assert(fs.existsSync(PLUGIN_ROOT), 'Plugin root directory not found');
});

test('.claude-plugin directory exists', () => {
  assert(
    fs.existsSync(path.join(PLUGIN_ROOT, '.claude-plugin')),
    '.claude-plugin directory not found'
  );
});

test('commands directory exists', () => {
  assert(
    fs.existsSync(path.join(PLUGIN_ROOT, 'commands')),
    'commands directory not found'
  );
});

test('skills directory exists', () => {
  assert(
    fs.existsSync(path.join(PLUGIN_ROOT, 'skills')),
    'skills directory not found'
  );
});

test('docs directory exists', () => {
  assert(
    fs.existsSync(path.join(PLUGIN_ROOT, 'docs')),
    'docs directory not found'
  );
});

// Manifest tests
console.log('\n📋 Manifest Tests\n');

test('plugin.json exists', () => {
  const manifestPath = path.join(PLUGIN_ROOT, '.claude-plugin/plugin.json');
  assert(fs.existsSync(manifestPath), 'plugin.json not found');
});

test('plugin.json is valid JSON', () => {
  const manifestPath = path.join(PLUGIN_ROOT, '.claude-plugin/plugin.json');
  const content = fs.readFileSync(manifestPath, 'utf8');
  JSON.parse(content); // Will throw if invalid
});

test('plugin.json has required fields', () => {
  const manifestPath = path.join(PLUGIN_ROOT, '.claude-plugin/plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.name, 'Missing name field');
  assert(manifest.version, 'Missing version field');
  assert(manifest.description, 'Missing description field');
});

test('plugin.json name is kebab-case', () => {
  const manifestPath = path.join(PLUGIN_ROOT, '.claude-plugin/plugin.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(
    /^[a-z][a-z0-9-]*[a-z0-9]$/.test(manifest.name),
    `Name should be kebab-case: ${manifest.name}`
  );
});

// Skills tests
console.log('\n⚡ Skills Tests\n');

test('personalization-manager skill exists', () => {
  const skillPath = path.join(
    PLUGIN_ROOT,
    'skills/personalization-manager/SKILL.md'
  );
  assert(
    fs.existsSync(skillPath),
    'personalization-manager SKILL.md not found'
  );
});

test('style-configurator skill exists', () => {
  const skillPath = path.join(
    PLUGIN_ROOT,
    'skills/style-configurator/SKILL.md'
  );
  assert(fs.existsSync(skillPath), 'style-configurator SKILL.md not found');
});

test('capability-toggler skill exists', () => {
  const skillPath = path.join(
    PLUGIN_ROOT,
    'skills/capability-toggler/SKILL.md'
  );
  assert(fs.existsSync(skillPath), 'capability-toggler SKILL.md not found');
});

test('Skills have YAML frontmatter', () => {
  const skillsDir = path.join(PLUGIN_ROOT, 'skills');
  const skills = fs
    .readdirSync(skillsDir)
    .filter((f) => fs.statSync(path.join(skillsDir, f)).isDirectory());

  for (const skill of skills) {
    const skillMdPath = path.join(skillsDir, skill, 'SKILL.md');
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, 'utf8');
      assert(
        content.startsWith('---'),
        `${skill}/SKILL.md missing YAML frontmatter`
      );
    }
  }
});

// Commands tests
console.log('\n🔧 Commands Tests\n');

test('init command exists', () => {
  const cmdPath = path.join(PLUGIN_ROOT, 'commands/init.md');
  assert(fs.existsSync(cmdPath), 'init.md not found');
});

test('Commands have YAML frontmatter', () => {
  const commandsDir = path.join(PLUGIN_ROOT, 'commands');
  const commands = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));

  for (const cmd of commands) {
    const content = fs.readFileSync(path.join(commandsDir, cmd), 'utf8');
    assert(content.startsWith('---'), `${cmd} missing YAML frontmatter`);
  }
});

// Documentation tests
console.log('\n📚 Documentation Tests\n');

test('README.md exists', () => {
  assert(
    fs.existsSync(path.join(PLUGIN_ROOT, 'README.md')),
    'README.md not found'
  );
});

test('LICENSE exists', () => {
  assert(fs.existsSync(path.join(PLUGIN_ROOT, 'LICENSE')), 'LICENSE not found');
});

test('Research documentation exists', () => {
  const researchDir = path.join(PLUGIN_ROOT, 'docs/research');
  assert(fs.existsSync(researchDir), 'docs/research directory not found');

  const summaryPath = path.join(researchDir, 'claude-documentation-summary.md');
  assert(
    fs.existsSync(summaryPath),
    'claude-documentation-summary.md not found'
  );
});

// Hooks tests
console.log('\n🪝 Hooks Tests\n');

test('hooks.json exists', () => {
  const hooksPath = path.join(PLUGIN_ROOT, 'hooks/hooks.json');
  assert(fs.existsSync(hooksPath), 'hooks.json not found');
});

test('hooks.json is valid JSON', () => {
  const hooksPath = path.join(PLUGIN_ROOT, 'hooks/hooks.json');
  const content = fs.readFileSync(hooksPath, 'utf8');
  JSON.parse(content);
});

// Print summary
console.log('\n' + '='.repeat(50));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Some tests failed\n');
  process.exit(1);
} else {
  console.log('✅ All tests passed\n');
  process.exit(0);
}
