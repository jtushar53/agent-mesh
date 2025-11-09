import { test, expect } from '@playwright/test'

test.describe('MCP Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for app to load
    await expect(page.locator('h1')).toContainText('AgentMesh')
  })

  test('should connect to MCP server and list tools', async ({ page }) => {
    // Navigate to MCP tab
    await page.click('text=MCP Tools')

    // Verify MCP Manager is visible
    await expect(page.locator('h2')).toContainText('MCP Connection Manager')

    // Connect to the mock server
    await page.fill('input[id="server-url"]', 'http://localhost:3001/mcp')
    await page.click('button:has-text("Connect")')

    // Wait for connection
    await expect(page.locator('text=✅ Connected')).toBeVisible({
      timeout: 10000,
    })

    // Verify tools are discovered
    await expect(page.locator('text=calculator')).toBeVisible()
    await expect(page.locator('text=get_time')).toBeVisible()
    await expect(page.locator('text=reverse_text')).toBeVisible()
    await expect(page.locator('text=word_count')).toBeVisible()
  })

  test('should execute calculator tool via MCP', async ({ page }) => {
    // Navigate to MCP tab and connect
    await page.click('text=MCP Tools')
    await page.fill('input[id="server-url"]', 'http://localhost:3001/mcp')
    await page.click('button:has-text("Connect")')
    await expect(page.locator('text=✅ Connected')).toBeVisible({
      timeout: 10000,
    })

    // Select calculator tool
    await page.click('text=calculator')

    // Verify tool is selected
    await expect(page.locator('text=Execute Tool: calculator')).toBeVisible()

    // Input JSON arguments
    await page.fill('textarea[id="tool-input"]', '{ "expression": "2 + 2" }')

    // Execute tool
    await page.click('button:has-text("Execute Tool")')

    // Verify result
    await expect(page.locator('text=✅ Success')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('pre.result-content')).toContainText('"result"')
    await expect(page.locator('pre.result-content')).toContainText('4')
  })

  test('should execute get_time tool via MCP', async ({ page }) => {
    // Navigate to MCP tab and connect
    await page.click('text=MCP Tools')
    await page.fill('input[id="server-url"]', 'http://localhost:3001/mcp')
    await page.click('button:has-text("Connect")')
    await expect(page.locator('text=✅ Connected')).toBeVisible({
      timeout: 10000,
    })

    // Select get_time tool
    await page.click('text=get_time')

    // Execute tool with empty args
    await page.click('button:has-text("Execute Tool")')

    // Verify result contains timestamp
    await expect(page.locator('text=✅ Success')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('pre.result-content')).toContainText('"time"')
    await expect(page.locator('pre.result-content')).toContainText(
      '"timestamp"'
    )
  })

  test('should execute reverse_text tool via MCP', async ({ page }) => {
    // Navigate to MCP tab and connect
    await page.click('text=MCP Tools')
    await page.fill('input[id="server-url"]', 'http://localhost:3001/mcp')
    await page.click('button:has-text("Connect")')
    await expect(page.locator('text=✅ Connected')).toBeVisible({
      timeout: 10000,
    })

    // Select reverse_text tool
    await page.click('text=reverse_text')

    // Input JSON arguments
    await page.fill(
      'textarea[id="tool-input"]',
      '{ "text": "Hello World" }'
    )

    // Execute tool
    await page.click('button:has-text("Execute Tool")')

    // Verify result
    await expect(page.locator('text=✅ Success')).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator('pre.result-content')).toContainText(
      '"original"'
    )
    await expect(page.locator('pre.result-content')).toContainText(
      'Hello World'
    )
    await expect(page.locator('pre.result-content')).toContainText(
      '"reversed"'
    )
    await expect(page.locator('pre.result-content')).toContainText(
      'dlroW olleH'
    )
  })

  test('should disconnect from MCP server', async ({ page }) => {
    // Navigate to MCP tab and connect
    await page.click('text=MCP Tools')
    await page.fill('input[id="server-url"]', 'http://localhost:3001/mcp')
    await page.click('button:has-text("Connect")')
    await expect(page.locator('text=✅ Connected')).toBeVisible({
      timeout: 10000,
    })

    // Disconnect
    await page.click('button:has-text("Disconnect")')

    // Verify disconnect
    await expect(page.locator('button:has-text("Connect")')).toBeVisible()
    await expect(page.locator('text=✅ Connected')).not.toBeVisible()
  })
})
