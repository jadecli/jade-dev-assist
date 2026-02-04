// tests/create-issues-from-tasks.test.js
const test = require('node:test');
const assert = require('node:assert');
const { readTasksFromRepo } = require('../scripts/create-issues-from-tasks');

test('readTasksFromRepo reads pending tasks', () => {
    const tasks = readTasksFromRepo('jade-dev-assist');
    assert.ok(Array.isArray(tasks));
    assert.ok(tasks.every(t => t.status === 'pending'));
});

test('formatIssueBody creates markdown from task', () => {
    const { formatIssueBody } = require('../scripts/create-issues-from-tasks');

    const task = {
        id: 'test/task-1',
        title: 'Test Task',
        description: 'Test description',
        complexity: 'M',
        labels: ['feature']
    };

    const body = formatIssueBody(task);

    assert.ok(body.includes('Test description'));
    assert.ok(body.includes('**Complexity:** M'));
    assert.ok(body.includes('**Task ID:** `test/task-1`'));
});
