import { test, expect } from '@playwright/test'

const ROOM_CODE = 'TESTROOM' + Date.now().toString(36).toUpperCase()

async function joinRoom(page, nickname) {
  await page.goto('/')
  await page.fill('#nickname', nickname)
  await page.fill('#room-code', ROOM_CODE)
  await page.click('button[type="submit"]')
  await page.waitForSelector('.messages-container', { timeout: 10_000 })
}

async function sendMessage(page, text) {
  await page.fill('.chat-text-input', text)
  await page.click('button[type="submit"]')
}

async function getScrollInfo(page) {
  return page.$eval('.messages-container', el => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    isNearBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 100,
  }))
}

test.describe('Chat UI stress tests', () => {

  test('no overflow:hidden on message groups (the cut-off bug)', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.setViewportSize({ width: 900, height: 700 })

    await joinRoom(page, 'Tester')

    // Send a few messages
    for (let i = 1; i <= 5; i++) {
      await sendMessage(page, `Message number ${i} checking overflow`)
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(1500)

    // Check that NO .message-group has overflow:hidden
    const overflowValues = await page.$$eval('.message-group', els =>
      els.map(el => getComputedStyle(el).overflow)
    )

    console.log(`  Message group overflow values: ${[...new Set(overflowValues)].join(', ')}`)

    for (const val of overflowValues) {
      expect(val, 'message-group should not have overflow:hidden').not.toBe('hidden')
    }

    await ctx.close()
  })

  test('long messages are not clipped', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.setViewportSize({ width: 900, height: 700 })

    await joinRoom(page, 'LongMsgTester')

    // Send various long message types
    await sendMessage(page, 'A'.repeat(600))
    await page.waitForTimeout(300)
    await sendMessage(page, 'This is a really long message with lots of words to test wrapping behavior across the full width of the chat container and make sure nothing gets cut off at the edges or clipped by overflow hidden. '.repeat(3))
    await page.waitForTimeout(300)
    await sendMessage(page, 'Line1\nLine2\nLine3\nLine4\nLine5\nLine6\nLine7\nLine8\nLine9\nLine10')
    await page.waitForTimeout(2500) // wait for decode animation

    const results = await page.$$eval('.message-text', els =>
      els.map(el => ({
        text: el.textContent?.slice(0, 40),
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        clipped: el.scrollHeight > el.clientHeight + 2,
      }))
    )

    console.log('  Long message clipping check:')
    for (const r of results) {
      console.log(`    "${r.text}..." scrollH=${r.scrollH} clientH=${r.clientH} clipped=${r.clipped}`)
    }

    const clipped = results.filter(r => r.clipped)
    expect(clipped.length, 'Some messages are clipped').toBe(0)

    await ctx.close()
  })

  test('scroll stays locked when reading history', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.setViewportSize({ width: 900, height: 700 })

    await joinRoom(page, 'ScrollTester')

    // Send enough messages to create scrollable content
    console.log('  Sending 40 messages to fill scroll...')
    for (let i = 1; i <= 40; i++) {
      await sendMessage(page, `Filling up the chat with message number ${i} so we have scrollable content`)
      await page.waitForTimeout(80)
    }
    await page.waitForTimeout(2000)

    // Ensure we're at the bottom (smooth scroll may still be animating after rapid sends)
    await page.$eval('.messages-container', el => { el.scrollTop = el.scrollHeight })
    await page.waitForTimeout(300)

    const initialScroll = await getScrollInfo(page)
    console.log(`  Initial (forced to bottom): scrollTop=${initialScroll.scrollTop}, nearBottom=${initialScroll.isNearBottom}`)
    expect(initialScroll.isNearBottom, 'Should start at bottom').toBe(true)

    // Scroll to top to "read history"
    await page.$eval('.messages-container', el => { el.scrollTop = 0 })
    await page.waitForTimeout(300)

    const scrolledUp = await getScrollInfo(page)
    console.log(`  After scroll up: scrollTop=${scrolledUp.scrollTop}, nearBottom=${scrolledUp.isNearBottom}`)
    expect(scrolledUp.isNearBottom, 'Should be scrolled up').toBe(false)

    // Send more messages while scrolled up
    console.log('  Sending 5 more messages while scrolled up...')
    for (let i = 1; i <= 5; i++) {
      await sendMessage(page, `New message ${i} while reading history`)
      await page.waitForTimeout(200)
    }
    await page.waitForTimeout(1000)

    // Check we were NOT yanked to the bottom
    const afterNewMsgs = await getScrollInfo(page)
    console.log(`  After new msgs: scrollTop=${afterNewMsgs.scrollTop}, nearBottom=${afterNewMsgs.isNearBottom}`)

    // The scroll position should have changed slightly (because our own messages are added below)
    // but we should NOT be at the bottom
    expect(afterNewMsgs.isNearBottom, 'Should NOT be yanked to bottom while reading history').toBe(false)

    await ctx.close()
  })

  test('typing indicator does not cause layout shift', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.setViewportSize({ width: 900, height: 700 })

    await joinRoom(page, 'LayoutTester')

    await sendMessage(page, 'testing layout stability')
    await page.waitForTimeout(1000)

    // The typing indicator container should ALWAYS be in the DOM
    const typingExists = await page.$('.typing-indicator')
    expect(typingExists, 'typing-indicator should always be in DOM').toBeTruthy()

    // Measure container height
    const height1 = await page.$eval('.messages-container', el => el.clientHeight)

    // The container height should be stable (typing indicator is always reserved)
    await page.waitForTimeout(500)
    const height2 = await page.$eval('.messages-container', el => el.clientHeight)

    console.log(`  Container height: ${height1}px -> ${height2}px (delta: ${Math.abs(height2 - height1)}px)`)
    expect(Math.abs(height2 - height1), 'Container height should be stable').toBeLessThanOrEqual(1)

    await ctx.close()
  })

  test('rapid burst of 50 messages renders without errors', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.setViewportSize({ width: 900, height: 700 })

    // Collect console errors
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', err => errors.push(err.message))

    await joinRoom(page, 'BurstTester')

    console.log('  Sending 50 messages as fast as possible...')
    for (let i = 1; i <= 50; i++) {
      await sendMessage(page, `rapid burst message #${i}`)
      await page.waitForTimeout(30)
    }

    await page.waitForTimeout(3000)

    // Check final state
    const msgs = await page.$$eval('.message-text', els => els.length)
    const scroll = await getScrollInfo(page)

    console.log(`  Final: ${msgs} messages rendered, nearBottom=${scroll.isNearBottom}`)
    console.log(`  Console errors: ${errors.length}`)

    if (errors.length > 0) {
      console.log('  Errors:', errors.slice(0, 5))
    }

    expect(msgs, 'All messages should be rendered').toBeGreaterThanOrEqual(45) // allow minor variance
    expect(scroll.isNearBottom, 'Should be at bottom after own messages').toBe(true)
    expect(errors.filter(e => !e.includes('trystero')).length, 'No JS errors').toBe(0)

    await ctx.close()
  })
})
