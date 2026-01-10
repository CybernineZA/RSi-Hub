// Compatibility wrapper: some pages import YardClient from '/app/app/yard-client'
// while the actual implementation lives in '/app/app/yard/yard-client'.
export { default } from './yard/yard-client'
