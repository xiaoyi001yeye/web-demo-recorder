# Scenario Reference

Scenario files are app-specific CommonJS files. They keep credentials, route paths, IDs, and workflow decisions out of the reusable recorder.

## Contract

```js
exports.run = async ({ page, recorder }) => {
  await recorder.goto('/login', 'login');
  await recorder.fill(page.getByLabel('Username'), process.env.DEMO_USERNAME);
  await recorder.fill(page.getByLabel('Password'), process.env.DEMO_PASSWORD);
  await recorder.click(page.locator('button[type="submit"]'));
  await recorder.wait(1200);

  recorder.step('dashboard');
  await page.getByText('Dashboard').waitFor();
};
```

## Helpers

- `recorder.goto(pathOrUrl, stepName)`
- `recorder.click(locator)`
- `recorder.fill(locator, value)`
- `recorder.press(locator, key)`
- `recorder.scrollTo(y)`
- `recorder.moveTo(x, y, options)`
- `recorder.wait(ms)`
- `recorder.step(name)`
- `recorder.installCursor()`

Use helpers for visible operations so cursor traces match the action. Use raw Playwright only for assertions, setup, or app-specific logic that should not appear as a user gesture.
