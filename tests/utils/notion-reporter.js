// @ts-check
'use strict';

/**
 * Custom Playwright reporter that posts test results to a Notion database.
 *
 * Configure in playwright.config.js:
 *   reporter: [['list'], ['./tests/utils/notion-reporter.js']]
 *
 * Required env vars:
 *   NOTION_API_KEY            — Notion integration token
 *   NOTION_TEST_DATABASE_ID   — ID of the target Notion database
 *
 * The target database must have these properties:
 *   Test Run   (title)
 *   Passed     (number)
 *   Failed     (number)
 *   Total      (number)
 *   Duration   (number)
 *   Status     (status: "Pass" | "Fail")
 *   Suite      (rich_text)
 *   Environment (select: "local" | "staging" | "production")
 */

class NotionReporter {
  constructor() {
    this._startTime = null;
    this._passed = 0;
    this._failed = 0;
    this._skipped = 0;
    this._suiteName = process.env.TEST_SUITE_NAME || 'Full Suite';
  }

  onBegin(_config, _suite) {
    this._startTime = Date.now();
  }

  onTestEnd(test, result) {
    if (result.status === 'passed') this._passed++;
    else if (result.status === 'skipped') this._skipped++;
    else this._failed++;
  }

  async onEnd(_result) {
    const apiKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_TEST_DATABASE_ID;

    if (!apiKey || !databaseId) {
      console.log(
        '[notion-reporter] Skipping Notion report: NOTION_API_KEY or NOTION_TEST_DATABASE_ID not set'
      );
      return;
    }

    const duration = Date.now() - this._startTime;
    const total = this._passed + this._failed + this._skipped;
    const allPassed = this._failed === 0;
    const environment = process.env.ENVIRONMENT || 'production';
    const version = process.env.npm_package_version || 'unknown';

    const runTitle = `v${version} — ${new Date().toISOString().split('T')[0]} — ${
      this._suiteName
    }`;

    const body = {
      parent: { database_id: databaseId },
      properties: {
        'Test Run': {
          title: [{ text: { content: runTitle } }],
        },
        Passed: { number: this._passed },
        Failed: { number: this._failed },
        Total: { number: total },
        Duration: { number: duration },
        Status: {
          select: { name: allPassed ? 'Pass' : 'Fail' },
        },
        Suite: {
          rich_text: [{ text: { content: this._suiteName } }],
        },
        Environment: {
          select: { name: environment },
        },
      },
    };

    try {
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(
          `[notion-reporter] Failed to create Notion page: ${res.status} ${text}`
        );
      } else {
        const data = await res.json();
        console.log(
          `[notion-reporter] Test results logged to Notion: ${data.url || data.id}`
        );
      }
    } catch (err) {
      console.error('[notion-reporter] Error posting to Notion:', err.message);
    }
  }
}

module.exports = NotionReporter;
