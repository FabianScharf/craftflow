import { hole, schuss } from './stripe-hilfe.mjs'
const { browser, seite } = await hole(process.argv[2] ?? 'dashboard.stripe.com')
await seite.bringToFront()
await new Promise(r => setTimeout(r, 800))
console.log('URL:', seite.url())
await schuss(seite, process.argv[3] ?? '.tmp-cu/stripe.png')
await browser.disconnect()
